<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '日期计算器'

type Mode = 'diff' | 'add' | 'workday'

const mode = ref<Mode>('diff')

const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// ---- 相差天数 ----
const startDate = ref(toDateStr(today))
const endDate = ref(toDateStr(new Date(today.getTime() + 30 * 86400000)))

const parseDate = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

const DAY = 86400000

const diffResult = computed(() => {
  const a = parseDate(startDate.value)
  const b = parseDate(endDate.value)
  if (!a || !b) return null
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  const days = Math.round((b0.getTime() - a0.getTime()) / DAY)
  const earlier = days >= 0 ? a0 : b0
  const later = days >= 0 ? b0 : a0
  const absDays = Math.abs(days)

  // 精确 X年X月X天
  let years = later.getFullYear() - earlier.getFullYear()
  let months = later.getMonth() - earlier.getMonth()
  let dayDiff = later.getDate() - earlier.getDate()
  if (dayDiff < 0) {
    months--
    const prevMonthDays = new Date(later.getFullYear(), later.getMonth(), 0).getDate()
    dayDiff += prevMonthDays
  }
  if (months < 0) {
    years--
    months += 12
  }

  return {
    days,
    absDays,
    weeks: (absDays / 7).toFixed(1),
    monthsTotal: years * 12 + months,
    precise: `${years} 年 ${months} 个月 ${dayDiff} 天`,
    weekdays: countWorkdays(earlier, later),
    startWeek: ['日', '一', '二', '三', '四', '五', '六'][a.getDay()],
    endWeek: ['日', '一', '二', '三', '四', '五', '六'][b.getDay()],
  }
})

// ---- 日期加减 ----
const baseDate = ref(toDateStr(today))
const addAmount = ref(30)
const addUnit = ref<'day' | 'week' | 'month' | 'year'>('day')

const addResult = computed(() => {
  const base = parseDate(baseDate.value)
  if (!base || !Number.isFinite(addAmount.value)) return null
  const d = new Date(base.getTime())
  const n = Math.trunc(addAmount.value)
  if (addUnit.value === 'day') d.setDate(d.getDate() + n)
  else if (addUnit.value === 'week') d.setDate(d.getDate() + n * 7)
  else if (addUnit.value === 'month') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return {
    date: toDateStr(d),
    week: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
  }
})

// ---- 工作日计算 ----
const workStart = ref(toDateStr(today))
const workEnd = ref(toDateStr(new Date(today.getTime() + 30 * 86400000)))
const workIncludeEnd = ref(true)

