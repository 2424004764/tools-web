<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import Sortable from 'sortablejs'
import {
  fetchAdminDashboardPanel,
  type AdminDashboardPanel,
} from '@/api/admin/dashboard'
import type { AdminDashboard, ToolUsageTrendPoint } from '@/types/admin'
import { fetchAdminSiteConfig, updateAdminSiteConfig } from '@/api/admin/site-config'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import IconUser from '~icons/ep/user'
import IconLock from '~icons/ep/lock'
import IconCoin from '~icons/ep/coin'
import IconSetUp from '~icons/ep/set-up'
import IconHistogram from '~icons/ep/histogram'
import IconTrophy from '~icons/ep/trophy'
import IconTimer from '~icons/ep/timer'
import IconBox from '~icons/ep/box'
import IconRank from '~icons/ep/rank'

// 每个面板独立拉取：请求成功哪个面板就先渲染对应卡片，失败只影响自己的卡片
const panelData = ref<Partial<AdminDashboard>>({})
const data = computed(() => panelData.value)

type PanelStatus = 'loading' | 'done' | 'failed'
const DASHBOARD_PANELS: AdminDashboardPanel[] = [
  'overview',
  'storage',
  'usage',
  'userTrend',
  'topTools',
  'slowlog',
  'pending',
  'transactions',
]
const panelState = reactive(
  Object.fromEntries(DASHBOARD_PANELS.map((p) => [p, 'loading'])) as Record<AdminDashboardPanel, PanelStatus>,
)

// 卡片 → 面板：统计卡片共用 overview
const WIDGET_PANEL: Record<WidgetId, AdminDashboardPanel> = {
  users: 'overview',
  storage: 'storage',
  disabled: 'overview',
  credits: 'overview',
  tools: 'overview',
  usage: 'usage',
  userTrend: 'userTrend',
  topTools: 'topTools',
  slowlog: 'slowlog',
  pending: 'pending',
  transactions: 'transactions',
}
const panelLoading = (id: WidgetId) => panelState[WIDGET_PANEL[id]] === 'loading'
const panelFailed = (id: WidgetId) => panelState[WIDGET_PANEL[id]] === 'failed'
const retryWidget = (id: WidgetId) => loadPanel(WIDGET_PANEL[id])

const loadPanel = async (panel: AdminDashboardPanel) => {
  panelState[panel] = 'loading'
  try {
    const res = await fetchAdminDashboardPanel(panel)
    panelData.value = { ...panelData.value, ...res }
    panelState[panel] = 'done'
    // 趋势图数据到达后立即建图，不等其他面板
    if (panel === 'usage' && res.usageTrend) usagePanel.build(res.usageTrend)
    if (panel === 'userTrend' && res.userTrend) userPanel.build(res.userTrend)
  } catch (err) {
    panelState[panel] = 'failed'
    console.error(`[dashboard] ${panel} 面板加载失败:`, err)
    ElMessage.error(`仪表盘 ${panel} 面板加载失败`)
  }
}

const load = () => DASHBOARD_PANELS.forEach((p) => loadPanel(p))

// ============ 卡片布局：可拖拽排序，顺序持久化在 site_config.admin_dashboard_layout ============
// 卡片 id 是前后端约定的稳定标识；后端只校验格式，新增/下线卡片仅需维护这里
type WidgetId =
  | 'users'
  | 'storage'
  | 'disabled'
  | 'credits'
  | 'tools'
  | 'usage'
  | 'userTrend'
  | 'topTools'
  | 'slowlog'
  | 'pending'
  | 'transactions'

interface WidgetMeta {
  id: WidgetId
  /** 网格占列数：基础网格 2 列（移动端），md 起 8 列（小卡占 1，宽卡占 4 = 半行） */
  span: string
}

const DEFAULT_WIDGETS: WidgetMeta[] = [
  { id: 'users', span: '' },
  { id: 'storage', span: 'col-span-2 md:col-span-2' },
  { id: 'disabled', span: '' },
  { id: 'credits', span: '' },
  { id: 'tools', span: '' },
  { id: 'usage', span: 'col-span-2 md:col-span-2' },
  { id: 'userTrend', span: 'col-span-2 md:col-span-2' },
  { id: 'topTools', span: 'col-span-2 md:col-span-2' },
  { id: 'slowlog', span: 'col-span-2 md:col-span-2' },
  { id: 'pending', span: 'col-span-2 md:col-span-2' },
  { id: 'transactions', span: 'col-span-2 md:col-span-8' },
]

const widgets = ref<WidgetMeta[]>(DEFAULT_WIDGETS.map((w) => ({ ...w })))
const gridRef = ref<HTMLDivElement | null>(null)
let sortable: Sortable | null = null

const saveLayout = async () => {
  try {
    await updateAdminSiteConfig({
      admin_dashboard_layout: JSON.stringify(widgets.value.map((w) => w.id)),
    })
  } catch (err) {
    console.error(err)
    ElMessage.error('布局保存失败')
  }
}

