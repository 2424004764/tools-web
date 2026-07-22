<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { fetchGlobalCreditTransactions } from '@/api/admin/credit'
import type { CreditTransaction, AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<CreditTransaction[]>([])
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
  type: '' as '' | 'grant' | 'deduct' | 'reverse',
})

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const typeLabel = (t: string) => {
  switch (t) {
    case 'grant':
      return '赠送'
    case 'deduct':
      return '扣减'
    case 'reverse':
      return '撤销'
    case 'reset':
      return '重置'
    default:
      return t
  }
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchGlobalCreditTransactions({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      type: filter.type || undefined,
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

const fmtAmount = (n: number) => (n > 0 ? `+${n}` : `${n}`)

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">积分流水</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索用户邮箱/UID/备注"
        clearable
        class="!w-56"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select
        v-model="filter.type"
        placeholder="类型"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="赠送" value="grant" />
        <el-option label="扣减" value="deduct" />
        <el-option label="撤销" value="reverse" />
      </el-select>

      <el-button @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default">
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="flex flex-col">
              <span class="text-ink-900">{{ row.user_name || row.user_email || row.uid }}</span>
              <span class="text-xs text-ink-400">
                {{ row.user_email || row.uid.slice(0, 12) }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag
              :type="row.type === 'grant' ? 'success' : row.type === 'deduct' ? 'danger' : 'info'"
              effect="plain"
              size="small"
            >
              {{ typeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="100" align="right">
          <template #default="{ row }">
            <span
              :class="row.amount > 0 ? 'text-success-600' : 'text-danger-600'"
              class="font-medium"
            >
              {{ fmtAmount(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="余额后" width="100" align="right" prop="balance_after" />
        <el-table-column label="操作人" min-width="160">
          <template #default="{ row }">
            <span class="text-ink-700">
              <template v-if="row.operator_uid === 'SYSTEM'">系统</template>
              <template v-else>
                {{ row.operator_name || row.operator_email || (row.operator_uid.slice(0, 12) + '…') }}
              </template>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="160" prop="reason" show-overflow-tooltip />
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
  </div>
</template>