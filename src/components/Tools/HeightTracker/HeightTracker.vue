<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { debounce } from 'lodash-es'
import html2canvas from 'html2canvas'
import { heightApi } from './api'
import type { HeightMember, HeightRecord, HeightStatistics, ChartDataPoint, TimeRange, Achievement } from './types'
import { NOTE_TAGS, HEIGHT_MILESTONES } from './types'
import { useUserStore } from '@/store/modules/user'

const info = { title: '身高记录' }

// Emoji 头像列表
const AVATAR_EMOJIS = ['😀', '😊', '🙂', '😎', '🤗', '💪', '🏃', '⭐', '🌟', '❤️', '🎯', '🔥']

// 默认统计数据
const defaultStatistics: HeightStatistics = {
  currentHeight: null,
  lastHeight: null,
  changeFromLast: 0,
  changeFromYesterday: 0,
  maxHeight: null,
  minHeight: null,
  avgHeight: null,
  totalDays: 0,
  totalRecords: 0,
  consecutiveDays: 0,
  weeklyReport: null,
  monthlyReport: null,
  yearlyReport: null,
  growthRate: 0,
  goalDifference: null,
  ageMonths: null,
  predictedAdultHeight: null
}

// ===== 状态管理 =====
const members = ref<HeightMember[]>([])
const currentMemberId = ref<string>('')
const records = ref<HeightRecord[]>([])
const statistics = ref<HeightStatistics>(defaultStatistics)
const chartData = ref<ChartDataPoint[]>([])

// UI 状态
const notLoggedIn = ref(false)
const timeRange = ref<TimeRange>('30')
const showMemberDialog = ref(false)
const showEditMemberDialog = ref(false)
const showRecordDialog = ref(false)
const showEditDialog = ref(false)
const showReportDialog = ref(false)
const showAchievementDialog = ref(false)
const editingRecord = ref<HeightRecord | null>(null)
const editingMember = ref<HeightMember | null>(null)
const loading = ref(false)
const isFirstTime = ref(false)

// 各按钮独立 loading 状态
const memberLoading = ref(false)
const editMemberLoading = ref(false)
const recordLoading = ref(false)
const editRecordLoading = ref(false)
const deleteRecordLoading = ref(false)
const deleteMemberLoading = ref(false)
const shareLoading = ref(false)

const userStore = useUserStore()

// localStorage 持久化当前选中成员
const getSavedMemberId = (): string => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  return localStorage.getItem(`height_tracker_member_${uid}`) || ''
}
const saveMemberId = (memberId: string) => {
  const uid = userStore.getUserInfo?.uid || 'anonymous'
  localStorage.setItem(`height_tracker_member_${uid}`, memberId)
}

