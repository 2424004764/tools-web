<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { priceComparisonApi } from './api'
import type { PriceItem, PriceEntry, PriceStatistics } from './types'
import {
  ITEM_STATUS, ITEM_STATUS_LABEL, ITEM_STATUS_COLOR,
  ENTRY_STATUS, ENTRY_STATUS_LABEL, ENTRY_STATUS_COLOR,
  CATEGORY_LIST, getCategoryMeta
} from './types'
import { useUserStore } from '@/store/modules/user'

const info = { title: '物品比价' }

const DEFAULT_STATISTICS: PriceStatistics = {
  totalItems: 0,
  comparingCount: 0,
  purchasedCount: 0,
  cancelledCount: 0,
  totalEntries: 0,
  purchasedEntries: 0,
  totalSpent: 0,
  totalPotentialSaved: 0,
  byCategory: [],
  cheapestItems: [],
  recentItems: []
}

// ===== 状态 =====
const items = ref<PriceItem[]>([])
const statistics = ref<PriceStatistics>(DEFAULT_STATISTICS)
const notLoggedIn = ref(false)
const isFirstTime = ref(false)
const loading = ref(false)

const createLoading = ref(false)
const updateLoading = ref(false)
const deleteLoading = ref(false)
const createEntryLoading = ref(false)
const updateEntryLoading = ref(false)
const deleteEntryLoading = ref(false)
const shareLoading = ref(false)

// 筛选
const filterStatus = ref<number | ''>('')
const filterCategory = ref<string>('')
const searchKeyword = ref('')

// 展开状态（仅展开一个物品查看条目）
const expandedItemId = ref<string>('')

// 物品对话框
const showItemDialog = ref(false)
const editingItem = ref<PriceItem | null>(null)
const itemForm = ref({
  name: '',
  category: 'other',
  spec: '',
  note: ''
})

// 条目对话框
const showEntryDialog = ref(false)
const editingEntry = ref<PriceEntry | null>(null)
const entryFormContext = ref<{ itemId: string }>({ itemId: '' })
const entryForm = ref<{
  platform: string
  unitPrice: string
  shippingFee: string
  discount: string
  quantity: string
  currency: string
  status: number
  purchaseDate: string
  link: string
  seller: string
  note: string
  isChosen: number
}>({
  platform: '',
  unitPrice: '',
  shippingFee: '0',
  discount: '0',
  quantity: '1',
  currency: 'CNY',
  status: ENTRY_STATUS.PENDING,
  purchaseDate: '',
  link: '',
  seller: '',
  note: '',
  isChosen: 0
})

// 统计报告弹窗
const showReportDialog = ref(false)

const userStore = useUserStore()
const goToLogin = () => { window.location.href = '/login?redirect=/price-comparison/' }

// ===== 计算属性 =====
const formatMoney = (val: number | null | undefined, decimals = 2): string => {
  if (val === null || val === undefined) return '--'
  return Number(val).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatMoneyInt = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '--'
  return Number(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const filteredItems = computed(() => {
  let list = items.value || []
  if (filterStatus.value !== '') {
    list = list.filter(i => Number(i.status) === Number(filterStatus.value))
  }
  if (filterCategory.value) {
    list = list.filter(i => (i.category || 'other') === filterCategory.value)
  }
  if (searchKeyword.value && searchKeyword.value.trim()) {
    const k = searchKeyword.value.trim().toLowerCase()
    list = list.filter(i =>
      (i.name || '').toLowerCase().includes(k) ||
      (i.spec || '').toLowerCase().includes(k) ||
      (i.note || '').toLowerCase().includes(k) ||
      (i.entries || []).some(e => (e.platform || '').toLowerCase().includes(k) || (e.seller || '').toLowerCase().includes(k))
    )
  }
  return list
})

// 当前展示统计（按筛选过滤后）
const filteredStats = computed(() => {
  const list = filteredItems.value
  let totalSpent = 0
  let totalPotentialSaved = 0
  const purchasedItems = list.filter(i => Number(i.status) === ITEM_STATUS.PURCHASED)
  purchasedItems.forEach(it => {
    if (it.chosenEntry) {
      totalSpent += Number(it.chosenEntry.finalPrice || 0)
      if (it.entries.length >= 2) {
        const others = it.entries.filter(e => e.id !== it.chosenEntry!.id)
        const maxOther = Math.max(...others.map(o => Number(o.finalPrice || 0)))
        if (maxOther > Number(it.chosenEntry.finalPrice)) {
          totalPotentialSaved += (maxOther - Number(it.chosenEntry.finalPrice))
        }
      }
    }
  })
  return {
    count: list.length,
    purchasedCount: purchasedItems.length,
    comparingCount: list.filter(i => Number(i.status) === ITEM_STATUS.COMPARING).length,
    totalSpent: Number(totalSpent.toFixed(2)),
    totalPotentialSaved: Number(totalPotentialSaved.toFixed(2))
  }
})

// ===== 数据加载 =====
const fetchItems = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value !== '') params.status = filterStatus.value
    if (filterCategory.value) params.category = filterCategory.value
    if (searchKeyword.value && searchKeyword.value.trim()) params.keyword = searchKeyword.value.trim()
    const data = await priceComparisonApi.getItems(params)
    items.value = Array.isArray(data) ? data : []
    isFirstTime.value = items.value.length === 0 && !filterStatus.value && !filterCategory.value && !searchKeyword.value.trim()
  } catch {
    ElMessage.error('获取比价物品失败')
    items.value = []
  } finally {
    loading.value = false
  }
}

