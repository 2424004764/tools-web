<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { fixedExpenseApi } from './api'
import type { FixedExpense, FixedExpenseStatistics } from './types'
import { EXPENSE_CATEGORIES, getCategoryMeta } from './types'
import { useUserStore } from '@/store/modules/user'

const info = { title: '每月固定开销' }

const defaultStatistics: FixedExpenseStatistics = {
  totalCount: 0,
  activeCount: 0,
  monthlyTotal: 0,
  yearlyTotal: 0,
  byCategory: [],
  nextBilling: null,
  upcoming: [],
  averagePerItem: 0,
  maxItem: null,
  minItem: null,
  currentMonth: ''
}

// 状态
const items = ref<FixedExpense[]>([])
const statistics = ref<FixedExpenseStatistics>(defaultStatistics)

const notLoggedIn = ref(false)
const loading = ref(false)
const submitLoading = ref(false)
const toggleLoadingId = ref<string | null>(null)

const showAddDialog = ref(false)
const showEditDialog = ref(false)
const editingItem = ref<FixedExpense | null>(null)

const categoryFilter = ref<string>('')
const activeFilter = ref<'' | 'active' | 'inactive'>('')

const formRef = ref<any>()
const editFormRef = ref<any>()

const itemForm = ref({
  name: '',
  amount: '',
  category: 'housing',
  billingDay: '',
  startDate: '',
  endDate: '',
  note: '',
  isActive: true
})

const userStore = useUserStore()

// 工具函数
const formatMoney = (val: number | null | undefined, decimals = 2): string => {
  if (val === null || val === undefined) return '--'
  return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatMoneyShort = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '--'
  if (val >= 10000) return `${(val / 10000).toFixed(1)} 万`
  return formatMoney(val, 0)
}

const parseAmount = (s: string): number => parseFloat(String(s).replace(/,/g, ''))

// 列表（应用筛选 + 排序）
const filteredItems = computed(() => {
  let list = [...items.value]
  if (categoryFilter.value) list = list.filter(i => (i.category || 'other') === categoryFilter.value)
  if (activeFilter.value === 'active') list = list.filter(i => i.isActive === 1)
  if (activeFilter.value === 'inactive') list = list.filter(i => i.isActive === 0)
  // 排序：有效优先 + 扣款日升序
  list.sort((a, b) => {
    if (a.isActive !== b.isActive) return b.isActive - a.isActive
    const ad = a.billingDay || 32
    const bd = b.billingDay || 32
    if (ad !== bd) return ad - bd
    return a.name.localeCompare(b.name)
  })
  return list
})

// 操作中的总开销（基于过滤后）
const filteredTotal = computed(() =>
  filteredItems.value
    .filter(i => i.isActive === 1)
    .reduce((s, i) => s + (i.amount || 0), 0)
)

// 图表
const chartRef = ref<HTMLElement>()
let chartInstance: ECharts | null = null

