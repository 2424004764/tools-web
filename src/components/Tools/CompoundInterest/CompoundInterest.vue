<script setup lang="ts">
/**
 * 复利计算器
 * --------------------------------------------------------
 * 纯前端：终值 / 定投 / 单利对照 / 目标倒推 / 年度明细 / 折线图。
 * 不调用任何后端 API。
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = { title: '复利计算器' }
const STORAGE_KEY = 'compound-interest-settings-v1'

type Freq = 0 | 1 | 2 | 4 | 12 | 365
type Timing = 'end' | 'begin'
type Mode = 'future' | 'principal' | 'years' | 'rate'

const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: 1, label: '每年' },
  { value: 2, label: '每半年' },
  { value: 4, label: '每季度' },
  { value: 12, label: '每月' },
  { value: 365, label: '每天' },
  { value: 0, label: '连续' },
]

const PRESETS = [
  { label: '银行定期 3 年', principal: 100000, rate: 2.5, years: 3, freq: 1 as Freq, contribution: 0 },
  { label: '货币基金 1 年', principal: 50000, rate: 1.8, years: 1, freq: 365 as Freq, contribution: 0 },
  { label: '指数基金 10 年', principal: 100000, rate: 8, years: 10, freq: 1 as Freq, contribution: 0 },
  { label: '每月定投 1000', principal: 0, rate: 7, years: 15, freq: 12 as Freq, contribution: 1000 },
  { label: '养老金 30 年', principal: 200000, rate: 6, years: 30, freq: 12 as Freq, contribution: 2000 },
]

interface Settings {
  principal: number
  rate: number
  years: number
  freq: Freq
  contribution: number
  timing: Timing
  inflation: number
  mode: Mode
  target: number
}

const defaultSettings = (): Settings => ({
  principal: 100000,
  rate: 5,
  years: 10,
  freq: 12,
  contribution: 0,
  timing: 'end',
  inflation: 0,
  mode: 'future',
  target: 1000000,
})

const settings = ref<Settings>(defaultSettings())

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<Settings>
    settings.value = { ...defaultSettings(), ...parsed }
  } catch {
    settings.value = defaultSettings()
  }
}

loadSettings()

const saveSettings = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  } catch {
    // ignore quota / private mode
  }
}

watch(settings, saveSettings, { deep: true })

interface YearRow {
  year: number
  start: number
  contribution: number
  interest: number
  end: number
  totalIn: number
  totalInterest: number
}

const clampNum = (n: number, min: number, max: number) => {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** 复利终值（闭式） */
const futureValue = (
  principal: number,
  annualRate: number,
  years: number,
  freq: Freq,
  contribution: number,
  timing: Timing,
) => {
  const P = Math.max(0, principal)
  const t = Math.max(0, years)
  const PMT = Math.max(0, contribution)
  const r = annualRate / 100

  if (t === 0) return P

  if (freq === 0) {
    const fvP = P * Math.exp(r * t)
    // 连续复利下定投按每月近似
    if (PMT <= 0) return fvP
    const i = r / 12
    const nt = Math.max(0, Math.round(12 * t))
    if (Math.abs(i) < 1e-12) return fvP + PMT * nt
    const factor = Math.pow(1 + i, nt)
    let fvC = PMT * (factor - 1) / i
    if (timing === 'begin') fvC *= 1 + i
    return fvP + fvC
  }

  const n = freq
  const i = r / n
  // 与年度明细同一套期数（四舍五入到整数期），避免公式终值和表格最后一行对不上
  const nt = Math.max(0, Math.round(n * t))
  if (Math.abs(i) < 1e-12) return P + PMT * nt
  const factor = Math.pow(1 + i, nt)
  const fvP = P * factor
  let fvC = PMT * (factor - 1) / i
  if (timing === 'begin') fvC *= 1 + i
  return fvP + fvC
}

