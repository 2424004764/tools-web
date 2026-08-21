<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import html2canvas from 'html2canvas'
import { salaryApi } from './api'
import type { SalaryRecord, SalaryMember, SalaryStatistics, ChartDataPoint, Achievement } from './types'
import { SALARY_MILESTONES, REASON_TAGS, MEMBER_COLORS, MEMBER_EMOJIS } from './types'
import { useUserStore } from '@/store/modules/user'

const info = { title: '工资变化记录' }

// 默认统计数据
const defaultStatistics: SalaryStatistics = {
  currentSalary: null,
  lastSalary: null,
  changeAmount: 0,
  changePercent: 0,
  totalRecords: 0,
  totalRaises: 0,
  totalCuts: 0,
  avgSalary: null,
  maxSalary: null,
  minSalary: null,
  yearsCovered: 0,
  firstRecordDate: null,
  currentTenureMonths: 0,
  annualizedGrowth: 0,
  yearlyReport: null
}

// 状态
const records = ref<SalaryRecord[]>([])
const statistics = ref<SalaryStatistics>(defaultStatistics)
const chartData = ref<ChartDataPoint[]>([])

const members = ref<SalaryMember[]>([])
const currentMemberId = ref<string>('')
const memberSwitcherLoading = ref(false)

const notLoggedIn = ref(false)
const isFirstTime = ref(false)
const loading = ref(false)

const recordLoading = ref(false)
const editRecordLoading = ref(false)
const deleteRecordLoading = ref(false)
const memberLoading = ref(false)
const editMemberLoading = ref(false)
const deleteMemberLoading = ref(false)
const shareLoading = ref(false)

const showRecordDialog = ref(false)
const showEditDialog = ref(false)
const showReportDialog = ref(false)
const showAchievementDialog = ref(false)
const showMemberDialog = ref(false)
const showEditMemberDialog = ref(false)
const editingRecord = ref<SalaryRecord | null>(null)
const editingMember = ref<SalaryMember | null>(null)

const dateFilter = ref<[Date, Date] | null>(null)

const recordForm = ref({
  monthlyIncome: '',
  effectiveDate: '',
  source: '',
  note: '',
  reasonTag: ''
})

// 成员表单（新增 / 编辑共用）
const memberForm = ref({
  name: '',
  avatarColor: '#409EFF',
  avatarEmoji: '👤'
})

const userStore = useUserStore()

// localStorage 持久化当前选中成员
const getSavedMemberId = (): string => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  return localStorage.getItem(`salary_tracker_member_${uid}`) || ''
}
const saveMemberId = (memberId: string) => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  localStorage.setItem(`salary_tracker_member_${uid}`, memberId)
}

// 图表
const chartRef = ref<HTMLElement>()
let chartInstance: ECharts | null = null

// ===== 计算属性 =====
// 千分位格式化
const formatMoney = (val: number | null | undefined, decimals = 0): string => {
  if (val === null || val === undefined) return '--'
  return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 解析薪资输入（去逗号）
const parseIncome = (val: string): number => {
  return parseFloat(val.replace(/,/g, ''))
}

// 当前薪资大卡片变化箭头
const currentChange = computed(() => {
  const amount = statistics.value.changeAmount
  const percent = statistics.value.changePercent
  if (statistics.value.totalRecords < 2) return null
  if (Math.abs(amount) < 0.01) return { amount: 0, percent: 0, type: 'flat' as const }
  return {
    amount,
    percent,
    type: amount > 0 ? ('up' as const) : ('down' as const)
  }
})

// 工龄显示
const tenureText = computed(() => {
  const months = statistics.value.currentTenureMonths
  if (statistics.value.totalRecords === 0) return ''
  if (months < 1) return '不到 1 个月'
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years === 0) return `${months} 个月`
  if (remMonths === 0) return `${years} 年`
  return `${years} 年 ${remMonths} 月`
})

// 涨幅评价（基于 changePercent）
const changeRating = computed(() => {
  const pct = statistics.value.changePercent
  if (pct === 0 || Math.abs(pct) < 0.5) return { text: '基本持平', color: '#909399' }
  if (pct > 0) {
    if (pct >= 30) return { text: '大幅涨薪', color: '#67C23A' }
    if (pct >= 15) return { text: '明显涨薪', color: '#67C23A' }
    if (pct >= 5) return { text: '正常涨薪', color: '#67C23A' }
    return { text: '小幅涨薪', color: '#E6A23C' }
  }
  if (pct <= -30) return { text: '大幅降薪', color: '#F56C6C' }
  if (pct <= -15) return { text: '明显降薪', color: '#F56C6C' }
  return { text: '小幅降薪', color: '#E6A23C' }
})

