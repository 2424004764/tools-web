<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { fetchMyGenerationRecords } from '@/api/me'
import type { GenerationRecord } from '@/types/admin'
import { autoDown } from '@/utils/file'

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const visible = ref(false)
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

const filter = reactive({
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
      filter.status,
      filter.keyword,
    )
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const open = () => {
  visible.value = true
  pagination.value.page = 1
  load()
  startTick()
}

defineExpose({ open })

const handleSearch = () => {
  pagination.value.page = 1
  load()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  load()
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  // 弹窗按需加载，onMounted 不主动拉数据
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

const downloadResult = async (url: string) => {
  try {
    const r = await fetch(url)
    const blob = await r.blob()
    const objUrl = URL.createObjectURL(blob)
    autoDown(objUrl, `ai-image-${Date.now()}.png`)
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="我的生成历史"
    :width="isMobile ? '95vw' : '880px'"
    :fullscreen="isMobile"
    :close-on-click-modal="false"
    @close="stopTick"
  >
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
            :preview-src-list="[row.result_url]"
            :initial-index="0"
            fit="cover"
            class="w-12 h-12 rounded cursor-zoom-in"
            alt="缩略图"
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
            @click="downloadResult(row.result_url)"
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
    <div v-if="list.length > 0" class="flex justify-end mt-4">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-count="pagination.totalPages"
        layout="total, prev, pager, next, jumper"
        :background="true"
        @current-change="handlePageChange"
      />
    </div>
  </el-dialog>
</template>