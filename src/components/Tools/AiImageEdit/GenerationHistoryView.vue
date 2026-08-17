<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMyGenerationRecords, fetchMyGenerationRecordImage } from '@/api/me'
import type { GenerationRecord } from '@/types/admin'
import { autoDown } from '@/utils/file'

// 父组件（/ai-image-edit/ 桌面端弹窗、手机端独立页）传入的图片预览接管函数：
// dialog 场景下父组件把 <el-image-viewer> 渲染在 AiImageEdit.vue 根级，避开 dialog 栈上下文，
// 这样无论怎么点图都不会被 dialog 盖住。
const props = defineProps<{
  onPreview?: (url: string) => void
}>()

// 兜底：父组件没传 onPreview（如测试场景）就退回到本组件内的 el-image-viewer
const fallbackPreviewUrl = ref<string | null>(null)

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// 从当前路由自动 derive tool 来源（/ai-outfit -> '/ai-outfit/'，/ai-image-edit -> '/ai-image-edit/'）
// Dialog 在 /ai-outfit 时打开 → 自动只看 outfit 记录；Page 在 /ai-image-edit/history 或 /ai-outfit/history 时同样适用。
const route = useRoute()
function deriveSource(): string {
  const path = route.path || ''
  if (path.startsWith('/ai-outfit')) return '/ai-outfit/'
  if (path.startsWith('/ai-image-edit')) return '/ai-image-edit/'
  return ''
}
const source = deriveSource()

const loading = ref(false)
const list = ref<GenerationRecord[]>([])
const pagination = ref<Pagination>({
  total: 0, page: 1, pageSize: 10, totalPages: 0, hasNext: false, hasPrev: false,
})

// 响应式：< 640px 视为手机端
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

const filter = ref({
  keyword: '',
  status: '' as '' | 'in_progress' | 'success' | 'failed' | 'timeout' | 'reversed',
})

// 实时耗时（仅 in_progress 行）
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const startTick = () => {
  if (tickTimer) return
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
}
const stopTick = () => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchMyGenerationRecords(
      pagination.value.page,
      pagination.value.pageSize,
      filter.value.status,
      filter.value.keyword,
      source,
    )
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

defineExpose({ load })

const handleSearch = () => {
  pagination.value.page = 1
  load()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  load()
}

// 直接跳到首页 / 末页。
// el-pagination 默认只显示当前 ±3 的页码 + 折叠点，总页数多时看不到首页按钮；
// 单独提供这两个按钮让用户在任意页都能一键回到首页/末页（手机端尤其需要）。
const goFirstPage = () => {
  if (pagination.value.page === 1) return
  pagination.value.page = 1
  load()
}
const goLastPage = () => {
  const last = pagination.value.totalPages
  if (!last || pagination.value.page === last) return
  pagination.value.page = last
  load()
}

// 分页 layout：手机端去掉 jumper（输入框太挤）和 total（节省空间），只保留 prev/pager/next；
// 桌面端保持完整 layout 含 jumper 和 total。
const paginationLayout = computed(() => isMobile.value
  ? 'prev, pager, next'
  : 'total, prev, pager, next, jumper')

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  load()
  startTick()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  stopTick()
})

// ============ 格式化 ============
const createdAtMs = (s: string) => {
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T') + 'Z').getTime()
  return Number.isNaN(t) ? 0 : t
}

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const formatDuration = (ms: number | null) => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const liveDuration = (rec: GenerationRecord): number | null => {
  if (rec.status !== 'in_progress') return null
  const start = createdAtMs(rec.created_at)
  if (!start) return null
  return Math.max(0, nowTick.value - start)
}

const modeLabel = (m: string | null) => {
  if (!m) return '-'
  if (m === 'text-to-image') return '文生图'
  if (m === 'image-to-image') return '图生图'
  return m
}

const statusTagType = (s: string) => {
  switch (s) {
    case 'success': return 'success'
    case 'failed': return 'danger'
    case 'timeout': return 'warning'
    case 'reversed': return 'info'
    case 'in_progress': return 'primary'
    default: return 'info'
  }
}

