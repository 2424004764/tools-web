<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  fetchToolUsageRecords,
  fetchToolUsageStats,
} from '@/api/admin/tool-usage'
import { functionsRequest } from '@/utils/functionsRequest'
import { formatLocation } from '@/utils/geo-name'
import { SOURCE_LABELS, getSourceLabel } from '@/utils/source'
import type {
  AdminPagination,
  ToolUsageRecord,
  ToolUsageStats,
  ToolFeature,
} from '@/types/admin'

const loading = ref(false)
const statsLoading = ref(false)

// 聚合统计
const stats = ref<ToolUsageStats | null>(null)

// 明细列表
const list = ref<ToolUsageRecord[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

// 工具下拉（来自 /api/tools）
const toolOptions = ref<{ label: string; value: string }[]>([])

// 推广来源下拉（与 SOURCE_LABELS 一致；direct 放在最前表示无来源/直接访问）
const sourceOptions = (() => {
  const entries = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))
  // direct 优先
  return entries.sort((a, b) => (a.value === 'direct' ? -1 : b.value === 'direct' ? 1 : a.label.localeCompare(b.label)))
})()

// 筛选
const filter = reactive({
  uid: '',
  tool_url: '',
  source: '',
  range: '7d' as '' | 'today' | '7d' | '30d' | 'all',
})

// range → startDate / endDate 转换（YYYY-MM-DD，本地 UTC+8）
const rangeToDates = (range: typeof filter.range): { startDate?: string; endDate?: string } => {
  if (range === '' || range === 'all') return {}
  const now = new Date()
  // 当前 UTC+8 当天 YYYY-MM-DD
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const end = new Date(now.getTime())
  if (range === 'today') {
    return { startDate: fmt(end), endDate: fmt(end) }
  }
  if (range === '7d') {
    const start = new Date(end.getTime() - 6 * 24 * 3600 * 1000)
    return { startDate: fmt(start), endDate: fmt(end) }
  }
  if (range === '30d') {
    const start = new Date(end.getTime() - 29 * 24 * 3600 * 1000)
    return { startDate: fmt(start), endDate: fmt(end) }
  }
  return {}
}

// 秒级时间戳 → 本地化时间
const formatTime = (sec: number) => {
  if (!sec || Number.isNaN(sec)) return '-'
  // 后端秒级 timestamp；前端构造 Date 即可
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return String(sec)
  return d.toLocaleString('zh-CN', { hour12: false })
}

// 拼接悬浮提示，展示全部 CF 原始字段（方便排查异常）
const geoTooltip = (row: ToolUsageRecord) => {
  const parts: string[] = []
  if (row.country) parts.push(`国家: ${row.country}`)
  if (row.region) parts.push(`省/州: ${row.region}`)
  if (row.city) parts.push(`城市: ${row.city}`)
  if (row.timezone) parts.push(`时区: ${row.timezone}`)
  if (row.colo) parts.push(`CF 接入点: ${row.colo}`)
  return parts.length ? parts.join('\n') : '无地理位置信息'
}

const loadStats = async () => {
  statsLoading.value = true
  try {
    stats.value = await fetchToolUsageStats()
  } catch (err: any) {
    console.error('[tool-usage] stats error:', err)
    ElMessage.error('统计加载失败')
  } finally {
    statsLoading.value = false
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const dateRange = rangeToDates(filter.range)
    const result = await fetchToolUsageRecords({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      uid: filter.uid || undefined,
      tool_url: filter.tool_url || undefined,
      source: filter.source || undefined,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })
    list.value = result.list
    pagination.value = result.pagination
  } catch (err: any) {
    console.error('[tool-usage] list error:', err)
    ElMessage.error('明细加载失败')
  } finally {
    loading.value = false
  }
}