/** 单利终值：本金按单利，定投各期按剩余年限单利 */
const simpleFutureValue = (
  principal: number,
  annualRate: number,
  years: number,
  freq: Freq,
  contribution: number,
  timing: Timing,
) => {
  const P = Math.max(0, principal)
  const t = Math.max(0, years)
  const PMT = Math.max(0, contribution)
  const r = annualRate / 100
  const fvP = P * (1 + r * t)
  if (PMT <= 0) return fvP
  const n = freq === 0 ? 12 : freq
  const nt = Math.max(0, Math.round(n * t))
  const iYear = r
  // 每期投入后剩余时间：期末 k 期时剩余 (nt-k)/n 年；期初再多 1/n 年
  let fvC = 0
  for (let k = 1; k <= nt; k++) {
    const elapsedYears = timing === 'begin' ? k / n : (k - 1) / n
    const remain = Math.max(0, t - elapsedYears)
    fvC += PMT * (1 + iYear * remain)
  }
  return fvP + fvC
}

const buildRows = (
  principal: number,
  annualRate: number,
  years: number,
  freq: Freq,
  contribution: number,
  timing: Timing,
): YearRow[] => {
  const P = Math.max(0, principal)
  const t = Math.max(0, years)
  const PMT = Math.max(0, contribution)
  const r = annualRate / 100
  const whole = Math.max(0, Math.ceil(t - 1e-9))
  if (whole === 0) return []

  if (freq === 0 && PMT <= 0) {
    const rows: YearRow[] = []
    for (let y = 1; y <= whole; y++) {
      const span = Math.min(1, t - (y - 1))
      const start = P * Math.exp(r * (y - 1))
      const end = P * Math.exp(r * (y - 1 + span))
      rows.push({
        year: y,
        start,
        contribution: 0,
        interest: end - start,
        end,
        totalIn: P,
        totalInterest: end - P,
      })
    }
    return rows
  }

  const n = freq === 0 ? 12 : freq
  const i = r / n
  const totalPeriods = Math.max(0, Math.round(n * t))
  let balance = P
  let totalIn = P
  let totalInterest = 0
  const rows: YearRow[] = []
  let year = 1
  let yearStart = balance
  let yearContrib = 0
  let yearInterest = 0

  for (let p = 1; p <= totalPeriods; p++) {
    if (timing === 'begin' && PMT > 0) {
      balance += PMT
      yearContrib += PMT
      totalIn += PMT
    }
    const interest = Math.abs(i) < 1e-12 ? 0 : balance * i
    balance += interest
    yearInterest += interest
    totalInterest += interest
    if (timing === 'end' && PMT > 0) {
      balance += PMT
      yearContrib += PMT
      totalIn += PMT
    }
    if (p % n === 0 || p === totalPeriods) {
      rows.push({
        year,
        start: yearStart,
        contribution: yearContrib,
        interest: yearInterest,
        end: balance,
        totalIn,
        totalInterest,
      })
      year += 1
      yearStart = balance
      yearContrib = 0
      yearInterest = 0
    }
  }
  return rows
}