// 读取已保存顺序：未知 id 丢弃，缺省卡片（后续新增）按默认顺序补尾
const loadLayout = async () => {
  try {
    const cfg = await fetchAdminSiteConfig()
    const raw = String(cfg.values.admin_dashboard_layout ?? '').trim()
    if (!raw) return
    const ids: unknown = JSON.parse(raw)
    if (!Array.isArray(ids)) return
    const byId = new Map(widgets.value.map((w) => [w.id, w] as const))
    const next = ids
      .map((id) => (typeof id === 'string' ? byId.get(id as WidgetId) : undefined))
      .filter((w): w is WidgetMeta => !!w)
    for (const w of widgets.value) {
      if (!next.includes(w)) next.push(w)
    }
    widgets.value = next
  } catch (err) {
    // 布局读取失败不阻塞页面，按默认顺序展示
    console.error(err)
  }
}

const handleDragEnd = (evt: Sortable.SortableEvent) => {
  const { oldIndex, newIndex, item, from } = evt
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
  // Sortable 拖完已直接改动 DOM：先还原，再交给 Vue 按新数组重排，避免虚拟 DOM 与真实 DOM 脱节
  from.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] ?? null)
  const list = widgets.value
  list.splice(newIndex, 0, list.splice(oldIndex, 1)[0])
  saveLayout()
  // 重排会重建图表容器节点，等待 Vue 渲染后按新节点重建两块趋势图
  nextTick(() => {
    usagePanel.init()
    userPanel.init()
  })
}

const resetLayout = async () => {
  widgets.value = DEFAULT_WIDGETS.map((w) => ({ ...w }))
  try {
    // 置空即视为未配置，后端按默认顺序处理
    await updateAdminSiteConfig({ admin_dashboard_layout: '' })
    ElMessage.success('已恢复默认布局')
  } catch (err) {
    console.error(err)
    ElMessage.error('布局保存失败')
  }
}