// 历史记录（带与上次变化的差额）
const formattedRecords = computed(() => {
  if (!Array.isArray(records.value)) return []
  let list = [...records.value].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
  if (dateFilter.value && dateFilter.value.length === 2) {
    const [start, end] = dateFilter.value
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    list = list.filter(r => r.effectiveDate >= startStr && r.effectiveDate <= endStr)
  }
  // 与下一条更早记录比较
  return list.map((r, idx) => {
    const prev = list[idx + 1]
    const changeAmount = prev ? r.monthlyIncome - prev.monthlyIncome : 0
    const changePercent = prev && prev.monthlyIncome > 0
      ? (changeAmount / prev.monthlyIncome) * 100
      : 0
    return { ...r, changeAmount, changePercent }
  })
})

// 成就
const achievements = computed((): Achievement[] => {
  const stats = statistics.value
  const current = stats.currentSalary
  const list: Achievement[] = []

  // 首次记录
  if (stats.totalRecords >= 1) list.push({ id: 'first', title: '初次记录', description: '完成第一次工资记录', icon: '🎉', unlocked: true })

  // 涨薪里程碑
  if (stats.totalRaises >= 1) list.push({ id: 'raise-1', title: '首次涨薪', description: '记录了第一次涨薪', icon: '📈', unlocked: true })
  if (stats.totalRaises >= 3) list.push({ id: 'raise-3', title: '稳步上升', description: '累计涨薪3次', icon: '🚀', unlocked: true })
  if (stats.totalRaises >= 5) list.push({ id: 'raise-5', title: '晋升达人', description: '累计涨薪5次', icon: '🏆', unlocked: true })

  // 薪资里程碑
  SALARY_MILESTONES.forEach(m => {
    if (current && current >= m.income) {
      list.push({ id: `milestone-${m.income}`, title: m.label, description: m.desc, icon: m.icon, unlocked: true })
    }
  })

  // 工龄
  if (stats.currentTenureMonths >= 12) list.push({ id: 'tenure-1y', title: '坚守一年', description: '当前薪资已持续1年', icon: '🌳', unlocked: true })
  if (stats.currentTenureMonths >= 36) list.push({ id: 'tenure-3y', title: '坚守三年', description: '当前薪资已持续3年', icon: '🌲', unlocked: true })
  if (stats.currentTenureMonths >= 60) list.push({ id: 'tenure-5y', title: '五年陈酿', description: '当前薪资已持续5年', icon: '🏔️', unlocked: true })

  // 年化增长率
  if (stats.annualizedGrowth >= 10) list.push({ id: 'growth-10', title: '年化≥10%', description: '薪资年化增长率达到10%', icon: '💎', unlocked: true })
  if (stats.annualizedGrowth >= 20) list.push({ id: 'growth-20', title: '年化≥20%', description: '薪资年化增长率达到20%', icon: '🌟', unlocked: true })

  return list
})

// ===== API 调用 =====
const fetchMembers = async () => {
  try {
    const data = await salaryApi.getMembers()
    members.value = Array.isArray(data) ? data : []
    // 初始化当前成员：localStorage > 默认成员 > 第一个
    const savedId = getSavedMemberId()
    if (savedId && members.value.some(m => m.id === savedId)) {
      currentMemberId.value = savedId
    } else if (!currentMemberId.value && members.value.length > 0) {
      const def = members.value.find(m => m.isDefault === 1) || members.value[0]
      currentMemberId.value = def.id
    }
  } catch {
    members.value = []
  }
}

const fetchRecords = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (currentMemberId.value) params.memberId = currentMemberId.value
    if (dateFilter.value && dateFilter.value.length === 2) {
      const [start, end] = dateFilter.value
      params.startDate = start.toISOString().split('T')[0]
      params.endDate = end.toISOString().split('T')[0]
    }
    const data = await salaryApi.getRecords(params)
    records.value = Array.isArray(data) ? data : []
    // 首次进入判定：没有成员才算"真正的首次"；有成员但无记录进入空状态
    isFirstTime.value = members.value.length === 0
  } catch {
    ElMessage.error('获取记录列表失败')
    records.value = []
  } finally {
    loading.value = false
  }
}

const fetchStatistics = async () => {
  try {
    const data = await salaryApi.getStatistics(currentMemberId.value ? { memberId: currentMemberId.value } : undefined)
    statistics.value = data || defaultStatistics
  } catch {
    statistics.value = defaultStatistics
  }
}

const fetchChartData = async () => {
  try {
    const data = await salaryApi.getChartData(currentMemberId.value ? { memberId: currentMemberId.value } : undefined)
    chartData.value = Array.isArray(data) ? data : []
    renderChart()
  } catch {
    chartData.value = []
  }
}

const refreshData = async () => {
  await Promise.all([fetchRecords(), fetchStatistics(), fetchChartData()])
}

const currentMember = computed(() => members.value.find(m => m.id === currentMemberId.value) || null)

