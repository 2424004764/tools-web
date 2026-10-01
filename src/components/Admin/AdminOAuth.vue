<script setup lang="ts">
// OAuth2 客户端应用管理：为子站签发 client_id / client_secret
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchOAuthClients,
  createOAuthClient,
  updateOAuthClient,
  deleteOAuthClient,
  resetOAuthClientSecret,
  type OAuthClient,
} from '@/api/admin/oauth-clients'
import type { AdminPagination } from '@/types/admin'

const loading = ref(false)
const list = ref<OAuthClient[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})
const keyword = ref('')

// ---- 新建 / 编辑弹窗 ----
const dialogVisible = ref(false)
const editing = ref<OAuthClient | null>(null)
const saving = ref(false)
const form = reactive({
  name: '',
  description: '',
  logo_url: '',
  redirect_uris: '',
})

// ---- 密钥仅展示一次的弹窗 ----
const secretDialogVisible = ref(false)
const secretInfo = reactive({ client_id: '', client_secret: '' })
// 正在重置密钥的应用 id（按钮 loading 用）
const resettingId = ref('')

const showSecret = (clientId: string, clientSecret: string) => {
  secretInfo.client_id = clientId
  secretInfo.client_secret = clientSecret
  secretDialogVisible.value = true
}

const copySecret = async () => {
  const text = `client_id: ${secretInfo.client_id}\nclient_secret: ${secretInfo.client_secret}`
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchOAuthClients({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: keyword.value || undefined,
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

const openCreate = () => {
  editing.value = null
  form.name = ''
  form.description = ''
  form.logo_url = ''
  form.redirect_uris = ''
  dialogVisible.value = true
}

const openEdit = (row: OAuthClient) => {
  editing.value = row
  form.name = row.name
  form.description = row.description
  form.logo_url = row.logo_url
  form.redirect_uris = row.redirect_uris
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写应用名称')
    return
  }
  if (!form.redirect_uris.trim()) {
    ElMessage.warning('请至少填写一个回调地址')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await updateOAuthClient(editing.value.client_id, { ...form })
      ElMessage.success('已保存')
      dialogVisible.value = false
      await load()
    } else {
      const created = await createOAuthClient({ ...form })
      dialogVisible.value = false
      await load()
      showSecret(created.client_id, created.client_secret)
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleToggleDisabled = async (row: OAuthClient) => {
  const next = !row.is_disabled
  try {
    await ElMessageBox.confirm(
      next
        ? `停用后「${row.name}」的授权与登录将立即失效。确定停用？`
        : `重新启用「${row.name}」？`,
      next ? '停用应用' : '启用应用',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: next ? 'warning' : 'info' },
    )
  } catch {
    return
  }
  try {
    await updateOAuthClient(row.client_id, { is_disabled: next })
    ElMessage.success(next ? '已停用' : '已启用')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '操作失败')
  }
}

const handleResetSecret = async (row: OAuthClient) => {
  try {
    await ElMessageBox.confirm(
      `重置后旧 client_secret 立即失效，该应用所有已登录用户的令牌将被撤销，子站需同步更新密钥。确定重置？`,
      '重置密钥',
      { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  resettingId.value = row.client_id
  try {
    const result = await resetOAuthClientSecret(row.client_id)
    await load()
    showSecret(result.client_id, result.client_secret)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '重置失败')
  } finally {
    resettingId.value = ''
  }
}

const handleDelete = async (row: OAuthClient) => {
  try {
    await ElMessageBox.confirm(
      `确定永久删除「${row.name}」吗？该应用的授权记录与令牌将一并作废，操作不可恢复。`,
      '删除应用',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteOAuthClient(row.client_id)
    ElMessage.success('已删除')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  load()
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">OAuth 应用</h2>
      <el-input
        v-model="keyword"
        placeholder="搜索应用名称 / client_id"
        clearable
        class="!w-64"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button @click="load">刷新</el-button>
      <el-button type="primary" @click="openCreate">新建应用</el-button>
    </div>

    <el-alert
      class="mb-4"
      type="info"
      :closable="false"
      show-icon
      title="子站统一登录（OAuth2 授权码模式）"
    >
      <template #default>
        <div class="text-[13px] leading-relaxed">
          子站把用户跳转到 /oauth/authorize?client_id=…&redirect_uri=…&state=… 完成授权，再 POST /api/oauth/token
          用授权码换令牌，GET /api/oauth/userinfo 拉取用户资料。
          <a
            href="/oauth/docs"
            target="_blank"
            rel="noopener"
            class="text-accent-600 hover:underline font-medium"
          >在线接入文档（发给子站开发者）↗</a>
        </div>
      </template>
    </el-alert>

    <el-table :data="list" stripe size="small">
      <el-table-column label="应用" min-width="180">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <img
              v-if="row.logo_url"
              :src="row.logo_url"
              class="w-8 h-8 rounded-lg object-cover border border-border-subtle"
              :alt="row.name"
            />
            <div
              v-else
              class="w-8 h-8 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-medium shrink-0"
            >
              {{ row.name.slice(0, 1) }}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-medium text-ink-900 truncate">{{ row.name }}</span>
              <span v-if="row.description" class="text-xs text-ink-500 truncate max-w-[200px]">{{ row.description }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="client_id" width="220">
        <template #default="{ row }">
          <span class="text-xs text-ink-600 font-mono break-all">{{ row.client_id }}</span>
        </template>
      </el-table-column>
      <el-table-column label="回调地址" min-width="200">
        <template #default="{ row }">
          <div class="text-xs text-ink-500 break-all">
            <div v-for="(u, i) in String(row.redirect_uris).split('\n')" :key="i" class="truncate" :title="u">
              {{ u }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="已授权用户" width="100" align="center">
        <template #default="{ row }">
          <span class="text-xs text-ink-600">{{ row.granted_users ?? 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_disabled ? 'danger' : 'success'" effect="plain" size="small">
            {{ row.is_disabled ? '已停用' : '正常' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <div class="flex gap-1">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link :type="row.is_disabled ? 'success' : 'warning'" @click="handleToggleDisabled(row)">
              {{ row.is_disabled ? '启用' : '停用' }}
            </el-button>
            <el-button
              size="small"
              link
              type="warning"
              :loading="resettingId === row.client_id"
              @click="handleResetSecret(row)"
            >重置密钥</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <!-- 新建 / 编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑应用' : '新建 OAuth 应用'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item label="应用名称" required>
          <el-input v-model="form.name" maxlength="40" placeholder="如：一方笔记" />
        </el-form-item>
        <el-form-item label="应用描述">
          <el-input v-model="form.description" maxlength="200" placeholder="展示在授权确认页（可选）" />
        </el-form-item>
        <el-form-item label="Logo 地址">
          <el-input v-model="form.logo_url" placeholder="https://…（可选，展示在授权确认页）" />
        </el-form-item>
        <el-form-item label="回调地址" required>
          <el-input
            v-model="form.redirect_uris"
            type="textarea"
            :rows="4"
            placeholder="每行一个，精确匹配&#10;https://sub.example.com/auth/callback"
          />
          <div class="text-xs text-ink-400 mt-1">每行一个完整 URL，授权时会精确匹配，不支持通配符。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ editing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 密钥仅展示一次 -->
    <el-dialog v-model="secretDialogVisible" title="客户端凭据（仅展示一次）" width="560px">
      <el-alert
        class="mb-4"
        type="warning"
        :closable="false"
        show-icon
        title="请立即保存 client_secret"
        description="关闭后无法再查看完整密钥（服务端只存密文），丢失只能重置。"
      />
      <el-form label-width="110px" label-position="left">
        <el-form-item label="client_id">
          <el-input :model-value="secretInfo.client_id" readonly />
        </el-form-item>
        <el-form-item label="client_secret">
          <el-input :model-value="secretInfo.client_secret" readonly class="font-mono" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copySecret">复制凭据</el-button>
        <el-button type="primary" @click="secretDialogVisible = false">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
