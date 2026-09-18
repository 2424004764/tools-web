<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAdminFriendLinks,
  updateAdminFriendLink,
  deleteAdminFriendLink,
  type FriendLink,
  type FriendLinkCounts,
  type FriendLinkStatus,
} from '@/api/admin/friend-links'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<FriendLink[]>([])
const counts = ref<FriendLinkCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 })
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
  status: 'pending' as FriendLinkStatus | '',
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

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminFriendLinks({
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

const handleApprove = async (row: FriendLink) => {
  try {
    await ElMessageBox.confirm(
      `通过后会在全站页脚公开展示「${row.name}」。确定通过？`,
      '审核通过',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  try {
    await updateAdminFriendLink(row.id, { status: 'approved' })
    ElMessage.success('已通过')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handleReject = async (row: FriendLink) => {
  let reason = ''
  try {
    const r = await ElMessageBox.prompt(
      `拒绝「${row.name}」的申请。可选填写拒绝原因（仅后台可见）。`,
      '审核拒绝',
      {
        confirmButtonText: '拒绝',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '可选，最多 200 字',
        inputValidator: (val: string) => (val ? val.length <= 200 || '最多 200 字' : true),
        type: 'warning',
      },
    )
    reason = (r?.value || '').trim()
  } catch {
    return
  }
  try {
    await updateAdminFriendLink(row.id, { status: 'rejected', reject_reason: reason })
    ElMessage.success('已拒绝')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handleDelete = async (row: FriendLink) => {
  try {
    await ElMessageBox.confirm(
      `确定永久删除「${row.name}」吗？此操作不可恢复。`,
      '删除友链',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteAdminFriendLink(row.id)
    ElMessage.success('已删除')
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

const handleSortChange = async (row: FriendLink, value: number | undefined) => {
  if (value === undefined || value === row.sort_order) return
  try {
    const updated = await updateAdminFriendLink(row.id, { sort_order: value })
    Object.assign(row, updated)
    ElMessage.success('排序已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">友链审核</h2>
      <el-tag effect="plain" type="warning">待审 {{ counts.pending }}</el-tag>
      <el-tag effect="plain" type="success">已过 {{ counts.approved }}</el-tag>
      <el-tag effect="plain" type="danger">已拒 {{ counts.rejected }}</el-tag>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索名称 / URL / 描述 / 联系方式"
        clearable
        class="!w-72"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select v-model="filter.status" class="!w-32" @change="handleSearch">
        <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table :data="list" stripe size="small">
      <el-table-column label="网站" min-width="180">
        <template #default="{ row }">
          <div class="flex flex-col">
            <span class="font-medium text-ink-900">{{ row.name }}</span>
            <a
              :href="row.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-accent-600 hover:underline truncate max-w-[240px]"
              :title="row.url"
            >{{ row.url }}</a>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="描述" min-width="160">
        <template #default="{ row }">
          <span class="text-xs text-ink-600">{{ row.description || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="联系方式" min-width="120">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ row.contact || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="plain" size="small" :title="row.reject_reason || ''">
            {{ statusLabel(row.status) }}
          </el-tag>
          <div v-if="row.status === 'rejected' && row.reject_reason" class="text-[11px] text-ink-400 mt-1">
            {{ row.reject_reason }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="排序" width="130">
        <template #default="{ row }">
          <el-input-number
            :model-value="row.sort_order"
            :min="0"
            :max="9999"
            size="small"
            controls-position="right"
            @change="(v: number | undefined) => handleSortChange(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="提交 IP" width="130">
        <template #default="{ row }">
          <span class="text-xs text-ink-400 font-mono">{{ row.submit_ip || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <div class="flex gap-1">
            <el-button
              v-if="row.status !== 'approved'"
              size="small"
              type="success"
              link
              @click="handleApprove(row)"
            >通过</el-button>
            <el-button
              v-if="row.status !== 'rejected'"
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
  </div>
</template>
