<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchApiErrorLogs, cleanupApiErrorLogs } from '@/api/admin/error-log'
import type { AdminPagination, ApiErrorLog } from '@/types/admin'
import { formatLocation } from '@/utils/geo-name'

const loading = ref(false)
const list = ref<ApiErrorLog[]>([])
const pagination = ref<AdminPagination>({
  total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
})

const filter = reactive({
  keyword: '',
  path: '',
  status: '' as '' | '400' | '401' | '403' | '404' | '409' | '500',
  stage: '' as '' | 'validation' | 'auth' | 'db' | 'kv' | 'upstream' | 'unknown',
  uid: '',
})

const statusOptions = [
  { value: '', label: '全部' },
  { value: '400', label: '400 参数错误' },
  { value: '401', label: '401 未登录' },
  { value: '403', label: '403 无权限' },
  { value: '404', label: '404 未找到' },
  { value: '409', label: '409 冲突' },
  { value: '500', label: '500 服务器' },
]

const stageOptions = [
  { value: '', label: '全部' },
  { value: 'validation', label: '参数校验' },
  { value: 'auth', label: '鉴权' },
  { value: 'db', label: '数据库' },
  { value: 'kv', label: 'KV' },
  { value: 'upstream', label: '上游' },
  { value: 'unknown', label: '未分类' },
]

const stageTagType = (s: string | null) => {
  switch (s) {
    case 'validation': return 'warning'
    case 'auth':       return 'danger'
    case 'db':         return 'danger'
    case 'kv':         return 'danger'
    case 'upstream':   return 'info'
    case 'unknown':    return 'info'
    default:           return 'info'
  }
}

const stageLabel = (s: string | null) => {
  if (!s) return '-'
  return stageOptions.find((o) => o.value === s)?.label || s
}

const statusTagType = (s: number): 'danger' | 'warning' | 'info' | 'primary' | 'success' | undefined => {
  if (s >= 500) return 'danger'
  if (s === 429) return 'warning'
  if (s >= 400) return 'warning'
  return undefined
}

