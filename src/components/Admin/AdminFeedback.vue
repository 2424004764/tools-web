<script setup lang="ts">
// 意见反馈管理：查看用户提交的反馈/建议，标记处理状态、写备注、删除，形成需求池
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAdminFeedback,
  updateAdminFeedback,
  deleteAdminFeedback,
  type FeedbackItem,
  type FeedbackCounts,
  type FeedbackStatus,
} from '@/api/admin/feedback'
import type { FeedbackType } from '@/api/feedback'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<FeedbackItem[]>([])
const counts = ref<FeedbackCounts>({ pending: 0, resolved: 0, closed: 0, total: 0 })
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
  status: 'pending' as FeedbackStatus | '',
  type: '' as FeedbackType | '',
})

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已处理' },
  { value: 'closed', label: '已关闭' },
]

const typeOptions = [
  { value: '', label: '全部类型' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'bug', label: '问题反馈' },
  { value: 'other', label: '其他' },
]

const statusTagType = (s: string) => {
  if (s === 'resolved') return 'success'
  if (s === 'closed') return 'info'
  if (s === 'pending') return 'warning'
  return 'info'
}

const statusLabel = (s: string) => {
  if (s === 'resolved') return '已处理'
  if (s === 'closed') return '已关闭'
  if (s === 'pending') return '待处理'
  return s
}

const typeTagType = (t: string) => {
  if (t === 'suggestion') return 'success'
  if (t === 'bug') return 'danger'
  return 'info'
}

const typeLabel = (t: string) => {
  if (t === 'suggestion') return '功能建议'
  if (t === 'bug') return '问题反馈'
  if (t === 'other') return '其他'
  return t
}

const userLabel = (row: FeedbackItem) => {
  if (row.username) return row.username
  if (row.email) return row.email
  if (row.uid) return row.uid.slice(0, 8)
  return '游客'
}

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

// 详情弹窗
const detailVisible = ref(false)
const detailRow = ref<FeedbackItem | null>(null)
const detailContent = computed(() => detailRow.value?.content || '')