// 记录表单
const recordForm = ref({
  memberId: '',
  height: '',
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
  birthDate: '',
  sex: '' as '' | 'male' | 'female',
  goalHeight: '',
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

// 当前年龄（显示用）
const currentAgeText = computed(() => {
  const months = statistics.value.ageMonths
  if (months === null || months === undefined) return ''
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (years === 0) return `${months} 月龄`
  if (remMonths === 0) return `${years} 岁`
  return `${years} 岁 ${remMonths} 月`
})

// 增长速率评级（cm/年）
const growthRating = computed(() => {
  const rate = statistics.value.growthRate
  const months = statistics.value.ageMonths
  if (!rate) return null
  // 儿童参考范围（粗略）：
  // 婴儿期 0-2 岁：~10-12 cm/年
  // 学龄前 3-5 岁：~6-8 cm/年
  // 学龄期 6-12 岁：~5-6 cm/年
  // 青春期 12-18 岁：~8-12 cm/年（高峰）
  // 成人后：基本为 0
  if (months !== null && months !== undefined) {
    if (months < 24) {
      if (rate >= 8) return { text: '快速增长', color: '#67C23A' }
      if (rate >= 5) return { text: '正常', color: '#67C23A' }
      if (rate >= 2) return { text: '增长偏慢', color: '#E6A23C' }
      return { text: '增长缓慢', color: '#F56C6C' }
    }
    if (months < 72) {
      if (rate >= 6) return { text: '正常', color: '#67C23A' }
      if (rate >= 4) return { text: '正常', color: '#67C23A' }
      if (rate >= 2) return { text: '增长偏慢', color: '#E6A23C' }
      return { text: '增长缓慢', color: '#F56C6C' }
    }
    if (months < 144) {
      if (rate >= 4) return { text: '正常', color: '#67C23A' }
      if (rate >= 3) return { text: '正常', color: '#67C23A' }
      if (rate >= 1) return { text: '增长偏慢', color: '#E6A23C' }
      return { text: '增长缓慢', color: '#F56C6C' }
    }
    if (months < 216) {
      if (rate >= 6) return { text: '快速增长', color: '#67C23A' }
      if (rate >= 3) return { text: '正常', color: '#67C23A' }
      if (rate >= 1) return { text: '增长偏慢', color: '#E6A23C' }
      return { text: '增长缓慢', color: '#F56C6C' }
    }
    // 成人
    if (rate >= 1) return { text: '异常增高', color: '#E6A23C' }
    if (rate >= -0.5) return { text: '基本稳定', color: '#67C23A' }
    return { text: '身高下降', color: '#F56C6C' }
  }
  return { text: '保持稳定', color: '#67C23A' }
})

// 目标差距展示
const goalDifferenceText = computed(() => {
  const diff = statistics.value.goalDifference
  const goal = currentMember.value?.goalHeight
  if (diff === null || !goal) return null
  if (Math.abs(diff) < 0.1) return { text: '已达成目标', color: '#67C23A', isGoal: true }
  if (diff < 0) return { text: `还差 ${Math.abs(diff).toFixed(1)} cm`, color: '#E6A23C', isGoal: false }
  return { text: `已超过 ${diff.toFixed(1)} cm`, color: '#409EFF', isGoal: false }
})

// 目标进度（基于起始身高到目标身高的进度）
const goalProgress = computed(() => {
  const member = currentMember.value
  const current = statistics.value.currentHeight
  if (!member?.goalHeight || !current) return null
  const goal = member.goalHeight
  const diff = goal - current
  // 取第一条记录的height作为起点
  const sortedRecords = [...records.value].sort((a, b) => a.recordDate.localeCompare(b.recordDate))
  const startHeight = sortedRecords[0]?.height ?? current
  const totalChangeNeeded = Math.abs(goal - startHeight)
  if (totalChangeNeeded < 0.1) return { diff, isGrowing: diff > 0, progress: 100 }
  const currentChange = Math.abs(current - startHeight)
  const progress = Math.min(100, (currentChange / totalChangeNeeded) * 100)
  return { diff, isGrowing: diff > 0, progress: Number(progress.toFixed(2)) }
})

const formattedRecords = computed(() => {
  if (!Array.isArray(records.value)) return []
  let filteredRecords = [...records.value].sort((a, b) => {
    const dateCompare = b.recordDate.localeCompare(a.recordDate)
    if (dateCompare !== 0) return dateCompare
    return (b.recordTime || '23:59').localeCompare(a.recordTime || '23:59')
  })

  if (dateFilter.value && dateFilter.value.length === 2) {
    const [start, end] = dateFilter.value
    const startDateStr = start.toISOString().split('T')[0]
    const endDateStr = end.toISOString().split('T')[0]
    filteredRecords = filteredRecords.filter(r => r.recordDate >= startDateStr && r.recordDate <= endDateStr)
  }

  return filteredRecords.map((r, index) => {
    let change = 0
    const nextHeight = filteredRecords[index + 1]?.height
    if (nextHeight !== undefined) {
      change = r.height - nextHeight
    }
    return { ...r, change }
  })
})

// 成就系统
const achievements = computed((): Achievement[] => {
  const stats = statistics.value
  const current = stats.currentHeight
  const list: Achievement[] = []

  // 连续记录成就
  if (stats.consecutiveDays >= 3) list.push({ id: 'streak-3', title: '坚持3天', description: '连续记录3天', icon: '🔥', unlocked: true })
  if (stats.consecutiveDays >= 7) list.push({ id: 'streak-7', title: '坚持一周', description: '连续记录7天', icon: '⭐', unlocked: true })
  if (stats.consecutiveDays >= 30) list.push({ id: 'streak-30', title: '坚持一月', description: '连续记录30天', icon: '🏆', unlocked: true })

  // 累计天数成就
  if (stats.totalDays >= 10) list.push({ id: 'days-10', title: '初见成效', description: '累计记录10天', icon: '🌱', unlocked: true })
  if (stats.totalDays >= 30) list.push({ id: 'days-30', title: '月度习惯', description: '累计记录30天', icon: '📅', unlocked: true })
  if (stats.totalDays >= 100) list.push({ id: 'days-100', title: '百日筑基', description: '累计记录100天', icon: '💎', unlocked: true })

  // 首次记录
  if (stats.totalRecords >= 1) list.push({ id: 'first-record', title: '首次记录', description: '完成第一次身高记录', icon: '🎉', unlocked: true })

  // 里程碑身高
  HEIGHT_MILESTONES.forEach(m => {
    if (current && current >= m.height) {
      list.push({
        id: `milestone-${m.height}`,
        title: m.label,
        description: m.desc,
        icon: m.icon,
        unlocked: true
      })
    }
  })

  // 目标达成
  if (goalProgress.value && goalProgress.value.progress >= 100) {
    list.push({ id: 'goal-reached', title: '目标达成', description: '已达目标身高', icon: '🎯', unlocked: true })
  }

  return list
})

// ===== API 调用 =====
const fetchMembers = async () => {
  try {
    members.value = await heightApi.getMembers()
    const savedMemberId = getSavedMemberId()
    if (savedMemberId && members.value.find(m => m.id === savedMemberId)) {
      currentMemberId.value = savedMemberId
    } else if (!currentMemberId.value && members.value.length > 0) {
      const defaultMember = members.value.find(m => m.isDefault) || members.value[0]
      currentMemberId.value = defaultMember.id
    }
    isFirstTime.value = members.value.length === 0
  } catch (error: any) {
    if (error?.response?.status === 401) {
      notLoggedIn.value = true
    } else {
      ElMessage.error('获取成员列表失败')
    }
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
    const data = await heightApi.getRecords(params)
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
    const data = await heightApi.getStatistics(currentMemberId.value)
    statistics.value = data || defaultStatistics
  } catch (error) {
    statistics.value = defaultStatistics
  }
}

const fetchChartData = async () => {
  if (!currentMemberId.value) return
  try {
    const days = timeRange.value === 'all' ? 3650 : parseInt(timeRange.value)
    const data = await heightApi.getChartData(currentMemberId.value, days)
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
    height: '',
    note: '',
    recordDate: now.toISOString().split('T')[0],
    recordTime: now.toTimeString().slice(0, 5),
    noteTag: ''
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
        a.download = `身高记录_${currentMember.value?.name || '我'}_${new Date().toISOString().split('T')[0]}.png`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('图片已保存')
      }
    })
  } catch (error) {
    ElMessage.error('分享失败')
  } finally {
    shareLoading.value = false
  }
}

