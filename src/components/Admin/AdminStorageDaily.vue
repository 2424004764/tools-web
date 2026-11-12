<script setup lang="ts">
// Admin 存储空间按天用量明细（AdminStorage.vue「按天明细」视图）
// 上：日期选择 + 快捷日 + 搜索；近 30 天可点击趋势条
// 中：当日汇总卡 + 当日来源构成
// 下：当日按用户用表（当日新增 / 来源拆解悬浮），点「当日明细」看该用户逐文件记录
// 口径：按上传时间（UTC+8）归天统计现存记录；生成图持久化等其他类不落文件表，无法按天归集
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  fetchStorageDaily,
  fetchStorageDailyUserDetail,
  type StorageDailyRow,
  type StorageDailySummary,
  type StorageDailyTrendPoint,
  type StorageDailyUserDetail,
  type StorageDailySources,
} from '@/api/admin/storage'
import { formatStorageBytes } from '@/api/storageQuota'
import defaultAvatar from '@/assets/default_avatar.png'
import type { AdminPagination } from '@/types/admin'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const summary = ref<StorageDailySummary | null>(null)
const trend = ref<StorageDailyTrendPoint[]>([])
const list = ref<StorageDailyRow[]>([])
// 线上缺的来源表（未跑迁移），对应来源已按 0 跳过，提示管理员补迁移
const missingTables = ref<string[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

// 本地日期串（前端与后端同为 UTC+8 语境）
const fmtDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => fmtDateStr(new Date())
const yesterdayStr = () => fmtDateStr(new Date(Date.now() - 86400 * 1000))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const queryDate = String(route.query.date || '').trim()
const viewDate = ref(DATE_RE.test(queryDate) ? queryDate : todayStr())
const keyword = ref('')

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z'))
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const formatBytes = (bytes: number) => formatStorageBytes(bytes || 0)

const onAvatarError = (e: Event) => {
  const img = e.target as HTMLImageElement | null
  if (!img) return
  if (img.dataset.fallback === '1') return
  img.dataset.fallback = '1'
  img.onerror = null
  img.src = defaultAvatar
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchStorageDaily({
      date: viewDate.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: keyword.value || undefined,
    })
    summary.value = result.summary
    trend.value = result.trend
    list.value = result.list
    pagination.value = result.pagination
    missingTables.value = result.missingTables || []
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '按天明细加载失败')
  } finally {
    loading.value = false
  }
}

// 换日期：回到第一页并同步到 URL（可分享 / 刷新保持）
const selectDate = (d: string) => {
  if (!DATE_RE.test(d) || d === viewDate.value) return
  viewDate.value = d
  pagination.value.page = 1
  router.replace({ query: { ...route.query, date: d } })
}

watch(viewDate, () => load())

const handleSearch = () => {
  pagination.value.page = 1
  load()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  load()
}

const disabledFuture = (d: Date) => d.getTime() > Date.now()

// ============ 近 N 天趋势条（可点击切换日期） ============
const trendMax = computed(() => Math.max(1, ...trend.value.map((p) => p.bytes)))
const trendBarMeta = (p: StorageDailyTrendPoint) => {
  if (p.date === viewDate.value) return '#409eff'
  if (p.bytes > 0) return 'rgba(64, 158, 255, 0.38)'
  return '#e5e7eb'
}

// ============ 来源构成（比存量视图多「购物清单图片」一类） ============
interface DailySegment {
  key: keyof StorageDailySources
  label: string
  color: string
  bytes: number
  count: number
}

const SOURCE_META: Record<keyof StorageDailySources, { label: string; color: string }> = {
  music: { label: '音乐文件', color: '#409eff' },
  aiCreation: { label: 'AI 创作图片', color: '#a855f7' },
  subsite: { label: '子站上传', color: '#10b981' },
  shoppingList: { label: '购物清单图片', color: '#f59e0b' },
}

const buildSegments = (sources: StorageDailySources): DailySegment[] =>
  (Object.keys(SOURCE_META) as Array<keyof StorageDailySources>).map((key) => ({
    key,
    label: SOURCE_META[key].label,
    color: SOURCE_META[key].color,
    bytes: sources[key]?.bytes || 0,
    count: sources[key]?.count || 0,
  }))

const daySegments = computed<DailySegment[]>(() =>
  summary.value ? buildSegments(summary.value.sources) : [],
)

const dayTotalBytes = computed(() => daySegments.value.reduce((sum, seg) => sum + seg.bytes, 0))

const segPercent = (bytes: number, total: number) =>
  total > 0 ? Math.max(0, (bytes / total) * 100) : 0

const rowSegments = (row: StorageDailyRow) => buildSegments(row.sources)