const loadToolsOptions = async () => {
  try {
    // /api/tools 返回已启用工具（公开接口），用于筛选下拉足够
    const res = await functionsRequest.get('/api/tools')
    const tools: ToolFeature[] = res?.data?.data || []
    toolOptions.value = tools.map((t) => ({
      label: t.title,
      value: t.url,
    }))
  } catch (err) {
    console.warn('[tool-usage] 工具列表加载失败:', err)
    toolOptions.value = []
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  loadList()
}

const handleReset = () => {
  filter.uid = ''
  filter.tool_url = ''
  filter.source = ''
  filter.range = '7d'
  pagination.value.page = 1
  loadList()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  loadList()
}

// range 变化即重新加载（无需点搜索）
watch(
  () => filter.range,
  () => {
    pagination.value.page = 1
    loadList()
  },
)

// 移动端分页器适配：< 640px 时切精简布局 + 5 个页码 + small 模式
const { isMobile } = useIsMobile()

onMounted(() => {
  loadStats()
  loadList()
  loadToolsOptions()
})
</script>

<template>
  <div v-loading="loading || statsLoading">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">工具使用记录</h2>
      <el-button @click="() => { loadStats(); loadList() }" :loading="loading || statsLoading">
        刷新
      </el-button>
    </div>

    <!-- 顶部 4 个统计卡 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">今日次数</div>
        <div class="mt-1 text-2xl font-semibold text-accent-700">
          {{ stats?.todayCount ?? 0 }}
        </div>
        <div class="text-xs text-ink-400 mt-1">本地 UTC+8 当天</div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">本周次数</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900">
          {{ stats?.weekCount ?? 0 }}
        </div>
        <div class="text-xs text-ink-400 mt-1">本周一至今</div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">总次数</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900">
          {{ stats?.totalCount ?? 0 }}
        </div>
        <div class="text-xs text-ink-400 mt-1">所有时间</div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">活跃用户（30 天）</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900">
          {{ stats?.activeUsers30d ?? 0 }}
        </div>
        <div class="text-xs text-ink-400 mt-1">去重 uid</div>
      </el-card>
    </div>

    <!-- TOP 10 工具 + TOP 10 用户 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <el-card shadow="never" class="!rounded-xl">
        <template #header>
          <span class="font-medium text-ink-900">TOP 10 工具</span>
        </template>
        <div v-if="stats?.topTools?.length" class="space-y-2">
          <div
            v-for="(t, i) in stats.topTools"
            :key="t.tool_url"
            class="flex items-center gap-3 text-sm"
          >
            <span class="text-ink-400 w-5 text-right tabular-nums">{{ i + 1 }}</span>
            <span class="text-ink-900 truncate flex-1" :title="t.tool_title">{{ t.tool_title }}</span>
            <a
              :href="t.tool_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline font-mono shrink-0"
              :title="`点击打开 ${t.tool_url}`"
            >
              {{ t.tool_url }}
            </a>
            <span class="text-accent-700 font-medium tabular-nums w-12 text-right">
              {{ t.use_count }}
            </span>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="60" />
      </el-card>

      <el-card shadow="never" class="!rounded-xl">
        <template #header>
          <span class="font-medium text-ink-900">TOP 10 用户</span>
        </template>
        <div v-if="stats?.topUsers?.length" class="space-y-2">
          <div
            v-for="(u, i) in stats.topUsers"
            :key="u.uid"
            class="flex items-center gap-3 text-sm"
          >
            <span class="text-ink-400 w-5 text-right tabular-nums">{{ i + 1 }}</span>
            <span class="text-ink-900 truncate flex-1">
              {{ u.user_email || u.user_name || u.uid }}
            </span>
            <span class="text-accent-700 font-medium tabular-nums w-12 text-right">
              {{ u.use_count }}
            </span>
          </div>
        </div>
        <el-empty v-else description="暂无数据" :image-size="60" />
      </el-card>
    </div>

    <!-- 推广来源 TOP 10（独立一行：来源维度比工具/用户少，宽屏下单独成行更易读） -->
    <el-card shadow="never" class="!rounded-xl mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium text-ink-900">推广来源 TOP 10</span>
          <span class="text-xs text-ink-400">utm_source 优先 → referer 指纹 → direct</span>
        </div>
      </template>
      <div v-if="stats?.topSources?.length" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <div
          v-for="(s, i) in stats.topSources"
          :key="s.source"
          class="flex items-center gap-3 text-sm"
        >
          <span class="text-ink-400 w-5 text-right tabular-nums">{{ i + 1 }}</span>
          <span class="text-ink-900 truncate flex-1" :title="getSourceLabel(s.source)">
            {{ getSourceLabel(s.source) }}
          </span>
          <span class="text-[10px] text-ink-400 font-mono shrink-0" :title="s.source">
            {{ s.source }}
          </span>
          <span class="text-accent-700 font-medium tabular-nums w-14 text-right">
            {{ s.use_count }}
          </span>
        </div>
      </div>
      <el-empty v-else description="暂无数据" :image-size="60" />
    </el-card>

    <!-- 筛选 + 明细表 -->
    <el-card shadow="never" class="!rounded-xl">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium text-ink-900">使用明细</span>
        </div>
      </template>

      <div class="flex flex-wrap items-end gap-3 mb-4">
        <el-select
          v-model="filter.tool_url"
          placeholder="选择工具（可空）"
          clearable
          filterable
          class="!w-56"
          @change="handleSearch"
        >
          <el-option
            v-for="opt in toolOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-input
          v-model="filter.uid"
          placeholder="用户 UID"
          clearable
          class="!w-44"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />

        <el-select
          v-model="filter.source"
          placeholder="推广来源（可空）"
          clearable
          filterable
          class="!w-48"
          @change="handleSearch"
        >
          <el-option
            v-for="opt in sourceOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-radio-group v-model="filter.range">
          <el-radio-button value="today">今天</el-radio-button>
          <el-radio-button value="7d">7 天</el-radio-button>
          <el-radio-button value="30d">30 天</el-radio-button>
          <el-radio-button value="all">全部</el-radio-button>
        </el-radio-group>

        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table
        v-if="list.length"
        :data="list"
        stripe
        size="small"
        :show-header="true"
      >
        <el-table-column label="时间" min-width="170">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.used_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="flex flex-col">
              <!-- 匿名用户（uid 为空）显示 IP 作为身份标识 -->
              <span v-if="!row.uid" class="text-ink-700 italic">匿名</span>
              <span v-else class="text-ink-900">{{ row.user_email || row.user_name || '-' }}</span>
              <span class="text-[10px] text-ink-400 font-mono">
                {{ row.uid ? row.uid : (row.ip || '-') }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="IP" min-width="130">
          <template #default="{ row }">
            <span class="text-xs text-ink-500 font-mono">{{ row.ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="位置" min-width="170">
          <template #default="{ row }">
            <div
              class="flex flex-col"
              :title="geoTooltip(row)"
            >
              <span class="text-ink-900 text-xs">{{ formatLocation(row.country, row.city) }}</span>
              <span class="text-[10px] text-ink-400">
                <template v-if="row.timezone || row.colo">
                  <span v-if="row.timezone">{{ row.timezone }}</span>
                  <span v-if="row.timezone && row.colo"> · </span>
                  <span v-if="row.colo">CF {{ row.colo }}</span>
                </template>
                <template v-else>-</template>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="110">
          <template #default="{ row }">
            <span
              class="text-xs text-ink-900"
              :title="row.source ? `来源标识: ${row.source}` : '迁移前旧记录，无来源'"
            >
              {{ row.source ? getSourceLabel(row.source) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="工具" min-width="160">
          <template #default="{ row }">
            <span class="text-ink-900">{{ row.tool_title }}</span>
          </template>
        </el-table-column>
        <el-table-column label="URL" min-width="160">
          <template #default="{ row }">
            <a
              :href="row.tool_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline font-mono"
              :title="`点击打开 ${row.tool_url}`"
            >
              {{ row.tool_url }}
            </a>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无记录" :image-size="60" />

      <div v-if="pagination.totalPages > 1" :class="isMobile ? 'flex justify-center mt-4 overflow-x-auto py-1' : 'flex justify-end mt-4'">
        <el-pagination
          background
          :layout="isMobile ? 'prev, pager, next' : 'prev, pager, next, total, jumper'"
          :pager-count="isMobile ? 5 : 7"
          :small="isMobile"
          :total="pagination.total"
          :page-size="pagination.pageSize"
          :current-page="pagination.page"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>