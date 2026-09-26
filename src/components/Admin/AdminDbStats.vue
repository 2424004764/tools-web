<script setup lang="ts">
// Admin 数据统计页
// 上：近 30 天每日新增行数折线图（下拉切换数据表）
// 下：所有数据表的 总行数 / 今日 / 7日 / 30日 新增统计表
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { ElMessage } from 'element-plus'
import { useTheme } from '@/composables/useTheme'
import {
  fetchDbStats,
  fetchDbTableTrend,
  type DbStatsResponse,
  type DbTableStat,
} from '@/api/admin/db-stats'

const loading = ref(false)
const generatedAt = ref('')
const tables = ref<DbTableStat[]>([])

// ============ 折线图 ============
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ECharts | null = null
let chartLoading = ref(false)
const selectedTable = ref('')
const trendTable = ref('')

const chartTables = computed(() => tables.value.filter((t) => t.tracked))

const formatNum = (n: number) => (n || 0).toLocaleString('zh-CN')

// 图表配色跟随主题：html.dark 翻转 CSS 变量后，构建 option 时实时解析即得当前主题色
const { isDark } = useTheme()
function themeVar(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parts = raw.split(/\s+/)
  if (parts.length < 3) return raw
  return `rgba(${parts.join(', ')}, ${alpha})`
}

// 最近一次绘制的数据，主题切换时用它重绘（不重新请求接口）
let lastTrend: { dates: string[]; counts: number[] } | null = null

function buildDateList(days: number): string[] {
  const list: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const pad = (n: number) => String(n).padStart(2, '0')
    list.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  }
  return list
}

async function loadTrend(table: string) {
  if (!table) return
  chartLoading.value = true
  trendTable.value = table
  try {
    const points = await fetchDbTableTrend(table)
    const countMap = new Map(points.map((p) => [p.date, p.count]))
    const dates = buildDateList(30)
    const counts = dates.map((d) => countMap.get(d) || 0)
    lastTrend = { dates, counts }
    applyTrendOption(dates, counts)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '趋势数据加载失败')
  } finally {
    chartLoading.value = false
  }
}

function applyTrendOption(dates: string[], counts: number[]) {
  chartInstance?.setOption(
    {
      grid: { left: 48, right: 20, top: 36, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: themeVar('--surface-0'),
        borderColor: themeVar('--border-default'),
        textStyle: { color: themeVar('--ink-700') },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          return `${p.name}<br/>${p.marker} 新增 <b>${formatNum(p.value)}</b> 行`
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          color: themeVar('--ink-500'),
          interval: 4,
          formatter: (v: string) => v.slice(5),
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
          name: '每日新增行数',
          type: 'line',
          data: counts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          itemStyle: { color: themeVar('--accent-500') },
          lineStyle: { width: 2.5, color: themeVar('--accent-500') },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: themeVar('--accent-500', 0.25) },
              { offset: 1, color: themeVar('--accent-500', 0.02) },
            ]),
          },
        },
      ],
    },
    { notMerge: true },
  )
}

// 主题切换时用缓存数据按新主题色重绘
watch(isDark, () => {
  if (chartInstance && lastTrend) {
    applyTrendOption(lastTrend.dates, lastTrend.counts)
  }
})

function onSelectTable(table: string) {
  loadTrend(table)
}

// ============ 列表 ============
const load = async () => {
  loading.value = true
  try {
    const data: DbStatsResponse = await fetchDbStats()
    tables.value = data.tables
    generatedAt.value = data.generatedAt

    // 默认选中近 30 日新增最多的已跟踪表（曲线信息量最大）
    if (!selectedTable.value && chartTables.value.length > 0) {
      const top = [...chartTables.value].sort(
        (a, b) => (b.last30 - a.last30) || (b.total - a.total),
      )[0]
      selectedTable.value = top.name
      await nextTick()
      initChart()
      await loadTrend(selectedTable.value)
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '数据统计加载失败')
  } finally {
    loading.value = false
  }
}

function initChart() {
  if (chartInstance || !chartRef.value) return
  chartInstance = echarts.init(chartRef.value)
}

const handleResize = () => chartInstance?.resize()

onMounted(() => {
  load()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">数据统计</h2>
      <span v-if="generatedAt" class="text-xs text-ink-400">
        生成于 {{ new Date(generatedAt).toLocaleString('zh-CN', { hour12: false }) }}
      </span>
      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 折线图 -->
    <el-card shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-medium text-ink-900">近 30 天每日新增行数</span>
          <el-select
            v-model="selectedTable"
            filterable
            class="!w-64"
            :loading="chartLoading"
            aria-label="选择数据表"
            @change="onSelectTable"
          >
            <el-option
              v-for="t in chartTables"
              :key="t.name"
              :value="t.name"
              :label="`${t.comment}（${t.name}）`"
            />
          </el-select>
        </div>
      </template>
      <div ref="chartRef" v-loading="chartLoading" class="w-full h-[320px]"></div>
    </el-card>

    <!-- 全表统计 -->
    <el-card shadow="never">
      <template #header>
        <span class="font-medium text-ink-900">数据表行数统计</span>
      </template>
      <el-table
        :data="tables"
        stripe
        size="default"
        empty-text="暂无数据"
      >
        <el-table-column prop="name" label="表名" min-width="200">
          <template #default="{ row }">
            <code class="font-mono text-body-sm text-ink-900">{{ row.name }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="comment" label="说明" min-width="160">
          <template #default="{ row }">
            <span :class="row.tracked ? 'text-ink-700' : 'text-ink-400'">{{ row.comment }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="total" label="总行数" width="120" align="right" sortable>
          <template #default="{ row }">
            <span class="font-medium text-ink-900 tabular-nums">{{ formatNum(row.total) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="today" label="今日新增" width="110" align="right" sortable>
          <template #default="{ row }">
            <span :class="row.today > 0 ? 'text-accent-700 font-medium' : 'text-ink-400'" class="tabular-nums">
              {{ row.tracked ? formatNum(row.today) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="last7" label="7 日新增" width="110" align="right" sortable>
          <template #default="{ row }">
            <span class="tabular-nums" :class="row.tracked ? 'text-ink-700' : 'text-ink-400'">
              {{ row.tracked ? formatNum(row.last7) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="last30" label="30 日新增" width="110" align="right" sortable>
          <template #default="{ row }">
            <span class="tabular-nums" :class="row.tracked ? 'text-ink-700' : 'text-ink-400'">
              {{ row.tracked ? formatNum(row.last30) : '-' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
