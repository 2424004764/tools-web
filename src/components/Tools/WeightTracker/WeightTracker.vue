<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { debounce } from 'lodash-es'
import html2canvas from 'html2canvas'
import { weightApi } from './api'
import type { WeightMember, WeightRecord, WeightStatistics, ChartDataPoint, TimeRange, WeightUnit, HealthyRange, Achievement } from './types'
import { NOTE_TAGS } from './types'
import { useUserStore } from '@/store/modules/user'

const info = { title: '体重记录' }

// Emoji 头像列表
const AVATAR_EMOJIS = ['😀', '😊', '🙂', '😎', '🤗', '💪', '🏃', '⭐', '🌟', '❤️', '🎯', '🔥']

// 默认统计数据
const defaultStatistics: WeightStatistics = {
  currentWeight: null,
  lastWeight: null,
  changeFromLast: 0,
  changeFromYesterday: 0,
  maxWeight: null,
  minWeight: null,
  avgWeight: null,
  totalDays: 0,
  totalRecords: 0,
  consecutiveDays: 0,
  weeklyReport: null,
  monthlyReport: null,
  weeklyChangeRate: 0,
  monthlyChangeRate: 0,
  bmr: null,
  healthyRange: null
}

// ===== 状态管理 =====
const members = ref<WeightMember[]>([])
const currentMemberId = ref<string>('')
const records = ref<WeightRecord[]>([])
const statistics = ref<WeightStatistics>(defaultStatistics)
const chartData = ref<ChartDataPoint[]>([])

// UI 状态
const timeRange = ref<TimeRange>('30')
const weightUnit = ref<WeightUnit>('jin')
const showMemberDialog = ref(false)
const showEditMemberDialog = ref(false)
const showRecordDialog = ref(false)
const showEditDialog = ref(false)
const showReportDialog = ref(false)
const showAchievementDialog = ref(false)
const editingRecord = ref<WeightRecord | null>(null)
const editingMember = ref<WeightMember | null>(null)
const loading = ref(false)
const isFirstTime = ref(false)

// ===== localStorage 持久化 =====
const userStore = useUserStore()

// 获取当前选中的成员ID（从localStorage）
const getSavedMemberId = (): string => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  return localStorage.getItem(`weight_tracker_member_${uid}`) || ''
}

// 保存当前选中的成员ID到localStorage
const saveMemberId = (memberId: string) => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  localStorage.setItem(`weight_tracker_member_${uid}`, memberId)
}

// 记录表单
const recordForm = ref({
  memberId: '',
  weight: '',
  note: '',
  recordDate: '',
  recordTime: '',
  noteTag: ''
})

// 时间筛选
const dateFilter = ref<[Date, Date] | null>(null)

// 成员表单
const memberForm = ref({
  name: '',
  height: '',
  goalWeight: '',
  avatarColor: '#409EFF',
  avatarEmoji: ''
})

// 图表相关
const chartRef = ref<HTMLElement>()
let chartInstance: ECharts | null = null

// ===== 计算属性 =====
const currentMember = computed(() => {
  return members.value.find(m => m.id === currentMemberId.value)
})

const bmi = computed(() => {
  if (!statistics.value?.currentWeight || !currentMember.value?.height) return null
  const weightInKg = statistics.value.currentWeight / 2
  const heightInM = currentMember.value.height / 100
  return (weightInKg / (heightInM * heightInM)).toFixed(1)
})

const bmiStatus = computed((): { text: string; color: string } | null => {
  if (!bmi.value) return null
  const bmiNum = parseFloat(bmi.value)
  if (bmiNum < 18.5) return { text: '偏瘦', color: '#409EFF' }
  if (bmiNum < 24) return { text: '正常', color: '#67C23A' }
  if (bmiNum < 28) return { text: '偏胖', color: '#E6A23C' }
  return { text: '肥胖', color: '#F56C6C' }
})

// 健康体重区间
const healthyRange = computed((): HealthyRange | null => {
  if (!currentMember.value?.height) return null
  const heightInM = currentMember.value.height / 100
  const minWeightKg = 18.5 * heightInM * heightInM
  const maxWeightKg = 24 * heightInM * heightInM
  return {
    minWeight: parseFloat((minWeightKg * 2).toFixed(1)),
    maxWeight: parseFloat((maxWeightKg * 2).toFixed(1))
  }
})

// 目标进度
const goalProgress = computed(() => {
  if (!currentMember.value?.goalWeight || !statistics.value?.currentWeight) return null
  const current = statistics.value.currentWeight
  const goal = currentMember.value.goalWeight
  const diff = goal - current
  const isLosing = diff < 0
  const progress = Math.min(100, Math.abs((current - (currentMember.value.goalWeight || current)) / (currentMember.value.goalWeight || current)) * 100)
  return { diff, isLosing, progress: Number(progress.toFixed(2)) }
})

const displayWeight = computed(() => {
  if (!statistics.value?.currentWeight) return '--'
  if (weightUnit.value === 'jin') {
    return statistics.value.currentWeight.toFixed(1)
  }
  return (statistics.value.currentWeight / 2).toFixed(1)
})