const openDetail = (row: FeedbackItem) => {
  detailRow.value = row
  detailVisible.value = true
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminFeedback({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      status: filter.status || undefined,
      type: filter.type || undefined,
    })
    list.value = result.list
    pagination.value = result.pagination
    counts.value = result.counts
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

const handleStatus = async (row: FeedbackItem, status: FeedbackStatus) => {
  const actionLabel = status === 'resolved' ? '标记为已处理' : status === 'closed' ? '关闭' : '重新打开'
  try {
    await ElMessageBox.confirm(`确定将这条反馈${actionLabel}吗？`, '更新状态', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info',
    })
  } catch {
    return
  }
  try {
    await updateAdminFeedback(row.id, { status })
    ElMessage.success(`已${actionLabel}`)
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handleEditNote = async (row: FeedbackItem) => {
  let note = ''
  try {
    const r = await ElMessageBox.prompt('处理备注（如：已列入开发计划 / 下版本修复），仅后台可见。', '编辑备注', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValue: row.admin_note || '',
      inputPlaceholder: '最多 500 字',
      inputValidator: (val: string) => (val ? val.length <= 500 || '最多 500 字' : true),
    })
    note = (r?.value || '').trim()
  } catch {
    return
  }
  try {
    const updated = await updateAdminFeedback(row.id, { admin_note: note })
    Object.assign(row, updated)
    ElMessage.success('备注已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  }
}

const handleDelete = async (row: FeedbackItem) => {
  try {
    await ElMessageBox.confirm('确定永久删除这条反馈吗？此操作不可恢复。', '删除反馈', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteAdminFeedback(row.id)
    ElMessage.success('已删除')
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">意见反馈</h2>
      <el-tag effect="plain" type="warning">待处理 {{ counts.pending }}</el-tag>
      <el-tag effect="plain" type="success">已处理 {{ counts.resolved }}</el-tag>
      <el-tag effect="plain" type="info">已关闭 {{ counts.closed }}</el-tag>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索内容 / 联系方式 / 用户 / 页面"
        clearable
        class="!w-64"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select v-model="filter.type" class="!w-32" @change="handleSearch">
        <el-option v-for="o in typeOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="filter.status" class="!w-32" @change="handleSearch">
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table :data="list" stripe size="small">
      <el-table-column label="类型" width="96">
        <template #default="{ row }">
          <el-tag :type="typeTagType(row.type)" effect="plain" size="small">{{ typeLabel(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="内容" min-width="240">
        <template #default="{ row }">
          <span
            class="text-sm text-ink-700 cursor-pointer hover:text-accent-600"
            :title="'点击查看完整内容'"
            @click="openDetail(row)"
          >{{ row.content }}</span>
          <div v-if="row.admin_note" class="text-[11px] text-ink-400 mt-1 truncate">
            备注：{{ row.admin_note }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="用户" min-width="130">
        <template #default="{ row }">
          <div class="flex flex-col">
            <span class="text-xs text-ink-700 truncate">{{ userLabel(row) }}</span>
            <span v-if="row.email && row.username" class="text-[11px] text-ink-400 truncate">{{ row.email }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="联系方式" min-width="120">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ row.contact || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="来源页面" min-width="150">
        <template #default="{ row }">
          <a
            v-if="row.page_url"
            :href="row.page_url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-accent-600 hover:underline truncate max-w-[200px] block"
            :title="row.page_url"
          >{{ row.page_url }}</a>
          <span v-else class="text-xs text-ink-400">-</span>
        </template>
      </el-table-column>
      <el-table-column label="IP" width="120">
        <template #default="{ row }">
          <span class="text-xs text-ink-400 font-mono">{{ row.submit_ip || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="plain" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="flex gap-1 flex-wrap">
            <el-button
              v-if="row.status !== 'resolved'"
              size="small"
              type="success"
              link
              @click="handleStatus(row, 'resolved')"
            >已处理</el-button>
            <el-button
              v-if="row.status === 'resolved'"
              size="small"
              type="info"
              link
              @click="handleStatus(row, 'pending')"
            >重新打开</el-button>
            <el-button
              v-if="row.status !== 'closed'"
              size="small"
              type="warning"
              link
              @click="handleStatus(row, 'closed')"
            >关闭</el-button>
            <el-button size="small" type="primary" link @click="handleEditNote(row)">备注</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">删除</el-button>
          </div>
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

    <!-- 反馈详情 -->
    <el-dialog v-model="detailVisible" title="反馈详情" width="min(560px, 92vw)" append-to-body>
      <template v-if="detailRow">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2 items-center">
            <el-tag :type="typeTagType(detailRow.type)" effect="plain" size="small">
              {{ typeLabel(detailRow.type) }}
            </el-tag>
            <el-tag :type="statusTagType(detailRow.status)" effect="plain" size="small">
              {{ statusLabel(detailRow.status) }}
            </el-tag>
            <span class="text-xs text-ink-400">提交于 {{ formatTime(detailRow.created_at) }}</span>
          </div>
          <p class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap bg-surface-2 rounded-xl p-3 m-0">
            {{ detailContent }}
          </p>
          <div class="text-xs text-ink-500 flex flex-col gap-1">
            <span>用户：{{ userLabel(detailRow) }}<template v-if="detailRow.email">（{{ detailRow.email }}）</template></span>
            <span>联系方式：{{ detailRow.contact || '-' }}</span>
            <span>来源页面：{{ detailRow.page_url || '-' }}</span>
            <span>IP：{{ detailRow.submit_ip || '-' }}</span>
            <span v-if="detailRow.admin_note">备注：{{ detailRow.admin_note }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" class="bg-brand-gradient border-none" @click="detailRow && handleEditNote(detailRow)">
          编辑备注
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
