<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAdminComments,
  updateAdminCommentStatus,
  batchUpdateAdminComments,
  deleteAdminComment,
  replyAdminComment,
  type AdminComment,
  type AdminCommentCounts,
  type SiteCommentStatus,
} from '@/api/admin/comments'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<AdminComment[]>([])
const counts = ref<AdminCommentCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 })
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
  status: 'pending' as SiteCommentStatus | '',
})

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
]

const statusTagType = (s: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'danger'
  if (s === 'pending') return 'warning'
  return 'info'
}

const statusLabel = (s: string) => {
  if (s === 'approved') return '已通过'
  if (s === 'rejected') return '已拒绝'
  if (s === 'pending') return '待审核'
  return s
}

// 点击顶部统计标签筛选状态，再次点击已选中标签恢复全部
const handleCountClick = (status: SiteCommentStatus) => {
  filter.status = filter.status === status ? '' : status
  handleSearch()
}

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminComments({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      status: filter.status || undefined,
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

// 通过/拒绝直接生效，不弹二次确认；删除是不可恢复操作，仍保留确认
const setStatus = async (row: AdminComment, status: SiteCommentStatus, label: string) => {
  try {
    await updateAdminCommentStatus(row.id, status)
    ElMessage.success(`已${label}`)
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handleApprove = (row: AdminComment) => setStatus(row, 'approved', '通过')

const handleReject = (row: AdminComment) => setStatus(row, 'rejected', '拒绝')

// ---- 站长回复 ----
const replyDialogVisible = ref(false)
const replyTarget = ref<AdminComment | null>(null)
const replyContent = ref('')
const replySubmitting = ref(false)

const openReply = (row: AdminComment) => {
  replyTarget.value = row
  replyContent.value = ''
  replyDialogVisible.value = true
}

const confirmReply = async () => {
  const target = replyTarget.value
  const content = replyContent.value.trim()
  if (!target || !content || replySubmitting.value) return
  replySubmitting.value = true
  try {
    const result = await replyAdminComment(target.id, content)
    ElMessage.success(
      result.parent.status === 'approved' && target.status === 'pending'
        ? '已回复，原评论已自动通过审核'
        : '已回复',
    )
    replyDialogVisible.value = false
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '回复失败')
  } finally {
    replySubmitting.value = false
  }
}

// ---- 批量审核 ----
const tableRef = ref()
const selected = ref<AdminComment[]>([])
const batchLoading = ref(false)

const handleSelectionChange = (rows: AdminComment[]) => {
  selected.value = rows
}

const batchLabel = (status: SiteCommentStatus) => (status === 'approved' ? '通过' : status === 'rejected' ? '拒绝' : '撤回待审')

const handleBatch = async (status: SiteCommentStatus) => {
  const ids = selected.value.map((r) => r.id)
  if (!ids.length) return
  batchLoading.value = true
  try {
    const result = await batchUpdateAdminComments(ids, status)
    ElMessage.success(`已批量${batchLabel(status)} ${result.updated} 条评论`)
    await load()
    tableRef.value?.clearSelection()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '批量操作失败')
  } finally {
    batchLoading.value = false
  }
}

const handleDelete = async (row: AdminComment) => {
  try {
    await ElMessageBox.confirm(
      '确定永久删除这条评论吗？此操作不可恢复。',
      '删除评论',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteAdminComment(row.id)
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
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">评论管理</h2>
      <el-tag
        :effect="filter.status === 'pending' ? 'dark' : 'plain'"
        type="warning"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('pending')"
      >待审 {{ counts.pending }}</el-tag>
      <el-tag
        :effect="filter.status === 'approved' ? 'dark' : 'plain'"
        type="success"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('approved')"
      >已过 {{ counts.approved }}</el-tag>
      <el-tag
        :effect="filter.status === 'rejected' ? 'dark' : 'plain'"
        type="danger"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('rejected')"
      >已拒 {{ counts.rejected }}</el-tag>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索内容 / 昵称 / 邮箱 / 页面"
        clearable
        class="!w-72"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select v-model="filter.status" class="!w-32" placeholder="全部" @change="handleSearch">
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button @click="load">刷新</el-button>

      <div class="flex items-center gap-2 w-full">
        <span v-if="selected.length" class="text-body-sm text-ink-500">已选 {{ selected.length }} 条</span>
        <el-button
          type="success"
          size="small"
          :disabled="!selected.length"
          :loading="batchLoading"
          @click="handleBatch('approved')"
        >批量通过</el-button>
        <el-button
          type="warning"
          size="small"
          :disabled="!selected.length"
          :loading="batchLoading"
          @click="handleBatch('rejected')"
        >批量拒绝</el-button>
      </div>
    </div>

    <el-table ref="tableRef" :data="list" stripe size="small" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="45" />
      <el-table-column label="评论内容" min-width="240">
        <template #default="{ row }">
          <div class="flex flex-col gap-0.5">
            <el-tag v-if="row.is_admin" size="small" effect="dark" type="primary" class="w-fit">站长回复</el-tag>
            <span class="text-xs text-ink-800 whitespace-pre-line break-words">{{ row.content }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="评论人" min-width="150">
        <template #default="{ row }">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-ink-900">{{ row.nickname }}</span>
              <el-tag v-if="row.user_id" size="small" effect="plain" type="info">注册用户</el-tag>
              <el-tag v-else size="small" effect="plain">游客</el-tag>
            </div>
            <span class="text-xs text-ink-500">{{ row.email || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="所属页面" min-width="130">
        <template #default="{ row }">
          <div class="flex flex-col">
            <a
              :href="row.page_path"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-accent-600 hover:underline truncate max-w-[160px] font-mono"
              :title="row.page_path"
            >{{ row.page_path }}</a>
            <span class="text-[11px] text-ink-400 truncate max-w-[160px]" :title="row.page_title || ''">
              {{ row.page_title || '-' }}
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="plain" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交 IP" width="125">
        <template #default="{ row }">
          <span class="text-xs text-ink-400 font-mono">{{ row.submit_ip || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="155">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <div class="flex gap-1">
            <el-button
              v-if="!row.is_admin"
              size="small"
              type="primary"
              link
              @click="openReply(row)"
            >回复</el-button>
            <el-button
              v-if="!row.is_admin && row.status !== 'approved'"
              size="small"
              type="success"
              link
              @click="handleApprove(row)"
            >通过</el-button>
            <el-button
              v-if="!row.is_admin && row.status !== 'rejected'"
              size="small"
              type="warning"
              link
              @click="handleReject(row)"
            >拒绝</el-button>
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

    <!-- 站长回复对话框 -->
    <el-dialog v-model="replyDialogVisible" title="回复评论" width="560px" :append-to-body="true">
      <div v-if="replyTarget" class="rounded-lg bg-surface-1 dark:bg-surface-2/40 p-3 mb-3">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-body-sm font-medium text-ink-900">{{ replyTarget.nickname }}</span>
          <el-tag v-if="replyTarget.status === 'pending'" size="small" type="warning" effect="plain">待审核，回复后自动通过</el-tag>
        </div>
        <p class="text-body-sm text-ink-600 dark:text-ink-300 whitespace-pre-line break-words">{{ replyTarget.content }}</p>
        <p class="text-caption text-ink-400 mt-1.5">{{ replyTarget.page_path }}</p>
      </div>
      <el-input
        v-model="replyContent"
        type="textarea"
        :rows="4"
        maxlength="1000"
        show-word-limit
        placeholder="以站长身份回复，回复将直接公开展示…"
      />
      <template #footer>
        <el-button @click="replyDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!replyContent.trim()"
          :loading="replySubmitting"
          @click="confirmReply"
        >回复</el-button>
      </template>
    </el-dialog>
  </div>
</template>