const fetchStatistics = async () => {
  try {
    const data = await priceComparisonApi.getStatistics()
    statistics.value = data || DEFAULT_STATISTICS
  } catch {
    statistics.value = DEFAULT_STATISTICS
  }
}

const refreshAll = async () => {
  await Promise.all([fetchItems(), fetchStatistics()])
}

// ===== 物品对话框 =====
const openItemDialog = (item: PriceItem | null = null) => {
  if (item) {
    editingItem.value = item
    itemForm.value = {
      name: item.name || '',
      category: item.category || 'other',
      spec: item.spec || '',
      note: item.note || ''
    }
  } else {
    editingItem.value = null
    itemForm.value = {
      name: '',
      category: 'other',
      spec: '',
      note: ''
    }
  }
  showItemDialog.value = true
}

const handleSaveItem = async () => {
  if (!itemForm.value.name || !itemForm.value.name.trim()) {
    ElMessage.warning('请输入物品名称')
    return
  }
  if (itemForm.value.name.length > 100) {
    ElMessage.warning('物品名称不能超过100个字符')
    return
  }
  createLoading.value = !editingItem.value
  updateLoading.value = !!editingItem.value
  try {
    if (editingItem.value) {
      await priceComparisonApi.updateItem(editingItem.value.id, {
        name: itemForm.value.name.trim(),
        category: itemForm.value.category || null,
        spec: itemForm.value.spec || null,
        note: itemForm.value.note || ''
      })
      ElMessage.success('物品已更新')
    } else {
      await priceComparisonApi.createItem({
        name: itemForm.value.name.trim(),
        category: itemForm.value.category || null,
        spec: itemForm.value.spec || null,
        note: itemForm.value.note || '',
        status: ITEM_STATUS.COMPARING
      })
      ElMessage.success('物品已添加')
    }
    showItemDialog.value = false
    await refreshAll()
  } catch (e: any) {
    const msg = e?.response?.data?.error || (editingItem.value ? '更新失败' : '添加失败')
    ElMessage.error(msg)
  } finally {
    createLoading.value = false
    updateLoading.value = false
  }
}

