<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchGenerationRecords, cleanupStuckGenerationRecords } from '@/api/admin/generation-record'
import type { GenerationRecord, AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<GenerationRecord[]>([])
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
  status: '' as '' | 'success' | 'failed' | 'timeout' | 'reversed',
  source: '',
})

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'in_progress', label: '处理中' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'timeout', label: '超时' },
  { value: 'reversed', label: '已退还' },
]

const sourceOptions = [
  { value: '', label: '全部' },
  { value: '/ai-image-edit/', label: 'AI 图片编辑' },
]

const statusTagType = (s: string) => {
  switch (s) {
    case 'success':
      return 'success'
    case 'failed':
      return 'danger'
    case 'timeout':
      return 'warning'
    case 'reversed':
      return 'info'
    case 'in_progress':
      return 'primary'
    default:
      return 'info'
  }
}

const statusLabel = (s: string) => {
  switch (s) {
    case 'in_progress':
      return '处理中'
    case 'success':
      return '成功'
    case 'failed':
      return '失败'
    case 'timeout':
      return '超时'
    case 'reversed':
      return '已退还'
    default:
      return s
  }
}

const modeLabel = (m: string | null) => {
  if (!m) return '-'
  if (m === 'text-to-image') return '文生图'
  if (m === 'image-to-image') return '图生图'
  return m
}

