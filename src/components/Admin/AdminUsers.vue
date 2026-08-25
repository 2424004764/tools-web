<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  fetchAdminUsers,
  adjustUserCredits,
  toggleAdminUserDisabled,
  updateAdminUser,
  batchAdjustUserCredits,
  fetchUserCreditLogs,
  createAdminUser,
  deleteAdminUser,
} from '@/api/admin/user'
import type {
  AdminUser,
  AdminPagination,
  BatchAdjustCreditResult,
  CreateUserResult,
  CreditTransaction,
} from '@/types/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  View,
  Hide,
  ArrowDown,
} from '@element-plus/icons-vue'

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

// ============ 表格选择 ============
const selectedUids = ref<string[]>([])
const handleSelectionChange = (rows: AdminUser[]) => {
  selectedUids.value = rows.map((r) => r.id)
}
const clearSelection = () => {
  selectedUids.value = []
}
const isSelectable = (row: AdminUser) => !row.is_admin

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

// ============ 批量积分调整弹窗 ============
const batchCreditDialog = reactive({
  visible: false,
  type: 'grant' as 'grant' | 'deduct',
  amount: 0,
  reason: '',
  submitting: false,
  lastResult: null as BatchAdjustCreditResult | null,
})

const openBatchCreditDialog = () => {
  batchCreditDialog.type = 'grant'
  batchCreditDialog.amount = 0
  batchCreditDialog.reason = ''
  batchCreditDialog.lastResult = null
  batchCreditDialog.visible = true
}

const closeBatchCreditDialog = () => {
  batchCreditDialog.visible = false
  // 关闭弹窗后清掉上次结果，避免下次打开时残留
  batchCreditDialog.lastResult = null
}

const submitBatchCredit = async () => {
  if (!Number.isInteger(batchCreditDialog.amount) || batchCreditDialog.amount <= 0) {
    ElMessage.warning('请输入大于 0 的整数金额')
    return
  }
  const scopeAll = selectedUids.value.length === 0

  // 全用户模式额外二次确认
  if (scopeAll) {
    const total = pagination.value.total
    const op = batchCreditDialog.type === 'grant' ? '赠送' : '扣减'
    try {
      const { value } = await ElMessageBox.prompt(
        `本次将对【全部 ${total} 个非管理员用户】${op} ${batchCreditDialog.amount} 积分。\n\n请输入「确认」二字以继续。`,
        '⚠️ 全用户范围确认',
        {
          confirmButtonText: '确认执行',
          cancelButtonText: '取消',
          inputPlaceholder: '请输入：确认',
          inputPattern: /^确认$/,
          inputValidator: (v: string) =>
            v === '确认' || (v && v.trim() === '确认') || '请输入「确认」二字',
          type: 'warning',
        },
      )
      if (value !== '确认') return
    } catch {
      return
    }
  }

  batchCreditDialog.submitting = true
  try {
    const result = await batchAdjustUserCredits({
      type: batchCreditDialog.type,
      amount: batchCreditDialog.amount,
      reason: batchCreditDialog.reason || undefined,
      uids: scopeAll ? undefined : selectedUids.value,
    })
    batchCreditDialog.lastResult = result
    ElMessage.success(
      `完成：成功 ${result.succeeded}，跳过 ${result.skipped}，失败 ${result.failed.length}`,
    )
    clearSelection()
    load()
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '操作失败')
  } finally {
    batchCreditDialog.submitting = false
  }
}

// ============ 单用户积分明细弹窗 ============
const logsDialog = reactive({
  visible: false,
  uid: '',
  userLabel: '',
  currentBalance: 0,
  list: [] as CreditTransaction[],
  loading: false,
  type: '' as '' | 'grant' | 'deduct' | 'reverse',
  page: 1,
  pageSize: 15,
  total: 0,
})

const openLogsDialog = async (user: AdminUser) => {
  logsDialog.visible = true
  logsDialog.uid = user.id
  logsDialog.userLabel = user.username || user.email || user.id
  logsDialog.currentBalance = user.credits_balance ?? 0
  logsDialog.page = 1
  logsDialog.type = ''
  await loadLogs()
}

