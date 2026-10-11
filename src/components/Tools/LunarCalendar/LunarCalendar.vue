<script setup lang="ts">
import { computed, ref } from 'vue'
import solarLunar from 'solarlunar'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '农历/万年历'

const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')

const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1) // 1-12
const selected = ref(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`)

interface CalendarCell {
  date: string
  day: number
  lunarText: string
  isToday: boolean
  isCurrentMonth: boolean
  isTerm: boolean
  isWeekend: boolean
}

const calendarCells = computed<CalendarCell[]>(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = firstDay.getDay() // 0=周日
  const cells: CalendarCell[] = []

  // 上月补位（0-based 月份：上个月是 month - 2，Date 会自动处理跨年）
  const prevDays = new Date(year, month - 1, 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 2, prevDays - i)
    cells.push(buildCell(d, false))
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(buildCell(new Date(year, month - 1, day), true))
  }
  // 下月补位，凑满整周
  while (cells.length % 7 !== 0) {
    cells.push(buildCell(new Date(year, month, cells.length - startOffset - daysInMonth + 1), false))
  }
  return cells
})

function buildCell(d: Date, isCurrentMonth: boolean): CalendarCell {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  // solar2lunar 任一参数缺失时会回退到今天，必须传完整的年月日数字
  const lunar = solarLunar.solar2lunar(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const isToday = d.toDateString() === today.toDateString()
  const lunarText = lunar.dayCn === '初一' ? lunar.monthCn : lunar.isTerm ? lunar.term : lunar.dayCn
  return {
    date,
    day: d.getDate(),
    lunarText,
    isToday,
    isCurrentMonth,
    isTerm: !!lunar.isTerm,
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
  }
}

const selectedInfo = computed(() => {
  const [y, m, d] = selected.value.split('-').map(Number)
  const lunar = solarLunar.solar2lunar(y, m, d)
  if (!lunar || typeof lunar === 'number') return null
  const solar = lunar.cYear + ' 年 ' + lunar.cMonth + ' 月 ' + lunar.cDay + ' 日'
  const week = '星期' + lunar.ncWeek.slice(2)
  return {
    solar,
    week,
    lunarDate: `${lunar.yearCn} ${lunar.monthCn}${lunar.dayCn}`,
    gz: `${lunar.gzYear}年 ${lunar.gzMonth}月 ${lunar.gzDay}日`,
    animal: lunar.animal,
    term: lunar.isTerm ? lunar.term : '',
  }
})

const prevMonth = () => {
  if (viewMonth.value === 1) {
    viewYear.value--
    viewMonth.value = 12
  } else {
    viewMonth.value--
  }
}
const nextMonth = () => {
  if (viewMonth.value === 12) {
    viewYear.value++
    viewMonth.value = 1
  } else {
    viewMonth.value++
  }
}
const backToday = () => {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth() + 1
  selected.value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

// ---- 农历转公历 ----
const lunarYear = ref(today.getFullYear())
const lunarMonth = ref(1)
const lunarDay = ref(1)
const lunarLeap = ref(false)

const leapMonthOfYear = computed(() => solarLunar.leapMonth(lunarYear.value))
const lunarMonthDays = computed(() => solarLunar.monthDays(lunarYear.value, lunarMonth.value))

const lunarToSolarResult = ref('')
const convertLunarToSolar = () => {
  const r = solarLunar.lunar2solar(lunarYear.value, lunarMonth.value, lunarDay.value, lunarLeap.value)
  if (typeof r === 'number' || !r) {
    lunarToSolarResult.value = ''
    return
  }
  lunarToSolarResult.value = `${r.cYear} 年 ${r.cMonth} 月 ${r.cDay} 日（星期${r.ncWeek.slice(2)}）`
}
convertLunarToSolar()

const lunarMonthLabel = (m: number) => {
  const cn = solarLunar.nStr3[m - 1] || m
  return leapMonthOfYear.value === m ? `闰${cn}月` : `${cn}月`
}

const lunarDayLabel = (d: number) => {
  if (d === 10) return '初十'
  if (d === 20) return '二十'
  if (d === 30) return '三十'
  return solarLunar.nStr2[Math.floor(d / 10)] + solarLunar.nStr1[d % 10]
}

const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
    value: m,
    label: lunarMonthLabel(m),
  })),
)

const dayOptions = computed(() =>
  Array.from({ length: lunarMonthDays.value }, (_, i) => i + 1).map((d) => ({
    value: d,
    label: lunarDayLabel(d),
  })),
)

const weekHeaders = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">农历/万年历</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          公农历对照万年历，展示干支纪年、生肖与二十四节气，支持农历生日反查公历日期。
        </p>
      </header>

      <div class="lunar-layout">
        <div class="lunar-calendar">
          <div class="lunar-toolbar">
            <el-button size="small" @click="prevMonth">‹ 上月</el-button>
            <span class="lunar-title">{{ viewYear }} 年 {{ viewMonth }} 月</span>
            <el-button size="small" @click="nextMonth">下月 ›</el-button>
            <el-button size="small" text type="primary" @click="backToday">今天</el-button>
          </div>

          <div class="lunar-grid lunar-grid-head">
            <div v-for="w in weekHeaders" :key="w" class="lunar-week-header" :class="{ 'lunar-weekend': w === '日' || w === '六' }">
              {{ w }}
            </div>
          </div>
          <div class="lunar-grid">
            <button
              v-for="cell in calendarCells"
              :key="cell.date"
              type="button"
              class="lunar-cell"
              :class="{
                'lunar-cell-today': cell.isToday,
                'lunar-cell-active': cell.date === selected,
                'lunar-cell-muted': !cell.isCurrentMonth,
                'lunar-cell-weekend': cell.isWeekend && cell.isCurrentMonth,
              }"
              @click="selected = cell.date"
            >
              <span class="lunar-day">{{ cell.day }}</span>
              <span class="lunar-sub" :class="{ 'lunar-term': cell.isTerm }">{{ cell.lunarText }}</span>
            </button>
          </div>
        </div>

        <aside class="lunar-aside">
          <div v-if="selectedInfo" class="lunar-detail">
            <div class="lunar-detail-solar">{{ selectedInfo.solar }}</div>
            <div class="lunar-detail-week">{{ selectedInfo.week }}</div>
            <dl class="lunar-detail-list">
              <div><dt>农历</dt><dd>{{ selectedInfo.lunarDate }}</dd></div>
              <div><dt>干支</dt><dd>{{ selectedInfo.gz }}</dd></div>
              <div><dt>生肖</dt><dd>{{ selectedInfo.animal }}</dd></div>
              <div v-if="selectedInfo.term"><dt>节气</dt><dd>{{ selectedInfo.term }}</dd></div>
            </dl>
          </div>

          <el-divider>农历 → 公历</el-divider>

          <div class="lunar-convert">
            <div class="lunar-convert-row">
              <el-input-number v-model="lunarYear" :min="1900" :max="2100" :controls="false" class="!w-20" />
              <el-select v-model="lunarMonth" class="flex-1" @change="lunarDay = 1; convertLunarToSolar()">
                <el-option v-for="m in monthOptions" :key="m.value" :label="m.label" :value="m.value" />
              </el-select>
              <el-select v-model="lunarDay" class="flex-1" @change="convertLunarToSolar()">
                <el-option v-for="d in dayOptions" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </div>
            <el-checkbox
              v-model="lunarLeap"
              :disabled="leapMonthOfYear === 0 || leapMonthOfYear !== lunarMonth"
              @change="convertLunarToSolar()"
            >
              闰月{{ leapMonthOfYear ? `（今年闰${leapMonthOfYear} 月）` : '（今年无闰月）' }}
            </el-checkbox>
            <div v-if="lunarToSolarResult" class="lunar-convert-result">
              对应公历：{{ lunarToSolarResult }}
            </div>
          </div>
        </aside>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        左侧为公农历对照的月历，每天下方显示农历日、农历月初一显示月名、节气当天显示节气名；点击任意日期可在右侧查看农历、干支、生肖等详情。右下角支持农历转公历，适合查询农历生日对应的公历日期，闰月年份会自动提供闰月选项。支持 1900–2100 年，数据来自内置历法库，全部在浏览器本地计算。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.lunar-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr);
  gap: 24px;
  align-items: start;
}

.lunar-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.lunar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lunar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.lunar-grid-head {
  margin-bottom: 4px;
}

.lunar-week-header {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 0;
}

.lunar-weekend {
  color: var(--el-color-danger);
}

.lunar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}

.lunar-cell:hover {
  background: var(--el-fill-color);
}

.lunar-cell-muted {
  opacity: 0.35;
}

.lunar-cell-weekend .lunar-day {
  color: var(--el-color-danger);
}

.lunar-cell-active {
  background: var(--el-color-primary-light-8);
}

.lunar-cell-today .lunar-day {
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 50%;
}

.lunar-day {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.lunar-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1;
}

.lunar-term {
  color: var(--el-color-success);
  font-weight: 600;
}

.lunar-aside {
  display: flex;
  flex-direction: column;
}

.lunar-detail {
  padding: 16px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}

.lunar-detail-solar {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lunar-detail-week {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.lunar-detail-list {
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lunar-detail-list div {
  display: flex;
  gap: 12px;
}

.lunar-detail-list dt {
  flex-shrink: 0;
  width: 36px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.lunar-detail-list dd {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.lunar-convert {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lunar-convert-row {
  display: flex;
  gap: 8px;
}

.lunar-convert-result {
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
  font-size: 14px;
}

@media (max-width: 1023px) {
  .lunar-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 639px) {
  .lunar-day {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }

  .lunar-sub {
    font-size: 10px;
  }
}
</style>