const solved = computed(() => {
  const s = settings.value
  const freq = s.freq
  const timing = s.timing
  const contribution = Math.max(0, Number(s.contribution) || 0)
  const inflation = clampNum(Number(s.inflation) || 0, 0, 50)

  let principal = Math.max(0, Number(s.principal) || 0)
  let rate = Number(s.rate)
  if (!Number.isFinite(rate)) rate = 0
  let years = Math.max(0, Number(s.years) || 0)
  const target = Math.max(0, Number(s.target) || 0)

  const fvOf = (P: number, r: number, t: number) =>
    futureValue(P, r, t, freq, contribution, timing)

  if (s.mode === 'principal') {
    // 倒推本金：目标 = P * factor + annuity
    const t = Math.max(0.01, years)
    const fvC = fvOf(0, rate, t)
    const need = target - fvC
    const fv1 = fvOf(1, rate, t) - fvC
    principal = fv1 > 1e-12 ? need / fv1 : 0
    if (!Number.isFinite(principal)) principal = 0
    principal = Math.max(0, principal)
  } else if (s.mode === 'years') {
    // 二分求年限 0–80
    let lo = 0
    let hi = 80
    const start = fvOf(principal, rate, 0)
    if (target <= start) {
      years = 0
    } else if (fvOf(principal, rate, hi) < target) {
      years = hi
    } else {
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        if (fvOf(principal, rate, mid) >= target) hi = mid
        else lo = mid
      }
      years = hi
    }
  } else if (s.mode === 'rate') {
    // 二分求年利率 -20% ~ 100%
    let lo = -20
    let hi = 100
    const at = (r: number) => fvOf(principal, r, Math.max(0.01, years))
    if (at(lo) >= target) {
      rate = lo
    } else if (at(hi) < target) {
      rate = hi
    } else {
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        if (at(mid) >= target) hi = mid
        else lo = mid
      }
      rate = hi
    }
  }

  const fv = fvOf(principal, rate, years)
  const sv = simpleFutureValue(principal, rate, years, freq, contribution, timing)
  const rows = buildRows(principal, rate, years, freq, contribution, timing)
  const totalIn = rows.length ? rows[rows.length - 1].totalIn : principal
  const totalInterest = fv - totalIn
  const interestShare = fv > 0 ? (totalInterest / fv) * 100 : 0

  const n = freq === 0 ? 0 : freq
  const ear = freq === 0
    ? (Math.exp(rate / 100) - 1) * 100
    : (Math.pow(1 + rate / 100 / n, n) - 1) * 100

  const realRate = inflation > 0
    ? ((1 + rate / 100) / (1 + inflation / 100) - 1) * 100
    : rate
  const realFv = inflation > 0
    ? fv / Math.pow(1 + inflation / 100, years)
    : fv

  const doubleYears = rate > 0 ? 72 / rate : Infinity

  return {
    principal,
    rate,
    years,
    fv,
    sv,
    extraVsSimple: fv - sv,
    rows,
    totalIn,
    totalInterest,
    interestShare,
    ear,
    realRate,
    realFv,
    doubleYears,
    contribution,
  }
})

const formatMoney = (n: number, digits = 2) => {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return sign + abs.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const formatMoneyShort = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)} 万`
  return formatMoney(n)
}

const formatPct = (n: number, digits = 2) => {
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

const formatYears = (n: number) => {
  if (!Number.isFinite(n) || n === Infinity) return '—'
  if (n < 1) {
    const months = Math.round(n * 12)
    return `${months} 个月`
  }
  const y = Math.floor(n)
  const m = Math.round((n - y) * 12)
  return m > 0 ? `${y} 年 ${m} 个月` : `${y} 年`
}

const freqLabel = computed(() => FREQ_OPTIONS.find(f => f.value === settings.value.freq)?.label || '')

const formulaText = computed(() => {
  const s = settings.value
  if (s.freq === 0 && s.contribution <= 0) {
    return 'FV = P × e^(r t)'
  }
  if (s.contribution > 0) {
    return s.timing === 'begin'
      ? 'FV = P(1+i)^N + PMT × [(1+i)^N − 1] / i × (1+i)'
      : 'FV = P(1+i)^N + PMT × [(1+i)^N − 1] / i'
  }
  return 'FV = P (1 + r/n)^(n t)'
})

const summaryText = computed(() => {
  const r = solved.value
  const s = settings.value
  const lines = [
    `复利计算器结果`,
    `本金：${formatMoney(r.principal)} 元`,
    `年利率：${formatPct(r.rate)}`,
    `期限：${formatYears(r.years)}`,
    `复利频率：${freqLabel.value}`,
  ]
  if (r.contribution > 0) {
    lines.push(`每期定投：${formatMoney(r.contribution)} 元（${s.timing === 'begin' ? '期初' : '期末'}）`)
  }
  lines.push(`累计投入：${formatMoney(r.totalIn)} 元`)
  lines.push(`累计利息：${formatMoney(r.totalInterest)} 元`)
  lines.push(`复利终值：${formatMoney(r.fv)} 元`)
  lines.push(`单利对照：${formatMoney(r.sv)} 元`)
  lines.push(`有效年利率：${formatPct(r.ear)}`)
  return lines.join('\n')
})

const copySummary = () => {
  copy(summaryText.value)
}

const exportCsv = () => {
  const rows = solved.value.rows
  if (!rows.length) {
    ElMessage.warning('暂无明细可导出')
    return
  }
  const header = ['年份', '年初金额', '当年投入', '当年利息', '年末金额', '累计投入', '累计利息']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push([
      row.year,
      row.start.toFixed(2),
      row.contribution.toFixed(2),
      row.interest.toFixed(2),
      row.end.toFixed(2),
      row.totalIn.toFixed(2),
      row.totalInterest.toFixed(2),
    ].join(','))
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `复利明细_${settings.value.years}年.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 CSV')
}