const formatTime = (s: string | null) => {
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

const truncate = (s: string | null, max = 80) => {
  if (!s) return '-'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchApiErrorLogs({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      path: filter.path || undefined,
      status: filter.status ? Number(filter.status) : undefined,
      stage: filter.stage || undefined,
      uid: filter.uid || undefined,
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

const cleaning = ref(false)
const handleCleanup = async () => {
  try {
    await ElMessageBox.confirm(
      '将删除所有 30 天前的 API 错误日志记录，且不可恢复。确定继续？',
      '清理历史错误日志',
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
    const result = await cleanupApiErrorLogs(30)
    ElMessage.success(`已清理 ${result.deleted} 条历史记录`)
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '清理失败')
  } finally {
    cleaning.value = false
  }
}

// ============ 详情抽屉 ============
const drawerVisible = ref(false)
const selected = ref<ApiErrorLog | null>(null)

const openDetail = (row: ApiErrorLog) => {
  selected.value = row
  drawerVisible.value = true
}

const formatExtra = (extra: string | null) => {
  if (!extra) return null
  try {
    return JSON.stringify(JSON.parse(extra), null, 2)
  } catch {
    return extra
  }
}

const copyText = async (text: string | null, label: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(load)
</script>

<template>
  <!-- 单根节点：外层 <Transition mode="out-in"> 要求页面组件是单元素根，否则告警且无法做过渡动画 -->
  <div>
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">错误日志</h2>
      <el-input
        v-model="filter.keyword"
        placeholder="搜索错误信息/上游响应/路径"
        clearable
        class="!w-64"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append><el-button @click="handleSearch">搜索</el-button></template>
      </el-input>
      <el-input
        v-model="filter.path"
        placeholder="路径（含子串）"
        clearable
        class="!w-48"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="filter.status"
        placeholder="状态码"
        clearable
        class="!w-36"
        @change="handleSearch"
      >
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select
        v-model="filter.stage"
        placeholder="失败环节"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option v-for="o in stageOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-input
        v-model="filter.uid"
        placeholder="用户 UID"
        clearable
        class="!w-36"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-button @click="load">刷新</el-button>
      <el-button :loading="cleaning" @click="handleCleanup" plain>清理 30 天前</el-button>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        size="default"
        @row-click="openDetail"
        style="cursor: pointer;"
      >
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="path" label="路径" min-width="220">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <el-tag size="small" type="info" effect="plain">{{ row.method }}</el-tag>
              <span class="truncate">{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="IP" width="120">
          <template #default="{ row }">
            <span class="text-xs text-ink-500 font-mono">{{ row.client_ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="位置" width="140">
          <template #default="{ row }">
            <span
              v-if="row.country || row.city"
              class="text-xs text-ink-700"
              :title="[row.timezone, row.colo ? `CF ${row.colo}` : null].filter(Boolean).join(' · ')"
            >
              {{ formatLocation(row.country, row.city) }}
            </span>
            <span v-else class="text-xs text-ink-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态码" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="plain">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="环节" width="100">
          <template #default="{ row }">
            <el-tag :type="stageTagType(row.error_stage)" effect="plain" size="small">
              {{ stageLabel(row.error_stage) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上游" width="160">
          <template #default="{ row }">
            <span v-if="row.upstream_name">
              <span class="text-ink-700">{{ row.upstream_name }}</span>
              <span v-if="row.upstream_status" class="ml-1 text-gray-400">({{ row.upstream_status }})</span>
            </span>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="错误摘要" min-width="240">
          <template #default="{ row }">
            <span class="text-gray-700">{{ truncate(row.error_message, 80) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="90">
          <template #default="{ row }">{{ formatDuration(row.duration_ms) }}</template>
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

    <el-drawer
      v-model="drawerVisible"
      title="错误日志详情"
      size="640px"
      direction="rtl"
      destroy-on-close
    >
      <div v-if="selected" class="space-y-4 p-2">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-gray-500 mb-1">时间</div>
            <div>{{ formatTime(selected.created_at) }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">耗时</div>
            <div>{{ formatDuration(selected.duration_ms) }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">方法</div>
            <div>{{ selected.method }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">状态码</div>
            <div>
              <el-tag :type="statusTagType(selected.status)" effect="plain" size="small">
                {{ selected.status }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">失败环节</div>
            <div>
              <el-tag :type="stageTagType(selected.error_stage)" effect="plain" size="small">
                {{ stageLabel(selected.error_stage) }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">UID</div>
            <div class="truncate">{{ selected.uid || '匿名' }}</div>
          </div>
          <div class="col-span-2">
            <div class="text-gray-500 mb-1">路径</div>
            <div class="break-all">{{ selected.path }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">客户端 IP</div>
            <div>{{ selected.client_ip || '-' }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">位置</div>
            <div>
              <span v-if="selected.country || selected.city">{{ formatLocation(selected.country, selected.city) }}</span>
              <span v-else class="text-gray-400">-</span>
              <span v-if="selected.timezone || selected.colo" class="text-xs text-gray-400 ml-1">
                ({{ [selected.timezone, selected.colo ? `CF ${selected.colo}` : null].filter(Boolean).join(' · ') }})
              </span>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">User-Agent</div>
            <div class="truncate" :title="selected.user_agent || ''">{{ selected.user_agent || '-' }}</div>
          </div>
        </div>

        <div>
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">错误信息</span>
            <el-button v-if="selected.error_message" link size="small" class="ml-auto"
                       @click="copyText(selected.error_message, '错误信息')">复制</el-button>
          </div>
          <div class="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap break-all">
            {{ selected.error_message || '-' }}
          </div>
        </div>

        <div v-if="selected.upstream_name || selected.upstream_body">
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">
              上游响应 ({{ selected.upstream_name || '?' }}
              <span v-if="selected.upstream_status" class="ml-1">HTTP {{ selected.upstream_status }}</span>)
            </span>
            <el-button v-if="selected.upstream_body" link size="small" class="ml-auto"
                       @click="copyText(selected.upstream_body, '上游响应')">复制</el-button>
          </div>
          <pre class="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap break-all">{{ selected.upstream_body || '-' }}</pre>
        </div>

        <div v-if="selected.extra">
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">附加上下文</span>
            <el-button link size="small" class="ml-auto"
                       @click="copyText(formatExtra(selected.extra), '附加上下文')">复制</el-button>
          </div>
          <pre class="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap break-all">{{ formatExtra(selected.extra) }}</pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>