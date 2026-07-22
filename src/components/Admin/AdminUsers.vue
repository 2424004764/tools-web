<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  fetchAdminUsers,
  adjustUserCredits,
  toggleAdminUserDisabled,
  updateAdminUser,
} from '@/api/admin/user'
import type { AdminUser, AdminPagination } from '@/types/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const list = ref<AdminUser[]>([])
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
  disabled: '' as '' | '0' | '1',
})

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      disabled: filter.disabled || undefined,
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

const copyUid = (uid: string) => {
  navigator.clipboard?.writeText(uid).then(
    () => ElMessage.success('UID 已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

// ============ 积分调整弹窗 ============
const creditDialog = reactive({
  visible: false,
  uid: '',
  userLabel: '',
  type: 'grant' as 'grant' | 'deduct',
  amount: 0,
  reason: '',
  submitting: false,
})

const openCreditDialog = (user: AdminUser) => {
  creditDialog.uid = user.id
  creditDialog.userLabel = user.username || user.email || user.id
  creditDialog.type = 'grant'
  creditDialog.amount = 0
  creditDialog.reason = ''
  creditDialog.visible = true
}

const submitCredit = async () => {
  if (!creditDialog.uid) return
  if (!Number.isInteger(creditDialog.amount) || creditDialog.amount <= 0) {
    ElMessage.warning('请输入大于 0 的整数金额')
    return
  }
  creditDialog.submitting = true
  try {
    const result = await adjustUserCredits(creditDialog.uid, {
      type: creditDialog.type,
      amount: creditDialog.amount,
      reason: creditDialog.reason || undefined,
    })
    ElMessage.success(
      `${creditDialog.type === 'grant' ? '赠送' : '扣减'}成功：余额 ${result.balanceBefore} → ${result.balanceAfter}`,
    )
    creditDialog.visible = false
    load()
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '操作失败')
  } finally {
    creditDialog.submitting = false
  }
}

// ============ 启用/禁用用户 ============
const handleToggleDisabled = async (user: AdminUser) => {
  const willDisable = !user.is_disabled
  let reason = ''
  if (willDisable) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请输入禁用原因（可选）',
        '禁用用户',
        {
          confirmButtonText: '确认禁用',
          cancelButtonText: '取消',
          inputPlaceholder: '例如：违规行为',
          inputValidator: () => true,
        },
      )
      reason = value || ''
    } catch {
      return
    }
  }
  try {
    await toggleAdminUserDisabled(user.id, willDisable, reason)
    ElMessage.success(willDisable ? '已禁用' : '已启用')
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

// ============ 修改用户名 ============
const editDialog = reactive({
  visible: false,
  uid: '',
  username: '',
  submitting: false,
})

const openEditDialog = (user: AdminUser) => {
  editDialog.uid = user.id
  editDialog.username = user.username || ''
  editDialog.visible = true
}

const submitEdit = async () => {
  if (!editDialog.uid) return
  editDialog.submitting = true
  try {
    await updateAdminUser(editDialog.uid, { username: editDialog.username })
    ElMessage.success('已更新')
    editDialog.visible = false
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  } finally {
    editDialog.submitting = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">用户管理</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索邮箱 / 用户名 / UID"
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
        v-model="filter.disabled"
        placeholder="状态"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="正常" value="0" />
        <el-option label="已禁用" value="1" />
      </el-select>

      <el-button @click="load">刷新</el-button>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default">
        <el-table-column label="UID" min-width="120">
          <template #default="{ row }">
            <div class="flex items-center gap-1">
              <code class="text-xs text-ink-500">{{ row.id.slice(0, 10) }}…</code>
              <el-button link size="small" @click="copyUid(row.id)">复制</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="邮箱" min-width="180">
          <template #default="{ row }">
            <span class="text-ink-900">{{ row.email || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户名" min-width="120">
          <template #default="{ row }">
            <span class="text-ink-700">{{ row.username || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="积分余额" width="120" align="right">
          <template #default="{ row }">
            <el-tag type="success" effect="plain" size="small">
              {{ row.credits_balance ?? 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.is_admin"
              type="warning"
              effect="dark"
              size="small"
            >管理员</el-tag>
            <el-tag
              v-else-if="row.is_disabled"
              type="danger"
              effect="dark"
              size="small"
            >已禁用</el-tag>
            <el-tag v-else type="success" effect="plain" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.last_login) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openCreditDialog(row)">
              调整积分
            </el-button>
            <el-button link size="small" @click="openEditDialog(row)">改名</el-button>
            <el-button
              v-if="!row.is_admin"
              :type="row.is_disabled ? 'success' : 'danger'"
              link
              size="small"
              @click="handleToggleDisabled(row)"
            >
              {{ row.is_disabled ? '启用' : '禁用' }}
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

    <!-- 积分调整弹窗 -->
    <el-dialog
      v-model="creditDialog.visible"
      :title="`调整积分 - ${creditDialog.userLabel}`"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" class="!mt-2">
        <el-form-item label="操作类型">
          <el-radio-group v-model="creditDialog.type">
            <el-radio-button value="grant">赠送</el-radio-button>
            <el-radio-button value="deduct">扣减</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number
            v-model="creditDialog.amount"
            :min="1"
            :max="1000000"
            :step="10"
            controls-position="right"
            class="!w-full"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="creditDialog.reason"
            placeholder="可选，将记录在流水中"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="creditDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="creditDialog.submitting"
          @click="submitCredit"
        >
          确认{{ creditDialog.type === 'grant' ? '赠送' : '扣减' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 改名弹窗 -->
    <el-dialog
      v-model="editDialog.visible"
      title="修改用户名"
      width="380px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" class="!mt-2">
        <el-form-item label="用户名">
          <el-input v-model="editDialog.username" maxlength="64" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="editDialog.submitting"
          @click="submitEdit"
        >保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>