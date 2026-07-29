<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAdminAiMediaWorks,
  auditAiMediaWork,
  deleteAiMediaWork,
  type AiMediaWork,
} from '@/api/ai-media-works'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<AiMediaWork[]>([])
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
  category: '',
  type: '',
  audit_status: '',
})

const auditOptions = [
  { value: '', label: '全部' },
  { value: 'approved', label: '已通过' },
  { value: 'pending', label: '待审核' },
  { value: 'rejected', label: '已拒绝' },
]
const typeOptions = [
  { value: '', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
]

const auditTagType = (s: string) => {
  if (s === 'approved') return 'success'
  if (s === 'rejected') return 'danger'
  if (s === 'pending') return 'warning'
  return 'info'
}
const auditLabel = (s: string) => {
  if (s === 'approved') return '已通过'
  if (s === 'rejected') return '已拒绝'
  if (s === 'pending') return '待审核'
  return s
}

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const formatDuration = (sec: number | null) => {
  if (!sec || sec <= 0) return '-'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

const truncate = (s: string | null | undefined, n = 60) => {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminAiMediaWorks({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      category: filter.category || undefined,
      type: (filter.type as 'image' | 'video' | '') || undefined,
      audit_status: (filter.audit_status as 'approved' | 'pending' | 'rejected' | '') || undefined,
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

const handleAudit = async (row: AiMediaWork, status: 'approved' | 'rejected') => {
  const verb = status === 'approved' ? '通过' : '拒绝'
  try {
    await ElMessageBox.confirm(
      `确定将 #${row.id} 审核${verb}吗？${status === 'rejected' ? '（拒绝后将不再公开展示）' : ''}`,
      `审核${verb}`,
      {
        confirmButtonText: `审核${verb}`,
        cancelButtonText: '取消',
        type: status === 'rejected' ? 'warning' : 'info',
      },
    )
  } catch {
    return
  }
  try {
    await auditAiMediaWork(row.id, status)
    ElMessage.success(`已${verb}`)
    // 局部更新，避免全量重拉
    const i = list.value.findIndex((r) => r.id === row.id)
    if (i >= 0) list.value[i].audit_status = status
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '审核失败')
  }
}

const handleDelete = async (row: AiMediaWork) => {
  try {
    await ElMessageBox.confirm(
      `确定永久删除 #${row.id} 吗？此操作不可恢复。`,
      '删除作品',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  try {
    await deleteAiMediaWork(row.id)
    ElMessage.success('已删除')
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

const previewVisible = ref(false)
const previewItem = ref<AiMediaWork | null>(null)
const openPreview = (row: AiMediaWork) => {
  previewItem.value = row
  previewVisible.value = true
}

onMounted(() => {
  load()
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">AI 媒体作品</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索 prompt / 模型 / 来源 / 标签"
        clearable
        class="!w-72"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-input
        v-model="filter.category"
        placeholder="分类"
        clearable
        class="!w-32"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-select
        v-model="filter.type"
        placeholder="类型"
        clearable
        class="!w-28"
        @change="handleSearch"
      >
        <el-option v-for="o in typeOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>

      <el-select
        v-model="filter.audit_status"
        placeholder="状态"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option v-for="o in auditOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>

      <el-button @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default">
        <el-table-column label="预览" width="80">
          <template #default="{ row }">
            <div
              class="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 cursor-pointer border border-gray-200 hover:border-indigo-400"
              @click="openPreview(row)"
            >
              <img
                v-if="row.media_type === 'image'"
                :src="row.thumbnail_url || row.media_url"
                class="w-full h-full object-cover"
                referrerpolicy="no-referrer"
              />
              <video
                v-else
                :src="row.media_url"
                :poster="row.thumbnail_url || undefined"
                class="w-full h-full object-cover"
                muted
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.media_type === 'video' ? 'warning' : 'success'" effect="plain">
              {{ row.media_type === 'video' ? '视频' : '图片' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分类" min-width="100" prop="category">
          <template #default="{ row }">
            <span class="text-ink-700">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提示词" min-width="280">
          <template #default="{ row }">
            <span class="text-ink-700" :title="row.prompt">
              {{ truncate(row.prompt, 80) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="模型/来源" min-width="140">
          <template #default="{ row }">
            <div class="flex flex-col text-xs">
              <span class="text-ink-700">{{ row.model_name || '-' }}</span>
              <span v-if="row.source_name" class="text-ink-400">{{ row.source_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="尺寸/时长" min-width="120">
          <template #default="{ row }">
            <span class="text-xs text-ink-600">
              <template v-if="row.width && row.height">{{ row.width }}×{{ row.height }}</template>
              <template v-else>-</template>
              <template v-if="row.duration"> · {{ formatDuration(row.duration) }}</template>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="auditTagType(row.audit_status || '')" effect="plain" size="small">
              {{ auditLabel(row.audit_status || '') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="浏览" width="70" align="right" prop="view_count" />
        <el-table-column label="创建时间" min-width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="flex gap-1">
              <el-button
                size="small"
                type="success"
                link
                @click="handleAudit(row, 'approved')"
              >
                通过
              </el-button>
              <el-button
                size="small"
                type="warning"
                link
                @click="handleAudit(row, 'rejected')"
              >
                拒绝
              </el-button>
              <el-button
                size="small"
                type="danger"
                link
                @click="handleDelete(row)"
              >
                删除
              </el-button>
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
    </el-card>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      width="min(960px, 96vw)"
      align-center
      destroy-on-close
      :show-close="true"
      :title="`#${previewItem?.id} 预览`"
    >
      <div v-if="previewItem" class="flex flex-col md:flex-row gap-4 max-h-[80vh]">
        <div class="md:flex-1 bg-black rounded-lg flex items-center justify-center min-h-[280px]">
          <img
            v-if="previewItem.media_type === 'image'"
            :src="previewItem.media_url"
            class="max-w-full max-h-[80vh] object-contain"
            referrerpolicy="no-referrer"
          />
          <video
            v-else
            :src="previewItem.media_url"
            :poster="previewItem.thumbnail_url || undefined"
            controls
            autoplay
            loop
            class="max-w-full max-h-[80vh]"
          />
        </div>
        <div class="md:w-72 shrink-0 text-sm">
          <div class="mb-3">
            <div class="text-xs text-ink-500 mb-1">提示词</div>
            <div class="bg-gray-50 rounded p-2 whitespace-pre-wrap">{{ previewItem.prompt }}</div>
          </div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="分类">{{ previewItem.category }}</el-descriptions-item>
            <el-descriptions-item label="模型">{{ previewItem.model_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="来源">{{ previewItem.source_name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="auditTagType(previewItem.audit_status || '')" effect="plain" size="small">
                {{ auditLabel(previewItem.audit_status || '') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建">{{ formatTime(previewItem.created_at) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