const weightUnitText = computed(() => weightUnit.value === 'jin' ? '斤' : 'kg')

const formattedRecords = computed(() => {
  if (!Array.isArray(records.value)) return []
  // 按记录日期降序排序（最新的在前），这样比较的是日期相邻的记录
  let filteredRecords = [...records.value].sort((a, b) => {
    const dateCompare = b.recordDate.localeCompare(a.recordDate)
    if (dateCompare !== 0) return dateCompare
    // 同一天按时间降序
    return (b.recordTime || '23:59').localeCompare(a.recordTime || '23:59')
  })

  if (dateFilter.value && dateFilter.value.length === 2) {
    const [start, end] = dateFilter.value
    const startDateStr = start.toISOString().split('T')[0]
    const endDateStr = end.toISOString().split('T')[0]
    filteredRecords = filteredRecords.filter(r => r.recordDate >= startDateStr && r.recordDate <= endDateStr)
  }

  // 计算与下一条记录（更早的记录）的变化
  return filteredRecords.map((r, index) => {
    let change = 0
    // 第一条（最新）不显示变化，与下一条（更早的）比较
    const nextWeight = filteredRecords[index + 1]?.weight
    if (nextWeight !== undefined) {
      change = r.weight - nextWeight
    }
    return {
      ...r,
      change
    }
  })
})

// 成就系统
const achievements = computed((): Achievement[] => {
  const stats = statistics.value
  const achievements: Achievement[] = []

  // 连续记录成就
  if (stats.consecutiveDays >= 3) achievements.push({
    id: 'streak-3',
    title: '坚持3天',
    description: '连续记录3天',
    icon: '🔥',
    unlocked: true
  })
  if (stats.consecutiveDays >= 7) achievements.push({
    id: 'streak-7',
    title: '坚持一周',
    description: '连续记录7天',
    icon: '⭐',
    unlocked: true
  })
  if (stats.consecutiveDays >= 30) achievements.push({
    id: 'streak-30',
    title: '坚持一月',
    description: '连续记录30天',
    icon: '🏆',
    unlocked: true
  })

  // 累计天数成就
  if (stats.totalDays >= 10) achievements.push({
    id: 'days-10',
    title: '初见成效',
    description: '累计记录10天',
    icon: '🌱',
    unlocked: true
  })
  if (stats.totalDays >= 30) achievements.push({
    id: 'days-30',
    title: '月度习惯',
    description: '累计记录30天',
    icon: '📅',
    unlocked: true
  })
  if (stats.totalDays >= 100) achievements.push({
    id: 'days-100',
    title: '百日筑基',
    description: '累计记录100天',
    icon: '💎',
    unlocked: true
  })

  // 目标达成
  if (goalProgress.value && goalProgress.value.progress >= 100) achievements.push({
    id: 'goal-reached',
    title: '目标达成',
    description: '已达目标体重',
    icon: '🎯',
    unlocked: true
  })

  // 首次记录
  if (stats.totalRecords >= 1) achievements.push({
    id: 'first-record',
    title: '首次记录',
    description: '完成第一次体重记录',
    icon: '🎉',
    unlocked: true
  })

  return achievements
})

// 变化速度评价
const changeSpeedRating = computed(() => {
  const rate = statistics.value.weeklyChangeRate
  if (rate === 0) return { text: '保持稳定', color: '#67C23A' }
  const absRate = Math.abs(rate)
  if (absRate < 0.5) return { text: '变化平缓', color: '#67C23A' }
  if (absRate < 1) return { text: '正常变化', color: '#409EFF' }
  if (absRate < 2) return { text: '变化较快', color: '#E6A23C' }
  return { text: '变化剧烈', color: '#F56C6C' }
})

// ===== API 调用 =====
const fetchMembers = async () => {
  try {
    members.value = await weightApi.getMembers()
    // 优先使用保存的成员ID，其次使用默认成员
    const savedMemberId = getSavedMemberId()
    if (savedMemberId && members.value.find(m => m.id === savedMemberId)) {
      currentMemberId.value = savedMemberId
    } else if (!currentMemberId.value && members.value.length > 0) {
      const defaultMember = members.value.find(m => m.isDefault) || members.value[0]
      currentMemberId.value = defaultMember.id
    }
    isFirstTime.value = members.value.length === 0
  } catch (error) {
    ElMessage.error('获取成员列表失败')
  }
}

const fetchRecords = async () => {
  if (!currentMemberId.value) return
  loading.value = true
  try {
    const params: any = { memberId: currentMemberId.value }
    if (dateFilter.value && dateFilter.value.length === 2) {
      const [start, end] = dateFilter.value
      params.startDate = start.toISOString().split('T')[0]
      params.endDate = end.toISOString().split('T')[0]
    }
    const data = await weightApi.getRecords(params)
    records.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error('获取记录列表失败')
    records.value = []
  } finally {
    loading.value = false
  }
}