const sourceLabel = (s: string) => {
  // 把 URL 后缀去斜杠作为展示名
  if (s === '/ai-image-edit/') return 'AI 图片编辑'
  return s.replace(/^\//, '').replace(/\/$/, '') || s
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

// 把 created_at（UTC 'YYYY-MM-DD HH:mm:ss'）解析成毫秒时间戳
const createdAtMs = (s: string) => {
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T') + 'Z').getTime()
  return Number.isNaN(t) ? 0 : t
}

// 1 秒一次的"当前时间"，驱动 in_progress 行实时刷新
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

// 仅对 in_progress 行计算实时耗时；其它行返回 null 让 fallback 到 DB duration
const liveDuration = (rec: GenerationRecord): number | null => {
  if (rec.status !== 'in_progress') return null
  const start = createdAtMs(rec.created_at)
  if (!start) return null
  return Math.max(0, nowTick.value - start)
}

const formatDurationWithUpstream = (rec: GenerationRecord) => {
  const live = liveDuration(rec)
  const total = live != null ? `实时 ${formatDuration(live)}` : formatDuration(rec.duration_ms)
  if (rec.upstream_duration_ms == null) return total
  return `${total} / 上游 ${formatDuration(rec.upstream_duration_ms)}`
}

const userLabel = (rec: GenerationRecord) => {
  if (!rec.uid) return '匿名'
  return rec.user_name || rec.user_email || rec.uid
}

const userSubLabel = (rec: GenerationRecord) => {
  if (!rec.uid) return ''
  if (rec.user_email || rec.user_name) return rec.uid.slice(0, 12)
  return ''
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchGenerationRecords({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      status: filter.status || undefined,
      source: filter.source || undefined,
    })
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    console.error(err)
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

// 清理卡住的 in_progress 记录（默认 15 分钟阈值）
const cleaning = ref(false)
const handleCleanup = async () => {
  try {
    await ElMessageBox.confirm(
      '将把所有超过 15 分钟仍处于"处理中"状态的记录标记为"失败"。这些通常是历史 bug 或 Worker 被强制终止留下的卡死记录。确定清理？',
      '清理卡住记录',
      {
        confirmButtonText: '清理',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  cleaning.value = true
  try {
    const result = await cleanupStuckGenerationRecords(15)
    if (result.cleaned === 0) {
      ElMessage.info('没有需要清理的卡住记录')
    } else {
      ElMessage.success(`已清理 ${result.cleaned} 条卡住记录`)
      load()
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '清理失败')
  } finally {
    cleaning.value = false
  }
}

// ============ 详情抽屉 ============
const drawerVisible = ref(false)
const selected = ref<GenerationRecord | null>(null)

const openDetail = (rec: GenerationRecord) => {
  selected.value = rec
  drawerVisible.value = true
}

const prettyRawData = computed(() => {
  if (!selected.value?.raw_data) return ''
  try {
    return JSON.stringify(JSON.parse(selected.value.raw_data), null, 2)
  } catch {
    return selected.value.raw_data
  }
})

const copyText = (text: string) => {
  if (!text) return
  navigator.clipboard?.writeText(text).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

const copyUid = (uid: string | null) => {
  if (!uid) return
  copyText(uid)
}

onMounted(() => {
  load()
  tickTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">请求日志</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索 UID / 模型 / prompt"
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
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>

      <el-select
        v-model="filter.source"
        placeholder="工具"
        clearable
        class="!w-40"
        @change="handleSearch"
      >
        <el-option v-for="o in sourceOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>

      <el-button :loading="cleaning" @click="handleCleanup">清理卡住记录</el-button>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default" @row-click="openDetail" style="cursor: pointer;">
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="工具" min-width="120">
          <template #default="{ row }">
            <span class="text-ink-700">{{ sourceLabel(row.source) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="模式" width="90">
          <template #default="{ row }">
            <span class="text-ink-700">{{ modeLabel(row.mode) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="模型" min-width="120" prop="model">
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
        <el-table-column label="积分" width="80" align="right" prop="cost" />
        <el-table-column label="耗时" min-width="160">
          <template #default="{ row }">
            <span class="text-xs" :class="liveDuration(row) != null ? 'text-blue-600 font-medium' : 'text-ink-700'">
              <span
                v-if="liveDuration(row) != null"
                class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse"
                aria-hidden="true"
              />
              {{ formatDurationWithUpstream(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="180">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="text-ink-900">{{ userLabel(row) }}</span>
              <span v-if="userSubLabel(row)" class="text-xs text-ink-400">{{ userSubLabel(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end mt-4">
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
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :size="640"
      direction="rtl"
      title="请求详情"
      :destroy-on-close="true"
    >
      <div v-if="selected" class="space-y-4">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="时间">{{ formatTime(selected.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(selected.status)" effect="plain" size="small">
              {{ statusLabel(selected.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="工具">{{ sourceLabel(selected.source) }}</el-descriptions-item>
          <el-descriptions-item label="模式">{{ modeLabel(selected.mode) }}</el-descriptions-item>
          <el-descriptions-item label="模型">{{ selected.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="积分">{{ selected.cost }}</el-descriptions-item>
          <el-descriptions-item label="用户">
            {{ userLabel(selected) }}
            <span v-if="selected.uid" class="text-xs text-ink-400 ml-2">{{ selected.uid }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态码" v-if="selected.upstream_status != null">
            HTTP {{ selected.upstream_status }}
          </el-descriptions-item>
          <el-descriptions-item label="总耗时" :span="2">
            <span :class="liveDuration(selected) != null ? 'text-blue-600 font-medium' : ''">
              <span
                v-if="liveDuration(selected) != null"
                class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1 animate-pulse"
                aria-hidden="true"
              />
              {{ liveDuration(selected) != null ? `实时 ${formatDuration(liveDuration(selected))}` : formatDuration(selected.duration_ms) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="上游耗时" :span="2">{{ formatDuration(selected.upstream_duration_ms) }}</el-descriptions-item>
          <el-descriptions-item label="幂等键" :span="2" v-if="selected.idempotency_key">
            <code class="text-xs break-all">{{ selected.idempotency_key }}</code>
            <el-button type="primary" link size="small" class="ml-2" @click="copyText(selected.idempotency_key)">复制</el-button>
          </el-descriptions-item>
          <el-descriptions-item label="扣费流水" :span="2" v-if="selected.tx_id">
            <code class="text-xs break-all">{{ selected.tx_id }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="错误信息" :span="2" v-if="selected.error_message">
            <span class="text-danger-700 break-all">{{ selected.error_message }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="结果 URL" :span="2" v-if="selected.result_url">
            <a
              :href="selected.result_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 break-all"
            >
              {{ selected.result_url }}
            </a>
          </el-descriptions-item>
        </el-descriptions>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium text-ink-900">请求参数 (raw_data)</h4>
            <div class="flex gap-2">
              <el-button v-if="selected.uid" size="small" @click="copyUid(selected.uid)">复制 UID</el-button>
              <el-button size="small" @click="copyText(selected.raw_data)">复制 JSON</el-button>
            </div>
          </div>
          <pre class="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-96"><code>{{ prettyRawData }}</code></pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>