const handleAddRecord = async () => {
  if (!recordForm.value.memberId) {
    ElMessage.warning('请选择成员')
    return
  }
  if (!recordForm.value.height) {
    ElMessage.warning('请输入身高')
    return
  }
  const height = parseFloat(recordForm.value.height)
  if (isNaN(height) || height <= 0 || height > 300) {
    ElMessage.warning('请输入有效的身高值（1-300cm）')
    return
  }
  recordLoading.value = true
  try {
    let fullNote = recordForm.value.note || ''
    if (recordForm.value.noteTag) {
      const tag = NOTE_TAGS.find(t => t.value === recordForm.value.noteTag)
      if (tag) fullNote = `[${tag.label}] ${fullNote}`.trim()
    }
    await heightApi.createRecord({
      memberId: recordForm.value.memberId,
      height,
      note: fullNote,
      recordDate: recordForm.value.recordDate,
      recordTime: recordForm.value.recordTime
    })
    ElMessage.success('记录成功')
    showRecordDialog.value = false
    recordForm.value.noteTag = ''
    await nextTick()
    await refreshData()
  } catch (error) {
    ElMessage.error('记录失败')
  } finally {
    recordLoading.value = false
  }
}

const handleDeleteRecord = async (record: HeightRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  deleteRecordLoading.value = true
  try {
    await heightApi.deleteRecord(record.id)
    ElMessage.success('删除成功')
    await refreshData()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteRecordLoading.value = false
  }
}

const handleEditRecord = (record: HeightRecord) => {
  editingRecord.value = { ...record }
  showEditDialog.value = true
}