const fetchStatistics = async () => {
  if (!currentMemberId.value) return
  try {
    const data = await weightApi.getStatistics(currentMemberId.value)
    statistics.value = data || defaultStatistics
  } catch (error) {
    statistics.value = defaultStatistics
  }
}

const fetchChartData = async () => {
  if (!currentMemberId.value) return
  try {
    const days = timeRange.value === 'all' ? 365 : parseInt(timeRange.value)
    const data = await weightApi.getChartData(currentMemberId.value, days)
    chartData.value = Array.isArray(data) ? data : []
    renderChart()
  } catch (error) {
    chartData.value = []
  }
}

const refreshData = async () => {
  await Promise.all([fetchRecords(), fetchStatistics(), fetchChartData()])
}

// ===== 操作方法 =====
const openRecordDialog = () => {
  if (members.value.length === 0) {
    ElMessage.warning('请先添加成员')
    showMemberDialog.value = true
    return
  }
  const now = new Date()
  recordForm.value = {
    memberId: currentMemberId.value,
    weight: '',
    note: '',
    recordDate: now.toISOString().split('T')[0],
    recordTime: now.toTimeString().slice(0, 5),
    noteTag: ''
  }
  showRecordDialog.value = true
}

const handleShare = async () => {
  try {
    // 使用 html2canvas 导出图表
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
        a.download = `体重记录_${currentMember.value?.name || '我'}_${new Date().toISOString().split('T')[0]}.png`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('图片已保存')
      }
    })
  } catch (error) {
    ElMessage.error('分享失败')
  }
}

const handleAddRecord = async () => {
  if (!recordForm.value.memberId) {
    ElMessage.warning('请选择成员')
    return
  }
  if (!recordForm.value.weight) {
    ElMessage.warning('请输入体重')
    return
  }
  const weight = parseFloat(recordForm.value.weight)
  if (isNaN(weight) || weight <= 0 || weight > 500) {
    ElMessage.warning('请输入有效的体重值（0-500斤）')
    return
  }
  try {
    // 组合备注（标签 + 自定义备注）
    let fullNote = recordForm.value.note || ''
    if (recordForm.value.noteTag) {
      const tag = NOTE_TAGS.find(t => t.value === recordForm.value.noteTag)
      if (tag) fullNote = `[${tag.label}] ${fullNote}`.trim()
    }
    const data = {
      memberId: recordForm.value.memberId,
      weight: weight,
      note: fullNote,
      recordDate: recordForm.value.recordDate,
      recordTime: recordForm.value.recordTime
    }
    await weightApi.createRecord(data)
    ElMessage.success('记录成功')
    showRecordDialog.value = false
    // 重置表单
    recordForm.value.noteTag = ''
    await refreshData()
  } catch (error) {
    ElMessage.error('记录失败')
  }
}

const handleDeleteRecord = async (record: WeightRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await weightApi.deleteRecord(record.id)
    ElMessage.success('删除成功')
    await refreshData()
  } catch (error) {
    // 用户取消
  }
}

const handleEditRecord = (record: WeightRecord) => {
  editingRecord.value = { ...record }
  showEditDialog.value = true
}

