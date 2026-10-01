<script setup lang="ts">
// 博客管理：文章列表 + 审核投稿 + 编辑/删除
// 编辑与新建跳 /admin/blog/write（复用前台 BlogEditor 组件）
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAdminBlogPosts,
  updateAdminBlogPost,
  deleteAdminBlogPost,
  type AdminBlogPost,
  type AdminBlogPostCounts,
  type AdminBlogPostStatus,
} from '@/api/admin/blog'
import type { AdminPagination } from '@/types/admin'

const router = useRouter()

const loading = ref(false)
const list = ref<AdminBlogPost[]>([])
const counts = ref<AdminBlogPostCounts>({ pending: 0, draft: 0, published: 0, rejected: 0, total: 0 })
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
  status: 'pending' as AdminBlogPostStatus | '',
})

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审投稿' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已驳回' },
]

const statusTagType = (s: string) => {
  if (s === 'published') return 'success'
  if (s === 'rejected') return 'danger'
  if (s === 'pending') return 'warning'
  return 'info'
}

const statusLabel = (s: string) => {
  if (s === 'published') return '已发布'
  if (s === 'rejected') return '已驳回'
  if (s === 'pending') return '待审核'
  if (s === 'draft') return '草稿'
  return s
}

// 点击顶部统计标签筛选状态，再次点击已选中标签恢复全部
const handleCountClick = (status: AdminBlogPostStatus) => {
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
    const result = await fetchAdminBlogPosts({
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

const goWrite = (row?: AdminBlogPost) => {
  router.push(row ? `/admin/blog/write?id=${row.id}` : '/admin/blog/write')
}

const viewPost = (row: AdminBlogPost) => {
  window.open(`/blog/${row.slug}`, '_blank', 'noopener,noreferrer')
}

// 状态变更（通过/驳回/下线）直接生效；驳回弹窗填理由
const applyStatus = async (row: AdminBlogPost, status: AdminBlogPostStatus, rejectReason = '') => {
  try {
    await updateAdminBlogPost(row.id, {
      status,
      ...(status === 'rejected' ? { reject_reason: rejectReason } : {}),
    })
    ElMessage.success(status === 'published' ? '已发布' : status === 'rejected' ? '已驳回' : '已下线为草稿')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handlePublish = (row: AdminBlogPost) => applyStatus(row, 'published')

const handleOffline = (row: AdminBlogPost) => applyStatus(row, 'draft')

// ---- 驳回（带理由） ----
const rejectDialogVisible = ref(false)
const rejectTarget = ref<AdminBlogPost | null>(null)
const rejectReason = ref('')
const rejectSubmitting = ref(false)

const openReject = (row: AdminBlogPost) => {
  rejectTarget.value = row
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

const confirmReject = async () => {
  const target = rejectTarget.value
  if (!target || rejectSubmitting.value) return
  rejectSubmitting.value = true
  try {
    await applyStatus(target, 'rejected', rejectReason.value.trim())
    rejectDialogVisible.value = false
  } finally {
    rejectSubmitting.value = false
  }
}

const handleDelete = async (row: AdminBlogPost) => {
  try {
    await ElMessageBox.confirm(
      `确定永久删除《${row.title}》吗？此操作不可恢复。`,
      '删除文章',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteAdminBlogPost(row.id)
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
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">博客管理</h2>
      <el-tag
        :effect="filter.status === 'pending' ? 'dark' : 'plain'"
        type="warning"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('pending')"
      >待审投稿 {{ counts.pending }}</el-tag>
      <el-tag
        :effect="filter.status === 'draft' ? 'dark' : 'plain'"
        type="info"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('draft')"
      >草稿 {{ counts.draft }}</el-tag>
      <el-tag
        :effect="filter.status === 'published' ? 'dark' : 'plain'"
        type="success"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('published')"
      >已发布 {{ counts.published }}</el-tag>
      <el-tag
        :effect="filter.status === 'rejected' ? 'dark' : 'plain'"
        type="danger"
        class="cursor-pointer select-none opacity-80 hover:opacity-100"
        title="点击筛选，再次点击恢复全部"
        @click="handleCountClick('rejected')"
      >已驳回 {{ counts.rejected }}</el-tag>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索标题 / 摘要 / 作者 / 标签"
        clearable
        class="!w-72"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select v-model="filter.status" class="!w-36" placeholder="全部" @change="handleSearch">
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button @click="load">刷新</el-button>
      <el-button type="primary" @click="goWrite()">写文章</el-button>
    </div>

    <el-table :data="list" stripe size="small">
      <el-table-column label="标题" min-width="240">
        <template #default="{ row }">
          <div class="flex flex-col gap-0.5">
            <span class="text-body-sm font-medium text-ink-900 line-clamp-1">{{ row.title }}</span>
            <a
              :href="`/blog/${row.slug}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-caption text-accent-600 hover:underline truncate max-w-[240px] font-mono"
              :title="`/blog/${row.slug}`"
            >/blog/{{ row.slug }}</a>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="作者" min-width="130">
        <template #default="{ row }">
          <div class="flex items-center gap-1.5">
            <span class="text-body-sm text-ink-800">{{ row.author_name }}</span>
            <el-tag v-if="row.author_type === 'admin'" size="small" effect="dark" type="primary">站长</el-tag>
            <el-tag v-else size="small" effect="plain" type="info">投稿</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="标签" min-width="120">
        <template #default="{ row }">
          <span class="text-caption text-ink-500 line-clamp-1">{{ row.tags || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.status === 'rejected' && row.reject_reason"
            :content="`驳回理由：${row.reject_reason}`"
            placement="top"
          >
            <el-tag :type="statusTagType(row.status)" effect="plain" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </el-tooltip>
          <el-tag v-else :type="statusTagType(row.status)" effect="plain" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="浏览" width="70">
        <template #default="{ row }">
          <span class="text-caption text-ink-500">{{ row.views }}</span>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="155">
        <template #default="{ row }">
          <div class="flex flex-col">
            <span class="text-caption text-ink-500">{{ formatTime(row.published_at || row.created_at) }}</span>
            <span class="text-[11px] text-ink-400">{{ row.published_at ? '发布时间' : '创建时间' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <div class="flex gap-1 flex-wrap">
            <el-button size="small" type="primary" link @click="goWrite(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'published'"
              size="small"
              type="success"
              link
              @click="handlePublish(row)"
            >发布</el-button>
            <el-button
              v-if="row.status === 'pending'"
              size="small"
              type="warning"
              link
              @click="openReject(row)"
            >驳回</el-button>
            <el-button
              v-if="row.status === 'published'"
              size="small"
              type="warning"
              link
              @click="handleOffline(row)"
            >下线</el-button>
            <el-button
              v-if="row.status === 'published'"
              size="small"
              link
              @click="viewPost(row)"
            >查看</el-button>
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

    <!-- 驳回对话框 -->
    <el-dialog v-model="rejectDialogVisible" title="驳回投稿" width="480px" :append-to-body="true">
      <div v-if="rejectTarget" class="rounded-lg bg-surface-1 dark:bg-surface-2/40 p-3 mb-3">
        <p class="text-body-sm font-medium text-ink-900">{{ rejectTarget.title }}</p>
        <p class="text-caption text-ink-400 mt-1">投稿人：{{ rejectTarget.author_name }}</p>
      </div>
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="驳回理由（选填，帮助投稿人改进）"
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="rejectSubmitting" @click="confirmReject">驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>