const formatTime = (s: string) => {
  if (!s) return '-'
  // D1 返回 "YYYY-MM-DD HH:mm:ss"（UTC）
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const fmtAmount = (n: number) => (n > 0 ? `+${n}` : `${n}`)

// 存储字节数 → 人类可读（1024 进制，小于 1KB 显示 B）
const fmtBytes = (bytes: number | undefined | null) => {
  const n = Math.max(0, Number(bytes) || 0)
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let v = n
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

// 存储使用率（0-100，总量为 0 时视为 0）
const storagePercent = computed(() => {
  const s = data.value?.storage
  if (!s || s.quotaBytes <= 0) return 0
  return Math.min(100, Math.round(((s.usedBytes + s.pendingBytes) / s.quotaBytes) * 100))
})

// 单项来源占已发放总空间的百分比（整数，用于来源拆解展示）
const storagePercentOf = (bytes?: number) => {
  const s = data.value?.storage
  if (!s || s.quotaBytes <= 0 || !bytes) return 0
  return Math.round((bytes / s.quotaBytes) * 100)
}

// 分段用量条：已用按来源拆色 + 预扣单独一段，剩余为底色轨道
// 百分比按字节精确累加最后一段兜底，避免四舍五入后总宽 ≠ 100%
interface StorageSegment {
  key: string
  label: string
  bytes: number
  count?: number
  barClass: string
  dotClass: string
  /** 占总量的百分比宽度（已归一化，末段兜底防溢出） */
  widthPct?: number
}
const STORAGE_SEGMENT_COLORS: Record<string, { barClass: string; dotClass: string }> = {
  music: { barClass: 'bg-sky-500', dotClass: 'bg-sky-500' },
  aiCreation: { barClass: 'bg-violet-500', dotClass: 'bg-violet-500' },
  subsite: { barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  other: { barClass: 'bg-gray-400', dotClass: 'bg-gray-400' },
  pending: { barClass: 'bg-amber-400', dotClass: 'bg-amber-400' },
}
const storageSegments = computed<StorageSegment[]>(() => {
  const s = data.value?.storage
  if (!s || s.quotaBytes <= 0) return []
  const defs: StorageSegment[] = [
    { key: 'music', label: '音乐', ...STORAGE_SEGMENT_COLORS.music, ...s.sources.music },
    { key: 'aiCreation', label: 'AI 图', ...STORAGE_SEGMENT_COLORS.aiCreation, ...s.sources.aiCreation },
    { key: 'subsite', label: '子站', ...STORAGE_SEGMENT_COLORS.subsite, ...s.sources.subsite },
    { key: 'other', label: '其他', ...STORAGE_SEGMENT_COLORS.other, ...s.sources.other },
    { key: 'pending', label: '预扣中', ...STORAGE_SEGMENT_COLORS.pending, bytes: s.pendingBytes, count: s.pendingCount },
  ]
  const out = defs.filter((d) => d.bytes > 0)
  let acc = 0
  return out.map((d) => {
    const pct = Math.min(100 - acc, Math.max(0.5, (d.bytes / s.quotaBytes) * 100))
    acc += pct
    return { ...d, widthPct: pct }
  })
})

// 流水来源。迁移前的老数据为 null → 展示"未知"
const sourceLabel = (s: 'system' | 'admin' | 'tool' | null | undefined) => {
  switch (s) {
    case 'system':
      return '系统'
    case 'admin':
      return '管理员'
    case 'tool':
      return '工具'
    default:
      return '未知'
  }
}

const sourceClass = (s: 'system' | 'admin' | 'tool' | null | undefined) => {
  switch (s) {
    case 'system':
      return 'bg-slate-100 text-slate-700'
    case 'admin':
      return 'bg-indigo-100 text-indigo-700'
    case 'tool':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-gray-50 text-gray-400'
  }
}

// ============ 趋势曲线（工具使用次数 / 用户总数注册趋势共用一套图逻辑） ============
const TREND_RANGES = [
  { key: 'daily', label: '每日' },
  { key: 'weekly', label: '每周' },
  { key: 'monthly', label: '每月' },
] as const
type TrendRangeKey = (typeof TREND_RANGES)[number]['key']

// 图表配色跟随主题：html.dark 翻转 CSS 变量后，构建 option 时实时解析即得当前主题色
const { isDark } = useTheme()
function themeVar(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parts = raw.split(/\s+/)
  if (parts.length < 3) return raw
  return `rgba(${parts.join(', ')}, ${alpha})`
}

const pad2 = (n: number) => String(n).padStart(2, '0')
// 统一按 UTC+8 生成日期轴（与后端聚合口径一致，不受浏览者时区影响）
const utc8Now = () => new Date(Date.now() + 8 * 3600 * 1000)

function buildDailyAxis(days: number): string[] {
  const list: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(utc8Now().getTime() - i * 86400000)
    list.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`)
  }
  return list
}

function buildWeeklyAxis(weeks: number): string[] {
  const utc8 = utc8Now()
  const daysSinceMonday = (utc8.getUTCDay() + 6) % 7
  const monday = Date.UTC(
    utc8.getUTCFullYear(),
    utc8.getUTCMonth(),
    utc8.getUTCDate() - daysSinceMonday,
  )
  const list: string[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(monday - i * 7 * 86400000)
    list.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`)
  }
  return list
}

function buildMonthlyAxis(months: number): string[] {
  const utc8 = utc8Now()
  const list: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(utc8.getUTCFullYear(), utc8.getUTCMonth() - i, 1))
    list.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`)
  }
  return list
}

function fillTrend(points: ToolUsageTrendPoint[] | undefined, dates: string[]): number[] {
  const map = new Map((points || []).map((p) => [p.date, p.count]))
  return dates.map((d) => map.get(d) || 0)
}

/** 一条趋势线的完整日期轴 + 补零后的计数 */
type TrendSeries = Record<TrendRangeKey, { dates: string[]; counts: number[] }>
type TrendPoints = NonNullable<AdminDashboard['usageTrend']>

// 一块面板一张图：粒度切换 / 主题重绘 / dataZoom 都内聚在此，工具使用与用户注册各建一份
// 各粒度初始窗口与上限：拖到最左边缘时窗口翻倍重新拉取（加载更早数据），直到上限
const TREND_INIT = { daily: 90, weekly: 12, monthly: 12 } as const
const TREND_LIMITS = { daily: 365, weekly: 52, monthly: 24 } as const

function createTrendPanel(
  verb: string,
  unit: string,
  panel: AdminDashboardPanel,
  trendKey: 'usageTrend' | 'userTrend',
) {
  const trendRange = ref<TrendRangeKey>('daily')
  const chartRef = ref<HTMLDivElement | null>(null)
  let chartInstance: ECharts | null = null
  // 后端返回稀疏点，这里缓存按完整日期轴补零后的数据，切换粒度 / 主题重绘时复用
  let series: TrendSeries | null = null
  // 已加载的窗口大小（随向左扩展增长）
  let loaded: Record<TrendRangeKey, number> = { ...TREND_INIT }
  let extending = false

  function applyOption() {
    if (!chartInstance || !series) return
    const { dates, counts } = series[trendRange.value]
    const isMonthly = trendRange.value === 'monthly'
    // 每日共 90 天，初始只展示近 30 天；可拖动图表或底部滑块向前翻看更早日期
    const total = dates.length
    const visible = trendRange.value === 'daily' ? 30 : total
    const hasZoom = total > visible
    const zoomStart = Math.max(0, total - visible)
    const dataZoom = hasZoom
      ? [
          {
            type: 'inside',
            startValue: zoomStart,
            endValue: total - 1,
            zoomOnMouseWheel: false, // 不劫持页面滚轮
          },
          {
            type: 'slider',
            startValue: zoomStart,
            endValue: total - 1,
            height: 16,
            bottom: 0,
            brushSelect: false,
            borderColor: themeVar('--border-subtle'),
            fillerColor: themeVar('--accent-500', 0.12),
            handleStyle: { color: themeVar('--surface-0') },
            moveHandleStyle: { color: themeVar('--accent-200') },
            emphasis: { moveHandleStyle: { color: themeVar('--accent-300') } },
            textStyle: { color: 'transparent' },
          },
        ]
      : []
    chartInstance.setOption(
      {
        grid: { left: 36, right: 12, top: 18, bottom: hasZoom ? 40 : 24 },
        dataZoom,
        tooltip: {
          trigger: 'axis',
          backgroundColor: themeVar('--surface-0'),
          borderColor: themeVar('--border-default'),
          textStyle: { color: themeVar('--ink-700') },
          formatter: (params: unknown) => {
            const p = (Array.isArray(params) ? params[0] : params) as { name: string; marker: string; value: number }
            return `${p.name}<br/>${p.marker} ${verb} <b>${(p.value || 0).toLocaleString('zh-CN')}</b> ${unit}`
          },
        },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLabel: {
            color: themeVar('--ink-500'),
            interval: isMonthly ? 1 : 4,
            formatter: (v: string) => (isMonthly ? v : v.slice(5)),
          },
          axisLine: { lineStyle: { color: themeVar('--border-default') } },
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: { color: themeVar('--ink-500') },
          splitLine: { lineStyle: { color: themeVar('--border-subtle') } },
        },
        series: [
          {
            name: `${verb}${unit}`,
            type: 'line',
            data: counts,
            smooth: true,
            showSymbol: false,
            itemStyle: { color: themeVar('--accent-500') },
            lineStyle: { width: 2, color: themeVar('--accent-500') },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: themeVar('--accent-500', 0.22) },
                { offset: 1, color: themeVar('--accent-500', 0.02) },
              ]),
            },
          },
        ],
      },
      { notMerge: true },
    )
  }

  // 后端返回稀疏点，按完整日期轴补零后缓存（轴长 = 已加载窗口）
  function build(trend?: TrendPoints) {
    const t = trend || { daily: [], weekly: [], monthly: [] }
    const dailyDates = buildDailyAxis(loaded.daily)
    const weeklyDates = buildWeeklyAxis(loaded.weekly)
    const monthlyDates = buildMonthlyAxis(loaded.monthly)
    series = {
      daily: { dates: dailyDates, counts: fillTrend(t.daily, dailyDates) },
      weekly: { dates: weeklyDates, counts: fillTrend(t.weekly, weeklyDates) },
      monthly: { dates: monthlyDates, counts: fillTrend(t.monthly, monthlyDates) },
    }
    applyOption()
  }

  watch(trendRange, () => applyOption())

  // 拖到最左边缘：窗口翻倍拉取更早数据，拼接后保持原可视区间不跳动
  async function extendLeft() {
    if (extending || !chartInstance || !series) return
    const key = trendRange.value
    if (loaded[key] >= TREND_LIMITS[key]) return

    // 读取当前缩放窗口（inside 与 slider 联动，取其一即可）
    const opt = chartInstance.getOption() as { dataZoom?: Array<{ startValue?: number; endValue?: number }> }
    const dz = opt.dataZoom?.[0]
    if (!dz || dz.startValue == null || dz.startValue > 2) return

    extending = true
    // 记住当前可视区间的首尾日期，重建轴后按日期找回位置
    const cur = series[key]
    const startIdx = Math.max(0, Math.floor(dz.startValue))
    const endIdx = Math.min(cur.dates.length - 1, Math.ceil(dz.endValue ?? startIdx))
    const startDate = cur.dates[startIdx]
    const endDate = cur.dates[endIdx]

    try {
      const next: Record<TrendRangeKey, number> = {
        daily: Math.min(loaded.daily * 2, TREND_LIMITS.daily),
        weekly: Math.min(loaded.weekly * 2, TREND_LIMITS.weekly),
        monthly: Math.min(loaded.monthly * 2, TREND_LIMITS.monthly),
      }
      const res = await fetchAdminDashboardPanel(panel, { ...next })
      panelData.value = { ...panelData.value, ...res }
      loaded = next
      build(res[trendKey])
      if (!chartInstance || !series) return
      const nd = series[key].dates
      const ns = Math.max(0, nd.indexOf(startDate))
      const ne = Math.min(nd.length - 1, Math.max(ns + 7, nd.indexOf(endDate)))
      // inside 与 slider 同步定位到原区间
      chartInstance.setOption({
        dataZoom: [
          { startValue: ns, endValue: ne },
          { startValue: ns, endValue: ne },
        ],
      })
    } catch (err) {
      console.error(`[dashboard] ${panel} 趋势向左加载失败:`, err)
    } finally {
      extending = false
    }
  }

  async function init() {
    await nextTick()
    // 卡片在 v-for 里，模板 ref 会被 Vue 收集成数组，取首个元素
    const raw = chartRef.value as HTMLDivElement | HTMLDivElement[] | null
    const el = Array.isArray(raw) ? raw[0] : raw
    if (!el) return
    // 拖拽排序后 Vue 会重建容器节点：旧实例挂载的节点已脱卸，需要销毁重建
    if (chartInstance && (!el.isConnected || chartInstance.getDom() !== el)) {
      chartInstance.dispose()
      chartInstance = null
    }
    if (!chartInstance) chartInstance = echarts.init(el)
    // 用户拖动缩放时检测是否到达最左边缘，触发向左加载更早数据
    chartInstance.on('datazoom', () => {
      void extendLeft()
    })
    // 数据先于图表容器就绪时（如缓存命中），初始化后补一次渲染
    applyOption()
  }

  return {
    trendRange,
    chartRef,
    build,
    applyOption,
    init,
    resize: () => chartInstance?.resize(),
    dispose: () => {
      chartInstance?.dispose()
      chartInstance = null
    },
  }
}

const usagePanel = createTrendPanel('使用', '次', 'usage', 'usageTrend')
const userPanel = createTrendPanel('新增', '人', 'userTrend', 'userTrend')

// TOP 10 工具的时间窗切换（复用趋势图的三粒度 + 累计）
const TOP_TOOLS_RANGES = [...TREND_RANGES, { key: 'all', label: '累计' }] as const
type TopToolsRangeKey = (typeof TOP_TOOLS_RANGES)[number]['key']
const topToolsRange = ref<TopToolsRangeKey>('daily')
const activeTopTools = computed(() => data.value?.topTools?.[topToolsRange.value] || [])
// 解构出的 ref 仍是响应式的，模板里直接绑定 ref / v-model
const { trendRange: usageTrendRange, chartRef: usageChartEl } = usagePanel
const { trendRange: userTrendRange, chartRef: userChartEl } = userPanel

// 主题切换时用缓存数据按新主题色重绘（不重新请求接口）
watch(isDark, () => {
  usagePanel.applyOption()
  userPanel.applyOption()
})

const handleResize = () => {
  usagePanel.resize()
  userPanel.resize()
}

onMounted(async () => {
  load()
  loadLayout()
  await Promise.all([usagePanel.init(), userPanel.init()])
  if (gridRef.value && !sortable) {
    sortable = Sortable.create(gridRef.value, {
      handle: '.widget-drag-handle', // 仅从把手发起拖拽，不影响图表缩放 / 链接等交互
      animation: 150,
      ghostClass: 'widget-ghost',
      // 触屏长按进入拖拽，避免与页面滚动冲突；鼠标拖拽无延迟
      delay: 150,
      delayOnTouchOnly: true,
      onEnd: handleDragEnd,
    })
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  sortable?.destroy()
  sortable = null
  usagePanel.dispose()
  userPanel.dispose()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900">仪表盘</h2>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline text-xs text-ink-400">拖动卡片标题旁的把手可调整位置</span>
        <el-button link type="primary" size="small" @click="resetLayout">恢复默认布局</el-button>
      </div>
    </div>

    <!-- 全部卡片：顺序可拖拽调整（持久化在 site_config.admin_dashboard_layout） -->
    <div ref="gridRef" class="grid grid-cols-2 md:grid-cols-8 gap-4">
      <div
        v-for="w in widgets"
        :key="w.id"
        :data-widget="w.id"
        class="min-w-0"
        :class="[w.span, panelFailed(w.id) ? 'cursor-pointer' : '']"
        :title="panelFailed(w.id) ? '加载失败，点击重试' : undefined"
        @click.capture="panelFailed(w.id) && retryWidget(w.id)"
      >
        <!-- 用户总数 -->
        <div v-if="w.id === 'users'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full cursor-pointer hover:border-accent-300 transition-colors"
          title="查看用户管理" @click="$router.push('/admin/users')">
          <div class="flex items-center gap-1.5 text-sm text-ink-500 whitespace-nowrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconUser class="w-3.5 h-3.5 text-accent-600 shrink-0" />
            用户总数
          </div>
          <div class="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">
            {{ data?.totalUsers ?? '-' }}
          </div>
          <div class="text-xs text-ink-400 mt-1.5">
            今日新增 {{ data?.todayNew ?? 0 }}
          </div>
        </div>

        <!-- 存储空间：摘要 + 分段条 + 来源图例，紧凑单卡（占两列） -->
        <div v-else-if="w.id === 'storage'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="flex items-center gap-1.5 text-sm text-ink-500 flex-wrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconBox class="w-3.5 h-3.5" />
            存储空间
            <span class="!ml-auto flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-normal">
              <span title="未过期的上传预留；长期不消可到存储明细清理">
                预扣中
                <b class="tabular-nums" :class="(data?.storage?.pendingBytes ?? 0) > 0 ? 'text-amber-600' : 'text-ink-700'">
                  {{ fmtBytes(data?.storage?.pendingBytes) }}
                </b>
                <span v-if="(data?.storage?.pendingCount ?? 0) > 0" class="text-amber-600">（{{ data?.storage?.pendingCount }} 笔）</span>
              </span>
              <span class="text-ink-400">·</span>
              <span>可用 <b class="text-accent-700 tabular-nums font-medium">{{ fmtBytes(data?.storage?.availableBytes) }}</b></span>
              <span class="text-ink-400">·</span>
              <span>{{ data?.storage?.users ?? 0 }} 个用户</span>
              <router-link to="/admin/storage" class="text-accent-600 hover:text-accent-700 font-medium">明细 →</router-link>
            </span>
          </div>

          <!-- 已使用 / 总量 摘要与分段用量条同行 -->
          <div class="flex items-center gap-3 mt-2">
            <div class="shrink-0 text-lg font-semibold text-ink-900 tabular-nums leading-none">
              {{ fmtBytes(data?.storage?.usedBytes) }}
              <span class="text-xs font-normal text-ink-400">/ {{ fmtBytes(data?.storage?.quotaBytes) }} · {{ storagePercent }}%</span>
            </div>
            <div class="flex-1 min-w-0 flex h-2 overflow-hidden rounded-full bg-ink-100" title="各来源占用占已发放总空间的比例">
              <div
                v-for="seg in storageSegments"
                :key="seg.key"
                class="h-full first:rounded-l-full last:rounded-r-full"
                :class="seg.barClass"
                :style="{ width: `${seg.widthPct}%` }"
                :title="`${seg.label} ${fmtBytes(seg.bytes)}（${storagePercentOf(seg.bytes)}%）`"
              ></div>
            </div>
          </div>

          <!-- 来源图例：色点 + 字节 + 文件数 + 占比，单行自适应换行 -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
            <span
              v-for="seg in storageSegments"
              :key="seg.key"
              class="inline-flex items-center gap-1 text-ink-500"
              :title="`${seg.label}：${fmtBytes(seg.bytes)}（${storagePercentOf(seg.bytes)}%）`"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="seg.dotClass"></span>
              {{ seg.label }}
              <b class="text-ink-900 font-medium tabular-nums">{{ fmtBytes(seg.bytes) }}</b>
              <span v-if="(seg.count ?? 0) > 0" class="text-ink-400">{{ seg.count }} 个</span>
              <span class="text-ink-400 tabular-nums">{{ storagePercentOf(seg.bytes) }}%</span>
            </span>
            <span v-if="!storageSegments.length" class="text-ink-400">暂无存储数据</span>
          </div>
        </div>

        <!-- 禁用用户 -->
        <div v-else-if="w.id === 'disabled'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full cursor-pointer hover:border-accent-300 transition-colors"
          title="查看禁用用户" @click="$router.push({ path: '/admin/users', query: { disabled: '1' } })">
          <div class="flex items-center gap-1.5 text-sm text-ink-500 whitespace-nowrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconLock class="w-3.5 h-3.5 text-danger-600 shrink-0" />
            禁用用户
          </div>
          <div class="mt-1.5 text-2xl font-semibold text-danger-600 tabular-nums">
            {{ data?.disabledUsers ?? '-' }}
          </div>
          <div class="text-xs text-ink-400 mt-1.5">无法登录账号</div>
        </div>

        <!-- 积分总余额 -->
        <div v-else-if="w.id === 'credits'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="flex items-center gap-1.5 text-sm text-ink-500 whitespace-nowrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconCoin class="w-3.5 h-3.5 text-amber-600 shrink-0" />
            积分总余额
          </div>
          <div class="mt-1.5 text-2xl font-semibold text-accent-700 tabular-nums">
            {{ data?.totalBalance ?? '-' }}
          </div>
          <div class="text-xs text-ink-400 mt-1.5">
            累计发放 {{ data?.totalEarned ?? 0 }}
            <span class="mx-1">·</span>
            今日消耗 {{ data?.todayCreditSpent ?? 0 }}
          </div>
        </div>

        <!-- 工具启用 -->
        <div v-else-if="w.id === 'tools'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full cursor-pointer hover:border-accent-300 transition-colors"
          title="查看工具开关" @click="$router.push('/admin/tools')">
          <div class="flex items-center gap-1.5 text-sm text-ink-500 whitespace-nowrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconSetUp class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            工具启用
          </div>
          <div class="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">
            {{ data?.tools?.enabled ?? '-' }}
            <span class="text-sm font-normal text-ink-400">/ {{ data?.tools?.total ?? '-' }}</span>
          </div>
          <div class="text-xs text-ink-400 mt-1.5">已启用工具数</div>
        </div>

        <!-- 工具使用次数（来自 tool_usage_records；老版本迁移前为 0） -->
        <div v-else-if="w.id === 'usage'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="text-sm text-ink-500 mb-2 flex items-center gap-1.5 flex-wrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <span class="flex items-center gap-1.5">
              <IconHistogram class="w-3.5 h-3.5" />
              工具使用次数
            </span>
            <el-radio-group v-model="usageTrendRange" size="small" class="!ml-auto">
              <el-radio-button
                v-for="r in TREND_RANGES"
                :key="r.key"
                :value="r.key"
              >
                {{ r.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="grid grid-cols-4 divide-x divide-ink-100">
            <router-link
              to="/admin/tool-usage?range=today#usage-detail"
              class="block pr-2 first:pl-0 group"
              title="查看今日使用明细"
            >
              <div class="text-[11px] text-ink-400 group-hover:text-accent-600 transition-colors">今日</div>
              <div class="mt-0.5 text-lg font-semibold text-accent-700 group-hover:text-accent-600 tabular-nums leading-tight transition-colors">
                {{ data?.todayToolUsage ?? 0 }}
              </div>
            </router-link>
            <router-link
              to="/admin/tool-usage?range=week#usage-detail"
              class="block px-2 group"
              title="查看本周使用明细"
            >
              <div class="text-[11px] text-ink-400 group-hover:text-accent-600 transition-colors">本周</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 group-hover:text-accent-600 tabular-nums leading-tight transition-colors">
                {{ data?.weekToolUsage ?? 0 }}
              </div>
            </router-link>
            <router-link
              to="/admin/tool-usage?range=month#usage-detail"
              class="block px-2 group"
              title="查看本月使用明细"
            >
              <div class="text-[11px] text-ink-400 group-hover:text-accent-600 transition-colors">本月</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 group-hover:text-accent-600 tabular-nums leading-tight transition-colors">
                {{ data?.monthToolUsage ?? 0 }}
              </div>
            </router-link>
            <router-link
              to="/admin/tool-usage?range=all#usage-detail"
              class="block pl-2 last:pr-0 group"
              title="查看累计使用明细"
            >
              <div class="text-[11px] text-ink-400 group-hover:text-accent-600 transition-colors">累计</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 group-hover:text-accent-600 tabular-nums leading-tight transition-colors">
                {{ data?.totalToolUsage ?? 0 }}
              </div>
            </router-link>
          </div>
          <div class="text-[11px] text-ink-400 mt-2">
            登录用户进入工具页次数
          </div>
          <div ref="usageChartEl" class="w-full h-[200px] mt-2"></div>
        </div>

        <!-- 用户总数（注册趋势）：与 TOP 5 工具位置对调，紧挨工具使用次数便于对照 -->
        <div v-else-if="w.id === 'userTrend'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="text-sm text-ink-500 mb-2 flex items-center gap-1.5 flex-wrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <span class="flex items-center gap-1.5">
              <IconUser class="w-3.5 h-3.5" />
              用户总数
            </span>
            <el-radio-group v-model="userTrendRange" size="small" class="!ml-auto">
              <el-radio-button
                v-for="r in TREND_RANGES"
                :key="r.key"
                :value="r.key"
              >
                {{ r.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="grid grid-cols-4 divide-x divide-ink-100">
            <div class="pr-2 first:pl-0">
              <div class="text-[11px] text-ink-400">今日</div>
              <div class="mt-0.5 text-lg font-semibold text-accent-700 tabular-nums leading-tight">
                {{ data?.todayNew ?? 0 }}
              </div>
            </div>
            <div class="px-2">
              <div class="text-[11px] text-ink-400">本周</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.weekNewUsers ?? 0 }}
              </div>
            </div>
            <div class="px-2">
              <div class="text-[11px] text-ink-400">本月</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.monthNewUsers ?? 0 }}
              </div>
            </div>
            <div class="pl-2 last:pr-0">
              <div class="text-[11px] text-ink-400">累计</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.totalUsers ?? 0 }}
              </div>
            </div>
          </div>
          <div class="text-[11px] text-ink-400 mt-2">
            今日 / 本周 / 本月为新增注册用户数，累计为用户总数
          </div>
          <div ref="userChartEl" class="w-full h-[200px] mt-2"></div>
        </div>

        <!-- TOP 10 工具：今日 / 每周 / 每月 / 累计 切换 -->
        <div v-else-if="w.id === 'topTools'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="text-sm text-ink-500 mb-2 flex items-center gap-1.5 flex-wrap">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <span class="flex items-center gap-1.5">
              <IconTrophy class="w-3.5 h-3.5" />
              TOP 10 工具
            </span>
            <el-radio-group v-model="topToolsRange" size="small" class="!ml-auto">
              <el-radio-button
                v-for="r in TOP_TOOLS_RANGES"
                :key="r.key"
                :value="r.key"
              >
                {{ r.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <!-- 限高滚动：条数多时不再把同排卡片撑高（含头部换行、底部链接后仍低于趋势图卡高度） -->
          <div v-if="activeTopTools.length" class="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
            <div
              v-for="(t, i) in activeTopTools"
              :key="t.tool_url"
              class="flex items-center gap-2 text-sm"
            >
              <span class="text-ink-400 w-4 text-right tabular-nums">{{ i + 1 }}.</span>
              <a
                v-if="t.tool_url"
                :href="t.tool_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-ink-900 truncate flex-1 hover:text-accent-600 hover:underline transition-colors"
                :title="`跳转到 ${t.tool_title}`"
              >
                {{ t.tool_title }}
              </a>
              <span v-else class="text-ink-900 truncate flex-1">{{ t.tool_title }}</span>
              <span class="text-accent-700 font-medium tabular-nums">{{ t.count }}</span>
            </div>
          </div>
          <div v-else class="text-xs text-ink-400">该时间窗内暂无使用记录</div>
          <div class="text-xs text-ink-400 mt-3">
            <router-link to="/admin/tool-usage" class="text-accent-600 hover:text-accent-700 font-medium">
              查看全部 TOP →
            </router-link>
          </div>
        </div>

        <!-- 慢日志数（阈值 100ms） -->
        <div v-else-if="w.id === 'slowlog'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="text-sm text-ink-500 mb-2 flex items-center gap-1.5">
            <span class="widget-drag-handle" title="拖动调整位置">
              <IconRank class="w-3.5 h-3.5" />
            </span>
            <IconTimer class="w-3.5 h-3.5" />
            慢日志数 <span class="text-[11px] text-ink-400 font-normal">（阈值 100ms）</span>
          </div>
          <div class="grid grid-cols-3 divide-x divide-ink-100">
            <div class="pr-2 first:pl-0">
              <div class="text-[11px] text-ink-400">今日</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.slowQueries?.today ?? 0 }}
              </div>
            </div>
            <div class="px-2">
              <div class="text-[11px] text-ink-400">本周</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.slowQueries?.week ?? 0 }}
              </div>
            </div>
            <div class="pl-2 last:pr-0">
              <div class="text-[11px] text-ink-400">本月</div>
              <div class="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums leading-tight">
                {{ data?.slowQueries?.month ?? 0 }}
              </div>
            </div>
          </div>
          <div class="text-[11px] text-ink-400 mt-2">
            <router-link to="/admin/slow-query-logs" class="text-accent-600 hover:text-accent-700 font-medium">
              查看明细 →
            </router-link>
          </div>
        </div>

        <!-- 待审核：评论 / 友链 / 文章 / 反馈（独占一整行） -->
        <div v-else-if="w.id === 'pending'" v-loading="panelLoading(w.id)" class="admin-stat-card h-full">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-sm text-ink-500 mb-2 flex items-center gap-1.5">
                <span class="widget-drag-handle" title="拖动调整位置">
                  <IconRank class="w-3.5 h-3.5" />
                </span>
                待审核
              </div>
              <div class="grid grid-cols-4 divide-x divide-ink-100">
                <div class="pr-2">
                  <div class="text-[11px] text-ink-400">评论</div>
                  <div class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
                    :class="data?.pendingComments ? 'text-amber-600' : 'text-ink-900'">
                    {{ data?.pendingComments ?? 0 }}
                  </div>
                  <div class="text-[11px] mt-1">
                    <router-link to="/admin/comments" class="text-accent-600 hover:text-accent-700 font-medium">
                      去审核 →
                    </router-link>
                  </div>
                </div>
                <div class="px-2">
                  <div class="text-[11px] text-ink-400">友链</div>
                  <div class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
                    :class="data?.pendingFriendLinks ? 'text-amber-600' : 'text-ink-900'">
                    {{ data?.pendingFriendLinks ?? 0 }}
                  </div>
                  <div class="text-[11px] mt-1">
                    <router-link to="/admin/friend-links" class="text-accent-600 hover:text-accent-700 font-medium">
                      去审核 →
                    </router-link>
                  </div>
                </div>
                <div class="px-2">
                  <div class="text-[11px] text-ink-400">文章</div>
                  <div class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
                    :class="data?.pendingBlogPosts ? 'text-amber-600' : 'text-ink-900'">
                    {{ data?.pendingBlogPosts ?? 0 }}
                  </div>
                  <div class="text-[11px] mt-1">
                    <router-link to="/admin/blog/review" class="text-accent-600 hover:text-accent-700 font-medium">
                      去审核 →
                    </router-link>
                  </div>
                </div>
                <div class="pl-2 last:pr-0">
                  <div class="text-[11px] text-ink-400">反馈</div>
                  <div class="mt-0.5 text-lg font-semibold tabular-nums leading-tight"
                    :class="data?.pendingFeedback ? 'text-amber-600' : 'text-ink-900'">
                    {{ data?.pendingFeedback ?? 0 }}
                  </div>
                  <div class="text-[11px] mt-1">
                    <router-link to="/admin/feedback" class="text-accent-600 hover:text-accent-700 font-medium">
                      去处理 →
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 最近积分流水 -->
        <el-card v-else-if="w.id === 'transactions'" v-loading="panelLoading(w.id)" shadow="never" class="!rounded-xl h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium text-ink-900 flex items-center gap-1.5">
                <span class="widget-drag-handle" title="拖动调整位置">
                  <IconRank class="w-3.5 h-3.5" />
                </span>
                最近积分流水
              </span>
              <router-link
                to="/admin/credits"
                class="text-sm text-accent-600 hover:text-accent-700"
              >
                查看全部 →
              </router-link>
            </div>
          </template>

          <el-table
            v-if="data?.recentTransactions?.length"
            :data="data.recentTransactions"
            stripe
            size="small"
            :show-header="true"
          >
            <el-table-column prop="created_at" label="时间" min-width="160">
              <template #default="{ row }">
                <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="用户" min-width="200">
              <template #default="{ row }">
                <span class="text-ink-900">{{ row.user_name || row.user_email || row.uid }}</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="80">
              <template #default="{ row }">
                <div class="flex flex-col items-start gap-0.5">
                  <el-tag
                    :type="row.type === 'grant' ? 'success' : 'danger'"
                    size="small"
                    effect="plain"
                  >
                    {{ row.type === 'grant' ? '赠送' : row.type === 'deduct' ? '扣减' : row.type }}
                  </el-tag>
                  <span
                    class="text-[10px] px-1 py-0.5 rounded"
                    :class="sourceClass(row.source)"
                  >{{ sourceLabel(row.source) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="变动" width="100" align="right">
              <template #default="{ row }">
                <span
                  :class="row.amount > 0 ? 'text-success-600' : 'text-danger-600'"
                  class="font-medium"
                >
                  {{ fmtAmount(row.amount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="余额后" width="100" align="right" prop="balance_after" />
            <el-table-column label="操作人" min-width="160">
              <template #default="{ row }">
                <span class="text-ink-700">
                  {{ row.operator_uid === 'SYSTEM' ? '系统' : (row.operator_uid.slice(0, 12) + (row.operator_uid.length > 12 ? '…' : '')) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="备注" min-width="160" show-overflow-tooltip />
          </el-table>
          <el-empty v-else description="暂无流水" :image-size="60" />
        </el-card>
      </div>
    </div>
  </div>
</template>
