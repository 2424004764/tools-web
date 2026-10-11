<script setup lang="ts">
// Admin 存储空间使用明细页
// 上：全站汇总卡（总额度 / 已用 / 可用 / 预留中）+ 全站来源构成条
// 中：按用户用表明细（已用 / 额度进度条 + 来源拆解悬浮），按已用降序分页
// 弹窗：单用户明细（来源构成 / 最近文件 / 子站上传记录）
// 入口：侧栏「存储明细」；用户管理「已用 / 可用存储」列点击深链 /admin/storage?uid=xxx
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchStorageUsage,
  fetchStorageUserDetail,
  type StorageSummary,
  type StorageUsageRow,
  type StorageUserDetail,
  type StorageSourceStat,
  type SubsiteUploadRecord,
} from '@/api/admin/storage'
import { clearUserStorageReservations } from '@/api/admin/user'
import { formatStorageBytes } from '@/api/storageQuota'
import defaultAvatar from '@/assets/default_avatar.png'
import type { AdminPagination } from '@/types/admin'

const route = useRoute()

const loading = ref(false)
const summary = ref<StorageSummary | null>(null)
const list = ref<StorageUsageRow[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

const filter = reactive({
  keyword: '',
})

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z'))
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const formatBytes = (bytes: number) => formatStorageBytes(bytes || 0)

// 头像加载失败回落默认头像（与用户管理同策略）
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
    const result = await fetchStorageUsage({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
    })
    summary.value = result.summary
    list.value = result.list
    pagination.value = result.pagination
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '存储明细加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  load()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  load()
}

// ============ 来源构成 ============
// 段顺序与配色固定，列表内迷你条与全站汇总条共用一套视觉
interface SourceSegment {
  key: 'music' | 'aiCreation' | 'subsite' | 'other'
  label: string
  color: string
  bytes: number
  count: number
}

const SOURCE_META: Record<SourceSegment['key'], { label: string; color: string }> = {
  music: { label: '音乐文件', color: '#409eff' },
  aiCreation: { label: 'AI 创作图片', color: '#a855f7' },
  subsite: { label: '子站上传', color: '#10b981' },
  other: { label: '其他（生成图持久化等）', color: '#94a3b8' },
}

const buildSegments = (sources: {
  music: StorageSourceStat
  aiCreation: StorageSourceStat
  subsite: StorageSourceStat
  other: StorageSourceStat
}): SourceSegment[] =>
  (Object.keys(SOURCE_META) as SourceSegment['key'][]).map((key) => ({
    key,
    label: SOURCE_META[key].label,
    color: SOURCE_META[key].color,
    bytes: sources[key]?.bytes || 0,
    count: sources[key]?.count || 0,
  }))

// 全站来源段：other = 已用 - 三大可归集来源（可能与列表口径的逐行 other 略有出入，均为兜底值）
const globalSegments = computed<SourceSegment[]>(() => {
  const s = summary.value
  if (!s) return []
  const identified = s.sources.music.bytes + s.sources.aiCreation.bytes + s.sources.subsite.bytes
  return buildSegments({
    music: s.sources.music,
    aiCreation: s.sources.aiCreation,
    subsite: s.sources.subsite,
    other: { count: 0, bytes: Math.max(0, s.usedBytes - identified) },
  })
})

const totalIdentifiedBytes = computed(() =>
  globalSegments.value.reduce((sum, seg) => sum + seg.bytes, 0),
)

// 段宽百分比：以各段合计为分母（比以 used_bytes 为分母更能看出相对构成）
const segPercent = (bytes: number, total: number) =>
  total > 0 ? Math.max(0, (bytes / total) * 100) : 0

const rowSegments = (row: StorageUsageRow) => buildSegments(row.sources)

const usagePercent = (row: StorageUsageRow) => {
  if (row.quotaBytes <= 0) return row.usedBytes > 0 ? 100 : 0
  return Math.min(100, (row.usedBytes / row.quotaBytes) * 100)
}

// 弹窗内来源占比（以该用户已用为分母）；无用量时返回 null 显示 '-'
const sourcePercent = (bytes: number): string | null => {
  const d = detailDialog.detail
  if (!d || d.quota.usedBytes <= 0 || bytes <= 0) return null
  return `${((bytes / d.quota.usedBytes) * 100).toFixed(1)}%`
}

// ============ 清理上传预留（预扣挂账修复） ============
const clearingReservations = ref(false)

