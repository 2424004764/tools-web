<script setup lang="ts">
import { onMounted, reactive, ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  fetchToolUsageRecords,
  fetchToolUsageStats,
} from '@/api/admin/tool-usage'
import { fetchIpBans, createIpBan, deleteIpBan } from '@/api/admin/ip-ban'
import { functionsRequest } from '@/utils/functionsRequest'
import { formatLocation } from '@/utils/geo-name'
import { SOURCE_LABELS, getSourceLabel } from '@/utils/source'
import { PRODUCTS } from '@/components/Layout/Header/products'
import type {
  AdminPagination,
  ToolUsageRecord,
  ToolUsageStats,
  ToolFeature,
  IpBanRule,
} from '@/types/admin'

/**
 * /app-jump/:key/ 是「更多产品」的站内跳转中间页埋点（复用 tool_usage_records 表）。
 * 展示时把路径翻译成「产品跳转 · 题迹」，其余路径原样返回。
 */
function displayToolUrl(url: string): string {
  const m = /^\/app-jump\/([a-z0-9-]+)\/?$/.exec(url || '')
  if (!m) return url
  const p = PRODUCTS.find((x) => x.key === m[1])
  return p ? `产品跳转 · ${p.name}` : `产品跳转 · ${m[1]}`
}

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
  range: 'today' as '' | 'today' | 'week' | 'month' | 'all',
})

const route = useRoute()

// 支持从仪表盘带 ?range=today|week|month 跳入预选时间维度；
// 在下方 watch 注册前写入，避免触发重复查询
const QUERY_RANGES = ['today', 'week', 'month', 'all']
if (typeof route.query.range === 'string' && QUERY_RANGES.includes(route.query.range)) {
  filter.range = route.query.range as typeof filter.range
}

// range → startDate / endDate 转换（YYYY-MM-DD，本地 UTC+8）
// week/month 与仪表盘口径一致：本周一至今 / 本月 1 日至今
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
  if (range === 'week') {
    const daysSinceMonday = (end.getDay() + 6) % 7
    const start = new Date(end.getTime() - daysSinceMonday * 24 * 3600 * 1000)
    return { startDate: fmt(start), endDate: fmt(end) }
  }
  if (range === 'month') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1)
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

// 秒级时间戳 → 本地 UTC+8 'YYYY-MM-DD'（与后端 tsToUTC8DateStr 对齐）
const formatUTC8Date = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return '-'
  const d = new Date(sec * 1000 + 8 * 3600 * 1000)
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 整张表的统计区间（顶部 4 卡和 TOP 来源卡共用）
const rangeLabel = computed(() => {
  const s = stats.value?.rangeStart
  const e = stats.value?.rangeEnd
  if (!s && !e) return '暂无数据'
  if (s === e) return `${s}`
  return `${s || '?'} ~ ${e || '?'}`
})

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
  filter.range = 'today'
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

// ============ IP 封禁管理 ============

// 生效中的封禁规则（底部管理卡片数据源）
const banRules = ref<IpBanRule[]>([])
const bansLoading = ref(false)
const banSubmitting = ref(false)

const banDialog = reactive({
  visible: false,
  ip: '',
  // 从记录行打开时锁定 IP，仅允许填原因/时长
  ipLocked: false,
  reason: '',
  durationHours: 24,
})

const loadBanRules = async () => {
  bansLoading.value = true
  try {
    banRules.value = await fetchIpBans()
  } catch (err: any) {
    console.error('[tool-usage] ip-bans error:', err)
  } finally {
    bansLoading.value = false
  }
}

// ip 传入时为「从记录行封禁」（锁定）；不传为「手动新增」
const openBanDialog = (ip?: string) => {
  banDialog.ip = ip || ''
  banDialog.ipLocked = Boolean(ip)
  banDialog.reason = ''
  banDialog.durationHours = 24
  banDialog.visible = true
}