const statusLabel = (s: string) => {
  switch (s) {
    case 'in_progress': return '处理中'
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'timeout': return '超时'
    case 'reversed': return '已退还'
    default: return s
  }
}

const getPrompt = (rec: GenerationRecord): string => {
  return (rec.raw_data_parsed as any)?.prompt || ''
}

const downloadResult = async (id: string, fallbackUrl: string | null) => {
  try {
    const { blob, filename } = await fetchMyGenerationRecordImage(id)
    const objUrl = URL.createObjectURL(blob)
    autoDown(objUrl, filename)
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
  } catch {
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    }
  }
}

// 缩略图点击：优先把 url 抛给父组件（弹窗场景下父级用根级 el-image-viewer 接管预览），
// 没传回调时退回到本组件兜底的 el-image-viewer。
const handleThumbClick = (row: GenerationRecord) => {
  if (!row.result_url) return
  if (props.onPreview) {
    props.onPreview(row.result_url)
  } else {
    fallbackPreviewUrl.value = row.result_url
  }
}
</script>

<template>
  <!-- 过滤栏 -->
  <div class="flex flex-wrap items-end gap-3 mb-3">
    <el-input
      v-model="filter.keyword"
      placeholder="搜索提示词 / 模型 / 错误信息"
      clearable
      class="!w-64"
      @keyup.enter="handleSearch"
      @clear="handleSearch"
    >
      <template #append>
        <el-button @click="handleSearch">搜索</el-button>
      </template>
    </el-input>
    <el-select
      v-model="filter.status"
      placeholder="状态"
      clearable
      class="!w-32"
      @change="handleSearch"
    >
      <el-option label="全部" value="" />
      <el-option label="处理中" value="in_progress" />
      <el-option label="成功" value="success" />
      <el-option label="失败" value="failed" />
      <el-option label="超时" value="timeout" />
      <el-option label="已退还" value="reversed" />
    </el-select>
    <el-button @click="load">刷新</el-button>
  </div>

  <!-- 表格 -->
  <el-table v-loading="loading" :data="list" stripe size="default">
    <el-table-column label="结果" width="80">
      <template #default="{ row }">
        <el-image
          v-if="row.result_url"
          :src="row.result_url"
          fit="cover"
          class="w-12 h-12 rounded cursor-zoom-in"
          alt="缩略图"
          @click="handleThumbClick(row)"
        />
        <span v-else class="text-xs text-ink-400">-</span>
      </template>
    </el-table-column>
    <el-table-column label="时间" min-width="150">
      <template #default="{ row }">
        <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
      </template>
    </el-table-column>
    <el-table-column v-if="!isMobile" label="模式" width="90">
      <template #default="{ row }">
        <span class="text-ink-700">{{ modeLabel(row.mode) }}</span>
      </template>
    </el-table-column>
    <el-table-column v-if="!isMobile" label="模型" min-width="120">
      <template #default="{ row }">
        <span class="text-ink-700">{{ row.model || '-' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="90">
      <template #default="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain" size="small">
          {{ statusLabel(row.status) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column v-if="!isMobile" label="积分" width="70" align="right" prop="cost" />
    <el-table-column v-if="!isMobile" label="耗时" min-width="100">
      <template #default="{ row }">
        <span
          class="text-xs"
          :class="liveDuration(row) != null ? 'text-blue-600 font-medium' : 'text-ink-700'"
        >
          <span
            v-if="liveDuration(row) != null"
            class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse"
            aria-hidden="true"
          />
          {{ liveDuration(row) != null ? `实时 ${formatDuration(liveDuration(row))}` : formatDuration(row.duration_ms) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="提示词" min-width="160">
      <template #default="{ row }">
        <el-tooltip
          v-if="getPrompt(row)"
          :content="getPrompt(row)"
          placement="top"
          :show-after="300"
        >
          <span
            class="text-xs text-ink-700 truncate inline-block align-middle"
            :class="isMobile ? 'max-w-[120px]' : 'max-w-[200px]'"
          >
            {{ getPrompt(row) }}
          </span>
        </el-tooltip>
        <span v-else class="text-xs text-ink-400">-</span>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="100" fixed="right">
      <template #default="{ row }">
        <el-button
          v-if="row.result_url"
          type="primary"
          link
          size="small"
          @click="downloadResult(row.id, row.result_url)"
        >
          下载
        </el-button>
        <span v-else-if="row.error_message" class="text-xs text-danger-600" :title="row.error_message">
          {{ row.error_message.slice(0, 12) }}{{ row.error_message.length > 12 ? '…' : '' }}
        </span>
      </template>
    </el-table-column>
  </el-table>

  <!-- 空状态 -->
  <div
    v-if="!loading && list.length === 0"
    class="py-10 text-center text-ink-400 text-sm"
  >
    还没有生成记录，去试试看吧 →
  </div>

  <!-- 分页 -->
  <div
    v-if="list.length > 0"
    class="pagination-wrapper mt-4"
    :class="{ 'pagination-mobile': isMobile }"
  >
    <!-- 桌面端：单行展示（首页 · el-pagination · 末页） -->
    <template v-if="!isMobile">
      <button
        type="button"
        class="pagination-edge-btn"
        :disabled="pagination.page <= 1"
        @click="goFirstPage"
        aria-label="跳到首页"
      >首页</button>
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-count="pagination.totalPages"
        :layout="paginationLayout"
        :background="true"
        @current-change="handlePageChange"
      />
      <button
        type="button"
        class="pagination-edge-btn"
        :disabled="pagination.page >= pagination.totalPages"
        @click="goLastPage"
        aria-label="跳到末页"
      >末页</button>
    </template>

    <!-- 手机端：上下两行布局
         第 1 行：页码 pager（独占一行，永远不会被挤压）
         第 2 行：首页 · 上一页 · 下一页 · 末页 -->
    <template v-else>
      <el-pagination
        class="mobile-pager"
        :current-page="pagination.page"
        :page-count="pagination.totalPages"
        :pager-count="5"
        layout="pager"
        :small="true"
        :background="true"
        @current-change="handlePageChange"
      />
      <div class="mobile-nav-row">
        <button
          type="button"
          class="pagination-edge-btn"
          :disabled="pagination.page <= 1"
          @click="goFirstPage"
          aria-label="跳到首页"
        >首页</button>
        <el-pagination
          class="mobile-prev-next"
          :current-page="pagination.page"
          :page-count="pagination.totalPages"
          layout="prev, next"
          :small="true"
          :background="true"
          @current-change="handlePageChange"
        />
        <button
          type="button"
          class="pagination-edge-btn"
          :disabled="pagination.page >= pagination.totalPages"
          @click="goLastPage"
          aria-label="跳到末页"
        >末页</button>
      </div>
    </template>
  </div>

  <!--
    兜底预览：当父组件没传 onPreview 时使用本组件内的 el-image-viewer
    父组件接管后这里 v-if 永远不会触发，不影响 DOM 结构。
  -->
  <el-image-viewer
    v-if="!onPreview && fallbackPreviewUrl"
    :url-list="[fallbackPreviewUrl]"
    :initial-index="0"
    teleported
    :z-index="9999"
    @close="fallbackPreviewUrl = null"
  />
</template>

<style scoped>
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.pagination-mobile {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
}
/* 手机端：第 1 行 pager 占满宽度 */
.pagination-mobile :deep(.mobile-pager) {
  display: flex;
  justify-content: center;
}
.pagination-mobile :deep(.mobile-pager .el-pagination) {
  flex-wrap: wrap;
  justify-content: center;
}
/* 手机端：第 2 行导航按钮 + 上下页 */
.pagination-mobile .mobile-nav-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.pagination-mobile :deep(.mobile-prev-next) {
  display: inline-flex;
}
.pagination-mobile :deep(.mobile-prev-next .el-pagination) {
  display: inline-flex;
}
/* 首页/末页 跳转按钮（桌面端样式）*/
.pagination-edge-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  margin: 0 4px;
  border: 1px solid #d4d4d8;
  border-radius: 4px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease, background-color .15s ease;
  white-space: nowrap;
}
.pagination-edge-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}
.pagination-edge-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  background: #f9fafb;
}
/* 手机端更紧凑 */
.pagination-mobile .pagination-edge-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  margin: 0;
}
</style>