// ===== 操作方法 =====
const openRecordDialog = () => {
  if (members.value.length === 0) {
    ElMessage.warning('请先添加成员')
    showMemberDialog.value = true
    return
  }
  const now = new Date()
  recordForm.value = {
    monthlyIncome: '',
    effectiveDate: now.toISOString().split('T')[0],
    source: '',
    note: '',
    reasonTag: ''
  }
  showRecordDialog.value = true
}

const handleShare = async () => {
  shareLoading.value = true
  try {
    const chartEl = document.querySelector('.chart-export-container')
    if (!chartEl) {
      ElMessage.warning('请先生成图表')
      return
    }
    const canvas = await html2canvas(chartEl as HTMLElement)
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `工资变化_${currentMember.value?.name || '我'}_${new Date().toISOString().split('T')[0]}.png`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('图片已保存')
      }
    })
  } catch {
    ElMessage.error('分享失败')
  } finally {
    shareLoading.value = false
  }
}

const handleAddRecord = async () => {
  if (!recordForm.value.monthlyIncome) {
    ElMessage.warning('请输入月收入')
    return
  }
  const income = parseIncome(recordForm.value.monthlyIncome)
  if (isNaN(income) || income <= 0 || income > 10000000) {
    ElMessage.warning('请输入有效的月收入（0-10000000 元）')
    return
  }
  recordLoading.value = true
  try {
    let fullNote = recordForm.value.note || ''
    if (recordForm.value.reasonTag) {
      const tag = REASON_TAGS.find(t => t.value === recordForm.value.reasonTag)
      if (tag) fullNote = `[${tag.label}] ${fullNote}`.trim()
    }
    await salaryApi.createRecord({
      memberId: currentMemberId.value,
      monthlyIncome: income,
      effectiveDate: recordForm.value.effectiveDate,
      source: recordForm.value.source || null,
      note: fullNote
    })
    ElMessage.success('记录成功')
    showRecordDialog.value = false
    await nextTick()
    await refreshData()
  } catch {
    ElMessage.error('记录失败')
  } finally {
    recordLoading.value = false
  }
}

const handleDeleteRecord = async (record: SalaryRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除这条工资记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  deleteRecordLoading.value = true
  try {
    await salaryApi.deleteRecord(record.id)
    ElMessage.success('删除成功')
    await refreshData()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteRecordLoading.value = false
  }
}

const handleEditRecord = (record: SalaryRecord) => {
  editingRecord.value = { ...record }
  showEditDialog.value = true
}

const handleUpdateRecord = async () => {
  if (!editingRecord.value) return
  editRecordLoading.value = true
  try {
    await salaryApi.updateRecord(editingRecord.value.id, {
      monthlyIncome: editingRecord.value.monthlyIncome,
      effectiveDate: editingRecord.value.effectiveDate,
      source: editingRecord.value.source,
      note: editingRecord.value.note
    })
    ElMessage.success('更新成功')
    showEditDialog.value = false
    await refreshData()
  } catch {
    ElMessage.error('更新失败')
  } finally {
    editRecordLoading.value = false
  }
}

// ===== 成员管理 =====
const handleAddMember = async () => {
  if (!memberForm.value.name || !memberForm.value.name.trim()) {
    ElMessage.warning('请输入成员名称')
    return
  }
  memberLoading.value = true
  try {
    const result = await salaryApi.createMember({
      name: memberForm.value.name.trim(),
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || undefined,
      isDefault: members.value.length === 0 ? true : false
    })
    ElMessage.success(result.updated ? '成员已存在，信息已更新' : '添加成功')
    showMemberDialog.value = false
    memberForm.value = { name: '', avatarColor: '#409EFF', avatarEmoji: '👤' }
    await fetchMembers()
    currentMemberId.value = result.id
    saveMemberId(result.id)
    isFirstTime.value = false
    await refreshData()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    memberLoading.value = false
  }
}