const submitBan = async () => {
  if (!banDialog.ip.trim()) {
    ElMessage.warning('请输入 IP')
    return
  }
  banSubmitting.value = true
  try {
    await createIpBan({
      ip: banDialog.ip.trim(),
      reason: banDialog.reason.trim() || undefined,
      duration_hours: banDialog.durationHours,
    })
    ElMessage.success('已封禁，最迟 15 秒内在各节点生效')
    banDialog.visible = false
    await Promise.all([loadBanRules(), loadList()])
  } catch {
    // 错误提示由 functionsRequest 拦截器统一弹出
  } finally {
    banSubmitting.value = false
  }
}

const handleUnban = async (id: string, ip: string) => {
  try {
    await ElMessageBox.confirm(
      `确定解除对 ${ip} 的封禁吗？解封后该 IP 立即恢复访问（最迟 15 秒生效）。`,
      '解封确认',
      { type: 'warning', confirmButtonText: '解封', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteIpBan(id)
    ElMessage.success('已解封，最迟 15 秒内在各节点生效')
    await Promise.all([loadBanRules(), loadList()])
  } catch {
    // 同上，拦截器已提示
  }
}

// 'YYYY-MM-DD HH:MM:SS'（UTC）→ 本地化时间
const formatBanTime = (s: string | null | undefined) => {
  if (!s) return '-'
  const ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(ts)) return s
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

// 到期字段 → 剩余时间描述
const formatBanExpiry = (rule: IpBanRule) => {
  if (!rule.expires_at) return '永久'
  const ts = new Date(rule.expires_at.replace(' ', 'T') + 'Z').getTime()
  if (Number.isNaN(ts)) return rule.expires_at
  const diff = ts - Date.now()
  if (diff <= 0) return '已过期'
  const hours = Math.floor(diff / 3600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)} 天后到期`
  if (hours >= 1) return `${hours} 小时后到期`
  return `${Math.max(1, Math.floor(diff / 60_000))} 分钟后到期`
}

// 移动端分页器适配：< 640px 时切精简布局 + 5 个页码 + small 模式
const { isMobile } = useIsMobile()

onMounted(() => {
  loadStats()
  loadList()
  loadToolsOptions()
  loadBanRules()
  // 从仪表盘带锚点跳入时（如 /admin/tool-usage?range=week#usage-detail）滚动到目标卡片。
  // 路由 afterEach 有 RAF 钉顶，且统计卡 / TOP 榜异步渲染会持续改变上方高度，
  // 因此轮询校正滚动位置，直到贴住锚点（scroll-mt-20 提供吸顶头部偏移）再停止
  if (route.hash) {
    const anchorId = route.hash.slice(1)
    let checks = 0
    let stable = 0
    const tick = () => {
      checks += 1
      const el = document.getElementById(anchorId)
      if (!el) return
      const offset = el.getBoundingClientRect().top
      if (Math.abs(offset - 80) > 6) {
        stable = 0
        el.scrollIntoView({ block: 'start' })
      } else if (++stable >= 2) {
        return
      }
      if (checks < 16) setTimeout(tick, 250)
    }
    setTimeout(tick, 150)
  }
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

    <!-- 顶部统计范围提示 -->
    <div class="text-xs text-ink-400 mb-2 flex items-center gap-1.5">
      <span>数据范围（UTC+8 自然日）：</span>
      <span class="font-medium text-ink-600 tabular-nums">{{ rangeLabel }}</span>
      <span class="text-ink-300">·</span>
      <span class="text-ink-400">以下 TOP 10 / 活跃用户 / 总次数均按此区间统计</span>
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
              {{ displayToolUrl(t.tool_url) }}
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
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="font-medium text-ink-900">推广来源 TOP 10</span>
            <span class="text-xs text-ink-400">utm_source 优先 → referer 指纹 → direct</span>
          </div>
          <span class="text-xs text-ink-500">
            统计区间：
            <span class="font-medium text-ink-700 tabular-nums">{{ rangeLabel }}</span>
            <span class="text-ink-400">（UTC+8 自然日）</span>
          </span>
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
          <span
            class="text-[10px] text-ink-500 shrink-0 tabular-nums"
            :title="s.last_used_at ? `最近一次：${formatTime(s.last_used_at)}` : ''"
          >
            {{ formatUTC8Date(s.last_used_at) }}
          </span>
          <span class="text-accent-700 font-medium tabular-nums w-14 text-right">
            {{ s.use_count }}
          </span>
        </div>
      </div>
      <el-empty v-else description="暂无数据" :image-size="60" />
    </el-card>

    <!-- 筛选 + 明细表（仪表盘"工具使用次数"跳转锚点，scroll-mt-20 避开吸顶头部） -->
    <el-card id="usage-detail" shadow="never" class="!rounded-xl scroll-mt-20">
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
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
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
        <el-table-column label="IP" min-width="150">
          <template #default="{ row }">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs text-ink-500 font-mono">{{ row.ip || '-' }}</span>
              <template v-if="row.ip">
                <el-tag v-if="row.ip_ban_id" size="small" type="danger" effect="light">已封禁</el-tag>
                <el-button
                  link
                  :type="row.ip_ban_id ? 'primary' : 'danger'"
                  size="small"
                  class="!p-0"
                  @click="row.ip_ban_id ? handleUnban(row.ip_ban_id, row.ip) : openBanDialog(row.ip)"
                >
                  {{ row.ip_ban_id ? '解除封禁' : '封禁' }}
                </el-button>
              </template>
            </div>
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
              {{ displayToolUrl(row.tool_url) }}
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

    <!-- IP 封禁规则管理 -->
    <el-card v-loading="bansLoading" shadow="never" class="!rounded-xl mt-4">
      <template #header>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-medium text-ink-900 shrink-0">IP 封禁（{{ banRules.length }}）</span>
            <span class="text-xs text-ink-400 truncate">
              拦截全站请求（管理接口除外）；IPv6 按 /64 网段封禁；规则变更最迟 15 秒生效
            </span>
          </div>
          <el-button type="danger" plain size="small" @click="openBanDialog()">新增封禁</el-button>
        </div>
      </template>

      <el-table v-if="banRules.length" :data="banRules" stripe size="small">
        <el-table-column label="封禁对象" min-width="200">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="text-xs text-ink-900 font-mono break-all">{{ row.ip }}</span>
              <span
                v-if="row.original_ip && row.original_ip !== row.ip"
                class="text-[10px] text-ink-400 font-mono break-all"
              >
                原始：{{ row.original_ip }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="原因" min-width="140">
          <template #default="{ row }">
            <span class="text-xs text-ink-600" :title="row.reason">{{ row.reason || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-600">{{ row.banned_by_email || row.banned_by || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="封禁时间" min-width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatBanTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="到期" min-width="110">
          <template #default="{ row }">
            <span
              class="text-xs"
              :class="row.expires_at ? 'text-ink-500' : 'text-red-500'"
              :title="row.expires_at ? `到期时间：${formatBanTime(row.expires_at)}` : '永久封禁'"
            >
              {{ formatBanExpiry(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleUnban(row.id, row.ip)">
              解除封禁
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无封禁规则" :image-size="60" />
    </el-card>

    <!-- 封禁弹窗：从记录行打开时 IP 锁定；手动新增时可编辑 -->
    <el-dialog
      v-model="banDialog.visible"
      :title="banDialog.ipLocked ? '封禁 IP' : '新增 IP 封禁'"
      width="430px"
    >
      <el-form label-width="72px" @submit.prevent>
        <el-form-item label="IP">
          <el-input
            v-model="banDialog.ip"
            :disabled="banDialog.ipLocked"
            placeholder="IPv4 如 1.2.3.4，或 IPv6 地址"
          />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="banDialog.reason" maxlength="100" placeholder="选填，如：恶意刷接口" />
        </el-form-item>
        <el-form-item label="时长">
          <el-select v-model="banDialog.durationHours" class="!w-full">
            <el-option label="1 小时" :value="1" />
            <el-option label="1 天" :value="24" />
            <el-option label="7 天" :value="168" />
            <el-option label="30 天" :value="720" />
            <el-option label="永久" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="text-xs text-ink-400 -mt-1">
        IPv6 地址将按其 /64 网段封禁（同网段全部拦截）；封禁后该 IP 无法访问本站（管理接口除外），最迟 15 秒生效。
      </div>
      <template #footer>
        <el-button @click="banDialog.visible = false">取消</el-button>
        <el-button type="danger" :loading="banSubmitting" @click="submitBan">确认封禁</el-button>
      </template>
    </el-dialog>
  </div>
</template>