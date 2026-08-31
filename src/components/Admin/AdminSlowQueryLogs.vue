<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchSlowQueryLogs, cleanupSlowQueryLogs } from '@/api/admin/slow-query-log'
import type { AdminPagination, SlowQueryLog } from '@/types/admin'

const loading = ref(false)
const list = ref<SlowQueryLog[]>([])
const pagination = ref<AdminPagination>({
  total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
})

const filter = reactive({
  keyword: '',
  table: '',
  source: '' as '' | 'model' | 'raw',
  path: '',
  uid: '',
  /** 仅看 >= N 毫秒的；空 = 不过滤 */
  minDuration: '' as '' | string,
})

const sourceOptions = [
  { value: '', label: '全部来源' },
  { value: 'model', label: 'Model 层' },
  { value: 'raw', label: 'Raw SQL' },
]

const minDurationOptions = [
  { value: '', label: '全部耗时' },
  { value: '100', label: '≥ 100ms' },
  { value: '300', label: '≥ 300ms' },
  { value: '1000', label: '≥ 1s' },
  { value: '3000', label: '≥ 3s' },
]

const sourceTagType = (s: string | null): 'success' | 'info' | 'warning' => {
  if (s === 'model') return 'success'
  if (s === 'raw') return 'info'
  return 'warning'
}

const sourceLabel = (s: string | null) => {
  if (!s) return '-'
  return sourceOptions.find((o) => o.value === s)?.label || s
}

const operationColor = (op: string | null): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  switch (op) {
    case 'SELECT': return 'primary'
    case 'INSERT': return 'success'
    case 'UPDATE': return 'warning'
    case 'DELETE': return 'danger'
    default: return 'info'
  }
}

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const formatDuration = (ms: number | null) => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

// 按耗时渲染颜色：>=1s 红，>=300ms 橙，其他默认
const durationTagType = (ms: number | null): 'danger' | 'warning' | 'info' => {
  if (ms == null) return 'info'
  if (ms >= 1000) return 'danger'
  if (ms >= 300) return 'warning'
  return 'info'
}

const formatSql = (sql: string | null) => {
  if (!sql) return '-'
  // 单行 + 折叠多余空白
  return sql.replace(/\s+/g, ' ').trim()
}

const truncate = (s: string | null, max = 80) => {
  if (!s) return '-'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const formatParams = (params: string | null) => {
  if (!params) return null
  try {
    const parsed = JSON.parse(params)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return params
  }
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchSlowQueryLogs({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      table: filter.table || undefined,
      source: filter.source || undefined,
      path: filter.path || undefined,
      uid: filter.uid || undefined,
      minDuration: filter.minDuration ? Number(filter.minDuration) : undefined,
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
      '将删除所有 30 天前的慢查询日志记录，且不可恢复。确定继续？',
      '清理历史慢查询日志',
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
    const result = await cleanupSlowQueryLogs(30)
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
const selected = ref<SlowQueryLog | null>(null)

const openDetail = (row: SlowQueryLog) => {
  selected.value = row
  drawerVisible.value = true
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
  <!-- 单根节点：外层 <Transition mode="out-in"> 要求页面组件是单元素根 -->
  <div>
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">慢查询日志</h2>
      <el-input
        v-model="filter.keyword"
        placeholder="搜索 SQL / 错误 / 路径"
        clearable
        class="!w-64"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append><el-button @click="handleSearch">搜索</el-button></template>
      </el-input>
      <el-input
        v-model="filter.table"
        placeholder="表名（精确匹配）"
        clearable
        class="!w-44"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-select
        v-model="filter.source"
        placeholder="来源"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option v-for="o in sourceOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select
        v-model="filter.minDuration"
        placeholder="最少耗时"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option v-for="o in minDurationOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-input
        v-model="filter.path"
        placeholder="路径（含子串）"
        clearable
        class="!w-44"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
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
        <el-table-column label="耗时" width="120" sortable :sort-by="(row: SlowQueryLog) => String(row.duration_ms)">
          <template #default="{ row }">
            <el-tag :type="durationTagType(row.duration_ms)" effect="plain">
              {{ formatDuration(row.duration_ms) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-tag :type="operationColor(row.operation)" effect="plain" size="small">
              {{ row.operation || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="表名" width="160">
          <template #default="{ row }">
            <span v-if="row.table_name" class="font-mono text-ink-700">{{ row.table_name }}</span>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.source)" effect="plain" size="small">
              {{ sourceLabel(row.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SQL 摘要" min-width="380">
          <template #default="{ row }">
            <span class="font-mono text-xs text-ink-700">{{ truncate(formatSql(row.sql_text), 120) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="路径" width="200">
          <template #default="{ row }">
            <div v-if="row.path" class="flex items-center gap-2">
              <el-tag v-if="row.method" size="small" type="info" effect="plain">{{ row.method }}</el-tag>
              <span class="truncate" :title="row.path">{{ row.path }}</span>
            </div>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="UID" width="160">
          <template #default="{ row }">
            <span v-if="row.uid" class="font-mono text-xs">{{ row.uid }}</span>
            <span v-else class="text-gray-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
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
      title="慢查询详情"
      size="720px"
      direction="rtl"
      destroy-on-close
    >
      <div v-if="selected" class="space-y-4 p-2">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-gray-500 mb-1">耗时</div>
            <div>
              <el-tag :type="durationTagType(selected.duration_ms)" effect="plain">
                {{ formatDuration(selected.duration_ms) }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">操作</div>
            <div>
              <el-tag :type="operationColor(selected.operation)" effect="plain" size="small">
                {{ selected.operation || '-' }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">表名</div>
            <div class="font-mono">{{ selected.table_name || '-' }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">来源</div>
            <div>
              <el-tag :type="sourceTagType(selected.source)" effect="plain" size="small">
                {{ sourceLabel(selected.source) }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">方法</div>
            <div>{{ selected.method || '-' }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">UID</div>
            <div class="truncate">{{ selected.uid || '匿名' }}</div>
          </div>
          <div>
            <div class="text-gray-500 mb-1">时间</div>
            <div>{{ formatTime(selected.created_at) }}</div>
          </div>
          <div v-if="selected.path">
            <div class="text-gray-500 mb-1">路径</div>
            <div class="break-all">{{ selected.path }}</div>
          </div>
        </div>

        <div>
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">SQL 全文</span>
            <el-button link size="small" class="ml-auto"
                       @click="copyText(selected.sql_text, 'SQL')">复制</el-button>
          </div>
          <pre class="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap break-all font-mono">{{ selected.sql_text }}</pre>
        </div>

        <div v-if="selected.params">
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">Bind 参数</span>
            <el-button link size="small" class="ml-auto"
                       @click="copyText(formatParams(selected.params), '参数')">复制</el-button>
          </div>
          <pre class="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap break-all font-mono">{{ formatParams(selected.params) }}</pre>
        </div>

        <div v-if="selected.error">
          <div class="flex items-center mb-1">
            <span class="text-gray-500 text-sm">异常信息</span>
            <el-button link size="small" class="ml-auto"
                       @click="copyText(selected.error, '异常信息')">复制</el-button>
          </div>
          <pre class="bg-red-50 text-red-700 rounded p-3 text-xs overflow-auto max-h-32 whitespace-pre-wrap break-all font-mono">{{ selected.error }}</pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>
