<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface Settings {
  birthYear: number
  birthMonth: number
  birthDay: number
  gender: 'male' | 'female-worker' | 'female-cadre'
  retireAge: number
  workStartYear: number
  workStartMonth: number
}

const STORAGE_KEY = 'retirement-countdown-settings-v1'

// 中国现行法定退休年龄（基础档，未含渐进式延迟调整，仅作提示用）
const DEFAULT_AGE_BY_GENDER: Record<Settings['gender'], number> = {
  'male': 60,
  'female-worker': 50,
  'female-cadre': 55,
}

const PRESETS = [
  { label: '男职工 (60 岁)', gender: 'male' as const, age: 60 },
  { label: '女工人 (50 岁)', gender: 'female-worker' as const, age: 50 },
  { label: '女干部 (55 岁)', gender: 'female-cadre' as const, age: 55 },
  { label: '自定义', gender: 'male' as const, age: 60 },
]

const today = new Date()
const defaultSettings = (): Settings => ({
  birthYear: 1990,
  birthMonth: today.getMonth() + 1,
  birthDay: today.getDate(),
  gender: 'male',
  retireAge: 60,
  workStartYear: 2012,
  workStartMonth: 7,
})

const settings = ref<Settings>(defaultSettings())
const now = ref(Date.now())
let timerId: ReturnType<typeof setInterval> | null = null

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Settings
      const base = defaultSettings()
      settings.value = { ...base, ...parsed }
    }
  } catch (e) {
    settings.value = defaultSettings()
  }
}

const saveSettings = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  } catch (e) {
    // ignore
  }
}

const clearSettings = () => {
  settings.value = defaultSettings()
  saveSettings()
}

// 退休日期 = 出生日期 + retireAge 年；若当日不存在（如 2 月 30）则取月末
const retirementDate = computed(() => {
  const { birthYear, birthMonth, birthDay, retireAge } = settings.value
  if (!birthYear || !birthMonth || !birthDay || !retireAge) return null
  const targetYear = birthYear + retireAge
  // 用 Date 构造，自动处理 2 月 30 → 3 月 2 这种越界，但希望"取当月最后一天"
  const daysInMonth = new Date(targetYear, birthMonth, 0).getDate()
  const day = Math.min(birthDay, daysInMonth)
  const d = new Date(targetYear, birthMonth - 1, day, 0, 0, 0, 0)
  return isNaN(d.getTime()) ? null : d
})

const diffMs = computed(() => {
  if (!retirementDate.value) return 0
  return retirementDate.value.getTime() - now.value
})

const isRetired = computed(() => diffMs.value <= 0)

// 拆分剩余为：天 / 时 / 分 / 秒
const parts = computed(() => {
  const total = Math.max(0, diffMs.value)
  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  return { days, hours, minutes, seconds }
})

// 把剩余天数拆成 "X 年 Y 个月 Z 天"，按"当年当月"取整，剩余不足 1 天按 1 天显示
const yearsMonthsDays = computed(() => {
  if (!retirementDate.value) return { years: 0, months: 0, days: 0 }
  const target = retirementDate.value
  const t = new Date(now.value)
  let years = target.getFullYear() - t.getFullYear()
  let months = target.getMonth() - t.getMonth()
  let days = target.getDate() - t.getDate()
  if (days < 0) {
    months -= 1
    // 用前一个月的天数补足
    const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0) years = 0
  if (months < 0) months = 0
  if (days < 0) days = 0
  return { years, months, days }
})

// 当前年龄与剩余进度（按总寿命假设 75 年，仅作进度展示）
const LIFE_EXPECTANCY = 75
const currentAge = computed(() => {
  const { birthYear, birthMonth, birthDay } = settings.value
  const t = new Date(now.value)
  let age = t.getFullYear() - birthYear
  const mDiff = t.getMonth() + 1 - birthMonth
  if (mDiff < 0 || (mDiff === 0 && t.getDate() < birthDay)) age -= 1
  return Math.max(0, age)
})

const lifeProgress = computed(() => {
  const pct = (currentAge.value / LIFE_EXPECTANCY) * 100
  return Math.min(100, Math.max(0, pct))
})

const retireProgress = computed(() => {
  if (!settings.value.retireAge) return 0
  return Math.min(100, Math.max(0, (currentAge.value / settings.value.retireAge) * 100))
})