// 较前一日（趋势里选中日的前一个点；超出趋势窗口显示 '-'）
const dayOverDay = computed(() => {
  const idx = trend.value.findIndex((p) => p.date === viewDate.value)
  if (idx <= 0) return null
  return summary.value && summary.value.date === viewDate.value
    ? summary.value.totalBytes - trend.value[idx - 1].bytes
    : null
})

// ============ 单用户当日明细弹窗 ============
const dayDialog = reactive({
  visible: false,
  loading: false,
  detail: null as StorageDailyUserDetail | null,
})

const openDayDialog = async (uid: string) => {
  dayDialog.visible = true
  dayDialog.loading = true
  dayDialog.detail = null
  try {
    dayDialog.detail = await fetchStorageDailyUserDetail(viewDate.value, uid)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '当日明细加载失败')
    dayDialog.visible = false
  } finally {
    dayDialog.loading = false
  }
}

const uploadStatusMeta = (status: string) => {
  switch (status) {
    case 'settled': return { label: '已结算', type: 'success' as const }
    case 'pending': return { label: '待结算', type: 'warning' as const }
    case 'rejected': return { label: '已拒绝', type: 'danger' as const }
    case 'expired': return { label: '已过期', type: 'info' as const }
    default: return { label: status, type: 'info' as const }
  }
}

const fileTypeMeta = (type: string) => {
  switch (type) {
    case 'music': return { label: '音乐', type: 'primary' as const }
    case 'ai_creation': return { label: 'AI 图片', type: 'success' as const }
    default: return { label: '购物清单图', type: 'warning' as const }
  }
}