const handleDeleteMember = async (member: SalaryMember) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除成员"${member.name}"吗？这将同时删除该成员的所有工资记录。`,
      '警告',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  deleteMemberLoading.value = true
  try {
    await salaryApi.deleteMember(member.id)
    ElMessage.success('删除成功')
    if (currentMemberId.value === member.id) {
      const next = members.value.find(m => m.id !== member.id)
      currentMemberId.value = next?.id || ''
      if (next) saveMemberId(next.id)
    }
    await fetchMembers()
    await refreshData()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteMemberLoading.value = false
  }
}

const handleEditMember = (member: SalaryMember) => {
  editingMember.value = { ...member }
  memberForm.value = {
    name: member.name,
    avatarColor: member.avatarColor || '#409EFF',
    avatarEmoji: member.avatarEmoji || '👤'
  }
  showEditMemberDialog.value = true
}

const handleUpdateMember = async () => {
  if (!editingMember.value) return
  if (!memberForm.value.name || !memberForm.value.name.trim()) {
    ElMessage.warning('请输入成员名称')
    return
  }
  editMemberLoading.value = true
  try {
    await salaryApi.updateMember(editingMember.value.id, {
      name: memberForm.value.name.trim(),
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || null
    })
    ElMessage.success('更新成功')
    showEditMemberDialog.value = false
    editingMember.value = null
    await fetchMembers()
  } catch {
    ElMessage.error('更新失败')
  } finally {
    editMemberLoading.value = false
  }
}

// ===== 图表 =====
const initChart = () => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  renderChart()
}

const renderChart = () => {
  if (!chartInstance) return
  if (!chartData.value || !Array.isArray(chartData.value) || chartData.value.length === 0) {
    chartInstance.clear()
    chartInstance.setOption({ xAxis: { data: [] }, yAxis: {}, series: [] }, { notMerge: true })
    return
  }

  // 标记每一次涨薪/降薪点
  const sortedAsc = [...chartData.value].sort((a, b) => a.date.localeCompare(b.date))
  const markPoints: any[] = []
  for (let i = 1; i < sortedAsc.length; i++) {
    const diff = sortedAsc[i].income - sortedAsc[i - 1].income
    if (Math.abs(diff) > 0.01) {
      markPoints.push({
        name: diff > 0 ? '涨薪' : '降薪',
        coord: [sortedAsc[i].date, sortedAsc[i].income],
        value: diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff),
        itemStyle: { color: diff > 0 ? '#67C23A' : '#F56C6C' }
      })
    }
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>${p.marker} 月薪: ¥${formatMoney(p.value[1])}`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: sortedAsc.map(d => d.date)
    },
    yAxis: {
      type: 'value',
      name: '月薪（元）',
      scale: true,
      axisLabel: {
        formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v
      }
    },
    series: [{
      name: '月薪',
      type: 'line',
      smooth: true,
      step: 'end',
      data: sortedAsc.map(d => [d.date, d.income]),
      itemStyle: { color: '#f59e0b' },
      lineStyle: { width: 3 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.02)' }
          ]
        }
      },
      markPoint: markPoints.length > 0 ? {
        data: markPoints,
        symbol: 'pin',
        symbolSize: 50,
        label: { fontSize: 10, color: '#fff' }
      } : undefined,
      animationDuration: 500
    }]
  }
  chartInstance.setOption(option, { notMerge: true })
}

const handleResize = () => chartInstance?.resize()
const goToLogin = () => { window.location.href = '/login?redirect=/salary-tracker/' }

// ===== 监听 =====
// 打开「添加成员」对话框时重置表单
watch(showMemberDialog, (val) => {
  if (val && !editingMember.value) {
    memberForm.value = {
      name: '',
      avatarColor: MEMBER_COLORS[members.value.length % MEMBER_COLORS.length],
      avatarEmoji: MEMBER_EMOJIS[members.value.length % MEMBER_EMOJIS.length]
    }
  }
})

watch(currentMemberId, async (newId) => {
  if (newId) saveMemberId(newId)
  memberSwitcherLoading.value = true
  try {
    await refreshData()
  } finally {
    memberSwitcherLoading.value = false
  }
})

watch(dateFilter, async () => { await fetchRecords() })