// 总工作日（粗略估算：剩余天数 × 5/7）
const workDaysRemaining = computed(() => {
  return Math.floor(parts.value.days * (5 / 7))
})

// 总工作小时
const workHoursRemaining = computed(() => {
  return workDaysRemaining.value * 8
})

const formattedRetirementDate = computed(() => {
  if (!retirementDate.value) return '—'
  const d = retirementDate.value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

const weekdayOfRetirement = computed(() => {
  if (!retirementDate.value) return ''
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return names[retirementDate.value.getDay()]
})

const totalWeekdays = computed(() => {
  return Math.max(0, Math.floor(parts.value.days * 2 / 7))
})

const totalWeekends = computed(() => {
  return Math.max(0, parts.value.days - workDaysRemaining.value - totalWeekdays.value)
})

// 工龄（精确到月）
const workYearsExact = computed(() => {
  const t = new Date(now.value)
  const startYear = settings.value.workStartYear
  const startMonth = settings.value.workStartMonth
  if (!startYear || !startMonth) return { years: 0, months: 0, totalMonths: 0 }
  let years = t.getFullYear() - startYear
  let months = (t.getMonth() + 1) - startMonth
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0) years = 0
  if (months < 0) months = 0
  return { years, months, totalMonths: years * 12 + months }
})

// 退休时累计工作月数（从工作开始到退休当月，含首月）
const totalWorkMonthsAtRetirement = computed(() => {
  const startYear = settings.value.workStartYear
  const startMonth = settings.value.workStartMonth
  if (!retirementDate.value || !startYear || !startMonth) return 0
  const retire = retirementDate.value
  let years = retire.getFullYear() - startYear
  let months = (retire.getMonth() + 1) - startMonth
  return Math.max(0, years * 12 + months + 1)
})

// 已工作月份占比（针对总工龄）
const workProgress = computed(() => {
  const total = totalWorkMonthsAtRetirement.value
  if (!total) return 0
  return Math.min(100, Math.max(0, (workYearsExact.value.totalMonths / total) * 100))
})

// 工作月份格子：按年分组
type MonthState = 'before-start' | 'past' | 'current' | 'future' | 'retired'
interface MonthCell {
  month: number
  state: MonthState
  isPast: boolean
}
interface YearRow {
  year: number
  cells: MonthCell[]
  pastCount: number
  isCurrentYear: boolean
  isRetiredYear: boolean
}

const monthLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

const workMonthGrid = computed<YearRow[]>(() => {
  const startYear = settings.value.workStartYear
  const startMonth = settings.value.workStartMonth
  const t = new Date(now.value)
  const curYear = t.getFullYear()
  const curMonth = t.getMonth() + 1
  const retire = retirementDate.value
  if (!startYear || !startMonth) return []

  const endYear = retire ? retire.getFullYear() : curYear
  const endMonth = retire ? retire.getMonth() + 1 : curMonth

  const rows: YearRow[] = []
  for (let y = startYear; y <= endYear; y++) {
    const cells: MonthCell[] = []
    let pastCount = 0
    const fromMonth = (y === startYear) ? startMonth : 1
    const toMonth = (y === endYear) ? endMonth : 12

    for (let m = 1; m <= 12; m++) {
      if (m < fromMonth || m > toMonth) {
        cells.push({ month: m, state: 'before-start', isPast: false })
        continue
      }
      let state: MonthState
      const cellDate = new Date(y, m - 1, 1)
      const curDate = new Date(curYear, curMonth - 1, 1)
      const retireDateFirst = retire ? new Date(retire.getFullYear(), retire.getMonth(), 1) : null
      if (cellDate.getTime() < curDate.getTime()) {
        state = 'past'
        pastCount += 1
      } else if (cellDate.getTime() === curDate.getTime()) {
        state = 'current'
      } else if (retireDateFirst && cellDate.getTime() >= retireDateFirst.getTime()) {
        state = 'retired'
      } else {
        state = 'future'
      }
      cells.push({ month: m, state, isPast: state === 'past' })
    }
    rows.push({
      year: y,
      cells,
      pastCount,
      isCurrentYear: y === curYear,
      isRetiredYear: retire ? y === retire.getFullYear() : false,
    })
  }
  return rows
})

const totalPastMonths = computed(() => {
  return workMonthGrid.value.reduce((sum, row) => sum + row.pastCount, 0)
})

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

const presetDefaultAge = computed(() => DEFAULT_AGE_BY_GENDER[settings.value.gender])

const applyPreset = (preset: typeof PRESETS[number]) => {
  settings.value.gender = preset.gender
  settings.value.retireAge = preset.age
}

// 监听设置变化，自动保存
watch(settings, () => {
  saveSettings()
}, { deep: true })

// 启动 / 停止定时器
const startTimer = () => {
  if (timerId) return
  timerId = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

loadSettings()
startTimer()

onBeforeUnmount(() => {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="退休倒计时" />

    <!-- 设置区 -->
    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div class="space-y-4">
          <div>
            <div class="text-h2 font-semibold text-slate-800">基本信息</div>
            <div class="mt-1 text-body-sm text-slate-500">填写出生日期、性别与目标退休年龄，倒计时将自动计算并实时更新。</div>
          </div>

          <div class="space-y-3">
            <div class="text-body-sm font-medium text-slate-700">出生日期</div>
            <el-row :gutter="12">
              <el-col :xs="24" :sm="8">
                <el-form-item label="年">
                  <el-input-number v-model="settings.birthYear" :min="1940" :max="2010" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="8">
                <el-form-item label="月">
                  <el-input-number v-model="settings.birthMonth" :min="1" :max="12" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="8">
                <el-form-item label="日">
                  <el-input-number v-model="settings.birthDay" :min="1" :max="31" class="w-full" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div class="space-y-3">
            <div class="text-body-sm font-medium text-slate-700">工作开始时间</div>
            <el-row :gutter="12">
              <el-col :xs="24" :sm="12">
                <el-form-item label="年">
                  <el-input-number v-model="settings.workStartYear" :min="1970" :max="2050" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="月">
                  <el-input-number v-model="settings.workStartMonth" :min="1" :max="12" class="w-full" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div class="space-y-2">
            <div class="text-body-sm font-medium text-slate-700">性别 / 身份</div>
            <el-radio-group v-model="settings.gender" class="flex flex-wrap">
              <el-radio-button value="male">男职工</el-radio-button>
              <el-radio-button value="female-worker">女工人</el-radio-button>
              <el-radio-button value="female-cadre">女干部</el-radio-button>
            </el-radio-group>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-body-sm font-medium text-slate-700">目标退休年龄</span>
              <span class="text-caption text-slate-500">法定参考：{{ presetDefaultAge }} 岁</span>
            </div>
            <el-input-number v-model="settings.retireAge" :min="40" :max="80" :step="1" class="w-full" />
            <el-slider v-model="settings.retireAge" :min="40" :max="80" :step="1" show-stops />
          </div>

          <div class="space-y-2">
            <div class="text-body-sm font-medium text-slate-700">快速预设</div>
            <div class="flex flex-wrap gap-2">
              <el-button v-for="item in PRESETS" :key="item.label" size="small" type="info" @click="applyPreset(item)">
                {{ item.label }}
              </el-button>
            </div>
          </div>

          <div class="flex justify-end">
            <el-button size="small" type="danger" plain @click="clearSettings">重置</el-button>
          </div>
        </div>

        <!-- 摘要信息 -->
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div class="text-caption text-slate-500">当前年龄</div>
              <div class="text-h3 font-semibold text-slate-800">{{ currentAge }} 岁</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div class="text-caption text-slate-500">退休日期</div>
              <div class="text-h3 font-semibold text-slate-800">{{ formattedRetirementDate }}</div>
              <div class="text-caption text-slate-400 mt-1">{{ weekdayOfRetirement }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div class="text-caption text-slate-500">已工作 / 退休目标</div>
              <div class="text-h3 font-semibold text-slate-800">{{ retireProgress.toFixed(0) }}%</div>
              <div class="h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div class="h-full bg-emerald-500 transition-all" :style="{ width: retireProgress + '%' }"></div>
              </div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div class="text-caption text-slate-500">人生进度（参考 75 岁）</div>
              <div class="text-h3 font-semibold text-slate-800">{{ lifeProgress.toFixed(0) }}%</div>
              <div class="h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                <div class="h-full bg-indigo-500 transition-all" :style="{ width: lifeProgress + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-body-sm leading-relaxed">
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold">当前工龄</span>
              <span class="text-h3 font-semibold tabular-nums">{{ workYearsExact.years }} 年 {{ workYearsExact.months }} 个月</span>
            </div>
            <div class="flex items-center justify-between text-caption text-indigo-700">
              <span>累计 {{ totalPastMonths }} / {{ totalWorkMonthsAtRetirement }} 个月（含退休当月）</span>
              <span>{{ workProgress.toFixed(0) }}%</span>
            </div>
            <div class="h-2 rounded-full bg-white/60 mt-2 overflow-hidden border border-indigo-200">
              <div class="h-full bg-indigo-500 transition-all" :style="{ width: workProgress + '%' }"></div>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-body-sm leading-relaxed">
            <div class="font-semibold mb-1">温馨提示</div>
            本工具仅供参考。法定退休年龄可能因政策调整发生变化，请以人社部门最新文件为准。法定基础档：男 60 周岁、女工人 50 周岁、女干部 55 周岁。
          </div>
        </div>
      </div>
    </div>

    <!-- 主显示：倒计时数字 -->
    <div class="mt-4 p-6 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
      <div class="flex items-center justify-between">
        <div class="text-body-sm opacity-90">距离退休还有</div>
        <div class="text-caption px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
          {{ isRetired ? '🎉 已退休' : '⏳ 进行中' }}
        </div>
      </div>

      <div v-if="isRetired" class="mt-8 text-center">
        <div class="text-5xl md:text-6xl font-bold">🎊 恭喜退休！</div>
        <div class="mt-3 text-body opacity-90">已于 {{ formattedRetirementDate }} ({{ weekdayOfRetirement }}) 正式退休</div>
      </div>

      <div v-else class="mt-6">
        <div class="grid grid-cols-4 gap-3 md:gap-6">
          <div class="text-center">
            <div class="text-4xl md:text-7xl font-bold tabular-nums tracking-tight">{{ pad(parts.days, 3) }}</div>
            <div class="mt-2 text-body-sm opacity-90">天</div>
          </div>
          <div class="text-center">
            <div class="text-4xl md:text-7xl font-bold tabular-nums tracking-tight">{{ pad(parts.hours) }}</div>
            <div class="mt-2 text-body-sm opacity-90">时</div>
          </div>
          <div class="text-center">
            <div class="text-4xl md:text-7xl font-bold tabular-nums tracking-tight">{{ pad(parts.minutes) }}</div>
            <div class="mt-2 text-body-sm opacity-90">分</div>
          </div>
          <div class="text-center">
            <div class="text-4xl md:text-7xl font-bold tabular-nums tracking-tight">{{ pad(parts.seconds) }}</div>
            <div class="mt-2 text-body-sm opacity-90">秒</div>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-3 gap-3 md:gap-4 text-center">
          <div class="rounded-xl bg-white/15 backdrop-blur-sm p-3">
            <div class="text-3xl md:text-4xl font-bold tabular-nums">{{ yearsMonthsDays.years }}</div>
            <div class="mt-1 text-caption opacity-90">年</div>
          </div>
          <div class="rounded-xl bg-white/15 backdrop-blur-sm p-3">
            <div class="text-3xl md:text-4xl font-bold tabular-nums">{{ yearsMonthsDays.months }}</div>
            <div class="mt-1 text-caption opacity-90">个月</div>
          </div>
          <div class="rounded-xl bg-white/15 backdrop-blur-sm p-3">
            <div class="text-3xl md:text-4xl font-bold tabular-nums">{{ yearsMonthsDays.days }}</div>
            <div class="mt-1 text-caption opacity-90">天</div>
          </div>
        </div>
      </div>

      <div class="mt-6 h-2 rounded-full bg-white/20 overflow-hidden">
        <div class="h-full bg-white transition-all" :style="{ width: retireProgress + '%' }" />
      </div>
      <div class="mt-2 flex justify-between text-caption text-white/80">
        <span>出生</span>
        <span>{{ formattedRetirementDate }} 退休</span>
      </div>
    </div>

    <!-- 统计区 -->
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div class="text-caption text-slate-500">剩余工作日</div>
        <div class="text-h2 font-semibold text-slate-800 tabular-nums">{{ workDaysRemaining.toLocaleString() }}</div>
        <div class="text-caption text-slate-400 mt-1">约 {{ Math.round(workDaysRemaining / 250) }} 年工作量</div>
      </div>
      <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div class="text-caption text-slate-500">剩余工作小时</div>
        <div class="text-h2 font-semibold text-slate-800 tabular-nums">{{ workHoursRemaining.toLocaleString() }}</div>
        <div class="text-caption text-slate-400 mt-1">按每日 8 小时估算</div>
      </div>
      <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div class="text-caption text-slate-500">剩余周末天数</div>
        <div class="text-h2 font-semibold text-slate-800 tabular-nums">{{ totalWeekends.toLocaleString() }}</div>
        <div class="text-caption text-slate-400 mt-1">约 {{ Math.round(totalWeekends / 52) }} 年的周末</div>
      </div>
      <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div class="text-caption text-slate-500">剩余总天数</div>
        <div class="text-h2 font-semibold text-slate-800 tabular-nums">{{ parts.days.toLocaleString() }}</div>
        <div class="text-caption text-slate-400 mt-1">含周末与节假日</div>
      </div>
    </div>

    <!-- 工作月份格子 -->
    <div class="mt-4 p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-h2 font-semibold text-slate-800">工作月份格子</div>
          <div class="mt-1 text-body-sm text-slate-500">
            从 {{ settings.workStartYear }} 年 {{ settings.workStartMonth }} 月开始，
            至 {{ formattedRetirementDate }} 退休。
            已度过 {{ totalPastMonths }} / {{ totalWorkMonthsAtRetirement }} 个月。
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-caption text-slate-500">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-slate-300"></span> 已过去
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-emerald-400 ring-2 ring-emerald-300"></span> 当前月
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-white border border-slate-300"></span> 工作中
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-pink-200"></span> 退休后
          </span>
        </div>
      </div>

      <!-- 表头：月份 -->
      <div class="overflow-x-auto">
        <div class="min-w-[640px]">
          <div class="grid items-center gap-2 mb-2" :style="{ gridTemplateColumns: '64px repeat(12, minmax(0, 1fr))' }">
            <div></div>
            <div v-for="m in monthLabels" :key="'h-' + m" class="text-center text-caption text-slate-400 font-medium">
              {{ m }}月
            </div>
          </div>

          <div v-for="row in workMonthGrid" :key="row.year" class="mb-2">
            <div
              class="grid items-center gap-2"
              :class="[row.isCurrentYear ? 'py-1.5 rounded-lg bg-indigo-50/60' : '']"
              :style="{ gridTemplateColumns: '64px repeat(12, minmax(0, 1fr))' }"
            >
              <div class="text-body-sm font-semibold text-slate-700 flex items-center gap-1">
                <span>{{ row.year }}</span>
                <span v-if="row.isRetiredYear" class="text-caption text-pink-500">🎉</span>
              </div>
              <div
                v-for="cell in row.cells"
                :key="row.year + '-' + cell.month"
                class="aspect-square rounded-md flex items-center justify-center text-caption transition-all select-none"
                :class="{
                  'bg-slate-200 text-slate-500 line-through': cell.state === 'past',
                  'bg-emerald-400 text-white font-bold ring-2 ring-emerald-300 shadow-sm scale-105': cell.state === 'current',
                  'bg-white border border-dashed border-slate-300 text-slate-300': cell.state === 'future',
                  'bg-pink-100 text-pink-400': cell.state === 'retired',
                  'bg-transparent text-transparent': cell.state === 'before-start',
                }"
                :title="row.year + '年' + cell.month + '月 - ' + (
                  cell.state === 'past' ? '已过去' :
                  cell.state === 'current' ? '当前月' :
                  cell.state === 'future' ? '工作中' :
                  cell.state === 'retired' ? '退休后' : '未入职'
                )"
              >
                <template v-if="cell.state === 'past'">✕</template>
                <template v-else-if="cell.state === 'current'">今</template>
                <template v-else-if="cell.state === 'future'">·</template>
                <template v-else-if="cell.state === 'retired'">✓</template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        退休倒计时工具根据出生日期、工作开始时间、性别（男职工 / 女工人 / 女干部）与目标退休年龄，自动计算距离法定退休日期的剩余时间，并按「天 / 时 / 分 / 秒」实时刷新，同时折算为「X 年 Y 个月 Z 天」便于直观理解。
        <br /><br />
        底部「工作月份格子」按年分组展示从入职到退休的每一个月份：已过去的月份显示「✕」并打上删除线，当前月高亮显示「今」，未来月以虚线框标记，退休后的月份显示「✓」。一眼看清自己的工龄进度。
        <br /><br />
        所有数据保存在浏览器本地（localStorage），不会上传服务器，可放心使用；点击「重置」可一键恢复默认设置。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>