onMounted(() => {
  load()
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

const isMobile = ref(false)
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 640
}
</script>

<template>
  <div v-loading="loading">
    <!-- 日期与搜索 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <el-date-picker
        :model-value="viewDate"
        type="date"
        value-format="YYYY-MM-DD"
        :clearable="false"
        :disabled-date="disabledFuture"
        class="!w-40"
        placeholder="选择日期"
        @update:model-value="selectDate"
      />
      <el-button size="small" @click="selectDate(todayStr())">今天</el-button>
      <el-button size="small" @click="selectDate(yesterdayStr())">昨天</el-button>

      <el-input
        v-model="keyword"
        placeholder="搜索邮箱 / 用户名 / UID"
        clearable
        class="!w-52 ml-auto"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 缺表提示：线上 D1 未跑齐迁移时对应来源按 0 跳过，而不是整页报错 -->
    <el-alert
      v-if="missingTables.length > 0"
      type="warning"
      :closable="false"
      class="mb-4 !rounded-xl"
      :title="`线上数据库缺表，已跳过对应来源：${missingTables.join('、')}（该来源当天用量按 0 计，请检查迁移是否已应用到 D1）`"
    />

    <!-- 近 N 天新增占用趋势（点击柱子切换日期） -->
    <el-card shadow="never" class="!rounded-xl mb-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium text-ink-900">近 {{ trend.length || 30 }} 天新增占用</span>
          <span class="text-[11px] text-ink-400">点击柱子查看当天明细（UTC+8）</span>
        </div>
      </template>
      <div v-if="trend.length > 0" class="flex h-24 items-end gap-[3px]">
        <button
          v-for="pt in trend"
          :key="pt.date"
          type="button"
          class="min-w-[5px] flex-1 rounded-t cursor-pointer transition-colors hover:opacity-80"
          :style="{
            height: `${pt.bytes > 0 ? Math.max(6, (pt.bytes / trendMax) * 100) : 3}%`,
            background: trendBarMeta(pt),
          }"
          :title="`${pt.date}：${formatBytes(pt.bytes)} / ${pt.files} 个文件 / ${pt.users} 人`"
          @click="selectDate(pt.date)"
        ></button>
      </div>
      <el-empty v-else description="暂无趋势数据" :image-size="60" />
      <div class="flex justify-between mt-1.5 text-[11px] text-ink-400 tabular-nums">
        <span>{{ trend[0]?.date }}</span>
        <span>{{ trend[trend.length - 1]?.date }}</span>
      </div>
    </el-card>

    <!-- 当日汇总卡 -->
    <div v-if="summary" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">{{ summary.date }} 新增占用</div>
        <div class="text-xl font-semibold text-accent-600 tabular-nums">{{ formatBytes(summary.totalBytes) }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">{{ summary.totalFiles }} 个文件（实扣口径）</div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">涉及用户</div>
        <div class="text-xl font-semibold text-ink-900 tabular-nums">{{ summary.users }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">当天有上传记录的用户数</div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">较前一日</div>
        <div class="text-xl font-semibold tabular-nums" :class="dayOverDay == null ? 'text-ink-400' : 'text-ink-900'">
          {{ dayOverDay == null ? '-' : (dayOverDay >= 0 ? '+' : '') + formatBytes(Math.abs(dayOverDay)) }}
        </div>
        <div class="text-[11px] text-ink-400 mt-0.5">当日新增占用与前一日之差</div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">当日来源构成</div>
        <div v-if="dayTotalBytes > 0" class="flex h-3 w-full overflow-hidden rounded-full bg-ink-100 mt-2">
          <div
            v-for="seg in daySegments.filter((s) => s.bytes > 0)"
            :key="seg.key"
            :style="{ width: `${segPercent(seg.bytes, dayTotalBytes)}%`, background: seg.color }"
            :title="`${seg.label} ${formatBytes(seg.bytes)}`"
          ></div>
        </div>
        <div v-else class="text-sm text-ink-400 mt-1.5">当天暂无上传</div>
        <div v-if="dayTotalBytes > 0" class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <span
            v-for="seg in daySegments.filter((s) => s.bytes > 0)"
            :key="seg.key"
            class="inline-flex items-center gap-1 text-[11px] text-ink-600"
          >
            <span class="w-2 h-2 rounded-sm" :style="{ background: seg.color }"></span>
            {{ seg.label }}
            <span class="tabular-nums text-ink-900 font-medium">{{ formatBytes(seg.bytes) }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 当日按用户用量列表 -->
    <el-card shadow="never" class="!rounded-xl storage-table-card">
      <el-table :data="list" stripe size="small" :empty-text="`${viewDate} 暂无存储使用记录`">
        <el-table-column label="用户" min-width="190">
          <template #default="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <img
                :src="row.avatar || defaultAvatar"
                :alt="row.username || row.email || ''"
                class="w-7 h-7 rounded-full object-cover border border-border-default bg-ink-50 shrink-0"
                loading="lazy"
                @error="onAvatarError"
              />
              <div class="flex min-w-0 flex-col gap-0 leading-tight">
                <span class="truncate text-ink-900" :title="row.email || '-'">{{ row.email || '-' }}</span>
                <div class="flex min-w-0 items-center gap-1">
                  <span class="truncate text-[11px] text-ink-500" :title="row.username || ''">{{ row.username || '-' }}</span>
                  <el-tag v-if="row.isAdmin" type="warning" effect="dark" size="small" class="!shrink-0">管理员</el-tag>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="当日新增" width="170">
          <template #default="{ row }">
            <div class="flex flex-col leading-tight">
              <span class="font-medium text-ink-900 tabular-nums">{{ formatBytes(row.totalBytes) }}</span>
              <span class="text-[11px] text-ink-400 tabular-nums">{{ row.totalFiles }} 个文件</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="来源构成" min-width="150">
          <template #default="{ row }">
            <el-popover
              placement="top-start"
              :width="260"
              trigger="hover"
              :show-after="120"
              :disabled="row.totalBytes <= 0"
            >
              <template #reference>
                <div class="flex h-3 w-full max-w-[130px] overflow-hidden rounded-full bg-ink-100 cursor-default">
                  <div
                    v-for="seg in rowSegments(row).filter((s) => s.bytes > 0)"
                    :key="seg.key"
                    :style="{ width: `${segPercent(seg.bytes, row.totalBytes)}%`, background: seg.color }"
                  ></div>
                </div>
              </template>
              <div class="text-xs font-medium text-ink-700 mb-2">来源拆解</div>
              <ul class="space-y-1.5">
                <li
                  v-for="seg in rowSegments(row)"
                  :key="seg.key"
                  class="flex items-center justify-between gap-2 text-xs"
                >
                  <span class="inline-flex items-center gap-1.5 text-ink-600">
                    <span class="w-2 h-2 rounded-sm" :style="{ background: seg.color }"></span>
                    {{ seg.label }}
                  </span>
                  <span class="tabular-nums text-ink-900">
                    {{ formatBytes(seg.bytes) }}
                    <span v-if="seg.count > 0" class="text-ink-400">/ {{ seg.count }} 个</span>
                  </span>
                </li>
              </ul>
            </el-popover>
          </template>
        </el-table-column>

        <el-table-column label="最后活动" width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-700 tabular-nums">{{ formatTime(row.lastAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="88" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openDayDialog(row.uid)">当日明细</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div :class="isMobile ? 'flex justify-center mt-4 overflow-x-auto py-1' : 'flex justify-end mt-4'">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :page-count="pagination.totalPages"
          :layout="isMobile ? 'prev, pager, next' : 'total, prev, pager, next, jumper'"
          :pager-count="isMobile ? 5 : 7"
          :small="isMobile"
          :background="true"
          @current-change="handlePageChange"
        />
      </div>

      <div class="text-[11px] text-ink-400 mt-2">
        口径：按上传时间（UTC+8）归天，统计音乐 / AI 创作图 / 子站上传（已结算）/ 购物清单图片（已确认）；
        生成图持久化等其他类不落文件表，无法按天归集；文件被删除后当日记录随之消失（不含删除回退）。
      </div>
    </el-card>

    <!-- 单用户当日明细弹窗 -->
    <el-dialog
      v-model="dayDialog.visible"
      :title="`当日明细 · ${viewDate}`"
      :width="isMobile ? '94vw' : '760px'"
      :close-on-click-modal="true"
      top="8vh"
    >
      <div v-loading="dayDialog.loading" class="min-h-[160px]">
        <template v-if="dayDialog.detail">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500 mb-3">
            <span class="inline-flex items-center gap-1.5">
              <img
                :src="dayDialog.detail.user.avatar || defaultAvatar"
                class="w-5 h-5 rounded-full object-cover border border-border-default bg-ink-50"
                @error="onAvatarError"
              />
              <span class="text-ink-800">{{ dayDialog.detail.user.username || dayDialog.detail.user.email || '-' }}</span>
              <span v-if="dayDialog.detail.user.email">（{{ dayDialog.detail.user.email }}）</span>
            </span>
            <span>
              当日新增：
              <span class="font-medium text-ink-900 tabular-nums">{{ formatBytes(dayDialog.detail.summary.totalBytes) }}</span>
              <span class="text-ink-400"> / {{ dayDialog.detail.summary.totalFiles }} 个文件</span>
            </span>
          </div>

          <!-- 当日来源 chips -->
          <div v-if="dayDialog.detail.summary.totalBytes > 0" class="flex flex-wrap gap-2 mb-3">
            <span
              v-for="seg in buildSegments(dayDialog.detail.summary.sources).filter((s) => s.bytes > 0)"
              :key="seg.key"
              class="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-surface-0 px-2 py-1 text-xs text-ink-600"
            >
              <span class="w-2 h-2 rounded-sm" :style="{ background: seg.color }"></span>
              {{ seg.label }}
              <span class="tabular-nums text-ink-900 font-medium">{{ formatBytes(seg.bytes) }}</span>
              <span class="text-ink-400">{{ seg.count }} 个</span>
            </span>
          </div>

          <el-tabs type="border-card" class="storage-detail-tabs">
            <el-tab-pane :label="`文件明细${dayDialog.detail.files.length ? `（${dayDialog.detail.files.length}）` : ''}`">
              <el-table
                :data="dayDialog.detail.files"
                stripe
                size="small"
                max-height="360"
                empty-text="当天暂无音乐 / AI 图 / 购物清单图片记录"
              >
                <el-table-column label="类型" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="fileTypeMeta(row.type).type" size="small" effect="plain">
                      {{ fileTypeMeta(row.type).label }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名" min-width="220">
                  <template #default="{ row }">
                    <span class="block truncate text-xs text-ink-800" :title="row.name">{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="大小" width="100" align="right">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-700">{{ row.bytes > 0 ? formatBytes(row.bytes) : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="150">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-500">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane :label="`子站上传${dayDialog.detail.uploads.length ? `（${dayDialog.detail.uploads.length}）` : ''}`">
              <el-table
                :data="dayDialog.detail.uploads"
                stripe
                size="small"
                max-height="360"
                empty-text="当天暂无子站上传记录"
              >
                <el-table-column label="状态" width="84" align="center">
                  <template #default="{ row }">
                    <el-tag :type="uploadStatusMeta(row.status).type" size="small" effect="plain">
                      {{ uploadStatusMeta(row.status).label }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名" min-width="170">
                  <template #default="{ row }">
                    <span class="block truncate text-xs text-ink-800" :title="`${row.filename}（${row.contentType}）`">{{ row.filename }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="子站应用" width="120">
                  <template #default="{ row }">
                    <span class="block truncate text-xs text-ink-600" :title="row.clientId">
                      {{ row.clientName || row.clientId.slice(0, 8) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="声明 / 实际" width="130" align="right">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-700">
                      {{ formatBytes(row.declaredBytes) }}
                      <template v-if="row.actualBytes != null">
                        <span class="text-ink-400"> / </span>{{ formatBytes(row.actualBytes) }}
                      </template>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="发起时间" width="150">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-500">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="text-[11px] text-ink-400 mt-2">
                仅「已结算」计入当日新增汇总；待结算 / 过期记录一并列出便于观察队列状态。
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>

      <template #footer>
        <el-button @click="dayDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.storage-table-card :deep(.el-card__body) {
  padding: 12px;
}

.storage-table-card :deep(.el-table__cell) {
  padding: 6px 0;
}

.storage-table-card :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
}

.storage-detail-tabs :deep(.el-tabs__content) {
  padding: 8px 0 0;
}
</style>