const handleClearReservations = async () => {
  const d = detailDialog.detail
  if (!d || d.quota.pendingBytes <= 0) return
  try {
    await ElMessageBox.confirm(
      `将删除该用户名下【全部】上传预留（当前预扣 ${formatBytes(d.quota.pendingBytes)}，${d.reservations.length} 笔）。\n\n删除后预扣占用的额度立即释放；若恰有上传正在途，该次上传仍会正常实扣，仅短暂绕过预扣闸门。`,
      '⚠️ 清理上传预留',
      { type: 'warning', confirmButtonText: '确认清理', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  clearingReservations.value = true
  try {
    const r = await clearUserStorageReservations(d.user.uid)
    ElMessage.success(
      r.deleted > 0
        ? `已清理 ${r.deleted} 笔预留，释放 ${formatBytes(r.bytesBefore)}`
        : r.message || '没有需要清理的预留',
    )
    // 重新拉取明细，刷新预留卡与列表
    await openDetailDialog(d.user.uid)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '清理失败')
  } finally {
    clearingReservations.value = false
  }
}

// ============ 单用户明细弹窗 ============
const detailDialog = reactive({
  visible: false,
  loading: false,
  detail: null as StorageUserDetail | null,
})

const openDetailDialog = async (uid: string) => {
  detailDialog.visible = true
  detailDialog.loading = true
  detailDialog.detail = null
  try {
    detailDialog.detail = await fetchStorageUserDetail(uid)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '用户存储明细加载失败')
    detailDialog.visible = false
  } finally {
    detailDialog.loading = false
  }
}

const uploadStatusMeta = (status: SubsiteUploadRecord['status']) => {
  switch (status) {
    case 'settled': return { label: '已结算', type: 'success' as const }
    case 'pending': return { label: '待结算', type: 'warning' as const }
    case 'rejected': return { label: '已拒绝', type: 'danger' as const }
    case 'expired': return { label: '已过期', type: 'info' as const }
    default: return { label: status, type: 'info' as const }
  }
}

const fileTypeMeta = (type: string) =>
  type === 'music'
    ? { label: '音乐', type: 'primary' as const }
    : { label: 'AI 图片', type: 'success' as const }

const copyUid = (uid: string) => {
  navigator.clipboard?.writeText(uid).then(
    () => ElMessage.success('UID 已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

// 深链：/admin/storage?uid=xxx 直接打开该用户明细弹窗
const deepLinkUid = String(route.query.uid || '').trim()
if (deepLinkUid) {
  openDetailDialog(deepLinkUid)
}

onMounted(() => {
  load()
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

// 移动端检测（< 640px）：弹窗宽度自适应
const isMobile = ref(false)
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 640
}
</script>

<template>
  <div v-loading="loading" class="mx-auto max-w-[1400px]">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">存储空间使用明细</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索邮箱 / 用户名 / UID"
        clearable
        class="!w-56"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 全站汇总卡 -->
    <div v-if="summary" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">总额度</div>
        <div class="text-xl font-semibold text-ink-900 tabular-nums">{{ formatBytes(summary.quotaBytes) }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">{{ summary.users }} 个用户产生过上传</div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">已用</div>
        <div class="text-xl font-semibold text-accent-600 tabular-nums">{{ formatBytes(summary.usedBytes) }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">
          占总额度 {{ summary.quotaBytes > 0 ? ((summary.usedBytes / summary.quotaBytes) * 100).toFixed(1) : '0' }}%
        </div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">可用（扣除预留）</div>
        <div class="text-xl font-semibold text-emerald-600 tabular-nums">{{ formatBytes(summary.availableBytes) }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">额度 - 已用 - 预留中</div>
      </div>
      <div class="rounded-xl border border-border-default bg-surface-0 px-4 py-3">
        <div class="text-xs text-ink-400 mb-1">预留中</div>
        <div class="text-xl font-semibold text-amber-500 tabular-nums">{{ formatBytes(summary.pendingBytes) }}</div>
        <div class="text-[11px] text-ink-400 mt-0.5">已签名未结算的上传预留（1 小时后自动失效）</div>
      </div>
    </div>

    <!-- 全站来源构成 -->
    <el-card shadow="never" class="!rounded-xl mb-4">
      <template #header>
        <span class="font-medium text-ink-900">全站来源构成</span>
      </template>
      <template v-if="summary && totalIdentifiedBytes > 0">
        <div class="flex h-4 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            v-for="seg in globalSegments"
            :key="seg.key"
            :style="{ width: `${segPercent(seg.bytes, totalIdentifiedBytes)}%`, background: seg.color }"
            :title="`${seg.label} ${formatBytes(seg.bytes)}`"
          ></div>
        </div>
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          <span
            v-for="seg in globalSegments"
            :key="seg.key"
            class="inline-flex items-center gap-1.5 text-xs text-ink-600"
          >
            <span class="w-2.5 h-2.5 rounded-sm" :style="{ background: seg.color }"></span>
            {{ seg.label }}
            <span class="tabular-nums text-ink-900 font-medium">{{ formatBytes(seg.bytes) }}</span>
            <span v-if="seg.count > 0" class="text-ink-400">{{ seg.count }} 个文件</span>
            <span class="text-ink-400">（{{ segPercent(seg.bytes, totalIdentifiedBytes).toFixed(1) }}%）</span>
          </span>
        </div>
      </template>
      <el-empty v-else description="暂无存储使用记录" :image-size="60" />
    </el-card>

    <!-- 按用户用量列表 -->
    <el-card shadow="never" class="!rounded-xl storage-table-card">
      <el-table :data="list" stripe size="small" empty-text="暂无数据">
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

        <el-table-column label="已用 / 额度" width="200">
          <template #default="{ row }">
            <div class="flex flex-col gap-1 leading-tight">
              <span class="text-xs text-ink-700 tabular-nums">
                <span class="font-medium text-ink-900">{{ formatBytes(row.usedBytes) }}</span>
                <span class="text-ink-400"> / {{ formatBytes(row.quotaBytes) }}</span>
              </span>
              <el-progress
                :percentage="usagePercent(row)"
                :stroke-width="5"
                :show-text="false"
                :color="usagePercent(row) >= 90 ? '#f56c6c' : undefined"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="可用" width="90" align="right">
          <template #default="{ row }">
            <span class="text-xs text-ink-700 tabular-nums">{{ formatBytes(row.availableBytes) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="预留中" width="96" align="right">
          <template #default="{ row }">
            <span
              v-if="row.pendingBytes > 0"
              class="text-xs text-warning-600 tabular-nums"
              :title="`${row.pendingCount} 笔有效预扣；长期不消说明结算链路异常，进「明细」可一键清理`"
            >
              ⚠ {{ formatBytes(row.pendingBytes) }}
            </span>
            <span v-else class="text-xs text-ink-400">-</span>
          </template>
        </el-table-column>

        <el-table-column label="来源构成" min-width="150">
          <template #default="{ row }">
            <el-popover
              placement="top-start"
              :width="260"
              trigger="hover"
              :show-after="120"
              :disabled="row.usedBytes <= 0"
            >
              <template #reference>
                <div class="flex h-3 w-full max-w-[130px] overflow-hidden rounded-full bg-ink-100 cursor-default">
                  <div
                    v-for="seg in rowSegments(row).filter((s) => s.bytes > 0)"
                    :key="seg.key"
                    :style="{ width: `${segPercent(seg.bytes, row.usedBytes)}%`, background: seg.color }"
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

        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-700 tabular-nums">{{ formatTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="72" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openDetailDialog(row.uid)">明细</el-button>
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
    </el-card>

    <!-- 单用户存储明细弹窗 -->
    <el-dialog
      v-model="detailDialog.visible"
      :title="`存储明细 - ${detailDialog.detail?.user.username || detailDialog.detail?.user.email || ''}`"
      :width="isMobile ? '94vw' : '860px'"
      :close-on-click-modal="true"
      top="6vh"
    >
      <div v-loading="detailDialog.loading" class="min-h-[200px]">
        <template v-if="detailDialog.detail">
          <!-- 额度概况 -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            <div class="rounded-lg border border-border-default bg-surface-0 px-3 py-2">
              <div class="text-[11px] text-ink-400">总额度</div>
              <div class="text-base font-semibold text-ink-900 tabular-nums">{{ formatBytes(detailDialog.detail.quota.quotaBytes) }}</div>
            </div>
            <div class="rounded-lg border border-border-default bg-surface-0 px-3 py-2">
              <div class="text-[11px] text-ink-400">已用</div>
              <div class="text-base font-semibold text-accent-600 tabular-nums">{{ formatBytes(detailDialog.detail.quota.usedBytes) }}</div>
            </div>
            <div class="rounded-lg border border-border-default bg-surface-0 px-3 py-2">
              <div class="text-[11px] text-ink-400">可用</div>
              <div class="text-base font-semibold text-emerald-600 tabular-nums">{{ formatBytes(detailDialog.detail.quota.availableBytes) }}</div>
            </div>
            <div class="rounded-lg border border-border-default bg-surface-0 px-3 py-2">
              <div class="text-[11px] text-ink-400">预留中</div>
              <div class="flex items-center justify-between gap-1">
                <span
                  class="text-base font-semibold tabular-nums"
                  :class="detailDialog.detail.quota.pendingBytes > 0 ? 'text-warning-600' : 'text-amber-500'"
                >{{ formatBytes(detailDialog.detail.quota.pendingBytes) }}</span>
                <el-button
                  v-if="detailDialog.detail.quota.pendingBytes > 0"
                  link
                  size="small"
                  type="danger"
                  :loading="clearingReservations"
                  @click="handleClearReservations"
                >清理</el-button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500 mb-4">
            <span>
              邮箱：<span class="text-ink-800">{{ detailDialog.detail.user.email || '-' }}</span>
            </span>
            <span class="inline-flex items-center gap-1">
              UID：<code class="text-ink-600">{{ detailDialog.detail.user.uid.slice(0, 12) }}…</code>
              <el-button link size="small" class="!p-0" @click="copyUid(detailDialog.detail.user.uid)">复制</el-button>
            </span>
            <span>更新：{{ formatTime(detailDialog.detail.quota.updatedAt) }}</span>
            <el-tag v-if="!detailDialog.detail.quota.exists" type="info" effect="plain" size="small">无额度记录（从未上传）</el-tag>
          </div>

          <!-- 来源构成 -->
          <div class="text-sm font-medium text-ink-900 mb-2">来源构成</div>
          <el-table
            :data="Object.entries(detailDialog.detail.sources).map(([key, stat]) => ({ key, ...stat }))"
            size="small"
            class="mb-4"
            :empty-text="'暂无记录'"
          >
            <el-table-column label="来源" min-width="160">
              <template #default="{ row }">
                <span class="inline-flex items-center gap-1.5 text-ink-700 text-xs">
                  <span class="w-2 h-2 rounded-sm" :style="{ background: SOURCE_META[row.key as keyof typeof SOURCE_META]?.color }"></span>
                  {{ SOURCE_META[row.key as keyof typeof SOURCE_META]?.label || row.key }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="文件数" width="90" align="right">
              <template #default="{ row }">
                <span class="text-xs tabular-nums text-ink-700">{{ row.count > 0 ? row.count : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="占用" width="110" align="right">
              <template #default="{ row }">
                <span class="text-xs tabular-nums text-ink-900">{{ formatBytes(row.bytes) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="占比" width="110" align="right">
              <template #default="{ row }">
                <span class="text-xs tabular-nums text-ink-500">{{ sourcePercent(row.bytes) ?? '-' }}</span>
              </template>
            </el-table-column>
          </el-table>

          <!-- 最近文件 / 子站上传记录 -->
          <el-tabs type="border-card" class="storage-detail-tabs">
            <el-tab-pane label="最近文件">
              <el-table
                :data="detailDialog.detail.files"
                stripe
                size="small"
                max-height="320"
                :empty-text="'暂无音乐 / AI 创作文件记录'"
              >
                <el-table-column label="类型" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="fileTypeMeta(row.type).type" size="small" effect="plain">
                      {{ fileTypeMeta(row.type).label }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="文件名" min-width="200">
                  <template #default="{ row }">
                    <span class="block truncate text-xs text-ink-800" :title="row.name">{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="大小" width="100" align="right">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-700">{{ row.bytes > 0 ? formatBytes(row.bytes) : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="创建时间" width="150">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-500">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane :label="`上传预留${detailDialog.detail.reservations.length ? `（${detailDialog.detail.reservations.length}）` : ''}`">
              <div class="flex flex-wrap items-center justify-between gap-2 px-2 mb-2">
                <span class="text-xs text-ink-500">
                  预扣 1 小时未结算即自动失效、不占可用额度；长期不消说明结算链路异常，可点「预留中」卡片的清理按钮一键释放。
                </span>
              </div>
              <el-table
                :data="detailDialog.detail.reservations"
                stripe
                size="small"
                max-height="320"
                :empty-text="'暂无有效上传预留'"
              >
                <el-table-column label="预留 ID" width="130">
                  <template #default="{ row }">
                    <code class="text-xs text-ink-600" :title="row.id">{{ row.id.slice(0, 8) }}…</code>
                  </template>
                </el-table-column>
                <el-table-column label="预扣大小" width="110" align="right">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-800">{{ formatBytes(row.bytes) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="发起时间" min-width="150">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-500">{{ formatTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane :label="`子站上传记录${detailDialog.detail.uploads.length ? `（${detailDialog.detail.uploads.length}）` : ''}`">
              <el-table
                :data="detailDialog.detail.uploads"
                stripe
                size="small"
                max-height="320"
                :empty-text="'暂无子站上传记录'"
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
                <el-table-column label="结算时间" width="150">
                  <template #default="{ row }">
                    <span class="text-xs tabular-nums text-ink-500">{{ formatTime(row.settledAt) }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <div class="text-[11px] text-ink-400 mt-2">
                待结算 = 凭证已下发但队列尚未回报实扣；超过 48 小时仍待结算会被定时任务标记为已过期。
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>

      <template #footer>
        <el-button @click="detailDialog.visible = false">关闭</el-button>
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

/* border-card 标签页去掉默认外边距与边框圆角冲突 */
.storage-detail-tabs :deep(.el-tabs__content) {
  padding: 8px 0 0;
}
</style>