const renderChart = () => {
  if (!chartInstance) return
  const list = statistics.value.byCategory || []
  if (list.length === 0) {
    chartInstance.clear()
    chartInstance.setOption({ series: [] }, { notMerge: true })
    return
  }
  const data = list.map(c => ({
    name: getCategoryMeta(c.category).label,
    value: c.amount,
    itemStyle: { color: c.color }
  }))
  chartInstance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.marker} ${p.name}<br/>¥${formatMoney(p.value)} (${p.percent.toFixed(2)}%)`
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['55%', '78%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      data,
      animationType: 'scale',
      animationEasing: 'elasticOut'
    }]
  }, { notMerge: true })
}

const initChart = () => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  renderChart()
}

const handleResize = () => chartInstance?.resize()

// ===== 数据加载 =====
const fetchItems = async () => {
  loading.value = true
  try {
    const data = await fixedExpenseApi.getList()
    items.value = Array.isArray(data) ? data : []
  } catch {
    ElMessage.error('获取开销列表失败')
    items.value = []
  } finally {
    loading.value = false
  }
}

const fetchStatistics = async () => {
  try {
    const data = await fixedExpenseApi.getStatistics()
    statistics.value = data || defaultStatistics
    nextTick(() => renderChart())
  } catch {
    statistics.value = defaultStatistics
  }
}

const refreshAll = async () => {
  await Promise.all([fetchItems(), fetchStatistics()])
}

// ===== 操作 =====
const openAddDialog = () => {
  itemForm.value = {
    name: '',
    amount: '',
    category: 'housing',
    billingDay: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    note: '',
    isActive: true
  }
  formRef.value?.clearValidate()
  showAddDialog.value = true
}

const handleAdd = async () => {
  if (!itemForm.value.name || !itemForm.value.name.trim()) {
    ElMessage.warning('请输入开销名称')
    return
  }
  const amount = parseAmount(itemForm.value.amount)
  if (isNaN(amount) || amount <= 0 || amount > 10000000) {
    ElMessage.warning('请输入有效金额（0-10000000 元）')
    return
  }
  const billingDay = itemForm.value.billingDay ? parseInt(itemForm.value.billingDay) : null
  if (billingDay !== null && (billingDay < 1 || billingDay > 31)) {
    ElMessage.warning('扣款日必须是 1-31 之间的数字')
    return
  }

  submitLoading.value = true
  try {
    await fixedExpenseApi.create({
      name: itemForm.value.name.trim(),
      amount,
      category: itemForm.value.category || null,
      billingDay,
      startDate: itemForm.value.startDate,
      endDate: itemForm.value.endDate || null,
      note: itemForm.value.note || '',
      isActive: itemForm.value.isActive ? 1 : 0
    } as any)
    ElMessage.success('添加成功')
    showAddDialog.value = false
    await refreshAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '添加失败')
  } finally {
    submitLoading.value = false
  }
}

const openEditDialog = (item: FixedExpense) => {
  editingItem.value = { ...item }
  itemForm.value = {
    name: item.name,
    amount: String(item.amount),
    category: item.category || 'housing',
    billingDay: item.billingDay ? String(item.billingDay) : '',
    startDate: item.startDate,
    endDate: item.endDate || '',
    note: item.note || '',
    isActive: item.isActive === 1
  }
  editFormRef.value?.clearValidate()
  showEditDialog.value = true
}

const handleUpdate = async () => {
  if (!editingItem.value) return
  if (!itemForm.value.name || !itemForm.value.name.trim()) {
    ElMessage.warning('请输入开销名称')
    return
  }
  const amount = parseAmount(itemForm.value.amount)
  if (isNaN(amount) || amount <= 0 || amount > 10000000) {
    ElMessage.warning('请输入有效金额')
    return
  }
  const billingDay = itemForm.value.billingDay ? parseInt(itemForm.value.billingDay) : null
  if (billingDay !== null && (billingDay < 1 || billingDay > 31)) {
    ElMessage.warning('扣款日必须是 1-31 之间的数字')
    return
  }

  submitLoading.value = true
  try {
    await fixedExpenseApi.update(editingItem.value.id, {
      name: itemForm.value.name.trim(),
      amount,
      category: itemForm.value.category || null,
      billingDay,
      startDate: itemForm.value.startDate,
      endDate: itemForm.value.endDate || null,
      note: itemForm.value.note || '',
      isActive: itemForm.value.isActive ? 1 : 0
    } as any)
    ElMessage.success('更新成功')
    showEditDialog.value = false
    editingItem.value = null
    await refreshAll()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (item: FixedExpense) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${item.name}」吗？此操作不可恢复。`,
      '提示',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await fixedExpenseApi.delete(item.id)
    ElMessage.success('删除成功')
    await refreshAll()
  } catch {
    ElMessage.error('删除失败')
  }
}