const handleDeleteItem = async (item: PriceItem) => {
  try {
    await ElMessageBox.confirm(
      `确定删除物品「${item.name}」吗？这将同时删除该物品的所有平台价格记录。`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  deleteLoading.value = true
  try {
    await priceComparisonApi.deleteItem(item.id)
    ElMessage.success('物品已删除')
    if (expandedItemId.value === item.id) expandedItemId.value = ''
    await refreshAll()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteLoading.value = false
  }
}

// ===== 条目对话框 =====
const openEntryDialog = (itemId: string, entry: PriceEntry | null = null) => {
  entryFormContext.value = { itemId }
  if (entry) {
    editingEntry.value = entry
    entryForm.value = {
      platform: entry.platform || '',
      unitPrice: String(entry.unitPrice || ''),
      shippingFee: String(entry.shippingFee || 0),
      discount: String(entry.discount || 0),
      quantity: String(entry.quantity || 1),
      currency: entry.currency || 'CNY',
      status: Number(entry.status || ENTRY_STATUS.PENDING),
      purchaseDate: entry.purchaseDate || '',
      link: entry.link || '',
      seller: entry.seller || '',
      note: entry.note || '',
      isChosen: Number(entry.isChosen) === 1 ? 1 : 0
    }
  } else {
    editingEntry.value = null
    entryForm.value = {
      platform: '',
      unitPrice: '',
      shippingFee: '0',
      discount: '0',
      quantity: '1',
      currency: 'CNY',
      status: ENTRY_STATUS.PENDING,
      purchaseDate: '',
      link: '',
      seller: '',
      note: '',
      isChosen: 0
    }
  }
  showEntryDialog.value = true
}

// 自动计算最终价
const calcFinalPrice = computed(() => {
  const u = parseFloat(entryForm.value.unitPrice) || 0
  const q = parseInt(entryForm.value.quantity) || 1
  const s = parseFloat(entryForm.value.shippingFee) || 0
  const d = parseFloat(entryForm.value.discount) || 0
  return Number(((u * q + s - d)).toFixed(2))
})

const handleSaveEntry = async () => {
  if (!entryForm.value.platform || !entryForm.value.platform.trim()) {
    ElMessage.warning('请输入平台名称')
    return
  }
  const unitPrice = parseFloat(entryForm.value.unitPrice)
  if (isNaN(unitPrice) || unitPrice < 0) {
    ElMessage.warning('请输入有效的单价')
    return
  }
  const shippingFee = parseFloat(entryForm.value.shippingFee) || 0
  const discount = parseFloat(entryForm.value.discount) || 0
  const quantity = parseInt(entryForm.value.quantity) || 1

  createEntryLoading.value = !editingEntry.value
  updateEntryLoading.value = !!editingEntry.value
  try {
    const payload = {
      itemId: entryFormContext.value.itemId,
      platform: entryForm.value.platform.trim(),
      unitPrice,
      shippingFee,
      discount,
      quantity,
      currency: entryForm.value.currency || 'CNY',
      status: entryForm.value.status,
      purchaseDate: entryForm.value.purchaseDate || null,
      link: entryForm.value.link || null,
      seller: entryForm.value.seller || null,
      note: entryForm.value.note || '',
      isChosen: entryForm.value.isChosen
    }
    if (editingEntry.value) {
      await priceComparisonApi.updateEntry(editingEntry.value.id, payload)
      ElMessage.success('价格已更新')
    } else {
      await priceComparisonApi.createEntry(payload)
      ElMessage.success('价格已添加')
    }
    showEntryDialog.value = false
    expandedItemId.value = entryFormContext.value.itemId
    await refreshAll()
  } catch (e: any) {
    const msg = e?.response?.data?.error || (editingEntry.value ? '更新失败' : '添加失败')
    ElMessage.error(msg)
  } finally {
    createEntryLoading.value = false
    updateEntryLoading.value = false
  }
}

const handleDeleteEntry = async (entry: PriceEntry) => {
  try {
    await ElMessageBox.confirm(`确定删除「${entry.platform}」的价格记录吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return
  }
  deleteEntryLoading.value = true
  try {
    await priceComparisonApi.deleteEntry(entry.id)
    ElMessage.success('价格记录已删除')
    await refreshAll()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteEntryLoading.value = false
  }
}

// 标记为最终选定
const handleChooseEntry = async (entry: PriceEntry) => {
  updateEntryLoading.value = true
  try {
    await priceComparisonApi.updateEntry(entry.id, { isChosen: Number(entry.isChosen) === 1 ? 0 : 1 })
    ElMessage.success(entry.isChosen === 1 ? '已取消选定' : '已标记为最终购买平台')
    await refreshAll()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '操作失败')
  } finally {
    updateEntryLoading.value = false
  }
}

// ===== 分享 =====
const handleShareReport = async () => {
  shareLoading.value = true
  try {
    // 简单地通过截图当前报告卡片分享
    const el = document.querySelector('.stats-report-card') as HTMLElement | null
    if (!el) {
      ElMessage.warning('请先查看数据报告')
      return
    }
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(el)
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `物品比价报告_${new Date().toISOString().split('T')[0]}.png`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('报告已保存')
      }
    })
  } catch {
    ElMessage.error('分享失败')
  } finally {
    shareLoading.value = false
  }
}

// 导出 JSON
const handleExport = () => {
  try {
    const data = items.value.map(i => ({
      ...i,
      // 去掉 entries 内的循环引用
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `物品比价_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('数据已导出')
  } catch {
    ElMessage.error('导出失败')
  }
}

// ===== 监听 =====
watch([filterStatus, filterCategory], async () => { await fetchItems() })

// 搜索 debounce
let searchTimer: number | null = null
watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(async () => {
    await fetchItems()
  }, 400)
})

// 切换物品状态（快速操作）
const handleChangeItemStatus = async (item: PriceItem, status: number) => {
  try {
    await priceComparisonApi.updateItem(item.id, { status })
    ElMessage.success('状态已更新')
    await refreshAll()
  } catch {
    ElMessage.error('更新失败')
  }
}

// ===== 生命周期 =====
onMounted(async () => {
  userStore.initUserState()
  if (!userStore.isLoggedIn) {
    notLoggedIn.value = true
    return
  }
  await refreshAll()
})
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50">
    <DetailHeader :title="info.title" />

    <!-- 未登录 -->
    <div v-if="notLoggedIn" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4">🔒</div>
      <h3 class="text-h3 font-bold text-white mb-3">请先登录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">物品比价需要登录后使用，比价数据将安全存储到您的账户</p>
      <el-button size="large" class="!bg-white !text-cyan-600 !border-none hover:!bg-gray-100" @click="goToLogin">
        前往登录
      </el-button>
    </div>

    <!-- 首次使用 -->
    <div v-else-if="isFirstTime" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4 animate-bounce">💰</div>
      <h3 class="text-h3 font-bold text-white mb-3">欢迎使用物品比价</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">添加您要购买的物品，记录各平台价格，自动找出最便宜的购买渠道</p>
      <el-button size="large" class="!bg-white !text-cyan-600 !border-none hover:!bg-gray-100" @click="openItemDialog(null)">
        <el-icon class="mr-1"><Plus /></el-icon> 添加第一个物品
      </el-button>
    </div>

    <div v-else class="px-3 sm:px-0 pb-6">
      <!-- 顶部统计卡片 -->
      <div class="grid grid-cols-2 md:grid-cols-4 mb-4 gap-3">
        <div class="stat-card bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div class="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
          <div class="text-white/80 text-caption">比价中</div>
          <div class="text-3xl font-bold mt-1">{{ statistics.comparingCount }}</div>
          <div class="text-caption text-white/80 mt-1">件物品</div>
        </div>
        <div class="stat-card bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div class="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
          <div class="text-white/80 text-caption">已购买</div>
          <div class="text-3xl font-bold mt-1">{{ statistics.purchasedCount }}</div>
          <div class="text-caption text-white/80 mt-1">件物品</div>
        </div>
        <div class="stat-card bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div class="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
          <div class="text-white/80 text-caption">累计花费</div>
          <div class="text-2xl font-bold mt-1">¥{{ formatMoneyInt(statistics.totalSpent) }}</div>
          <div class="text-caption text-white/80 mt-1">{{ statistics.purchasedEntries }} 笔订单</div>
        </div>
        <div class="stat-card bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div class="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full"></div>
          <div class="text-white/80 text-caption">比价节省</div>
          <div class="text-2xl font-bold mt-1">¥{{ formatMoneyInt(statistics.totalPotentialSaved) }}</div>
          <div class="text-caption text-white/80 mt-1">相对最高价</div>
        </div>
      </div>

      <!-- 主操作区 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <div class="flex flex-col gap-3 mb-4">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-h3">🛒</span>
            <span class="font-semibold text-gray-700 whitespace-nowrap">我的比价物品</span>
            <span class="text-caption text-gray-400 whitespace-nowrap">共 {{ filteredItems.length }} 件</span>
          </div>
          <!-- 筛选区（手机端独占一行 / sm 及以上同行右侧） -->
          <div class="flex flex-wrap items-center gap-2 w-full">
            <el-select v-model="filterStatus" placeholder="状态" class="!w-full sm:!w-28" clearable>
              <el-option label="比价中" :value="0" />
              <el-option label="已购买" :value="1" />
              <el-option label="已取消" :value="2" />
              <el-option label="已归档" :value="3" />
            </el-select>
            <el-select v-model="filterCategory" placeholder="分类" class="!w-full sm:!w-32" clearable filterable>
              <el-option v-for="cat in CATEGORY_LIST" :key="cat.value" :label="cat.label" :value="cat.value" />
            </el-select>
            <el-input v-model="searchKeyword" placeholder="搜索物品/平台/卖家" clearable class="!w-full sm:!w-44" />
            <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto">
              <el-button class="flex-1 sm:flex-none" @click="handleExport">导出</el-button>
              <el-button class="flex-1 sm:flex-none" @click="showReportDialog = true">数据报告</el-button>
              <el-button type="primary" class="flex-1 sm:flex-none" @click="openItemDialog(null)">
                <el-icon><Plus /></el-icon> 添加物品
              </el-button>
            </div>
          </div>
        </div>

        <!-- 当前筛选下的统计小条 -->
        <div v-if="filterStatus !== '' || filterCategory || searchKeyword.trim()" class="text-body-sm text-gray-500 mb-3 flex items-center gap-2 flex-wrap">
          <span class="whitespace-nowrap">当前筛选下：</span>
          <span class="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-600 whitespace-nowrap">{{ filteredStats.count }} 件</span>
          <span class="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 whitespace-nowrap">已购 {{ filteredStats.purchasedCount }} 件</span>
          <span class="px-2 py-0.5 rounded-lg bg-violet-50 text-violet-600 whitespace-nowrap">花费 ¥{{ formatMoneyInt(filteredStats.totalSpent) }}</span>
          <span v-if="filteredStats.totalPotentialSaved > 0" class="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 whitespace-nowrap">节省 ¥{{ formatMoneyInt(filteredStats.totalPotentialSaved) }}</span>
        </div>

        <div v-if="loading" class="text-center py-12">
          <el-icon class="is-loading text-4xl text-cyan-500"><Loading /></el-icon>
          <p class="text-gray-400 text-body-sm mt-2">加载中...</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📦</div>
          <p class="text-gray-400 mb-4">{{ items.length === 0 ? '还没有比价物品，点击右上角开始添加吧～' : '没有符合筛选条件的物品' }}</p>
          <el-button v-if="items.length === 0" type="primary" @click="openItemDialog(null)">添加第一个物品</el-button>
        </div>

        <div v-else class="space-y-3 max-h-[40rem] overflow-y-auto pr-1">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="item-card rounded-2xl bg-white border border-gray-100 overflow-hidden transition-all"
          >
            <!-- 物品头部 -->
            <div class="p-4 flex items-start gap-3">
              <div
                class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl"
                :style="{ backgroundColor: (getCategoryMeta(item.category).color || '#909399') + '20' }"
              >
                {{ getCategoryMeta(item.category).icon }}
              </div>
              <div class="flex-1 min-w-0">
                <!-- 第 1 行：名称 + 状态 + 分类 -->
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                  <span class="font-semibold text-gray-800 text-body-lg truncate max-w-full">{{ item.name }}</span>
                  <span
                    class="text-caption px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                    :style="{ backgroundColor: ITEM_STATUS_COLOR[item.status] + '20', color: ITEM_STATUS_COLOR[item.status] }"
                  >
                    {{ ITEM_STATUS_LABEL[item.status] }}
                  </span>
                  <span class="text-caption px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap flex-shrink-0">{{ getCategoryMeta(item.category).label }}</span>
                </div>
                <!-- 规格 -->
                <div v-if="item.spec" class="text-caption text-gray-500 mb-1.5 break-words">规格：{{ item.spec }}</div>
                <!-- 第 2 行：统计信息 -->
                <div class="flex items-center gap-x-2 gap-y-1 flex-wrap text-caption text-gray-500">
                  <span class="whitespace-nowrap">{{ item.entryCount }} 个平台价格</span>
                  <template v-if="item.entryCount >= 2">
                    <span class="whitespace-nowrap text-emerald-500 font-medium">最低 ¥{{ formatMoney(item.minPrice) }}</span>
                    <span class="whitespace-nowrap text-rose-400">最高 ¥{{ formatMoney(item.maxPrice) }}</span>
                    <span v-if="item.priceDiff && item.priceDiff > 0" class="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 whitespace-nowrap">
                      价差 ¥{{ formatMoney(item.priceDiff) }}
                    </span>
                  </template>
                  <span v-if="item.chosenEntry" class="whitespace-nowrap text-emerald-600 inline-flex items-center gap-0.5">
                    <el-icon><Check /></el-icon>
                    <span class="truncate">选定：{{ item.chosenEntry.platform }} ¥{{ formatMoney(item.chosenEntry.finalPrice) }}</span>
                  </span>
                </div>
              </div>
              <!-- 右侧操作 -->
              <div class="flex flex-col sm:flex-row items-end sm:items-center gap-0 sm:gap-1 flex-shrink-0">
                <el-button link size="small" @click="expandedItemId = expandedItemId === item.id ? '' : item.id" class="!px-1">
                  <el-icon><ArrowDown v-if="expandedItemId !== item.id" /><ArrowUp v-else /></el-icon>
                  <span class="ml-0.5">{{ expandedItemId === item.id ? '收起' : '展开' }}</span>
                </el-button>
                <el-button link class="!text-cyan-500 !px-1" size="small" @click="openItemDialog(item)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button link class="!text-rose-400 !px-1" size="small" :loading="deleteLoading" @click="handleDeleteItem(item)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>

            <!-- 状态快速切换 -->
            <div class="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <span class="text-caption text-gray-400 whitespace-nowrap">状态：</span>
              <button
                v-for="st in [0, 1, 2, 3]"
                :key="st"
                class="status-chip whitespace-nowrap"
                :class="{ active: Number(item.status) === st }"
                :style="Number(item.status) === st ? { backgroundColor: ITEM_STATUS_COLOR[st] + '20', color: ITEM_STATUS_COLOR[st], borderColor: ITEM_STATUS_COLOR[st] + '40' } : {}"
                @click="Number(item.status) !== st && handleChangeItemStatus(item, st)"
              >
                {{ ITEM_STATUS_LABEL[st] }}
              </button>
            </div>

            <!-- 展开的条目列表 -->
            <div v-if="expandedItemId === item.id" class="border-t border-gray-100 bg-gray-50/50 p-3">
              <div v-if="item.entries.length === 0" class="text-center py-6 text-gray-400 text-body-sm">
                暂无平台价格记录
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(entry, idx) in item.entries"
                  :key="entry.id"
                  class="entry-row flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-white border border-gray-100 transition-all"
                  :class="{
                    'entry-chosen': Number(entry.isChosen) === 1,
                    'entry-cheapest': idx === 0 && item.entries.length >= 2 && Number(entry.isChosen) !== 1
                  }"
                >
                  <!-- 顶部行：排名 + 平台名 + 标签（手机端独占一行，桌面端与下方详情并列） -->
                  <div class="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:flex-1 sm:min-w-0">
                    <!-- 排名 -->
                    <div class="flex-shrink-0 w-6 sm:w-8 text-center">
                      <span v-if="idx === 0 && item.entries.length >= 2" class="text-xl">👑</span>
                      <span v-else-if="Number(entry.isChosen) === 1" class="text-xl">✅</span>
                      <span v-else class="text-caption text-gray-400 whitespace-nowrap">#{{ idx + 1 }}</span>
                    </div>
                    <!-- 平台名 + 标签 -->
                    <div class="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      <span class="font-medium text-gray-700 truncate max-w-full">{{ entry.platform }}</span>
                      <span
                        v-if="Number(entry.isChosen) === 1"
                        class="text-caption px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 whitespace-nowrap flex-shrink-0"
                      >已选定</span>
                      <span
                        v-if="idx === 0 && item.entries.length >= 2"
                        class="text-caption px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 whitespace-nowrap flex-shrink-0"
                      >最低价</span>
                      <span
                        class="text-caption px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                        :style="{ backgroundColor: ENTRY_STATUS_COLOR[entry.status] + '20', color: ENTRY_STATUS_COLOR[entry.status] }"
                      >{{ ENTRY_STATUS_LABEL[entry.status] }}</span>
                    </div>
                  </div>

                  <!-- 详细信息（手机端独占一行，桌面端与上方并列） -->
                  <div class="flex-1 sm:flex-initial min-w-0 sm:max-w-[40%]">
                    <div class="text-caption text-gray-500 break-words">
                      <span class="whitespace-nowrap">单价 ¥{{ formatMoney(entry.unitPrice) }} × {{ entry.quantity }}</span>
                      <span v-if="Number(entry.shippingFee) > 0" class="whitespace-nowrap"> + 运费 ¥{{ formatMoney(entry.shippingFee) }}</span>
                      <span v-if="Number(entry.discount) > 0" class="whitespace-nowrap"> - 优惠 ¥{{ formatMoney(entry.discount) }}</span>
                      <span v-if="entry.seller"> · {{ entry.seller }}</span>
                      <span v-if="entry.purchaseDate"> · {{ entry.purchaseDate }}</span>
                    </div>
                    <div v-if="entry.note" class="text-caption text-gray-400 mt-0.5 break-words">📝 {{ entry.note }}</div>
                    <a v-if="entry.link" :href="entry.link" target="_blank" class="text-caption text-cyan-500 hover:underline mt-0.5 inline-block sm:hidden">查看链接 →</a>
                  </div>

                  <!-- 最终价 + 操作（手机端独占一行左对齐，桌面端竖排右侧） -->
                  <div class="flex items-center sm:items-end justify-between sm:justify-end gap-2 sm:flex-col sm:gap-1 sm:flex-shrink-0">
                    <div class="text-left sm:text-right">
                      <div class="font-bold text-lg whitespace-nowrap" :class="idx === 0 && item.entries.length >= 2 ? 'text-emerald-500' : 'text-gray-700'">
                        ¥{{ formatMoney(entry.finalPrice) }}
                      </div>
                      <a v-if="entry.link" :href="entry.link" target="_blank" class="text-caption text-cyan-500 hover:underline hidden sm:inline">查看链接</a>
                    </div>
                    <div class="flex items-center gap-0.5 flex-shrink-0">
                      <el-button link class="!text-amber-500 !p-0.5" size="small" :loading="updateEntryLoading" @click="handleChooseEntry(entry)">
                        <el-icon v-if="Number(entry.isChosen) === 1"><Close /></el-icon>
                        <el-icon v-else><Check /></el-icon>
                      </el-button>
                      <el-button link class="!text-cyan-500 !p-0.5" size="small" @click="openEntryDialog(item.id, entry)">
                        <el-icon><Edit /></el-icon>
                      </el-button>
                      <el-button link class="!text-rose-400 !p-0.5" size="small" :loading="deleteEntryLoading" @click="handleDeleteEntry(entry)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-end gap-2">
                <el-button size="small" type="primary" plain class="w-full sm:w-auto" @click="openEntryDialog(item.id, null)">
                  <el-icon><Plus /></el-icon> 添加平台价格
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 物品对话框 -->
    <el-dialog v-model="showItemDialog" :title="editingItem ? '编辑物品' : '添加比价物品'" width="90%" :style="{ maxWidth: '500px' }" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="物品名称" required>
          <el-input v-model="itemForm.name" placeholder="如：iPhone 15 Pro、小米电视 65 寸" maxlength="100" show-word-limit clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="itemForm.category" placeholder="选择分类" style="width: 100%" filterable>
            <el-option v-for="cat in CATEGORY_LIST" :key="cat.value" :label="cat.label" :value="cat.value">
              <span class="mr-1">{{ cat.icon }}</span>{{ cat.label }}
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="itemForm.spec" placeholder="如：256GB 钛原色、4K 60Hz" maxlength="200" clearable />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.note" type="textarea" :rows="3" placeholder="可选：选购要点、用途、对比维度等" maxlength="1000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showItemDialog = false">取消</el-button>
        <el-button type="primary" :loading="createLoading || updateLoading" @click="handleSaveItem">
          {{ editingItem ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 条目对话框 -->
    <el-dialog v-model="showEntryDialog" :title="editingEntry ? '编辑平台价格' : '添加平台价格'" width="90%" :style="{ maxWidth: '560px' }" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="平台" required>
          <el-input v-model="entryForm.platform" placeholder="如：淘宝、京东、拼多多、1688、官网、线下" maxlength="50" show-word-limit clearable />
        </el-form-item>
        <el-form-item label="单价" required>
          <el-input v-model="entryForm.unitPrice" type="number" step="0.01" placeholder="单价（元）" clearable>
            <template #prepend>¥</template>
            <template #append>元</template>
          </el-input>
        </el-form-item>
        <el-form-item label="数量">
          <el-input v-model="entryForm.quantity" type="number" min="1" step="1" placeholder="数量" clearable>
            <template #append>件</template>
          </el-input>
        </el-form-item>
        <el-form-item label="运费">
          <el-input v-model="entryForm.shippingFee" type="number" step="0.01" placeholder="运费（元），可填 0" clearable>
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="优惠">
          <el-input v-model="entryForm.discount" type="number" step="0.01" placeholder="优惠/减免（元），可填 0" clearable>
            <template #prepend>-¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="最终价">
          <div class="flex items-center gap-2">
            <span class="text-2xl font-bold text-emerald-500">¥{{ formatMoney(calcFinalPrice) }}</span>
            <span class="text-caption text-gray-400">（自动：单价×数量 + 运费 - 优惠）</span>
          </div>
        </el-form-item>
        <el-form-item label="卖家/店铺">
          <el-input v-model="entryForm.seller" placeholder="可选" maxlength="100" clearable />
        </el-form-item>
        <el-form-item label="商品链接">
          <el-input v-model="entryForm.link" placeholder="可选：商品详情页 URL" maxlength="2000" clearable />
        </el-form-item>
        <el-form-item label="购买日期">
          <el-date-picker v-model="entryForm.purchaseDate" type="date" placeholder="可选" value-format="YYYY-MM-DD" style="width: 100%" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="entryForm.status" style="width: 100%">
            <el-option v-for="(label, value) in ENTRY_STATUS_LABEL" :key="value" :label="label" :value="Number(value)" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="entryForm.note" type="textarea" :rows="2" placeholder="可选：活动信息、赠品、售后等" maxlength="1000" />
        </el-form-item>
        <el-form-item label="最终选定">
          <el-switch v-model="entryForm.isChosen" active-text="标记为最终购买平台" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEntryDialog = false">取消</el-button>
        <el-button type="primary" :loading="createEntryLoading || updateEntryLoading" @click="handleSaveEntry">
          {{ editingEntry ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 数据报告 -->
    <el-dialog v-model="showReportDialog" title="数据报告" width="90%" :style="{ maxWidth: '600px' }">
      <div class="stats-report-card space-y-4">
        <div class="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border border-cyan-100">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-semibold text-cyan-700 flex items-center gap-2">
              <span class="text-h2">📊</span> 总览
            </h4>
            <el-button link :loading="shareLoading" @click="handleShareReport" class="!text-cyan-600">
              <el-icon><Share /></el-icon> 保存图片
            </el-button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-body-sm">
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">物品总数</div>
              <div class="font-bold text-gray-700 text-lg">{{ statistics.totalItems }} 件</div>
            </div>
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">比价条目</div>
              <div class="font-bold text-gray-700 text-lg">{{ statistics.totalEntries }} 条</div>
            </div>
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">比价中</div>
              <div class="font-bold text-cyan-600 text-lg">{{ statistics.comparingCount }} 件</div>
            </div>
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">已购买</div>
              <div class="font-bold text-emerald-600 text-lg">{{ statistics.purchasedCount }} 件</div>
            </div>
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">累计花费</div>
              <div class="font-bold text-violet-600 text-lg">¥{{ formatMoneyInt(statistics.totalSpent) }}</div>
            </div>
            <div class="bg-white/60 rounded-xl p-3">
              <div class="text-gray-500 text-caption">理论节省</div>
              <div class="font-bold text-amber-600 text-lg">¥{{ formatMoneyInt(statistics.totalPotentialSaved) }}</div>
            </div>
          </div>
        </div>

        <!-- 按分类 -->
        <div v-if="statistics.byCategory.length > 0" class="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100">
          <h4 class="font-semibold text-violet-700 flex items-center gap-2 mb-3">
            <span class="text-h2">📂</span> 已购分类花费
          </h4>
          <div class="space-y-2">
            <div v-for="cat in statistics.byCategory" :key="cat.category" class="flex items-center gap-2 flex-wrap">
              <span class="w-20 text-caption text-gray-600 truncate whitespace-nowrap flex-shrink-0">{{ getCategoryMeta(cat.category).label }}</span>
              <div class="flex-1 min-w-[60px] bg-white/60 rounded-full h-3 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{
                    width: (statistics.totalSpent > 0 ? (cat.totalSpent / statistics.totalSpent) * 100 : 0) + '%',
                    backgroundColor: getCategoryMeta(cat.category).color
                  }"
                ></div>
              </div>
              <span class="text-body-sm font-medium text-gray-700 min-w-[80px] text-right whitespace-nowrap">¥{{ formatMoneyInt(cat.totalSpent) }}</span>
              <span class="text-caption text-gray-400 min-w-[40px] text-right whitespace-nowrap">{{ cat.count }}件</span>
            </div>
          </div>
        </div>

        <!-- 价差最大的物品 -->
        <div v-if="statistics.cheapestItems.length > 0" class="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
          <h4 class="font-semibold text-amber-700 flex items-center gap-2 mb-3">
            <span class="text-h2">💰</span> 价差最大 TOP 5（比价中）
          </h4>
          <div class="space-y-2">
            <div v-for="(it, idx) in statistics.cheapestItems" :key="it.id" class="flex items-center gap-2 p-2 rounded-xl bg-white/60 flex-wrap">
              <span class="text-body-lg flex-shrink-0">{{ ['🥇','🥈','🥉','4️⃣','5️⃣'][idx] || (idx + 1) }}</span>
              <span class="flex-1 min-w-0 truncate font-medium text-gray-700 text-body-sm">{{ it.name }}</span>
              <div class="flex items-center gap-1 whitespace-nowrap text-caption flex-shrink-0">
                <span class="text-emerald-500">¥{{ formatMoney(it.minPrice) }}</span>
                <span class="text-gray-400">~</span>
                <span class="text-rose-400">¥{{ formatMoney(it.maxPrice) }}</span>
              </div>
              <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-caption font-medium whitespace-nowrap flex-shrink-0">
                省 ¥{{ formatMoney(it.diff) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 最近更新 -->
        <div v-if="statistics.recentItems.length > 0" class="p-4 bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl border border-gray-100">
          <h4 class="font-semibold text-gray-700 flex items-center gap-2 mb-3">
            <span class="text-h2">🕓</span> 最近更新
          </h4>
          <div class="space-y-1">
            <div v-for="r in statistics.recentItems" :key="r.id" class="flex items-center gap-2 text-body-sm flex-wrap">
              <span class="flex-1 min-w-0 truncate text-gray-700">{{ r.name }}</span>
              <span class="text-caption px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0" :style="{ backgroundColor: ITEM_STATUS_COLOR[r.status] + '20', color: ITEM_STATUS_COLOR[r.status] }">
                {{ r.statusLabel }}
              </span>
              <span class="text-caption text-gray-400 whitespace-nowrap flex-shrink-0">{{ String(r.updateTime).split(' ')[0] }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showReportDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4 text-gray-600">
        <p class="text-gray-700">物品比价是一款轻量实用的购物决策工具，帮助你记录同一商品在淘宝、京东、拼多多、1688、官网、线下等不同平台的售价，自动算出最终实付价（单价×数量 + 运费 - 优惠），找出最低价并标记最终购买平台，量化你每次比价节省的金额。</p>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span class="text-body-lg">✨</span> 主要功能
          </h4>
          <div class="grid sm:grid-cols-2 gap-2 ml-6">
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>多平台对比</strong>：同一物品可记录任意多个平台的价格，自动按最终价排序</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>实付价计算</strong>：单价×数量 + 运费 - 优惠自动算出，也可手动指定</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>最低价高亮</strong>：自动标注 👑 最低价平台，省去口算</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>最终选定</strong>：标记"最终购买平台"，物品自动归类为"已购买"</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>备注功能</strong>：物品级备注 + 每个平台独立备注，活动信息、赠品、售后一目了然</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>节省金额统计</strong>：相对于其他平台最高价的节省金额累计</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>分类筛选</strong>：数码、服饰、食品、美妆等 10+ 预设分类</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>数据导出</strong>：一键导出 JSON 文件，便于备份与跨设备同步</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-cyan-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">💡</span> 使用建议
          </h4>
          <p class="text-body-sm">建议在每个平台比价时都录入一条价格记录（哪怕只是截个图记下），选中"最终购买平台"后，本工具会自动把该物品标记为已购买，并计算你相对于其他平台的节省金额。如果只是"先看看"，可保持状态为"比价中"或"已取消"以区分决策结果。</p>
        </div>

        <div class="p-3 bg-rose-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">🔒</span> 隐私保护
          </h4>
          <p class="text-body-sm">比价数据包含价格、平台等敏感信息，本工具数据存储在你的登录账户下，请妥善保管登录凭证。如需彻底删除，可逐条删除物品，或联系管理员清除账号数据。</p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import Plus from '~icons/ep/plus'
import Loading from '~icons/ep/loading'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
import ArrowDown from '~icons/ep/arrow-down'
import ArrowUp from '~icons/ep/arrow-up'
import Share from '~icons/ep/share'
import Check from '~icons/ep/check'
import Close from '~icons/ep/close'
export default {
  components: { Plus, Loading, Edit, Delete, ArrowDown, ArrowUp, Share, Check, Close }
}
</script>

<style scoped>
.glass-card-dark {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.item-card {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}
.item-card:hover {
  border-left-color: #06b6d4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.entry-row {
  transition: all 0.2s ease;
}
.entry-row:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.04) 0%, rgba(59, 130, 246, 0.02) 100%);
}

.entry-chosen {
  border-color: #10b981 !important;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%);
}

.entry-cheapest {
  border-color: #f59e0b !important;
}

.status-chip {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  background-color: #f3f4f6;
  color: #6b7280;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
.status-chip:hover {
  background-color: #e5e7eb;
}
.status-chip.active {
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
  font-size: 16px;
}
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border: none;
  transition: all 0.3s ease;
}
:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
}
:deep(.is-loading) {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>