// ===== 生命周期 =====
onMounted(async () => {
  userStore.initUserState()
  if (!userStore.isLoggedIn) {
    notLoggedIn.value = true
    return
  }
  await fetchMembers()
  await fetchRecords()
  await fetchStatistics()
  await fetchChartData()
  nextTick(() => { initChart() })
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50">
    <DetailHeader :title="info.title" />

    <!-- 未登录 -->
    <div v-if="notLoggedIn" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4">🔒</div>
      <h3 class="text-h3 font-bold text-white mb-3">请先登录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">工资记录需要登录后使用，数据将加密保存到您的账户</p>
      <el-button size="large" class="!bg-white !text-amber-600 !border-none hover:!bg-gray-100" @click="goToLogin">
        <el-icon class="mr-1"><Promotion /></el-icon> 前往登录
      </el-button>
    </div>

    <!-- 首次使用 -->
    <div v-else-if="isFirstTime" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4 animate-bounce">💰</div>
      <h3 class="text-h3 font-bold text-white mb-3">欢迎使用工资变化记录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">添加您的第一个成员，开启薪资追踪之旅</p>
      <el-button size="large" class="!bg-white !text-amber-600 !border-none hover:!bg-gray-100" @click="showMemberDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon> 添加成员
      </el-button>
    </div>

    <div v-else class="px-3 sm:px-0 pb-6">
      <!-- 主卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <!-- 成员选择栏 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-body-sm font-medium text-gray-500">成员</span>
            <el-select v-model="currentMemberId" placeholder="选择成员" class="!w-32" :loading="memberSwitcherLoading">
              <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
            <div v-if="currentMember" class="avatar-circle flex items-center justify-center w-9 h-9 rounded-full text-body-lg" :style="{ backgroundColor: currentMember.avatarColor || '#909399' }">
              {{ currentMember.avatarEmoji || currentMember.name.charAt(0) }}
            </div>
            <template v-if="currentMember">
              <el-button class="member-action-btn" size="small" :loading="editMemberLoading" @click="handleEditMember(currentMember)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button class="member-action-btn !text-rose-400 hover:!text-rose-500 hover:!bg-rose-50" size="small" :loading="deleteMemberLoading" @click="handleDeleteMember(currentMember)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
            <el-divider direction="vertical" class="!mx-1" />
            <el-button type="primary" @click="showMemberDialog = true">
              <el-icon><Plus /></el-icon> 添加成员
            </el-button>
          </div>
          <el-button link @click="showReportDialog = true" class="!text-amber-600 !font-medium">
            <el-icon class="mr-1"><DataAnalysis /></el-icon> 数据报告
          </el-button>
        </div>

        <!-- 当前薪资大卡片 -->
        <div v-if="statistics && statistics.currentSalary !== null" class="mb-6 p-6 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div class="relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-white/80 text-body-sm">当前月薪</span>
              <span class="tag-capsule bg-white/20 text-white">
                {{ currentMember?.name || '我' }}
              </span>
            </div>
            <div class="flex items-end gap-2 mb-3">
              <span class="text-body-sm text-white/80 pb-3">¥</span>
              <span class="text-5xl font-bold">{{ formatMoney(statistics.currentSalary) }}</span>
              <span class="text-h3 text-white/80 pb-2">/ 月</span>
            </div>
            <div v-if="currentChange" class="flex items-center gap-4 text-body-sm">
              <span class="flex items-center gap-1">
                <el-icon v-if="currentChange.type === 'up'"><CaretTop /></el-icon>
                <el-icon v-else-if="currentChange.type === 'down'"><CaretBottom /></el-icon>
                <el-icon v-else><Minus /></el-icon>
                <span :class="currentChange.type === 'up' ? 'text-emerald-200' : currentChange.type === 'down' ? 'text-rose-200' : 'text-white'">
                  {{ currentChange.type === 'flat' ? '持平' : (currentChange.amount > 0 ? '+' : '') + formatMoney(currentChange.amount) + ' (' + (currentChange.percent > 0 ? '+' : '') + currentChange.percent.toFixed(2) + '%)' }}
                </span>
              </span>
              <span v-if="tenureText" class="flex items-center gap-1">
                <el-icon><Calendar /></el-icon> 已持续 {{ tenureText }}
              </span>
            </div>
            <div v-else-if="tenureText" class="text-body-sm flex items-center gap-1">
              <el-icon><Calendar /></el-icon> 已持续 {{ tenureText }}
            </div>
          </div>
        </div>

        <!-- 统计卡片网格 -->
        <div v-if="statistics && statistics.totalRecords > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <!-- 涨薪次数 -->
          <div class="stat-card bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span class="text-emerald-600">📈</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">涨薪次数</span>
            </div>
            <div class="text-h3 font-bold text-emerald-600">{{ statistics.totalRaises }}</div>
            <div class="text-caption text-gray-400 mt-1">次</div>
          </div>

          <!-- 降薪次数 -->
          <div class="stat-card bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <span class="text-rose-600">📉</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">降薪次数</span>
            </div>
            <div class="text-h3 font-bold text-rose-600">{{ statistics.totalCuts }}</div>
            <div class="text-caption text-gray-400 mt-1">次</div>
          </div>

          <!-- 年化增长率 -->
          <div v-if="statistics.yearsCovered >= 0.1" class="stat-card bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <span class="text-violet-600">⚡</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">年化增长</span>
            </div>
            <div class="text-h3 font-bold" :class="statistics.annualizedGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'">
              {{ statistics.annualizedGrowth >= 0 ? '+' : '' }}{{ statistics.annualizedGrowth.toFixed(2) }}%
            </div>
            <div class="text-caption text-gray-400 mt-1">/ 年</div>
          </div>

          <!-- 平均月薪 -->
          <div class="stat-card bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border border-amber-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <span class="text-amber-600">📊</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">平均月薪</span>
            </div>
            <div class="text-body font-bold text-amber-600">¥{{ formatMoney(statistics.avgSalary) }}</div>
            <div class="text-caption text-gray-400 mt-1">{{ statistics.totalRecords }} 条均</div>
          </div>

          <!-- 历史最高 -->
          <div class="stat-card bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl p-4 border border-cyan-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center">
                <span class="text-cyan-600">🔝</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">历史最高</span>
            </div>
            <div class="text-body font-bold text-cyan-600">¥{{ formatMoney(statistics.maxSalary) }}</div>
            <div class="text-caption text-gray-400 mt-1">峰值</div>
          </div>

          <!-- 历史最低 -->
          <div class="stat-card bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span class="text-indigo-600">📌</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">历史最低</span>
            </div>
            <div class="text-body font-bold text-indigo-600">¥{{ formatMoney(statistics.minSalary) }}</div>
            <div class="text-caption text-gray-400 mt-1">起点</div>
          </div>

          <!-- 记录时长 -->
          <div class="stat-card bg-gradient-to-br from-fuchsia-50 to-purple-50 rounded-2xl p-4 border border-fuchsia-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-fuchsia-100 flex items-center justify-center">
                <span class="text-fuchsia-600">⏳</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">记录时长</span>
            </div>
            <div class="text-body-lg font-bold text-fuchsia-600">{{ statistics.yearsCovered }} 年</div>
            <div class="text-caption text-gray-400 mt-1">跨度</div>
          </div>

          <!-- 涨幅评价 -->
          <div v-if="statistics.totalRecords >= 2" class="stat-card bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-yellow-200 flex items-center justify-center">
                <span class="text-yellow-600">🎯</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">最新评价</span>
            </div>
            <div class="text-body-lg font-bold" :style="{ color: changeRating.color }">
              {{ changeRating.text }}
            </div>
            <div class="text-caption text-gray-400 mt-1">综合判定</div>
          </div>

          <!-- 成就入口 -->
          <div v-if="achievements.length > 0" class="stat-card bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border border-yellow-200 cursor-pointer" @click="showAchievementDialog = true">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-yellow-200 flex items-center justify-center">
                <span class="text-yellow-600">🏆</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">我的成就</span>
            </div>
            <div class="text-body-lg font-bold text-yellow-600">
              {{ achievements.length }}
            </div>
            <div class="text-caption text-gray-400 mt-1">已解锁</div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button class="main-record-btn text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2" @click="openRecordDialog">
            <el-icon><Plus /></el-icon>
            <span>记录工资变化</span>
          </button>
        </div>
      </div>

      <!-- 图表卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-h3">📈</span>
            <span class="font-semibold text-gray-700">薪资成长曲线</span>
          </div>
          <el-button link class="!text-amber-600 !font-medium" :loading="shareLoading" @click="handleShare">
            <el-icon><Share /></el-icon> 分享
          </el-button>
        </div>
        <div ref="chartRef" class="chart-export-container w-full h-64 sm:h-80 rounded-2xl"></div>
        <div v-if="chartData.length >= 2" class="mt-3 flex items-center gap-4 text-caption text-gray-500">
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-emerald-500"></span> 涨薪点</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-rose-500"></span> 降薪点</span>
          <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-amber-500"></span> 薪资曲线</span>
        </div>
      </div>

      <!-- 历史记录 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-h3">📋</span>
            <span class="font-semibold text-gray-700">历史记录</span>
            <span class="text-caption text-gray-400">共 {{ formattedRecords.length }} 条</span>
          </div>
          <el-date-picker
            v-model="dateFilter"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            size="small"
            class="!w-auto"
            clearable
          />
        </div>
        <div v-if="loading" class="text-center py-12">
          <el-icon class="is-loading text-4xl text-amber-500"><Loading /></el-icon>
          <p class="text-gray-400 text-body-sm mt-2">加载中...</p>
        </div>
        <div v-else-if="formattedRecords.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📝</div>
          <p class="text-gray-400">暂无记录，点击"记录工资变化"开始记录吧~</p>
        </div>
        <div v-else class="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          <div
            v-for="record in formattedRecords"
            :key="record.id"
            class="record-item flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="flex-shrink-0 w-20 text-center">
                <div class="text-caption text-gray-700 font-medium">{{ record.effectiveDate }}</div>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="text-caption text-gray-400">¥</span>
                <span class="text-body-lg font-bold text-gray-800">{{ formatMoney(record.monthlyIncome) }}</span>
              </div>
              <div v-if="record.source" class="text-caption text-gray-500 hidden sm:inline">
                {{ record.source }}
              </div>
              <div v-if="record.changeAmount !== 0" class="flex-shrink-0 px-2 py-0.5 rounded-lg text-caption font-medium"
                :class="record.changeAmount > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'">
                {{ record.changeAmount > 0 ? '+' : '' }}{{ formatMoney(record.changeAmount) }}
                <span class="opacity-70">({{ record.changePercent > 0 ? '+' : '' }}{{ record.changePercent.toFixed(1) }}%)</span>
              </div>
              <div v-if="record.note" class="flex-1 min-w-0 hidden md:block">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-caption bg-gray-100 text-gray-500 truncate max-w-full">
                  {{ record.note }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <el-button link class="!text-amber-500" size="small" :loading="editRecordLoading" @click="handleEditRecord(record)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button link class="!text-rose-400" size="small" :loading="deleteRecordLoading" @click="handleDeleteRecord(record)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 记录对话框 -->
    <el-dialog v-model="showRecordDialog" title="记录工资变化" width="90%" :style="{ maxWidth: '480px' }" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="月收入">
          <el-input v-model="recordForm.monthlyIncome" type="number" placeholder="请输入月收入" clearable :disabled="recordLoading">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="recordForm.effectiveDate" type="date" placeholder="从这天起生效" value-format="YYYY-MM-DD" style="width: 100%" :disabled="recordLoading" />
        </el-form-item>
        <el-form-item label="来源/公司">
          <el-input v-model="recordForm.source" placeholder="如：ABC 公司 / 研发部" clearable :disabled="recordLoading" />
        </el-form-item>
        <el-form-item label="类型标签">
          <el-select v-model="recordForm.reasonTag" placeholder="调薪原因（可选）" style="width: 100%" clearable :disabled="recordLoading">
            <el-option v-for="tag in REASON_TAGS" :key="tag.value" :label="tag.label" :value="tag.value">
              <span :style="{ color: tag.color }">{{ tag.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="recordForm.note" type="textarea" :rows="3" placeholder="可选：调薪背景、新岗位职责等" :disabled="recordLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordDialog = false" :disabled="recordLoading">取消</el-button>
        <el-button type="primary" :loading="recordLoading" @click="handleAddRecord">记录</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑工资记录" width="90%" :style="{ maxWidth: '480px' }" :close-on-click-modal="false">
      <el-form v-if="editingRecord" label-width="90px">
        <el-form-item label="月收入">
          <el-input v-model.number="editingRecord.monthlyIncome" type="number" :disabled="editRecordLoading">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="editingRecord.effectiveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled="editRecordLoading" />
        </el-form-item>
        <el-form-item label="来源/公司">
          <el-input v-model="editingRecord.source" clearable :disabled="editRecordLoading" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editingRecord.note" type="textarea" :rows="3" :disabled="editRecordLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false" :disabled="editRecordLoading">取消</el-button>
        <el-button type="primary" :loading="editRecordLoading" @click="handleUpdateRecord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 年度报告 -->
    <el-dialog v-model="showReportDialog" title="年度报告" width="90%" :style="{ maxWidth: '520px' }">
      <div v-if="statistics && statistics.yearlyReport" class="space-y-4">
        <div class="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">📊</span>
            <h4 class="font-semibold text-amber-700">{{ statistics.yearlyReport.year }} 年薪资变化</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-body-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">年初月薪</div>
              <div class="font-bold text-gray-700">¥{{ formatMoney(statistics.yearlyReport.startIncome) }}</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">当前月薪</div>
              <div class="font-bold text-gray-700">¥{{ formatMoney(statistics.yearlyReport.endIncome) }}</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">年度涨薪</div>
              <div class="font-bold" :class="statistics.yearlyReport.changeAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.yearlyReport.changeAmount >= 0 ? '+' : '' }}¥{{ formatMoney(statistics.yearlyReport.changeAmount) }}
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">涨薪幅度</div>
              <div class="font-bold" :class="statistics.yearlyReport.changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.yearlyReport.changePercent >= 0 ? '+' : '' }}{{ statistics.yearlyReport.changePercent.toFixed(2) }}%
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">年内变动</div>
              <div class="font-bold text-gray-700">{{ statistics.yearlyReport.recordCount }} 次</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">首次/末次变动</div>
              <div class="font-bold text-gray-700 text-xs">{{ statistics.yearlyReport.firstChangeDate }} → {{ statistics.yearlyReport.lastChangeDate }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-400">
        暂无本年度记录
      </div>
      <template #footer>
        <el-button type="primary" @click="showReportDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 成就对话框 -->
    <el-dialog v-model="showAchievementDialog" title="我的成就" width="90%" :style="{ maxWidth: '440px' }">
      <div v-if="achievements.length > 0" class="grid grid-cols-3 gap-3">
        <div
          v-for="achievement in achievements"
          :key="achievement.id"
          class="achievement-card flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 unlocked"
        >
          <div class="text-h1 mb-2">{{ achievement.icon }}</div>
          <div class="text-caption font-medium text-center text-gray-700">{{ achievement.title }}</div>
          <div class="text-caption text-gray-400 text-center mt-0.5">{{ achievement.description }}</div>
        </div>
      </div>
      <div v-else class="text-center py-8">
        <div class="text-5xl mb-3">🏆</div>
        <p class="text-gray-400">暂无成就，开始记录吧！</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="showAchievementDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 添加成员对话框 -->
    <el-dialog v-model="showMemberDialog" title="添加成员" width="90%" :style="{ maxWidth: '460px' }" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、老婆、老爸" clearable maxlength="50" show-word-limit :disabled="memberLoading" />
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" :disabled="memberLoading" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选 Emoji" style="width: 140px" clearable filterable :disabled="memberLoading">
              <el-option v-for="emoji in MEMBER_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
            </el-select>
            <div v-if="memberForm.avatarEmoji" class="avatar-circle flex items-center justify-center w-10 h-10 rounded-full text-h2" :style="{ backgroundColor: memberForm.avatarColor }">
              {{ memberForm.avatarEmoji }}
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMemberDialog = false" :disabled="memberLoading">取消</el-button>
        <el-button type="primary" :loading="memberLoading" @click="handleAddMember">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑成员对话框 -->
    <el-dialog v-model="showEditMemberDialog" title="编辑成员" width="90%" :style="{ maxWidth: '460px' }" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、老婆、老爸" clearable maxlength="50" show-word-limit :disabled="editMemberLoading" />
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" :disabled="editMemberLoading" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选 Emoji" style="width: 140px" clearable filterable :disabled="editMemberLoading">
              <el-option v-for="emoji in MEMBER_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
            </el-select>
            <div v-if="memberForm.avatarEmoji" class="avatar-circle flex items-center justify-center w-10 h-10 rounded-full text-h2" :style="{ backgroundColor: memberForm.avatarColor }">
              {{ memberForm.avatarEmoji }}
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditMemberDialog = false" :disabled="editMemberLoading">取消</el-button>
        <el-button type="primary" :loading="editMemberLoading" @click="handleUpdateMember">保存</el-button>
      </template>
    </el-dialog>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4 text-gray-600">
        <p class="text-gray-700">工资变化记录是一款轻量实用的薪资追踪工具，帮助你记录每一次薪资变动，绘制你的薪资成长曲线，量化职业发展进度。</p>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span class="text-body-lg">✨</span> 主要功能
          </h4>
          <div class="grid sm:grid-cols-2 gap-2 ml-6">
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>生效日期记录</strong>：从这天起薪资变为 X 元，符合实际调薪语义</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>来源/公司</strong>：支持多段职业履历，跳槽加薪一目了然</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>涨幅分析</strong>：自动计算调薪金额、百分比、年化增长率</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>成长曲线</strong>：阶梯折线图直观展示薪资台阶，标注每次变动</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>年度报告</strong>：本年内涨薪金额/次数/百分比一览</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>里程碑成就</strong>：5K、1万、2万、5万……解锁徽章</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>调薪标签</strong>：年度调薪/晋升/跳槽/绩效等分类标注</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span><strong>分享功能</strong>：导出曲线图，分享你的成长轨迹</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-amber-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">💡</span> 使用建议
          </h4>
          <p class="text-body-sm">建议在每次薪资实际发生变化时新增一条记录，生效日期填写工资条开始执行新标准的那个月。跳槽时同样建议新增记录并填写新的来源/公司，便于分析职业路径。如果一年内多次小幅调薪，年化增长率会自动反映整体趋势。</p>
        </div>

        <div class="p-3 bg-rose-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">🔒</span> 隐私保护
          </h4>
          <p class="text-body-sm">工资属于敏感个人数据，本工具数据存储在你的登录账户下，请妥善保管登录凭证。如需彻底删除，可在「我的成就/记录」逐条删除，或联系管理员清除账号数据。</p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import DataAnalysis from '~icons/ep/dataAnalysis'
import Loading from '~icons/ep/loading'
import Plus from '~icons/ep/plus'
import Promotion from '~icons/ep/promotion'
import Share from '~icons/ep/share'
import Calendar from '~icons/ep/calendar'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
import CaretTop from '~icons/ep/caret-top'
import CaretBottom from '~icons/ep/caret-bottom'
import Minus from '~icons/ep/minus'
import User from '~icons/ep/user'
import ArrowDown from '~icons/ep/arrow-down'
export default {
  components: { DataAnalysis, Loading, Plus, Promotion, Share, Calendar, Edit, Delete, CaretTop, CaretBottom, Minus, User, ArrowDown }
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
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.stat-card:hover::before {
  opacity: 1;
}

.record-item {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.record-item:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
  border-left-color: #f59e0b;
  transform: translateX(4px);
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
  background: linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%);
  border: none;
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.main-record-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
  transition: all 0.3s ease;
}

.main-record-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4);
}

.main-record-btn:active {
  transform: translateY(0);
}

:deep(.is-loading) {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.tag-capsule {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tag-capsule:hover {
  transform: scale(1.05);
}

.achievement-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.achievement-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.achievement-card.unlocked {
  animation: achievement-glow 2s ease-in-out infinite;
}

@keyframes achievement-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(251, 191, 36, 0); }
  50% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); }
}
</style>