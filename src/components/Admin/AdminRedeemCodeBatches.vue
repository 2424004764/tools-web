<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchRedeemCodeBatch,
  fetchRedeemCodeBatches,
  updateRedeemCodeBatch,
  type RedeemCodeBatchRow,
} from '@/api/admin/redeem-code-batches'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<RedeemCodeBatchRow[]>([])
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
})

// ============ 格式化 ============
const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** 使用百分比（0~100，保留 1 位小数） */
const usagePercent = (row: RedeemCodeBatchRow) => {
  if (!row.total) return '0'
  return ((row.used / row.total) * 100).toFixed(1)
}

const usageBarClass = (row: RedeemCodeBatchRow) => {
  const p = row.total ? row.used / row.total : 0
  if (p >= 1) return 'bg-emerald-500'
  if (p >= 0.5) return 'bg-accent-500'
  if (p > 0) return 'bg-amber-400'
  return 'bg-slate-200'
}

// ============ 加载 ============
const load = async () => {
  loading.value = true
  try {
    const result = await fetchRedeemCodeBatches({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
    })
    list.value = result.list
    pagination.value = result.pagination
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '加载批次列表失败')
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

// ============ 一键复制全部 codes ============
const copyState = reactive<{ id: string; copying: boolean }>({
  id: '',
  copying: false,
})

const copyBatchCodes = async (row: RedeemCodeBatchRow) => {
  copyState.id = row.batch_id
  copyState.copying = true
  try {
    const detail = await fetchRedeemCodeBatch(row.batch_id)
    if (!detail.codes.length) {
      ElMessage.warning('该批次下没有任何兑换码')
      return
    }
    await navigator.clipboard.writeText(detail.codes.join('\n'))
    ElMessage.success(`已复制 ${row.batch_id.slice(0, 8)}… 全部 ${detail.codes.length} 个兑换码`)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '复制失败，请检查浏览器剪贴板权限')
  } finally {
    copyState.copying = false
    copyState.id = ''
  }
}

// ============ 编辑备注 ============
const noteDialog = reactive({
  visible: false,
  batchId: '',
  shortId: '',
  note: '',
  submitting: false,
})

const openNoteDialog = (row: RedeemCodeBatchRow) => {
  noteDialog.batchId = row.batch_id
  noteDialog.shortId = row.batch_id.slice(0, 8) + '…'
  noteDialog.note = row.note || ''
  noteDialog.visible = true
}

const submitNote = async () => {
  if (!noteDialog.batchId) return
  noteDialog.submitting = true
  try {
    await updateRedeemCodeBatch(noteDialog.batchId, { note: noteDialog.note })
    ElMessage.success('备注已更新')
    noteDialog.visible = false
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '更新失败')
  } finally {
    noteDialog.submitting = false
  }
}

const clearBatchNote = () => {
  ElMessageBox.confirm(
    `确认清空批次 ${noteDialog.shortId} 的备注？`,
    '清空备注',
    {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    },
  )
    .then(() => {
      noteDialog.note = ''
      return submitNote()
    })
    .catch(() => {})
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <!-- 顶部栏 -->
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">兑换码批次</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索 备注 / 批次 ID 前缀"
        clearable
        class="!w-72"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-button @click="load">刷新</el-button>
      <el-button
        type="primary"
        class="!bg-accent-500 hover:!bg-accent-600 !border-none"
        @click="$router.push('/admin/redeem-codes')"
      >
        生成新批次 →
      </el-button>
    </div>

    <!-- 表格 -->
    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default">
        <el-table-column label="批次" min-width="180">
          <template #default="{ row }">
            <code class="font-mono text-body-sm text-ink-900">
              {{ row.batch_id.slice(0, 8) }}…
            </code>
          </template>
        </el-table-column>

        <el-table-column label="积分" width="90" align="right">
          <template #default="{ row }">
            <span class="font-semibold text-accent-700">
              {{ row.credits }}<span class="text-caption text-ink-400"> / 码</span>
            </span>
          </template>
        </el-table-column>

        <el-table-column label="总量 / 已兑换" min-width="200">
          <template #default="{ row }">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <strong class="text-ink-900">{{ row.used }}</strong>
                <span class="text-ink-400">/</span>
                <span class="text-ink-700">{{ row.total }}</span>
                <span class="text-caption text-ink-400 ml-1">({{ usagePercent(row) }}%)</span>
              </div>
              <div class="h-1.5 w-40 rounded-full bg-surface-2 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="usageBarClass(row)"
                  :style="{ width: Math.min(100, Number(usagePercent(row))) + '%' }"
                />
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="过期" min-width="160">
          <template #default="{ row }">
            <span class="text-caption text-ink-700">{{ formatTime(row.expires_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="备注" min-width="220">
          <template #default="{ row }">
            <span
              v-if="row.note"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption bg-amber-50 text-amber-800 border border-amber-200"
            >
              📌 {{ row.note }}
            </span>
            <span v-else class="text-ink-400 text-caption">（无）</span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">
            <span class="text-caption text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :loading="copyState.id === row.batch_id && copyState.copying"
              @click="copyBatchCodes(row)"
            >
              📋 复制全部
            </el-button>
            <el-button
              link
              type="primary"
              @click="openNoteDialog(row)"
            >
              ✏️ 编辑备注
            </el-button>
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

    <!-- 编辑备注弹窗 -->
    <el-dialog
      v-model="noteDialog.visible"
      title="编辑批次备注"
      width="480px"
      align-center
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" class="!mt-2">
        <el-form-item label="批次">
          <code class="font-mono text-caption text-ink-700">{{ noteDialog.shortId }}</code>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="noteDialog.note"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="例如：国庆活动 / 已上架，请勿修改 / 手动补发"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          v-if="noteDialog.note"
          @click="clearBatchNote"
        >清空备注</el-button>
        <el-button @click="noteDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="noteDialog.submitting"
          class="!bg-accent-500 hover:!bg-accent-600 !border-none"
          @click="submitNote"
        >保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>