const loadLogs = async () => {
  if (!logsDialog.uid) return
  logsDialog.loading = true
  try {
    const result = await fetchUserCreditLogs(logsDialog.uid, {
      page: logsDialog.page,
      pageSize: logsDialog.pageSize,
      type: logsDialog.type,
    })
    logsDialog.list = result.list
    logsDialog.total = result.pagination.total
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '加载流水失败')
  } finally {
    logsDialog.loading = false
  }
}

const handleLogsPageChange = (p: number) => {
  logsDialog.page = p
  loadLogs()
}

const handleLogsTypeChange = () => {
  logsDialog.page = 1
  loadLogs()
}

const typeMeta = (t: CreditTransaction['type']) => {
  switch (t) {
    case 'grant':   return { label: '获得', type: 'success' as const }
    case 'deduct':  return { label: '消费', type: 'danger' as const }
    case 'reverse': return { label: '退还', type: 'warning' as const }
    default:        return { label: t,     type: 'info' as const }
  }
}

const sourceMeta = (s: CreditTransaction['source']) => {
  switch (s) {
    case 'system': return { label: '系统',   type: 'info' as const }
    case 'admin':  return { label: '管理员', type: 'warning' as const }
    case 'tool':   return { label: '工具',   type: 'success' as const }
    default:       return { label: '未知',   type: 'info' as const }
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

// ============ 删除用户 ============
const handleDeleteUser = async (user: AdminUser) => {
  const label = user.username || user.email || user.id
  try {
    await ElMessageBox.confirm(
      `确定永久删除用户「${label}」（${user.email || '-'}）吗？此操作不可恢复，会一并清理该用户的积分、流水、收藏、密码库等所有数据。`,
      '⚠️ 删除用户',
      {
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  try {
    await deleteAdminUser(user.id)
    ElMessage.success('已删除')
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '删除失败')
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

// ============ 创建用户弹窗 ============
const createDialog = reactive({
  visible: false,
  submitting: false,
  form: { email: '', username: '', password: '', is_admin: false },
  showPassword: false,
  result: null as CreateUserResult | null,
})

// 与 functions/api/admin/users/index.js::generatePassword 字符集/长度严格一致
const generateLocalPassword = (len = 10): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

const openCreateDialog = () => {
  createDialog.form = { email: '', username: '', password: '', is_admin: false }
  createDialog.showPassword = false
  createDialog.result = null
  createDialog.visible = true
}

const fillGeneratedPassword = () => {
  createDialog.form.password = generateLocalPassword(10)
  createDialog.showPassword = true
}

const submitCreate = async () => {
  if (!createDialog.form.email.trim()) {
    ElMessage.warning('请输入邮箱')
    return
  }
  if (!createDialog.form.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  // 管理员二次确认
  if (createDialog.form.is_admin) {
    try {
      await ElMessageBox.confirm(
        '确定将该用户创建为管理员？此操作后续可禁用但请谨慎。',
        '二次确认',
        { type: 'warning', confirmButtonText: '确认创建', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }
  createDialog.submitting = true
  try {
    const result = await createAdminUser({
      email: createDialog.form.email.trim(),
      username: createDialog.form.username.trim(),
      password: createDialog.form.password || undefined,
      is_admin: createDialog.form.is_admin,
    })
    createDialog.result = result
    ElMessage.success('用户创建成功')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '创建失败')
  } finally {
    createDialog.submitting = false
  }
}

const finishCreate = () => {
  createDialog.visible = false
  load()
}

const copyText = (text: string, label = '内容') => {
  navigator.clipboard?.writeText(text).then(
    () => ElMessage.success(`${label}已复制`),
    () => ElMessage.warning('复制失败'),
  )
}

onMounted(() => {
  load()
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

// 移动端检测（< 640px）：用于弹窗宽度自适应
const isMobile = ref(false)
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 640
}
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

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <el-button
        type="primary"
        :disabled="batchCreditDialog.submitting || createDialog.submitting"
        @click="openCreateDialog"
      >
        创建用户
      </el-button>
      <el-button
        type="primary"
        :disabled="batchCreditDialog.submitting"
        @click="openBatchCreditDialog"
      >
        批量调整积分
      </el-button>
      <span v-if="selectedUids.length > 0" class="text-sm text-ink-500">
        已选 <span class="font-semibold text-accent-600">{{ selectedUids.length }}</span> 个用户
        <el-button link size="small" type="info" @click="clearSelection">清空</el-button>
      </span>
      <span v-else class="text-xs text-ink-400">
        不勾选则默认作用于全部非管理员用户
      </span>
    </div>

    <el-card shadow="never" class="!rounded-xl">
      <el-table
        :data="list"
        stripe
        size="default"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="48"
          :selectable="isSelectable"
        />
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
        <el-table-column label="今日使用工具" width="140" align="center">
          <template #default="{ row }">
            <template v-if="(row.today_usage_count ?? 0) > 0">
              <div class="text-sm text-ink-700 tabular-nums leading-tight">
                <span class="font-semibold text-accent-600">{{ row.today_tool_count ?? 0 }}</span>
                <span class="text-ink-500 text-xs mx-0.5">个工具 /</span>
                <span class="font-semibold text-accent-600">{{ row.today_usage_count ?? 0 }}</span>
                <span class="text-ink-500 text-xs ml-0.5">次</span>
              </div>
            </template>
            <span v-else class="text-xs text-ink-400">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button link size="small" type="primary">
                操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openCreditDialog(row)">
                    调整积分
                  </el-dropdown-item>
                  <el-dropdown-item @click="openLogsDialog(row)">
                    积分明细
                  </el-dropdown-item>
                  <el-dropdown-item @click="openEditDialog(row)">
                    改名
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="!row.is_admin"
                    divided
                    @click="handleToggleDisabled(row)"
                  >
                    {{ row.is_disabled ? '启用' : '禁用' }}
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="!row.is_admin"
                    divided
                    @click="handleDeleteUser(row)"
                  >
                    <span class="text-danger-600">删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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

    <!-- 批量积分调整弹窗 -->
    <el-dialog
      v-model="batchCreditDialog.visible"
      :title="batchCreditDialog.lastResult ? '批量调整完成' : '批量调整积分'"
      width="560px"
      :close-on-click-modal="false"
      @close="closeBatchCreditDialog"
    >
      <template v-if="!batchCreditDialog.lastResult">
        <el-form label-width="80px" class="!mt-2">
          <el-form-item label="操作类型">
            <el-radio-group v-model="batchCreditDialog.type">
              <el-radio-button value="grant">赠送</el-radio-button>
              <el-radio-button value="deduct">扣减</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="金额" required>
            <el-input-number
              v-model="batchCreditDialog.amount"
              :min="1"
              :max="1000000"
              :step="10"
              controls-position="right"
              class="!w-full"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="batchCreditDialog.reason"
              placeholder="可选，将记录在所有流水中"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="作用范围">
            <div
              class="w-full rounded-md px-3 py-2 text-sm border"
              :class="
                selectedUids.length > 0
                  ? 'bg-accent-50 border-accent-200 text-accent-700'
                  : 'bg-danger-50 border-danger-200 text-danger-700'
              "
            >
              <template v-if="selectedUids.length > 0">
                ✓ 已勾选 <strong>{{ selectedUids.length }}</strong> 个用户
                <span class="text-ink-500 text-xs ml-1">（管理员行已自动排除）</span>
              </template>
              <template v-else>
                ⚠️ 未勾选任何用户，将作用于
                <strong>全部 {{ pagination.total }}</strong>
                个非管理员用户（管理员和您自己已被自动排除）
              </template>
            </div>
            <div class="text-xs text-ink-500 mt-1">
              deduct 模式：余额不足时会扣到 0，流水会标注实际扣减额。
            </div>
          </el-form-item>
        </el-form>
      </template>

      <template v-else>
        <el-descriptions :column="2" border size="small" class="!mt-2">
          <el-descriptions-item label="处理总数">{{ batchCreditDialog.lastResult.total }}</el-descriptions-item>
          <el-descriptions-item label="成功">{{ batchCreditDialog.lastResult.succeeded }}</el-descriptions-item>
          <el-descriptions-item label="跳过（余额为 0）">{{ batchCreditDialog.lastResult.skipped }}</el-descriptions-item>
          <el-descriptions-item label="失败">{{ batchCreditDialog.lastResult.failed.length }}</el-descriptions-item>
          <el-descriptions-item label="净变动" :span="2">
            <span :class="batchCreditDialog.lastResult.total_delta >= 0 ? 'text-success-600' : 'text-danger-600'">
              {{ batchCreditDialog.lastResult.total_delta >= 0 ? '+' : '' }}{{ batchCreditDialog.lastResult.total_delta }}
            </span>
            <span class="text-ink-500 text-xs ml-2">
              （绝对变动合计 {{ batchCreditDialog.lastResult.balance_change_total }}）
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="batchCreditDialog.lastResult.failed.length > 0"
          class="mt-4 max-h-48 overflow-auto rounded border border-danger-200 bg-danger-50 p-2"
        >
          <div class="text-sm font-medium text-danger-700 mb-1">失败列表：</div>
          <ul class="text-xs text-ink-700 space-y-0.5">
            <li v-for="f in batchCreditDialog.lastResult.failed" :key="f.uid">
              <code class="text-ink-500">{{ f.uid.slice(0, 12) }}…</code>
              — {{ f.error }}
            </li>
          </ul>
        </div>
      </template>

      <template #footer>
        <template v-if="!batchCreditDialog.lastResult">
          <el-button @click="closeBatchCreditDialog">取消</el-button>
          <el-button
            type="primary"
            :loading="batchCreditDialog.submitting"
            @click="submitBatchCredit"
          >
            确认{{ batchCreditDialog.type === 'grant' ? '赠送' : '扣减' }}
          </el-button>
        </template>
        <template v-else>
          <el-button type="primary" @click="closeBatchCreditDialog">关闭</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 单用户积分明细弹窗 -->
    <el-dialog
      v-model="logsDialog.visible"
      :title="`积分明细 - ${logsDialog.userLabel}`"
      width="820px"
      :close-on-click-modal="false"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div class="flex items-baseline gap-2">
          <span class="text-sm text-ink-500">当前余额</span>
          <span class="text-xl font-semibold text-emerald-600 tabular-nums">
            {{ logsDialog.currentBalance.toLocaleString('zh-CN') }}
          </span>
          <span class="text-xs text-ink-500">积分</span>
          <span class="text-xs text-ink-400 ml-2">
            UID: <code>{{ logsDialog.uid.slice(0, 12) }}…</code>
          </span>
        </div>
        <el-radio-group
          v-model="logsDialog.type"
          size="small"
          @change="handleLogsTypeChange"
        >
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="grant">获得</el-radio-button>
          <el-radio-button value="deduct">消费</el-radio-button>
          <el-radio-button value="reverse">退还</el-radio-button>
        </el-radio-group>
      </div>

      <el-table
        :data="logsDialog.list"
        v-loading="logsDialog.loading"
        stripe
        size="small"
        :max-height="500"
        :empty-text="logsDialog.loading ? '加载中…' : '暂无流水记录'"
      >
        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            <span class="text-xs text-ink-700 tabular-nums">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="typeMeta(row.type).type" size="small" effect="plain">
              {{ typeMeta(row.type).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="90" align="right">
          <template #default="{ row }">
            <span
              class="tabular-nums font-semibold"
              :class="row.amount > 0 ? 'text-emerald-600' : 'text-rose-600'"
            >
              {{ row.amount > 0 ? '+' : '' }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="余额" width="80" align="right">
          <template #default="{ row }">
            <span class="tabular-nums text-ink-700">{{ row.balance_after }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="sourceMeta(row.source).type" size="small" effect="plain">
              {{ sourceMeta(row.source).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作人" min-width="140">
          <template #default="{ row }">
            <span class="text-xs text-ink-700">
              {{ row.operator_name || row.operator_email || row.operator_uid }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="原因" min-width="200">
          <template #default="{ row }">
            <span class="text-xs text-ink-600 break-all">{{ row.reason || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end mt-3">
        <el-pagination
          :current-page="logsDialog.page"
          :page-size="logsDialog.pageSize"
          :total="logsDialog.total"
          :page-count="Math.max(1, Math.ceil(logsDialog.total / logsDialog.pageSize))"
          layout="total, prev, pager, next"
          :background="true"
          @current-change="handleLogsPageChange"
        />
      </div>
    </el-dialog>

    <!-- 创建用户弹窗 -->
    <el-dialog
      v-model="createDialog.visible"
      title="创建用户"
      :width="isMobile ? '92vw' : '520px'"
    >
      <!-- 表单面板 -->
      <template v-if="!createDialog.result">
        <el-form :label-width="isMobile ? '64px' : '90px'" class="!mt-2">
          <el-form-item label="邮箱" required>
            <el-input
              v-model="createDialog.form.email"
              placeholder="例如：user@example.com"
              maxlength="120"
              clearable
            />
          </el-form-item>
          <el-form-item label="用户名" required>
            <el-input
              v-model="createDialog.form.username"
              placeholder="用户显示名"
              maxlength="64"
              clearable
            />
          </el-form-item>
          <el-form-item label="初始密码">
            <el-input
              v-model="createDialog.form.password"
              :type="createDialog.showPassword ? 'text' : 'password'"
              placeholder="留空将自动生成 10 位随机密码"
              maxlength="64"
              clearable
            >
              <template #suffix>
                <div class="flex items-center gap-1">
                  <el-tooltip content="生成 10 位随机密码" placement="top">
                    <el-button
                      link
                      size="small"
                      :icon="Refresh"
                      @click="fillGeneratedPassword"
                    />
                  </el-tooltip>
                  <el-tooltip
                    :content="createDialog.showPassword ? '隐藏密码' : '显示密码'"
                    placement="top"
                  >
                    <el-button
                      link
                      size="small"
                      :icon="createDialog.showPassword ? View : Hide"
                      @click="createDialog.showPassword = !createDialog.showPassword"
                    />
                  </el-tooltip>
                </div>
              </template>
            </el-input>
            <div class="text-xs text-ink-500 mt-1">
              留空时由后端生成 10 位小写字母 + 数字随机密码，并在成功面板中展示一次。
            </div>
          </el-form-item>
          <el-form-item label="权限">
            <el-checkbox v-model="createDialog.form.is_admin">
              设为管理员
            </el-checkbox>
            <div class="text-xs text-ink-500 mt-1">
              管理员可访问 /admin 后台。勾选后创建时会有二次确认。
            </div>
          </el-form-item>
        </el-form>
      </template>

      <!-- 成功面板 -->
      <template v-else>
        <el-alert
          type="success"
          title="用户创建成功！请妥善保存以下信息并告知用户。"
          :closable="false"
          show-icon
          class="!mb-4"
        />
        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="UID">
            <div class="flex items-center gap-2">
              <code class="text-xs text-ink-700 break-all">{{ createDialog.result.id }}</code>
              <el-button link size="small" @click="copyText(createDialog.result.id, 'UID')">
                复制
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            <span class="text-ink-900">{{ createDialog.result.email }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="用户名">
            <span class="text-ink-900">{{ createDialog.result.username }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="权限">
            <el-tag
              v-if="createDialog.result.is_admin"
              type="warning"
              effect="dark"
              size="small"
            >管理员</el-tag>
            <el-tag v-else type="success" effect="plain" size="small">普通用户</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="初始密码">
            <div class="flex items-center gap-2 flex-wrap">
              <code class="text-sm font-mono text-rose-600 select-all">
                {{ createDialog.result.generated_password || createDialog.form.password }}
              </code>
              <el-tag
                v-if="createDialog.result.generated_password"
                size="small"
                type="warning"
                effect="plain"
              >服务端生成</el-tag>
              <el-tag
                v-else
                size="small"
                type="info"
                effect="plain"
              >管理员设置</el-tag>
              <el-button
                link
                size="small"
                type="primary"
                @click="copyText(createDialog.result.generated_password || createDialog.form.password, '初始密码')"
              >
                复制
              </el-button>
            </div>
          </el-descriptions-item>
        </el-descriptions>
        <div
          v-if="createDialog.result.generated_password"
          class="text-xs text-danger-600 mt-3"
        >
          ⚠️ 此密码由服务端生成，仅展示一次，关闭弹窗后无法再次查看，请立即复制并告知用户。
        </div>
        <div
          v-else
          class="text-xs text-ink-500 mt-3"
        >
          此密码由您在表单中设置，关闭弹窗后如遗忘可通过「重置密码」流程处理。
        </div>
      </template>

      <template #footer>
        <template v-if="!createDialog.result">
          <el-button @click="createDialog.visible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="createDialog.submitting"
            @click="submitCreate"
          >
            创建
          </el-button>
        </template>
        <template v-else>
          <el-button type="primary" @click="finishCreate">完成</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>