const handleUpdateRecord = async () => {
  if (!editingRecord.value) return
  try {
    await weightApi.updateRecord(editingRecord.value.id, {
      weight: editingRecord.value.weight,
      note: editingRecord.value.note,
      recordDate: editingRecord.value.recordDate,
      recordTime: editingRecord.value.recordTime
    })
    ElMessage.success('更新成功')
    showEditDialog.value = false
    await refreshData()
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

const handleAddMember = async () => {
  if (!memberForm.value.name) {
    ElMessage.warning('请输入成员名称')
    return
  }
  try {
    const result = await weightApi.createMember({
      name: memberForm.value.name,
      height: memberForm.value.height ? parseFloat(memberForm.value.height) : null,
      goalWeight: memberForm.value.goalWeight ? parseFloat(memberForm.value.goalWeight) : null,
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || undefined,
      isDefault: members.value.length === 0 ? 1 : 0
    })
    if (result.updated) {
      ElMessage.success('成员已存在，信息已更新')
    } else {
      ElMessage.success('添加成功')
    }
    memberForm.value = { name: '', height: '', goalWeight: '', avatarColor: '#409EFF', avatarEmoji: '' }
    showMemberDialog.value = false
    await fetchMembers()
    currentMemberId.value = result.id
    isFirstTime.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleDeleteMember = async (member: WeightMember) => {
  try {
    await ElMessageBox.confirm(`确定要删除成员"${member.name}"吗？这将同时删除该成员的所有体重记录。`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await weightApi.deleteMember(member.id)
    ElMessage.success('删除成功')
    if (currentMemberId.value === member.id) {
      currentMemberId.value = members.value.find(m => m.id !== member.id)?.id || ''
    }
    await fetchMembers()
    await refreshData()
  } catch (error) {
    // 用户取消
  }
}

const handleEditMember = (member: WeightMember) => {
  editingMember.value = { ...member }
  memberForm.value = {
    name: member.name,
    height: member.height ? String(member.height) : '',
    goalWeight: member.goalWeight ? String(member.goalWeight) : '',
    avatarColor: member.avatarColor,
    avatarEmoji: member.avatarEmoji || ''
  }
  showEditMemberDialog.value = true
}

const handleUpdateMember = async () => {
  if (!editingMember.value) return
  if (!memberForm.value.name) {
    ElMessage.warning('请输入成员名称')
    return
  }
  try {
    await weightApi.updateMember(editingMember.value.id, {
      name: memberForm.value.name,
      height: memberForm.value.height ? parseFloat(memberForm.value.height) : null,
      goalWeight: memberForm.value.goalWeight ? parseFloat(memberForm.value.goalWeight) : null,
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || undefined
    })
    ElMessage.success('更新成功')
    showEditMemberDialog.value = false
    editingMember.value = null
    await fetchMembers()
    await refreshData()
  } catch (error) {
    ElMessage.error('更新失败')
  }
}

// ===== 图表相关 =====
const initChart = () => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
  renderChart()
}

const renderChart = () => {
  if (!chartInstance) return
  if (!chartData.value || !Array.isArray(chartData.value) || chartData.value.length === 0) {
    chartInstance.clear()
    chartInstance.setOption({ xAxis: { data: [] }, yAxis: {}, series: [] })
    return
  }

  // 添加目标线
  const series: any[] = [{
    name: currentMember.value?.name || '体重',
    type: 'line',
    smooth: true,
    data: chartData.value.map(d => [d.date, d.weight]),
    itemStyle: { color: currentMember.value?.avatarColor || '#409EFF' },
    lineStyle: { width: 3 }
  }]

  // 目标体重线
  if (currentMember.value?.goalWeight) {
    series.push({
      name: '目标',
      type: 'line',
      data: chartData.value.map(d => [d.date, currentMember.value!.goalWeight]),
      itemStyle: { color: '#E6A23C' },
      lineStyle: { type: 'dashed', width: 2 },
      showSymbol: false
    })
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>'
        params.forEach((param: any) => {
          result += `${param.marker} ${param.seriesName}: ${param.value[1].toFixed(1)} 斤<br/>`
        })
        return result
      }
    },
    legend: {
      data: series.map(s => s.name),
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...new Set(chartData.value.map(d => d.date))].sort()
    },
    yAxis: {
      type: 'value',
      name: '体重（斤）',
      scale: true
    },
    series
  }
  chartInstance.setOption(option)
}

const handleResize = () => {
  chartInstance?.resize()
}

// ===== 监听（带防抖）=====
const debouncedFetchChartData = debounce(async () => {
  await fetchChartData()
}, 300)

watch(currentMemberId, async (newId) => {
  if (newId) {
    saveMemberId(newId)
  }
  await refreshData()
})

watch(timeRange, () => {
  debouncedFetchChartData()
})

watch(dateFilter, async () => {
  await fetchRecords()
})

// ===== 生命周期 =====
onMounted(async () => {
  userStore.initUserState()
  await fetchMembers()
  if (currentMemberId.value) {
    await refreshData()
  }
  nextTick(() => {
    initChart()
  })
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
    <DetailHeader :title="info.title" />

    <!-- 首次使用引导 -->
    <div v-if="isFirstTime" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4 animate-bounce">⚖️</div>
      <h3 class="text-xl font-bold text-white mb-3">欢迎使用体重记录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">添加您的第一个成员，开启健康体重管理之旅</p>
      <el-button size="large" class="!bg-white !text-purple-600 !border-none hover:!bg-gray-100" @click="showMemberDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon> 添加成员
      </el-button>
    </div>

    <div v-else class="px-3 sm:px-0 pb-6">
      <!-- 主内容卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <!-- 成员选择栏 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-gray-500">成员</span>
            <el-select v-model="currentMemberId" placeholder="选择成员" class="!w-32">
              <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
            <div v-if="currentMember" class="avatar-circle flex items-center justify-center w-9 h-9 rounded-full text-lg" :style="{ backgroundColor: currentMember.avatarColor }">
              {{ currentMember.avatarEmoji || currentMember.name.charAt(0) }}
            </div>
            <!-- 成员操作按钮组 -->
            <template v-if="currentMember">
              <el-button class="member-action-btn" size="small" @click="handleEditMember(currentMember)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button class="member-action-btn !text-rose-400 hover:!text-rose-500 hover:!bg-rose-50" size="small" @click="handleDeleteMember(currentMember)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
            <el-divider direction="vertical" class="!mx-1" />
            <el-button type="primary" @click="showMemberDialog = true">
              <el-icon><Plus /></el-icon> 添加成员
            </el-button>
          </div>
          <el-button link @click="showReportDialog = true" class="!text-indigo-500 !font-medium">
            <el-icon class="mr-1"><DataAnalysis /></el-icon> 数据报告
          </el-button>
        </div>

        <!-- 当前体重大卡片 -->
        <div v-if="statistics && statistics.currentWeight" class="mb-6 p-6 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div class="relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-white/80 text-sm">当前体重</span>
              <span class="tag-capsule bg-white/20 text-white">
                {{ currentMember?.name || '我' }}
              </span>
            </div>
            <div class="flex items-end gap-3 mb-3">
              <span class="text-5xl font-bold">{{ displayWeight }}</span>
              <span class="text-xl text-white/80 pb-2">{{ weightUnitText }}</span>
            </div>
            <div class="flex items-center gap-4 text-sm">
              <span v-if="goalProgress" class="flex items-center gap-1">
                <el-icon><TrendCharts /></el-icon>
                距目标 {{ Math.abs(goalProgress.diff).toFixed(1) }} 斤
              </span>
              <span class="flex items-center gap-1">
                <el-icon><Calendar /></el-icon>
                已记录 {{ statistics.totalDays }} 天
              </span>
            </div>
          </div>
        </div>

        <!-- 统计卡片网格 -->
        <div v-if="statistics" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <!-- 较昨日变化 -->
          <div class="stat-card bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span class="text-emerald-600">📊</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">较昨日</span>
            </div>
            <div class="text-xl font-bold" :class="statistics.changeFromYesterday >= 0 ? 'text-rose-500' : 'text-emerald-500'">
              {{ statistics.changeFromYesterday >= 0 ? '+' : '' }}{{ statistics.changeFromYesterday.toFixed(1) }}
            </div>
            <div class="text-xs text-gray-400 mt-1">斤</div>
          </div>

          <!-- BMI -->
          <div v-if="bmi && bmiStatus" class="stat-card bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <span class="text-violet-600">🎯</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">BMI</span>
            </div>
            <div class="text-xl font-bold" :style="{ color: bmiStatus.color }">
              {{ bmi }}
            </div>
            <div class="tag-capsule mt-1" :style="{ backgroundColor: bmiStatus.color + '20', color: bmiStatus.color }">
              {{ bmiStatus.text }}
            </div>
          </div>

          <!-- 变化速度 -->
          <div class="stat-card bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <span class="text-amber-600">⚡</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">周变化</span>
            </div>
            <div class="text-lg font-bold" :class="statistics.weeklyChangeRate >= 0 ? 'text-rose-500' : 'text-emerald-500'">
              {{ statistics.weeklyChangeRate >= 0 ? '+' : '' }}{{ statistics.weeklyChangeRate.toFixed(2) }}
            </div>
            <div class="tag-capsule mt-1" :style="{ backgroundColor: changeSpeedRating.color + '20', color: changeSpeedRating.color }">
              {{ changeSpeedRating.text }}
            </div>
          </div>

          <!-- BMR基础代谢 -->
          <div v-if="statistics.bmr" class="stat-card bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <span class="text-rose-600">🔥</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">基础代谢</span>
            </div>
            <div class="text-lg font-bold text-rose-600">
              {{ statistics.bmr }}
            </div>
            <div class="text-xs text-gray-400 mt-1">kcal/天</div>
          </div>

          <!-- 健康区间 -->
          <div v-if="healthyRange" class="stat-card bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl p-4 border border-cyan-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center">
                <span class="text-cyan-600">💪</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">健康区间</span>
            </div>
            <div class="text-base font-bold text-cyan-600">
              {{ healthyRange.minWeight }}-{{ healthyRange.maxWeight }}
            </div>
            <div class="text-xs text-gray-400 mt-1">斤</div>
          </div>

          <!-- 记录统计 -->
          <div class="stat-card bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span class="text-indigo-600">📝</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">记录天数</span>
            </div>
            <div class="flex gap-3">
              <div>
                <div class="text-lg font-bold text-indigo-600">{{ statistics.consecutiveDays }}</div>
                <div class="text-xs text-gray-400">连续</div>
              </div>
              <div class="text-gray-300">|</div>
              <div>
                <div class="text-lg font-bold text-indigo-700">{{ statistics.totalDays }}</div>
                <div class="text-xs text-gray-400">累计</div>
              </div>
            </div>
          </div>

          <!-- 成就入口 -->
          <div v-if="achievements.length > 0" class="stat-card bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200 cursor-pointer" @click="showAchievementDialog = true">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-yellow-200 flex items-center justify-center">
                <span class="text-yellow-600">🏆</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">我的成就</span>
            </div>
            <div class="text-lg font-bold text-yellow-600">
              {{ achievements.filter(a => a.unlocked).length }}/{{ achievements.length }}
            </div>
            <div class="text-xs text-gray-400 mt-1">已解锁</div>
          </div>

          <!-- 总记录数 -->
          <div class="stat-card bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-4 border border-slate-200">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center">
                <span class="text-slate-600">📋</span>
              </div>
              <span class="text-xs text-gray-500 font-medium">总记录</span>
            </div>
            <div class="text-xl font-bold text-slate-600">
              {{ statistics.totalRecords }}
            </div>
            <div class="text-xs text-gray-400 mt-1">条记录</div>
          </div>
        </div>


        <!-- 目标进度条 -->
        <div v-if="goalProgress && currentMember?.goalWeight" class="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-lg">🎯</span>
              <span class="text-sm font-medium text-gray-700">目标进度</span>
            </div>
            <span class="text-lg font-bold" :class="goalProgress.isLosing ? 'text-emerald-500' : 'text-orange-500'">
              {{ currentMember.goalWeight }} 斤
            </span>
          </div>
          <el-progress
            :percentage="goalProgress.progress"
            :color="goalProgress.isLosing ? '#10b981' : '#f59e0b'"
            :stroke-width="10"
            :show-text="true"
          />
          <div class="text-xs text-gray-500 mt-2 text-center">
            {{ goalProgress.progress >= 100 ? '🎉 已达成目标！' : `还差 ${Math.abs(goalProgress.diff).toFixed(1)} 斤` }}
          </div>
        </div>

        <!-- 操作区域 -->
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <button class="main-record-btn text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2" @click="openRecordDialog">
              <el-icon><Plus /></el-icon>
              <span>记录体重</span>
            </button>
            <div class="flex gap-2">
              <el-button link @click="showReportDialog = true" class="!text-sm">
                <el-icon><DataAnalysis /></el-icon> 数据报告
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 图表卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">📈</span>
            <span class="font-semibold text-gray-700">体重趋势</span>
          </div>
          <div class="flex items-center gap-2">
            <el-button link class="!text-indigo-500 !font-medium" @click="handleShare">
              <el-icon><Share /></el-icon> 分享
            </el-button>
            <el-radio-group v-model="timeRange" size="small">
              <el-radio-button label="7">7天</el-radio-button>
              <el-radio-button label="30">30天</el-radio-button>
              <el-radio-button label="90">3月</el-radio-button>
              <el-radio-button label="all">全部</el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <div ref="chartRef" class="chart-export-container w-full h-64 sm:h-80 rounded-2xl"></div>
      </div>

      <!-- 历史记录卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">📋</span>
            <span class="font-semibold text-gray-700">历史记录</span>
            <span class="text-xs text-gray-400">共 {{ formattedRecords.length }} 条</span>
          </div>
          <el-date-picker
            v-model="dateFilter"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            size="small"
            class="!w-auto"
            clearable
          />
        </div>
        <div v-if="loading" class="text-center py-12">
          <el-icon class="is-loading text-4xl text-indigo-500"><Loading /></el-icon>
          <p class="text-gray-400 text-sm mt-2">加载中...</p>
        </div>
        <div v-else-if="formattedRecords.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📝</div>
          <p class="text-gray-400">暂无记录，点击"记录体重"开始记录吧~</p>
        </div>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto pr-1">
          <div
            v-for="record in formattedRecords"
            :key="record.id"
            class="record-item flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="flex-shrink-0 w-14 text-center">
                <div class="text-xs text-gray-400">{{ record.recordDate.slice(5) }}</div>
                <div class="text-xs text-gray-300">{{ record.recordTime }}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-lg font-bold text-gray-800">{{ record.weight.toFixed(1) }}</span>
                <span class="text-xs text-gray-400">斤</span>
              </div>
              <div v-if="record.change !== 0" class="flex-shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium"
                :class="record.change > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'">
                {{ record.change > 0 ? '↑' : '↓' }} {{ Math.abs(record.change).toFixed(1) }}
              </div>
              <div v-if="record.note" class="flex-1 min-w-0">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs bg-gray-100 text-gray-500 truncate max-w-full">
                  {{ record.note }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <el-button link class="!text-indigo-500" size="small" @click="handleEditRecord(record)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button link class="!text-rose-400" size="small" @click="handleDeleteRecord(record)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加成员对话框 -->
    <el-dialog v-model="showMemberDialog" title="添加成员" width="90%" :style="{ maxWidth: '420px' }">
      <el-form label-width="80px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、老婆、孩子" clearable />
        </el-form-item>
        <el-form-item label="身高">
          <el-input v-model="memberForm.height" type="number" placeholder="用于计算BMI">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="目标体重">
          <el-input v-model="memberForm.goalWeight" type="number" placeholder="可选">
            <template #append>斤</template>
          </el-input>
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选Emoji" style="width: 140px" clearable filterable>
              <el-option v-for="emoji in AVATAR_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
            </el-select>
            <div v-if="memberForm.avatarEmoji" class="avatar-circle flex items-center justify-center w-10 h-10 rounded-full text-2xl" :style="{ backgroundColor: memberForm.avatarColor }">
              {{ memberForm.avatarEmoji }}
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMemberDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddMember">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑成员对话框 -->
    <el-dialog v-model="showEditMemberDialog" title="编辑成员" width="90%" :style="{ maxWidth: '420px' }">
      <el-form label-width="80px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、老婆、孩子" clearable />
        </el-form-item>
        <el-form-item label="身高">
          <el-input v-model="memberForm.height" type="number" placeholder="用于计算BMI">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="目标体重">
          <el-input v-model="memberForm.goalWeight" type="number" placeholder="可选">
            <template #append>斤</template>
          </el-input>
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选Emoji" style="width: 140px" clearable filterable>
              <el-option v-for="emoji in AVATAR_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
            </el-select>
            <div v-if="memberForm.avatarEmoji" class="avatar-circle flex items-center justify-center w-10 h-10 rounded-full text-2xl" :style="{ backgroundColor: memberForm.avatarColor }">
              {{ memberForm.avatarEmoji }}
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditMemberDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateMember">保存</el-button>
      </template>
    </el-dialog>

    <!-- 记录体重对话框 -->
    <el-dialog v-model="showRecordDialog" title="记录体重" width="90%" :style="{ maxWidth: '420px' }">
      <el-form label-width="70px">
        <el-form-item label="成员">
          <el-select v-if="members.length > 1" v-model="recordForm.memberId" placeholder="选择成员" style="width: 100%">
            <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
          </el-select>
          <el-text v-else class="text-gray-600">{{ currentMember?.name || '我' }}</el-text>
        </el-form-item>
        <el-form-item label="体重">
          <el-input v-model.number="recordForm.weight" type="number" placeholder="请输入体重" clearable>
            <template #append>斤</template>
          </el-input>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="recordForm.recordDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时间">
          <el-time-picker v-model="recordForm.recordTime" placeholder="选择时间" value-format="HH:mm" format="HH:mm" style="width: 100%" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="recordForm.noteTag" placeholder="选择标签（可选）" style="width: 100%" clearable>
            <el-option v-for="tag in NOTE_TAGS" :key="tag.value" :label="tag.label" :value="tag.value">
              <span :style="{ color: tag.color }">{{ tag.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="recordForm.note" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddRecord">记录</el-button>
      </template>
    </el-dialog>

    <!-- 编辑记录对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑记录" width="90%" :style="{ maxWidth: '400px' }">
      <el-form v-if="editingRecord" label-width="70px">
        <el-form-item label="体重">
          <el-input v-model.number="editingRecord.weight" type="number">
            <template #append>斤</template>
          </el-input>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="editingRecord.recordDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时间">
          <el-time-picker v-model="editingRecord.recordTime" value-format="HH:mm" format="HH:mm" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editingRecord.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateRecord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 数据报告对话框 -->
    <el-dialog v-model="showReportDialog" title="数据报告" width="90%" :style="{ maxWidth: '520px' }">
      <div v-if="statistics" class="space-y-4">
        <!-- 周报 -->
        <div v-if="statistics.weeklyReport" class="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">📊</span>
            <h4 class="font-semibold text-blue-700">本周报告</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">起始体重</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.startWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">结束体重</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.endWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">变化</div>
              <div class="font-bold" :class="statistics.weeklyReport.change >= 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ statistics.weeklyReport.change >= 0 ? '+' : '' }}{{ statistics.weeklyReport.change.toFixed(1) }}斤
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">记录天数</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.recordDays }}天</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">最高</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.maxWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">最低</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.minWeight.toFixed(1) }}斤</div>
            </div>
          </div>
        </div>

        <!-- 月报 -->
        <div v-if="statistics.monthlyReport" class="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">📈</span>
            <h4 class="font-semibold text-emerald-700">本月报告</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">起始体重</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.startWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">结束体重</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.endWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">变化</div>
              <div class="font-bold" :class="statistics.monthlyReport.change >= 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ statistics.monthlyReport.change >= 0 ? '+' : '' }}{{ statistics.monthlyReport.change.toFixed(1) }}斤
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">记录天数</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.recordDays }}天</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">最高</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.maxWeight.toFixed(1) }}斤</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">最低</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.minWeight.toFixed(1) }}斤</div>
            </div>
          </div>
        </div>

        <!-- 变化速度分析 -->
        <div class="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">⚡</span>
            <h4 class="font-semibold text-amber-700">变化速度分析</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">周平均变化</div>
              <div class="font-bold" :class="statistics.weeklyChangeRate >= 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ statistics.weeklyChangeRate >= 0 ? '+' : '' }}{{ statistics.weeklyChangeRate.toFixed(2) }} 斤/周
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-xs">速度评价</div>
              <div class="tag-capsule mt-0.5" :style="{ backgroundColor: changeSpeedRating.color + '20', color: changeSpeedRating.color }">
                {{ changeSpeedRating.text }}
              </div>
            </div>
          </div>
        </div>

        <!-- BMR基础代谢 -->
        <div v-if="statistics.bmr" class="p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">🔥</span>
            <h4 class="font-semibold text-rose-700">基础代谢率 (BMR)</h4>
          </div>
          <p class="text-sm text-gray-600">
            您的基础代谢率为 <span class="font-bold text-rose-600">{{ statistics.bmr }} kcal/天</span>
          </p>
          <p class="text-xs text-gray-500 mt-2">
            这是您身体在静息状态下每天消耗的热量，实际消耗会因活动量而增加
          </p>
        </div>

        <!-- 健康区间 -->
        <div v-if="healthyRange" class="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">💪</span>
            <h4 class="font-semibold text-violet-700">健康体重区间（BMI 18.5-24）</h4>
          </div>
          <p class="text-sm text-gray-600">
            根据身高（{{ currentMember?.height }}cm），健康体重范围为：
            <span class="font-semibold text-violet-600">{{ healthyRange.minWeight }} - {{ healthyRange.maxWeight }} 斤</span>
          </p>
          <p v-if="statistics.currentWeight" class="text-sm mt-2 flex items-center gap-2">
            当前体重 <span class="font-medium">{{ statistics.currentWeight.toFixed(1) }}斤</span>
            <span v-if="statistics.currentWeight < healthyRange.minWeight" class="tag-capsule bg-blue-100 text-blue-600">低于健康区间</span>
            <span v-else-if="statistics.currentWeight > healthyRange.maxWeight" class="tag-capsule bg-orange-100 text-orange-600">高于健康区间</span>
            <span v-else class="tag-capsule bg-emerald-100 text-emerald-600">在健康区间内 ✅</span>
          </p>
        </div>
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
          class="achievement-card flex flex-col items-center p-3 rounded-2xl"
          :class="achievement.unlocked ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 unlocked' : 'bg-gray-50 border border-gray-200'"
        >
          <div class="text-3xl mb-2">{{ achievement.icon }}</div>
          <div class="text-xs font-medium text-center text-gray-700">{{ achievement.title }}</div>
          <div class="text-xs text-gray-400 text-center mt-0.5">{{ achievement.description }}</div>
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

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4 text-gray-600">
        <p class="text-gray-700">体重记录是一款简洁实用的体重追踪工具，帮助您记录和分析体重变化趋势。</p>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span class="text-lg">✨</span> 主要功能
          </h4>
          <div class="grid sm:grid-cols-2 gap-2 ml-6">
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>目标设定</strong>：可设置目标体重，实时显示进度</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>成员管理</strong>：支持添加多个家庭成员，自定义头像</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>趋势图表</strong>：折线图直观展示体重变化趋势</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>BMI & BMR</strong>：自动计算BMI指数和基础代谢率</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>数据报告</strong>：提供周报、月报，分析变化速度</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>成就系统</strong>：记录坚持，解锁成就徽章</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-indigo-500">•</span>
              <span><strong>分享功能</strong>：导出图表图片，分享进度</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-indigo-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-lg">💡</span> 健康提示
          </h4>
          <p class="text-sm">建议每天在固定时间（如晨起空腹时）测量体重，数据更具参考价值。保持规律的运动和健康的饮食习惯，配合体重追踪，更好地管理身体健康。</p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import { DataAnalysis, Loading, Plus, Share, TrendCharts, Calendar, Edit, Delete } from '@element-plus/icons-vue'
export default {
  components: { DataAnalysis, Loading, Plus, Share, TrendCharts, Calendar, Edit, Delete }
}
</script>

<style scoped>
/* 毛玻璃背景 */
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.glass-card-dark {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

/* 统计卡片动画 */
.stat-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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

/* 记录项动画 */
.record-item {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.record-item:hover {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.05) 0%, rgba(66, 133, 244, 0.02) 100%);
  border-left-color: #4285f4;
  transform: translateX(4px);
}

/* 进度条动画 */
:deep(.el-progress-bar__inner) {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 渐变背景 */
.gradient-bg {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 对话框样式优化 */
:deep(.el-dialog) {
  border-radius: 16px !important;
}

:deep(.el-dialog__header) {
  padding: 20px 24px 16px !important;
  margin: 0 !important;
  border-bottom: 1px solid #f0f0f0;
}

:deep(.el-dialog__headerbtn) {
  top: 18px !important;
  right: 20px !important;
  width: 28px !important;
  height: 28px !important;
}

:deep(.el-dialog__headerbtn:hover .el-dialog__close) {
  color: #667eea !important;
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

/* 按钮样式优化 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 单选按钮组样式 */
:deep(.el-radio-button__inner) {
  transition: all 0.2s ease;
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

/* 选择器样式 */
:deep(.el-select__wrapper) {
  border-radius: 10px !important;
  transition: all 0.2s ease;
}

:deep(.el-select__wrapper:hover) {
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
}

/* 图表容器样式 */
.chart-container {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  border-radius: 16px;
  padding: 16px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.02);
}

/* 成就卡片动画 */
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
  0%, 100% {
    box-shadow: 0 0 0 rgba(251, 191, 36, 0);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
  }
}

/* 头像样式 */
.avatar-circle {
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 成员操作按钮样式 */
.member-action-btn {
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border-radius: 8px !important;
  background: #f5f5f5 !important;
  border: none !important;
  color: #666 !important;
  transition: all 0.2s ease;
}

.member-action-btn:hover {
  background: #e0e0e0 !important;
  color: #333 !important;
  transform: scale(1.05);
}

/* 成员下拉菜单悬停提示 */
.member-dropdown .avatar-circle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

/* 主记录按钮样式 */
.main-record-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.main-record-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.main-record-btn:active {
  transform: translateY(0);
}

/* 加载动画 */
:deep(.is-loading) {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 标签胶囊样式 */
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
</style>