function countWorkdays(a: Date, b: Date) {
  let count = 0
  const cur = new Date(a.getTime())
  const end = new Date(b.getTime())
  while (cur <= end) {
    const w = cur.getDay()
    if (w !== 0 && w !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

const workResult = computed(() => {
  const a = parseDate(workStart.value)
  const b = parseDate(workEnd.value)
  if (!a || !b) return null
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  if (b0 < a0) return null
  const end = new Date(b0.getTime())
  if (!workIncludeEnd.value) end.setDate(end.getDate() - 1)
  if (end < a0) return { totalDays: 0, workdays: 0, weekendDays: 0 }
  const totalDays = Math.round((end.getTime() - a0.getTime()) / DAY) + 1
  const workdays = countWorkdays(a0, end)
  return { totalDays, workdays, weekendDays: totalDays - workdays }
})

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">日期计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          计算两个日期相差天数、日期推算以及工作日统计，支持精确到年月天的差异展示。
        </p>
      </header>

      <el-radio-group v-model="mode" class="mb-4">
        <el-radio-button value="diff">日期相差</el-radio-button>
        <el-radio-button value="add">日期推算</el-radio-button>
        <el-radio-button value="workday">工作日统计</el-radio-button>
      </el-radio-group>

      <!-- 相差天数 -->
      <div v-if="mode === 'diff'" class="datecalc-panel">
        <div class="datecalc-inputs">
          <div class="datecalc-field">
            <label>开始日期</label>
            <el-date-picker v-model="startDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="w-full" />
            <span class="datecalc-week" v-if="diffResult">星期{{ diffResult.startWeek }}</span>
          </div>
          <div class="datecalc-field">
            <label>结束日期</label>
            <el-date-picker v-model="endDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="w-full" />
            <span class="datecalc-week" v-if="diffResult">星期{{ diffResult.endWeek }}</span>
          </div>
        </div>
        <div v-if="diffResult" class="datecalc-cards">
          <div class="datecalc-card datecalc-card-main">
            <span class="datecalc-card-label">相差天数</span>
            <span class="datecalc-card-value">{{ diffResult.days }}<small> 天</small></span>
          </div>
          <div class="datecalc-card">
            <span class="datecalc-card-label">精确差异</span>
            <span class="datecalc-card-value-sm">{{ diffResult.precise }}</span>
          </div>
          <div class="datecalc-card">
            <span class="datecalc-card-label">约合</span>
            <span class="datecalc-card-value-sm">{{ diffResult.weeks }} 周 / {{ diffResult.monthsTotal }} 个月</span>
          </div>
          <div class="datecalc-card">
            <span class="datecalc-card-label">其中工作日</span>
            <span class="datecalc-card-value-sm">{{ diffResult.weekdays }} 天</span>
          </div>
        </div>
      </div>

      <!-- 日期推算 -->
      <div v-else-if="mode === 'add'" class="datecalc-panel">
        <div class="datecalc-inputs">
          <div class="datecalc-field">
            <label>基准日期</label>
            <el-date-picker v-model="baseDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="w-full" />
          </div>
          <div class="datecalc-field">
            <label>推算量</label>
            <div class="flex flex-wrap gap-2 items-center">
              <el-input-number v-model="addAmount" :min="-100000" :max="100000" class="datecalc-amount" />
              <el-select v-model="addUnit" class="datecalc-unit">
                <el-option label="天" value="day" />
                <el-option label="周" value="week" />
                <el-option label="月" value="month" />
                <el-option label="年" value="year" />
              </el-select>
            </div>
          </div>
        </div>
        <div v-if="addResult" class="datecalc-cards">
          <div class="datecalc-card datecalc-card-main datecalc-card-clickable" @click="copyText(addResult.date)">
            <span class="datecalc-card-label">推算结果（点击复制）</span>
            <span class="datecalc-card-value">{{ addResult.date }}</span>
            <span class="datecalc-card-tail">星期{{ addResult.week }}</span>
          </div>
        </div>
      </div>

      <!-- 工作日 -->
      <div v-else class="datecalc-panel">
        <div class="datecalc-inputs">
          <div class="datecalc-field">
            <label>开始日期</label>
            <el-date-picker v-model="workStart" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="w-full" />
          </div>
          <div class="datecalc-field">
            <label>结束日期</label>
            <el-date-picker v-model="workEnd" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="w-full" />
          </div>
          <div class="datecalc-field">
            <label>&nbsp;</label>
            <el-checkbox v-model="workIncludeEnd">结束日当天计入</el-checkbox>
          </div>
        </div>
        <div v-if="workResult" class="datecalc-cards">
          <div class="datecalc-card datecalc-card-main">
            <span class="datecalc-card-label">工作日</span>
            <span class="datecalc-card-value">{{ workResult.workdays }}<small> 天</small></span>
          </div>
          <div class="datecalc-card">
            <span class="datecalc-card-label">总天数</span>
            <span class="datecalc-card-value-sm">{{ workResult.totalDays }} 天</span>
          </div>
          <div class="datecalc-card">
            <span class="datecalc-card-label">周末天数</span>
            <span class="datecalc-card-value-sm">{{ workResult.weekendDays }} 天</span>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        三种模式：① 日期相差——计算两个日期间隔的总天数、几周几个月以及精确的 X 年 X 月 X 天，并统计其中工作日；② 日期推算——从基准日期往前或往后推 N 天/周/月/年，结果可点击复制；③ 工作日统计——统计区间内扣除周六周日后剩多少个工作日（不含法定节假日调休，仅供参考）。所有计算在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.datecalc-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.datecalc-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 260px));
  gap: 16px;
  align-items: start;
}

.datecalc-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.datecalc-field > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.datecalc-week {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* el-input-number 两侧步进按钮各占 42px 内边距，宽度不足时数值会被压到 0 宽而不可见 */
.datecalc-amount {
  flex: 1 1 150px;
  min-width: 150px;
}

.datecalc-unit {
  flex: 0 0 auto;
  width: 96px;
}

.datecalc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.datecalc-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.datecalc-card-main {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.datecalc-card-clickable {
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.datecalc-card-clickable:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.datecalc-card-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.datecalc-card-value {
  color: var(--el-color-primary);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
}

.datecalc-card small {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.datecalc-card-value-sm {
  color: var(--el-text-color-primary);
  font-size: 17px;
  font-weight: 600;
}

.datecalc-card-tail {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