const handleToggleActive = async (item: FixedExpense) => {
  toggleLoadingId.value = item.id
  try {
    await fixedExpenseApi.update(item.id, { isActive: item.isActive === 1 ? 0 : 1 })
    await refreshAll()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    toggleLoadingId.value = null
  }
}

const handleShare = async () => {
  const card = document.querySelector('.fe-share-card') as HTMLElement
  if (!card) {
    ElMessage.warning('请先生成汇总卡片')
    return
  }
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(card)
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `每月固定开销_${statistics.value.currentMonth || ''}.png`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('图片已保存')
      }
    })
  } catch {
    ElMessage.error('分享失败，请稍后重试')
  }
}

const handleExport = async () => {
  try {
    const blob = await fixedExpenseApi.exportData()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `固定开销_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

const goToLogin = () => { window.location.href = '/login?redirect=/fixed-expenses/' }

// 切换分类筛选 → 重置图表
watch(categoryFilter, () => nextTick(() => renderChart()))

onMounted(async () => {
  userStore.initUserState()
  if (!userStore.isLoggedIn) {
    notLoggedIn.value = true
    return
  }
  await fetchItems()
  await fetchStatistics()
  nextTick(() => initChart())
  window.addEventListener('resize', handleResize)
})

// 卸载
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-pink-50">
    <DetailHeader :title="info.title" />

    <!-- 未登录 -->
    <div v-if="notLoggedIn" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4">🔒</div>
      <h3 class="text-h3 font-bold text-white mb-3">请先登录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">固定开销属于个人财务数据，登录后加密保存到您的账户</p>
      <el-button size="large" class="!bg-white !text-rose-600 !border-none hover:!bg-gray-100" @click="goToLogin">
        <el-icon class="mr-1"><Promotion /></el-icon> 前往登录
      </el-button>
    </div>

    <div v-else class="px-3 sm:px-0 pb-6 space-y-4 sm:space-y-6">
      <!-- 月度总开销大卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6">
        <div class="fe-share-card p-6 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div class="relative">
            <div class="flex items-center justify-between mb-3">
              <span class="text-white/80 text-body-sm">本月固定开销 · {{ statistics.currentMonth || '--' }}</span>
              <span class="tag-capsule bg-white/20 text-white">{{ statistics.activeCount }} 项有效</span>
            </div>
            <div class="flex items-end gap-2 mb-3">
              <span class="text-body-sm text-white/80 pb-3">¥</span>
              <span class="text-5xl font-bold">{{ formatMoney(statistics.monthlyTotal) }}</span>
              <span class="text-h3 text-white/80 pb-2">/ 月</span>
            </div>
            <div class="flex items-center gap-4 text-body-sm flex-wrap">
              <span class="flex items-center gap-1">
                <el-icon><Coin /></el-icon>
                年度预估
                <span class="font-bold text-amber-200">¥{{ formatMoneyShort(statistics.yearlyTotal) }}</span>
              </span>
              <span class="flex items-center gap-1">
                <el-icon><DataLine /></el-icon>
                平均每项
                <span class="font-bold">¥{{ formatMoney(statistics.averagePerItem) }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 工具栏 -->
        <div class="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <el-select v-model="categoryFilter" placeholder="全部分类" clearable size="default" class="!w-36">
              <el-option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" :label="`${c.emoji} ${c.label}`" />
            </el-select>
            <el-select v-model="activeFilter" placeholder="全部状态" clearable size="default" class="!w-32">
              <el-option value="active" label="启用中" />
              <el-option value="inactive" label="已停用" />
            </el-select>
          </div>
          <div class="flex items-center gap-2">
            <el-button @click="handleExport">
              <el-icon><Download /></el-icon> 导出
            </el-button>
            <button class="main-btn text-white px-5 py-2 rounded-xl font-medium flex items-center gap-1" @click="openAddDialog">
              <el-icon><Plus /></el-icon> 添加
            </button>
          </div>
        </div>
      </div>

      <!-- 分类 + 即将扣款 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <!-- 分类汇总 -->
        <div class="glass-card-dark rounded-3xl p-4 sm:p-6 lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-h3">🥧</span>
              <span class="font-semibold text-gray-700">分类占比</span>
            </div>
            <el-button link class="!text-rose-600 !font-medium" :loading="loading" @click="handleShare">
              <el-icon><Share /></el-icon> 分享汇总
            </el-button>
          </div>
          <div v-if="statistics.byCategory.length === 0" class="py-12 text-center text-gray-400">
            <div class="text-5xl mb-3">🍩</div>
            添加开销后在此查看分类占比
          </div>
          <div v-else class="grid sm:grid-cols-2 gap-4 items-center">
            <div ref="chartRef" class="h-56 sm:h-64"></div>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              <div v-for="c in statistics.byCategory" :key="c.category" class="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-gray-50">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <span class="inline-block w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: c.color }"></span>
                  <span class="text-body-sm truncate">{{ getCategoryMeta(c.category).emoji }} {{ getCategoryMeta(c.category).label }}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-body-sm font-bold text-gray-700">¥{{ formatMoneyShort(c.amount) }}</span>
                  <span class="text-caption text-gray-400 w-10 text-right">{{ c.percentage.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 即将扣款 -->
        <div class="glass-card-dark rounded-3xl p-4 sm:p-6">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-h3">⏰</span>
            <span class="font-semibold text-gray-700">即将扣款</span>
          </div>
          <div v-if="!statistics.nextBilling && statistics.upcoming.length === 0" class="py-12 text-center text-gray-400">
            <div class="text-5xl mb-3">📅</div>
            <p class="text-body-sm">暂无即将扣款项目</p>
            <p class="text-caption mt-1">添加扣款日后会在此提醒</p>
          </div>
          <div v-else class="space-y-2">
            <div v-if="statistics.nextBilling" class="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 mb-3">
              <div class="text-caption text-rose-600 font-medium mb-1">下一笔</div>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-gray-800 truncate">{{ statistics.nextBilling.name }}</span>
                <span class="font-bold text-rose-600">¥{{ formatMoney(statistics.nextBilling.amount) }}</span>
              </div>
              <div class="text-caption text-gray-500 mt-1">
                {{ statistics.nextBilling.date }}（{{ statistics.nextBilling.billingDay }} 号扣款）
              </div>
            </div>
            <div v-for="u in statistics.upcoming" :key="u.id" class="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50">
              <div class="min-w-0 flex-1">
                <div class="text-body-sm font-medium text-gray-700 truncate">{{ u.name }}</div>
                <div class="text-caption text-gray-400">{{ u.date }}</div>
              </div>
              <span class="font-bold text-gray-700 flex-shrink-0">¥{{ formatMoney(u.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 开销列表 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="text-h3">📋</span>
            <span class="font-semibold text-gray-700">开销列表</span>
            <span class="text-caption text-gray-400">共 {{ filteredItems.length }} 项 · 筛选合计 ¥{{ formatMoney(filteredTotal) }} / 月</span>
          </div>
        </div>

        <div v-if="loading" class="text-center py-12">
          <el-icon class="is-loading text-4xl text-rose-500"><Loading /></el-icon>
          <p class="text-gray-400 text-body-sm mt-2">加载中...</p>
        </div>
        <div v-else-if="filteredItems.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">💸</div>
          <p class="text-gray-400">{{ items.length === 0 ? '暂无开销，点击「添加」开始记录吧~' : '没有符合条件的开销' }}</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="expense-card relative p-4 rounded-2xl border bg-white transition-all"
            :class="item.isActive === 1 ? 'border-gray-100' : 'border-gray-200 opacity-60'"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span
                  class="cat-badge flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-body"
                  :style="{ backgroundColor: getCategoryMeta(item.category).color + '22', color: getCategoryMeta(item.category).color }"
                >
                  {{ getCategoryMeta(item.category).emoji }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-gray-800 truncate">{{ item.name }}</div>
                  <div class="text-caption text-gray-400">{{ getCategoryMeta(item.category).label }}</div>
                </div>
              </div>
              <el-switch
                :model-value="item.isActive === 1"
                :loading="toggleLoadingId === item.id"
                @change="handleToggleActive(item)"
                size="small"
              />
            </div>

            <div class="mb-2">
              <div class="flex items-baseline gap-1">
                <span class="text-caption text-gray-400">¥</span>
                <span class="text-h3 font-bold" :class="item.isActive === 1 ? 'text-rose-600' : 'text-gray-400'">
                  {{ formatMoney(item.amount, item.amount % 1 === 0 ? 0 : 2) }}
                </span>
                <span class="text-caption text-gray-400">/ 月</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-caption mb-2">
              <div v-if="item.billingDay" class="flex items-center gap-1 text-gray-500">
                <el-icon><Calendar /></el-icon>
                <span>每月 {{ item.billingDay }} 号</span>
              </div>
              <div class="flex items-center gap-1 text-gray-500">
                <el-icon><Clock /></el-icon>
                <span>{{ item.startDate }} 起</span>
              </div>
              <div v-if="item.endDate" class="flex items-center gap-1 text-amber-600 col-span-2">
                <el-icon><BellFilled /></el-icon>
                <span>{{ item.endDate }} 到期</span>
              </div>
            </div>

            <div v-if="item.note" class="text-caption text-gray-400 bg-gray-50 rounded-lg px-2 py-1 mb-3 truncate">
              {{ item.note }}
            </div>

            <div class="flex justify-end gap-1 pt-2 border-t border-gray-50">
              <el-button link class="!text-rose-500" size="small" @click="openEditDialog(item)">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-button link class="!text-gray-400 hover:!text-rose-500" size="small" @click="handleDelete(item)">
                <el-icon><Delete /></el-icon> 删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加对话框 -->
    <el-dialog v-model="showAddDialog" title="添加固定开销" width="92%" :style="{ maxWidth: '480px' }" :close-on-click-modal="false">
      <el-form ref="formRef" label-width="84px">
        <el-form-item label="名称" required>
          <el-input v-model="itemForm.name" placeholder="如：房租 / 健身卡 / 视频会员" maxlength="50" show-word-limit clearable :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="月金额" required>
          <el-input v-model="itemForm.amount" placeholder="如：1500" type="number" :disabled="submitLoading">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="itemForm.category" placeholder="选择分类" style="width: 100%" :disabled="submitLoading">
            <el-option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" :label="`${c.emoji} ${c.label}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="扣款日">
          <el-input-number v-model="itemForm.billingDay" :min="1" :max="31" placeholder="1-31" controls-position="right" style="width: 100%" :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="启用日期">
          <el-date-picker v-model="itemForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="itemForm.endDate" type="date" value-format="YYYY-MM-DD" placeholder="可选（分期类）" style="width: 100%" clearable :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.note" type="textarea" :rows="2" placeholder="可选" maxlength="500" show-word-limit :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="itemForm.isActive" :disabled="submitLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false" :disabled="submitLoading">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleAdd">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑开销" width="92%" :style="{ maxWidth: '480px' }" :close-on-click-modal="false">
      <el-form ref="editFormRef" label-width="84px">
        <el-form-item label="名称" required>
          <el-input v-model="itemForm.name" maxlength="50" show-word-limit clearable :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="月金额" required>
          <el-input v-model="itemForm.amount" type="number" :disabled="submitLoading">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="itemForm.category" style="width: 100%" :disabled="submitLoading">
            <el-option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" :label="`${c.emoji} ${c.label}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="扣款日">
          <el-input-number v-model="itemForm.billingDay" :min="1" :max="31" controls-position="right" style="width: 100%" :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="启用日期">
          <el-date-picker v-model="itemForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="itemForm.endDate" type="date" value-format="YYYY-MM-DD" placeholder="可选" style="width: 100%" clearable :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.note" type="textarea" :rows="2" maxlength="500" show-word-limit :disabled="submitLoading" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="itemForm.isActive" :disabled="submitLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false" :disabled="submitLoading">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleUpdate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4 text-gray-600">
        <p class="text-gray-700">每月固定开销是一款帮助你梳理刚性支出的轻量工具。把所有"每月都会出现"的开销（房租、水电、订阅、贷款、保险等）记录下来，自动汇总成当月与年度总额，用分类饼图看清支出结构，用扣款日提醒提前准备资金。</p>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span class="text-body-lg">✨</span> 主要功能
          </h4>
          <div class="grid sm:grid-cols-2 gap-2 ml-6">
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>月度汇总</strong>：本月合计 + 年度预估（×12），所有有效项目自动汇总</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>分类饼图</strong>：订阅/住房/贷款/保险等一目了然，识别可优化项</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>扣款日提醒</strong>：提前 7 天显示即将扣款项目，配合工资到账日排程</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>启用/停用切换</strong>：一次性购买的会员可停用不删，保留历史</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>启用/结束日期</strong>：支持分期类支出（如 12 期健身卡），到期自动失效</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-rose-500">•</span>
              <span><strong>分享/导出</strong>：月度汇总支持导出为 PNG 或 JSON 备份</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-rose-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">💡</span> 使用建议
          </h4>
          <p class="text-body-sm">建议每月初（例如发工资当天）打开本工具，把上月新增/失效的固定开销做一次维护。扣款日尽量填实际扣款日而不是宽泛的"中旬"，便于精确提醒。分期类支出务必填写结束日期，到期后该项会自动从月度合计中剔除。</p>
        </div>

        <div class="p-3 bg-fuchsia-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">🔒</span> 隐私保护
          </h4>
          <p class="text-body-sm">财务数据属于高度敏感信息，本工具数据加密保存在你的登录账户下，请妥善保管登录凭证。需要彻底删除时，可逐条删除或联系管理员清除账号数据。</p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import Coin from '~icons/ep/coin'
import DataLine from '~icons/ep/data-line'
import Loading from '~icons/ep/loading'
import Plus from '~icons/ep/plus'
import Promotion from '~icons/ep/promotion'
import Share from '~icons/ep/share'
import Calendar from '~icons/ep/calendar'
import Clock from '~icons/ep/clock'
import BellFilled from '~icons/ep/bell-filled'
import Download from '~icons/ep/download'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
export default {
  components: { Coin, DataLine, Loading, Plus, Promotion, Share, Calendar, Clock, BellFilled, Download, Edit, Delete }
}
</script>

<style scoped>
.glass-card-dark {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.expense-card {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}
.expense-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(244, 63, 94, 0.08);
  border-left-color: #f43f5e;
}

.main-btn {
  background: linear-gradient(135deg, #f43f5e 0%, #d946ef 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(244, 63, 94, 0.3);
  transition: all 0.3s ease;
}
.main-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(244, 63, 94, 0.4);
}

.tag-capsule {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

:deep(.el-dialog) {
  border-radius: 16px !important;
}
:deep(.el-dialog__header) {
  padding: 20px 24px 16px !important;
  margin: 0 !important;
  border-bottom: 1px solid #f0f0f0;
}
:deep(.el-dialog__body) {
  padding: 20px 24px !important;
}
:deep(.el-dialog__footer) {
  padding: 16px 24px 20px !important;
  border-top: 1px solid #f0f0f0;
}
:deep(.el-dialog__title) {
  font-weight: 600;
  color: #1a1a2e;
}
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #f43f5e 0%, #d946ef 100%);
  border: none;
}
:deep(.el-button--primary:hover) {
  box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
}
:deep(.is-loading) {
  animation: fe-pulse 1.5s ease-in-out infinite;
}
@keyframes fe-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