const applyPreset = (preset: typeof PRESETS[number]) => {
  settings.value.principal = preset.principal
  settings.value.rate = preset.rate
  settings.value.years = preset.years
  settings.value.freq = preset.freq
  settings.value.contribution = preset.contribution
  settings.value.mode = 'future'
}

const resetSettings = () => {
  settings.value = defaultSettings()
}

const chartRef = ref<HTMLElement | null>(null)
let chart: ECharts | null = null

const renderChart = () => {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  const rows = solved.value.rows
  if (!rows.length) {
    chart.clear()
    return
  }
  const years = rows.map(r => `${r.year}年`)
  const balance = rows.map(r => Number(r.end.toFixed(2)))
  const invested = rows.map(r => Number(r.totalIn.toFixed(2)))
  const interest = rows.map(r => Number(r.totalInterest.toFixed(2)))
  const isDark = document.documentElement.classList.contains('dark')
  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const splitColor = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.25)'

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const lines = [params[0]?.axisValue || '']
        for (const p of params) {
          lines.push(`${p.marker}${p.seriesName}：¥${formatMoney(p.value)}`)
        }
        return lines.join('<br/>')
      },
    },
    legend: {
      data: ['账户总额', '累计投入', '累计利息'],
      textStyle: { color: axisColor },
      top: 0,
    },
    grid: { left: 16, right: 16, top: 40, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: splitColor } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: axisColor,
        formatter: (v: number) => {
          if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}亿`
          if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`
          return String(v)
        },
      },
      splitLine: { lineStyle: { color: splitColor } },
    },
    series: [
      {
        name: '账户总额',
        type: 'line',
        smooth: true,
        symbol: rows.length > 20 ? 'none' : 'circle',
        symbolSize: 6,
        data: balance,
        itemStyle: { color: '#4f46e5' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79,70,229,0.28)' },
              { offset: 1, color: 'rgba(79,70,229,0.02)' },
            ],
          },
        },
      },
      {
        name: '累计投入',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: invested,
        itemStyle: { color: '#0ea5e9' },
        lineStyle: { width: 2, type: 'dashed' },
      },
      {
        name: '累计利息',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: interest,
        itemStyle: { color: '#059669' },
        lineStyle: { width: 2 },
      },
    ],
  }, { notMerge: true })
}

watch(solved, () => nextTick(renderChart))

const handleResize = () => chart?.resize()
let darkObserver: MutationObserver | null = null

onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', handleResize)
  darkObserver = new MutationObserver(() => renderChart())
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  darkObserver?.disconnect()
  darkObserver = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white dark:bg-surface-0 shadow-sm border border-slate-200 dark:border-border-default">
      <div class="mb-4">
        <div class="text-h2 font-semibold text-slate-800 dark:text-ink-900">复利计算器</div>
        <div class="mt-1 text-body-sm text-slate-500">本金、利率、年限与定投实时计算终值，并对照单利、给出年度明细与增长曲线。数据只留在浏览器本地。</div>
      </div>

      <div class="flex flex-wrap gap-2 mb-4">
        <el-button
          v-for="item in PRESETS"
          :key="item.label"
          size="small"
          @click="applyPreset(item)"
        >{{ item.label }}</el-button>
      </div>

      <el-radio-group v-model="settings.mode" class="mb-4">
        <el-radio-button value="future">算终值</el-radio-button>
        <el-radio-button value="principal">倒推本金</el-radio-button>
        <el-radio-button value="years">倒推年限</el-radio-button>
        <el-radio-button value="rate">倒推利率</el-radio-button>
      </el-radio-group>

      <div class="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div class="space-y-3">
          <el-form label-position="top">
            <el-row :gutter="12">
              <el-col :xs="24" :sm="12">
                <el-form-item :label="settings.mode === 'principal' ? '目标金额（元）' : '本金（元）'">
                  <el-input-number
                    v-if="settings.mode === 'principal'"
                    v-model="settings.target"
                    :min="0"
                    :max="1e12"
                    :step="1000"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                  <el-input-number
                    v-else
                    v-model="settings.principal"
                    :min="0"
                    :max="1e12"
                    :step="1000"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item :label="settings.mode === 'rate' ? '目标金额（元）' : '年利率（%）'">
                  <el-input-number
                    v-if="settings.mode === 'rate'"
                    v-model="settings.target"
                    :min="0"
                    :max="1e12"
                    :step="1000"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                  <el-input-number
                    v-else
                    v-model="settings.rate"
                    :min="-50"
                    :max="100"
                    :step="0.1"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item :label="settings.mode === 'years' ? '目标金额（元）' : '投资年限（年）'">
                  <el-input-number
                    v-if="settings.mode === 'years'"
                    v-model="settings.target"
                    :min="0"
                    :max="1e12"
                    :step="1000"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                  <el-input-number
                    v-else
                    v-model="settings.years"
                    :min="0"
                    :max="80"
                    :step="1"
                    :precision="1"
                    class="w-full"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="每期定投（元）">
                  <el-input-number
                    v-model="settings.contribution"
                    :min="0"
                    :max="1e8"
                    :step="100"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="复利频率">
              <el-radio-group v-model="settings.freq" class="flex flex-wrap">
                <el-radio-button v-for="f in FREQ_OPTIONS" :key="f.value" :value="f.value">
                  {{ f.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-row :gutter="12">
              <el-col :xs="24" :sm="12">
                <el-form-item label="定投时点">
                  <el-radio-group v-model="settings.timing">
                    <el-radio-button value="end">期末投入</el-radio-button>
                    <el-radio-button value="begin">期初投入</el-radio-button>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12">
                <el-form-item label="通胀率（可选，%）">
                  <el-input-number
                    v-model="settings.inflation"
                    :min="0"
                    :max="50"
                    :step="0.1"
                    :precision="2"
                    class="w-full"
                    controls-position="right"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <div class="flex flex-wrap gap-2">
            <el-button type="primary" @click="copySummary">复制结果</el-button>
            <el-button @click="exportCsv">导出明细 CSV</el-button>
            <el-button type="danger" plain @click="resetSettings">重置</el-button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-white shadow-lg">
            <div class="text-body-sm text-white/80">
              {{ settings.mode === 'future' ? '复利终值' : settings.mode === 'principal' ? '所需本金' : settings.mode === 'years' ? '所需年限' : '所需年利率' }}
            </div>
            <div class="mt-2 text-4xl md:text-5xl font-bold tabular-nums tracking-tight">
              <template v-if="settings.mode === 'years'">{{ formatYears(solved.years) }}</template>
              <template v-else-if="settings.mode === 'rate'">{{ formatPct(solved.rate) }}</template>
              <template v-else-if="settings.mode === 'principal'">¥ {{ formatMoneyShort(solved.principal) }}</template>
              <template v-else>¥ {{ formatMoneyShort(solved.fv) }}</template>
            </div>
            <div class="mt-3 text-caption text-white/80">
              公式 {{ formulaText }}
            </div>
            <div v-if="settings.mode !== 'future'" class="mt-2 text-body-sm text-white/90">
              对应终值 ¥ {{ formatMoney(solved.fv) }}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">累计投入</div>
              <div class="text-h3 font-semibold text-slate-800 dark:text-ink-900 tabular-nums">¥ {{ formatMoneyShort(solved.totalIn) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">累计利息</div>
              <div class="text-h3 font-semibold text-emerald-600 tabular-nums">¥ {{ formatMoneyShort(solved.totalInterest) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">利息占比</div>
              <div class="text-h3 font-semibold text-indigo-600 tabular-nums">{{ formatPct(solved.interestShare) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">有效年利率</div>
              <div class="text-h3 font-semibold text-slate-800 dark:text-ink-900 tabular-nums">{{ formatPct(solved.ear) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">单利对照</div>
              <div class="text-h3 font-semibold text-slate-800 dark:text-ink-900 tabular-nums">¥ {{ formatMoneyShort(solved.sv) }}</div>
              <div class="text-caption text-emerald-600 mt-1">复利多赚 {{ formatMoneyShort(solved.extraVsSimple) }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-surface-1 border border-slate-200 dark:border-border-default">
              <div class="text-caption text-slate-500">72 法则翻倍</div>
              <div class="text-h3 font-semibold text-slate-800 dark:text-ink-900 tabular-nums">{{ formatYears(solved.doubleYears) }}</div>
              <div class="text-caption text-slate-400 mt-1">约 72 ÷ 年利率</div>
            </div>
          </div>

          <div v-if="settings.inflation > 0" class="p-3 rounded-xl bg-amber-50 dark:bg-surface-1 border border-amber-200 dark:border-border-default text-body-sm text-amber-800 dark:text-ink-800">
            扣除 {{ formatPct(settings.inflation) }} 通胀后，实际年化约 {{ formatPct(solved.realRate) }}，终值购买力约 ¥ {{ formatMoney(solved.realFv) }}。
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 p-4 rounded-2xl bg-white dark:bg-surface-0 shadow-sm border border-slate-200 dark:border-border-default">
      <div class="text-h2 font-semibold text-slate-800 dark:text-ink-900 mb-1">增长曲线</div>
      <div class="text-body-sm text-slate-500 mb-3">账户总额、累计投入与累计利息随年份变化</div>
      <div ref="chartRef" class="w-full h-[320px]"></div>
    </div>

    <div class="mt-4 p-4 rounded-2xl bg-white dark:bg-surface-0 shadow-sm border border-slate-200 dark:border-border-default">
      <div class="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div class="text-h2 font-semibold text-slate-800 dark:text-ink-900">年度明细</div>
          <div class="text-body-sm text-slate-500 mt-1">按年汇总；定投会并入对应年份的「当年投入」。</div>
        </div>
        <el-tag type="info">共 {{ solved.rows.length }} 年</el-tag>
      </div>
      <el-table :data="solved.rows" stripe border class="w-full" max-height="480">
        <el-table-column prop="year" label="年" width="70" align="center" />
        <el-table-column label="年初金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.start) }}</template>
        </el-table-column>
        <el-table-column label="当年投入" min-width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.contribution) }}</template>
        </el-table-column>
        <el-table-column label="当年利息" min-width="120" align="right">
          <template #default="{ row }">
            <span class="text-emerald-600">{{ formatMoney(row.interest) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="年末金额" min-width="140" align="right">
          <template #default="{ row }">
            <span class="font-semibold text-indigo-600">{{ formatMoney(row.end) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="累计投入" min-width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.totalIn) }}</template>
        </el-table-column>
        <el-table-column label="累计利息" min-width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.totalInterest) }}</template>
        </el-table-column>
      </el-table>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        复利是「利息再生利息」。本工具在浏览器本地计算，不会上传任何数据。
        <br /><br />
        <b>算终值：</b>输入本金 P、年利率 r、年限 t 与复利频率 n，得到
        <code>FV = P (1 + r/n)^(n t)</code>。连续复利使用 <code>FV = P e^(r t)</code>。
        <br /><br />
        <b>定投：</b>每期投入 PMT。期末投入使用普通年金公式
        <code>PMT × [(1+i)^N − 1] / i</code>；期初投入再乘 <code>(1+i)</code>。
        连续复利模式下的定投按每月近似。
        <br /><br />
        <b>目标倒推：</b>已知目标金额，可反算所需本金、年限或年利率（年限上限 80 年）。
        <br /><br />
        <b>单利对照：</b>本金按 <code>P(1 + r t)</code>，定投各期按剩余年限计单利，用来看清复利多出来的部分。
        <br /><br />
        <b>72 法则：</b>本金大约翻倍所需年数 ≈ 72 ÷ 年利率（%）。例如 8% 大约 9 年翻倍，仅作心算参考。
        <br /><br />
        <b>通胀：</b>填写通胀率后，会给出实际年化与终值的购买力（名义终值 ÷ (1+通胀)^t）。
        <br /><br />
        输入会自动保存在本机。结果仅供学习与规划参考，不构成任何投资建议。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
.el-form-item {
  margin-bottom: 12px;
}
</style>