const handleUpdateRecord = async () => {
  if (!editingRecord.value) return
  editRecordLoading.value = true
  try {
    await heightApi.updateRecord(editingRecord.value.id, {
      height: editingRecord.value.height,
      note: editingRecord.value.note,
      recordDate: editingRecord.value.recordDate,
      recordTime: editingRecord.value.recordTime
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

const handleAddMember = async () => {
  if (!memberForm.value.name) {
    ElMessage.warning('请输入成员名称')
    return
  }
  memberLoading.value = true
  try {
    const result = await heightApi.createMember({
      name: memberForm.value.name,
      birthDate: memberForm.value.birthDate || null,
      sex: (memberForm.value.sex || null) as 'male' | 'female' | null,
      goalHeight: memberForm.value.goalHeight ? parseFloat(memberForm.value.goalHeight) : null,
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || undefined,
      isDefault: members.value.length === 0 ? 1 : 0
    })
    if (result.updated) {
      ElMessage.success('成员已存在，信息已更新')
    } else {
      ElMessage.success('添加成功')
    }
    memberForm.value = { name: '', birthDate: '', sex: '', goalHeight: '', avatarColor: '#409EFF', avatarEmoji: '' }
    showMemberDialog.value = false
    await fetchMembers()
    currentMemberId.value = result.id
    isFirstTime.value = false
  } catch {
    ElMessage.error('操作失败')
  } finally {
    memberLoading.value = false
  }
}

const handleDeleteMember = async (member: HeightMember) => {
  try {
    await ElMessageBox.confirm(`确定要删除成员"${member.name}"吗？这将同时删除该成员的所有身高记录。`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  deleteMemberLoading.value = true
  try {
    await heightApi.deleteMember(member.id)
    ElMessage.success('删除成功')
    if (currentMemberId.value === member.id) {
      currentMemberId.value = members.value.find(m => m.id !== member.id)?.id || ''
    }
    await fetchMembers()
    await refreshData()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteMemberLoading.value = false
  }
}

const handleEditMember = (member: HeightMember) => {
  editingMember.value = { ...member }
  memberForm.value = {
    name: member.name,
    birthDate: member.birthDate || '',
    sex: (member.sex || '') as '' | 'male' | 'female',
    goalHeight: member.goalHeight ? String(member.goalHeight) : '',
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
  editMemberLoading.value = true
  try {
    await heightApi.updateMember(editingMember.value.id, {
      name: memberForm.value.name,
      birthDate: memberForm.value.birthDate || null,
      sex: (memberForm.value.sex || null) as 'male' | 'female' | null,
      goalHeight: memberForm.value.goalHeight ? parseFloat(memberForm.value.goalHeight) : null,
      avatarColor: memberForm.value.avatarColor,
      avatarEmoji: memberForm.value.avatarEmoji || undefined
    })
    ElMessage.success('更新成功')
    showEditMemberDialog.value = false
    editingMember.value = null
    await fetchMembers()
    await refreshData()
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

  const series: any[] = [{
    name: currentMember.value?.name || '身高',
    type: 'line',
    smooth: true,
    data: chartData.value.map(d => [d.date, d.height]),
    itemStyle: { color: currentMember.value?.avatarColor || '#409EFF' },
    lineStyle: { width: 3 },
    animationDuration: 500
  }]

  if (currentMember.value?.goalHeight) {
    series.push({
      name: '目标',
      type: 'line',
      data: chartData.value.map(d => [d.date, currentMember.value!.goalHeight]),
      itemStyle: { color: '#E6A23C' },
      lineStyle: { type: 'dashed', width: 2 },
      showSymbol: false,
      animationDuration: 500
    })
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>'
        params.forEach((param: any) => {
          result += `${param.marker} ${param.seriesName}: ${param.value[1].toFixed(1)} cm<br/>`
        })
        return result
      }
    },
    legend: { data: series.map(s => s.name), bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...new Set(chartData.value.map(d => d.date))].sort()
    },
    yAxis: { type: 'value', name: '身高（cm）', scale: true },
    series
  }
  chartInstance.setOption(option, { notMerge: true })
}

const handleResize = () => chartInstance?.resize()

const goToLogin = () => {
  window.location.href = '/login?redirect=/height-tracker/'
}

// ===== 监听 =====
const debouncedFetchChartData = debounce(async () => {
  await fetchChartData()
}, 300)

watch(currentMemberId, async (newId) => {
  if (newId) saveMemberId(newId)
  await refreshData()
})

watch(timeRange, () => { debouncedFetchChartData() })
watch(dateFilter, async () => { await fetchRecords() })

// ===== 生命周期 =====
onMounted(async () => {
  userStore.initUserState()
  if (!userStore.isLoggedIn) {
    notLoggedIn.value = true
    return
  }
  await fetchMembers()
  if (currentMemberId.value) {
    await refreshData()
  }
  nextTick(() => { initChart() })
  window.addEventListener('resize', handleResize)
})
</script>

<template>
  <div class="flex flex-col mt-3 min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50">
    <DetailHeader :title="info.title" />

    <!-- 未登录提示 -->
    <div v-if="notLoggedIn" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4">🔒</div>
      <h3 class="text-h3 font-bold text-white mb-3">请先登录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">身高记录需要登录后使用，数据将同步到您的账户</p>
      <el-button size="large" class="!bg-white !text-blue-600 !border-none hover:!bg-gray-100" @click="goToLogin">
        <el-icon class="mr-1"><Promotion /></el-icon> 前往登录
      </el-button>
    </div>

    <!-- 首次使用引导 -->
    <div v-else-if="isFirstTime" class="mx-3 sm:mx-0 p-8 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 mb-6 text-center shadow-xl">
      <div class="text-6xl mb-4 animate-bounce">📏</div>
      <h3 class="text-h3 font-bold text-white mb-3">欢迎使用身高记录</h3>
      <p class="text-white/90 mb-6 max-w-md mx-auto">添加您的第一个成员，开启身高追踪之旅</p>
      <el-button size="large" class="!bg-white !text-blue-600 !border-none hover:!bg-gray-100" @click="showMemberDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon> 添加成员
      </el-button>
    </div>

    <div v-else class="px-3 sm:px-0 pb-6">
      <!-- 主内容卡片 -->
      <div class="glass-card-dark rounded-3xl p-4 sm:p-6 mb-6">
        <!-- 成员选择栏 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-body-sm font-medium text-gray-500">成员</span>
            <el-select v-model="currentMemberId" placeholder="选择成员" class="!w-32">
              <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
            <div v-if="currentMember" class="avatar-circle flex items-center justify-center w-9 h-9 rounded-full text-body-lg" :style="{ backgroundColor: currentMember.avatarColor }">
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
          <el-button link @click="showReportDialog = true" class="!text-cyan-500 !font-medium">
            <el-icon class="mr-1"><DataAnalysis /></el-icon> 数据报告
          </el-button>
        </div>

        <!-- 当前身高大卡片 -->
        <div v-if="statistics && statistics.currentHeight" class="mb-6 p-6 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div class="relative">
            <div class="flex items-center justify-between mb-2">
              <span class="text-white/80 text-body-sm">当前身高</span>
              <span class="tag-capsule bg-white/20 text-white">
                {{ currentMember?.name || '我' }}
              </span>
            </div>
            <div class="flex items-end gap-3 mb-3">
              <span class="text-5xl font-bold">{{ statistics.currentHeight.toFixed(1) }}</span>
              <span class="text-h3 text-white/80 pb-2">cm</span>
            </div>
            <div class="flex items-center gap-4 text-body-sm">
              <span v-if="goalDifferenceText" class="flex items-center gap-1">
                <el-icon><Aim /></el-icon>
                {{ goalDifferenceText.text }}
              </span>
              <span v-if="currentAgeText" class="flex items-center gap-1">
                <el-icon><Calendar /></el-icon>
                {{ currentAgeText }}
              </span>
              <span class="flex items-center gap-1">
                <el-icon><DataLine /></el-icon>
                已记录 {{ statistics.totalDays }} 天
              </span>
            </div>
          </div>
        </div>

        <!-- 统计卡片网格 -->
        <div v-if="statistics" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <!-- 较上次变化 -->
          <div class="stat-card bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <span class="text-emerald-600">📏</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">较上次</span>
            </div>
            <div class="text-h3 font-bold" :class="statistics.changeFromLast >= 0 ? 'text-emerald-500' : 'text-rose-500'">
              {{ statistics.changeFromLast >= 0 ? '+' : '' }}{{ statistics.changeFromLast.toFixed(1) }}
            </div>
            <div class="text-caption text-gray-400 mt-1">cm</div>
          </div>

          <!-- 较昨日变化 -->
          <div class="stat-card bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                <span class="text-violet-600">📊</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">较昨日</span>
            </div>
            <div class="text-h3 font-bold" :class="statistics.changeFromYesterday >= 0 ? 'text-emerald-500' : 'text-rose-500'">
              {{ statistics.changeFromYesterday >= 0 ? '+' : '' }}{{ statistics.changeFromYesterday.toFixed(1) }}
            </div>
            <div class="text-caption text-gray-400 mt-1">cm</div>
          </div>

          <!-- 年增长速率 -->
          <div v-if="growthRating" class="stat-card bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <span class="text-amber-600">⚡</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">年增长</span>
            </div>
            <div class="text-body-lg font-bold text-amber-600">
              {{ statistics.growthRate >= 0 ? '+' : '' }}{{ statistics.growthRate.toFixed(1) }}
            </div>
            <div class="tag-capsule mt-1" :style="{ backgroundColor: growthRating.color + '20', color: growthRating.color }">
              {{ growthRating.text }}
            </div>
          </div>

          <!-- 预测成年身高 -->
          <div v-if="statistics.predictedAdultHeight" class="stat-card bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                <span class="text-rose-600">🔮</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">预测成年身高</span>
            </div>
            <div class="text-body-lg font-bold text-rose-600">
              {{ statistics.predictedAdultHeight.toFixed(1) }}
            </div>
            <div class="text-caption text-gray-400 mt-1">cm</div>
          </div>

          <!-- 平均身高 -->
          <div class="stat-card bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl p-4 border border-cyan-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-cyan-100 flex items-center justify-center">
                <span class="text-cyan-600">📐</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">平均身高</span>
            </div>
            <div class="text-body font-bold text-cyan-600">
              {{ statistics.avgHeight ? statistics.avgHeight.toFixed(1) : '--' }}
            </div>
            <div class="text-caption text-gray-400 mt-1">cm</div>
          </div>

          <!-- 最高 / 最低 -->
          <div class="stat-card bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-indigo-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <span class="text-indigo-600">📊</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">最高/最低</span>
            </div>
            <div class="flex gap-3">
              <div>
                <div class="text-body-lg font-bold text-indigo-600">{{ statistics.maxHeight ? statistics.maxHeight.toFixed(1) : '--' }}</div>
                <div class="text-caption text-gray-400">最高</div>
              </div>
              <div class="text-gray-300">|</div>
              <div>
                <div class="text-body-lg font-bold text-indigo-700">{{ statistics.minHeight ? statistics.minHeight.toFixed(1) : '--' }}</div>
                <div class="text-caption text-gray-400">最低</div>
              </div>
            </div>
          </div>

          <!-- 连续 / 累计 -->
          <div class="stat-card bg-gradient-to-br from-fuchsia-50 to-purple-50 rounded-2xl p-4 border border-fuchsia-100">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-fuchsia-100 flex items-center justify-center">
                <span class="text-fuchsia-600">📅</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">记录天数</span>
            </div>
            <div class="flex gap-3">
              <div>
                <div class="text-body-lg font-bold text-fuchsia-600">{{ statistics.consecutiveDays }}</div>
                <div class="text-caption text-gray-400">连续</div>
              </div>
              <div class="text-gray-300">|</div>
              <div>
                <div class="text-body-lg font-bold text-fuchsia-700">{{ statistics.totalDays }}</div>
                <div class="text-caption text-gray-400">累计</div>
              </div>
            </div>
          </div>

          <!-- 成就入口 -->
          <div v-if="achievements.length > 0" class="stat-card bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-200 cursor-pointer" @click="showAchievementDialog = true">
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

          <!-- 总记录数 -->
          <div class="stat-card bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-4 border border-slate-200">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center">
                <span class="text-slate-600">📋</span>
              </div>
              <span class="text-caption text-gray-500 font-medium">总记录</span>
            </div>
            <div class="text-h3 font-bold text-slate-600">
              {{ statistics.totalRecords }}
            </div>
            <div class="text-caption text-gray-400 mt-1">条记录</div>
          </div>
        </div>

        <!-- 目标进度条 -->
        <div v-if="goalProgress && currentMember?.goalHeight" class="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl border border-cyan-100">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-body-lg">🎯</span>
              <span class="text-body-sm font-medium text-gray-700">目标进度</span>
            </div>
            <span class="text-body-lg font-bold text-cyan-600">
              {{ currentMember.goalHeight }} cm
            </span>
          </div>
          <el-progress
            :percentage="goalProgress.progress"
            :color="goalProgress.isGrowing ? '#10b981' : '#f59e0b'"
            :stroke-width="10"
            :show-text="true"
          />
          <div class="text-caption text-gray-500 mt-2 text-center">
            {{ goalProgress.progress >= 100 ? '🎉 已达成目标！' : `还差 ${Math.abs(goalProgress.diff).toFixed(1)} cm` }}
          </div>
        </div>

        <!-- 操作区域 -->
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <button class="main-record-btn text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2" @click="openRecordDialog">
              <el-icon><Plus /></el-icon>
              <span>记录身高</span>
            </button>
            <div class="flex gap-2">
              <el-button link @click="showReportDialog = true" class="!text-body-sm">
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
            <span class="text-h3">📈</span>
            <span class="font-semibold text-gray-700">身高趋势</span>
          </div>
          <div class="flex items-center gap-2">
            <el-button link class="!text-cyan-500 !font-medium" :loading="shareLoading" @click="handleShare">
              <el-icon><Share /></el-icon> 分享
            </el-button>
            <el-radio-group v-model="timeRange" size="small">
              <el-radio-button label="7">7天</el-radio-button>
              <el-radio-button label="30">30天</el-radio-button>
              <el-radio-button label="90">3月</el-radio-button>
              <el-radio-button label="365">1年</el-radio-button>
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
            <span class="text-h3">📋</span>
            <span class="font-semibold text-gray-700">历史记录</span>
            <span class="text-caption text-gray-400">共 {{ formattedRecords.length }} 条</span>
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
          <el-icon class="is-loading text-4xl text-cyan-500"><Loading /></el-icon>
          <p class="text-gray-400 text-body-sm mt-2">加载中...</p>
        </div>
        <div v-else-if="formattedRecords.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📝</div>
          <p class="text-gray-400">暂无记录，点击"记录身高"开始记录吧~</p>
        </div>
        <div v-else class="space-y-2 max-h-96 overflow-y-auto pr-1">
          <div
            v-for="record in formattedRecords"
            :key="record.id"
            class="record-item flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="flex-shrink-0 w-14 text-center">
                <div class="text-caption text-gray-400">{{ record.recordDate.slice(5) }}</div>
                <div class="text-caption text-gray-300">{{ record.recordTime }}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-body-lg font-bold text-gray-800">{{ record.height.toFixed(1) }}</span>
                <span class="text-caption text-gray-400">cm</span>
              </div>
              <div v-if="record.change !== 0" class="flex-shrink-0 px-2 py-0.5 rounded-lg text-caption font-medium"
                :class="record.change > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'">
                {{ record.change > 0 ? '↑' : '↓' }} {{ Math.abs(record.change).toFixed(1) }}
              </div>
              <div v-if="record.note" class="flex-1 min-w-0">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-caption bg-gray-100 text-gray-500 truncate max-w-full">
                  {{ record.note }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <el-button link class="!text-cyan-500" size="small" :loading="editRecordLoading" @click="handleEditRecord(record)">
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

    <!-- 添加成员对话框 -->
    <el-dialog v-model="showMemberDialog" title="添加成员" width="90%" :style="{ maxWidth: '460px' }" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、孩子、老爸" clearable :disabled="memberLoading" />
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker v-model="memberForm.birthDate" type="date" placeholder="可选，用于儿童身高预测" value-format="YYYY-MM-DD" style="width: 100%" :disabled="memberLoading" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="memberForm.sex" :disabled="memberLoading">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="目标身高">
          <el-input v-model="memberForm.goalHeight" type="number" placeholder="可选" :disabled="memberLoading">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" :disabled="memberLoading" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选Emoji" style="width: 140px" clearable filterable :disabled="memberLoading">
              <el-option v-for="emoji in AVATAR_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
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
      <el-form label-width="90px">
        <el-form-item label="成员名称">
          <el-input v-model="memberForm.name" placeholder="如：我、孩子、老爸" clearable :disabled="editMemberLoading" />
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker v-model="memberForm.birthDate" type="date" placeholder="可选" value-format="YYYY-MM-DD" style="width: 100%" :disabled="editMemberLoading" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="memberForm.sex" :disabled="editMemberLoading">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="目标身高">
          <el-input v-model="memberForm.goalHeight" type="number" placeholder="可选" :disabled="editMemberLoading">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="头像样式">
          <div class="flex items-center gap-4">
            <el-color-picker v-model="memberForm.avatarColor" :disabled="editMemberLoading" />
            <el-select v-model="memberForm.avatarEmoji" placeholder="选Emoji" style="width: 140px" clearable filterable :disabled="editMemberLoading">
              <el-option v-for="emoji in AVATAR_EMOJIS" :key="emoji" :label="emoji" :value="emoji" />
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

    <!-- 记录身高对话框 -->
    <el-dialog v-model="showRecordDialog" title="记录身高" width="90%" :style="{ maxWidth: '420px' }" :close-on-click-modal="false">
      <el-form label-width="70px">
        <el-form-item label="成员">
          <el-select v-if="members.length > 1" v-model="recordForm.memberId" placeholder="选择成员" style="width: 100%" :disabled="recordLoading">
            <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
          </el-select>
          <el-text v-else class="text-gray-600">{{ currentMember?.name || '我' }}</el-text>
        </el-form-item>
        <el-form-item label="身高">
          <el-input v-model.number="recordForm.height" type="number" placeholder="请输入身高" clearable :disabled="recordLoading">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="recordForm.recordDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" :disabled="recordLoading" />
        </el-form-item>
        <el-form-item label="时间">
          <el-time-picker v-model="recordForm.recordTime" placeholder="选择时间" value-format="HH:mm" format="HH:mm" style="width: 100%" :disabled="recordLoading" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="recordForm.noteTag" placeholder="选择标签（可选）" style="width: 100%" clearable :disabled="recordLoading">
            <el-option v-for="tag in NOTE_TAGS" :key="tag.value" :label="tag.label" :value="tag.value">
              <span :style="{ color: tag.color }">{{ tag.label }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="recordForm.note" type="textarea" :rows="2" placeholder="备注（可选）" :disabled="recordLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRecordDialog = false" :disabled="recordLoading">取消</el-button>
        <el-button type="primary" :loading="recordLoading" @click="handleAddRecord">记录</el-button>
      </template>
    </el-dialog>

    <!-- 编辑记录对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑记录" width="90%" :style="{ maxWidth: '400px' }" :close-on-click-modal="false">
      <el-form v-if="editingRecord" label-width="70px">
        <el-form-item label="身高">
          <el-input v-model.number="editingRecord.height" type="number" :disabled="editRecordLoading">
            <template #append>cm</template>
          </el-input>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="editingRecord.recordDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" :disabled="editRecordLoading" />
        </el-form-item>
        <el-form-item label="时间">
          <el-time-picker v-model="editingRecord.recordTime" value-format="HH:mm" format="HH:mm" style="width: 100%" :disabled="editRecordLoading" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editingRecord.note" type="textarea" :rows="2" :disabled="editRecordLoading" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false" :disabled="editRecordLoading">取消</el-button>
        <el-button type="primary" :loading="editRecordLoading" @click="handleUpdateRecord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 数据报告对话框 -->
    <el-dialog v-model="showReportDialog" title="数据报告" width="90%" :style="{ maxWidth: '520px' }">
      <div v-if="statistics" class="space-y-4">
        <!-- 周报 -->
        <div v-if="statistics.weeklyReport" class="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">📊</span>
            <h4 class="font-semibold text-blue-700">本周报告</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-body-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">起始身高</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.startHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">结束身高</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.endHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">变化</div>
              <div class="font-bold" :class="statistics.weeklyReport.change >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.weeklyReport.change >= 0 ? '+' : '' }}{{ statistics.weeklyReport.change.toFixed(1) }}cm
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">记录天数</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.recordDays }}天</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">最高</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.maxHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">最低</div>
              <div class="font-bold text-gray-700">{{ statistics.weeklyReport.minHeight.toFixed(1) }}cm</div>
            </div>
          </div>
        </div>

        <!-- 月报 -->
        <div v-if="statistics.monthlyReport" class="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">📈</span>
            <h4 class="font-semibold text-emerald-700">本月报告</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-body-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">起始身高</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.startHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">结束身高</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.endHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">变化</div>
              <div class="font-bold" :class="statistics.monthlyReport.change >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.monthlyReport.change >= 0 ? '+' : '' }}{{ statistics.monthlyReport.change.toFixed(1) }}cm
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">记录天数</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.recordDays }}天</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">最高</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.maxHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">最低</div>
              <div class="font-bold text-gray-700">{{ statistics.monthlyReport.minHeight.toFixed(1) }}cm</div>
            </div>
          </div>
        </div>

        <!-- 年报 -->
        <div v-if="statistics.yearlyReport" class="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">🗓️</span>
            <h4 class="font-semibold text-amber-700">本年报告</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-body-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">起始身高</div>
              <div class="font-bold text-gray-700">{{ statistics.yearlyReport.startHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">结束身高</div>
              <div class="font-bold text-gray-700">{{ statistics.yearlyReport.endHeight.toFixed(1) }}cm</div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">年增长</div>
              <div class="font-bold" :class="statistics.yearlyReport.change >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.yearlyReport.change >= 0 ? '+' : '' }}{{ statistics.yearlyReport.change.toFixed(1) }}cm
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">记录天数</div>
              <div class="font-bold text-gray-700">{{ statistics.yearlyReport.recordDays }}天</div>
            </div>
          </div>
        </div>

        <!-- 年增长速率 -->
        <div v-if="growthRating" class="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">⚡</span>
            <h4 class="font-semibold text-violet-700">增长速率分析</h4>
          </div>
          <div class="grid grid-cols-2 gap-3 text-body-sm">
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">年增长速率</div>
              <div class="font-bold" :class="statistics.growthRate >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ statistics.growthRate >= 0 ? '+' : '' }}{{ statistics.growthRate.toFixed(2) }} cm/年
              </div>
            </div>
            <div class="bg-white/50 rounded-xl p-2">
              <div class="text-gray-500 text-caption">速率评价</div>
              <div class="tag-capsule mt-0.5" :style="{ backgroundColor: growthRating.color + '20', color: growthRating.color }">
                {{ growthRating.text }}
              </div>
            </div>
          </div>
        </div>

        <!-- 预测成年身高 -->
        <div v-if="statistics.predictedAdultHeight && currentAgeText" class="p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border border-rose-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">🔮</span>
            <h4 class="font-semibold text-rose-700">成年身高预测</h4>
          </div>
          <p class="text-body-sm text-gray-600">
            当前年龄 <span class="font-bold text-rose-600">{{ currentAgeText }}</span>，基于当前身高预测成年身高约为：
            <span class="font-semibold text-rose-600">{{ statistics.predictedAdultHeight.toFixed(1) }} cm</span>
          </p>
          <p class="text-caption text-gray-500 mt-2">
            ⚠️ 预测仅供参考，实际身高受遗传、营养、运动、睡眠等多因素影响
          </p>
        </div>

        <!-- 目标身高对比 -->
        <div v-if="goalDifferenceText && currentMember?.goalHeight" class="p-4 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl border border-cyan-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-h2">🎯</span>
            <h4 class="font-semibold text-cyan-700">目标身高对比</h4>
          </div>
          <p class="text-body-sm text-gray-600">
            目标身高 <span class="font-bold text-cyan-600">{{ currentMember.goalHeight }} cm</span>，
            当前 <span class="font-bold text-cyan-600">{{ statistics.currentHeight ? statistics.currentHeight.toFixed(1) : '--' }} cm</span>
          </p>
          <div class="mt-2 tag-capsule" :style="{ backgroundColor: goalDifferenceText.color + '20', color: goalDifferenceText.color }">
            {{ goalDifferenceText.text }}
          </div>
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

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4 text-gray-600">
        <p class="text-gray-700">身高记录是一款简洁实用的身高追踪工具，帮助您记录和分析身高变化趋势，尤其适合关注孩子生长发育的家庭。</p>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <span class="text-body-lg">✨</span> 主要功能
          </h4>
          <div class="grid sm:grid-cols-2 gap-2 ml-6">
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>目标设定</strong>：可设置目标身高，实时显示进度</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>成员管理</strong>：支持添加多个家庭成员，自定义头像</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>趋势图表</strong>：折线图直观展示身高变化趋势</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>增长速率</strong>：自动计算 cm/年增长速率，标注年龄段评级</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>成年预测</strong>：输入出生日期+性别，自动估算成年身高</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>数据报告</strong>：周/月/年报，分析身高变化速度</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>成就系统</strong>：里程碑身高（80cm、1米、1.5米……）解锁</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-cyan-500">•</span>
              <span><strong>分享功能</strong>：导出图表图片，分享进度</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-cyan-50 rounded-xl">
          <h4 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <span class="text-body-lg">💡</span> 健康提示
          </h4>
          <p class="text-body-sm">建议每天在固定时间（如晨起）测量身高，避免穿鞋影响数据。儿童身高发育受遗传、营养、睡眠、运动等多因素影响，保持规律作息、均衡饮食、适量运动，有助于充分发挥生长潜力。如发现生长速率异常，建议咨询专业医生。</p>
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
import TrendCharts from '~icons/ep/trendCharts'
import Calendar from '~icons/ep/calendar'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
import DataLine from '~icons/ep/dataLine'
import Aim from '~icons/ep/aim'
export default {
  components: { DataAnalysis, Loading, Plus, Promotion, Share, TrendCharts, Calendar, Edit, Delete, DataLine, Aim }
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
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(6, 182, 212, 0.02) 100%);
  border-left-color: #06b6d4;
  transform: translateX(4px);
}

:deep(.el-progress-bar__inner) {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border-color: #06b6d4;
}

:deep(.el-select__wrapper) {
  border-radius: 10px !important;
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

.avatar-circle {
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

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

.main-record-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(6, 182, 212, 0.3);
  transition: all 0.3s ease;
}

.main-record-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(6, 182, 212, 0.4);
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
</style>