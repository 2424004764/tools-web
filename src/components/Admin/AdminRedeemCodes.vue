<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  fetchRedeemCodes,
  generateRedeemCodes,
  type ListRedeemCodesParams,
} from '@/api/admin/redeem-codes'
import type {
  AdminPagination,
  GenerateRedeemCodesResult,
  RedeemCode,
  RedeemCodeBatch,
} from '@/types/admin'

const loading = ref(false)
const list = ref<RedeemCode[]>([])
const batches = ref<RedeemCodeBatch[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

const filter = reactive<ListRedeemCodesParams>({
  keyword: '',
  status: '',
  batch: '',
})

// ============ 格式化 ============
const formatTime = (s: string | null) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const statusMeta = (s: RedeemCode['status']) => {
  switch (s) {
    case 'unused':
      return { label: '未使用', cls: 'bg-slate-100 text-slate-700' }
    case 'used':
      return { label: '已兑换', cls: 'bg-emerald-100 text-emerald-700' }
    case 'expired':
      return { label: '已过期', cls: 'bg-rose-100 text-rose-700' }
    default:
      return { label: s, cls: 'bg-gray-100 text-gray-500' }
  }
}

const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard?.writeText(text)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

// ============ 加载 ============
const load = async () => {
  loading.value = true
  try {
    const result = await fetchRedeemCodes({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      status: filter.status || undefined,
      batch: filter.batch || undefined,
    })
    list.value = result.list
    pagination.value = result.pagination
    batches.value = result.batches
  } catch (err) {
    console.error(err)
    ElMessage.error('加载兑换码列表失败')
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

// ============ 生成批次弹窗 ============
const genDialog = reactive({
  visible: false,
  credits: 1000,
  count: 10,
  expires_at: '' as string,
  note: '',
  submitting: false,
})

const openGenDialog = () => {
  genDialog.credits = 1000
  genDialog.count = 10
  genDialog.expires_at = ''
  genDialog.note = ''
  genDialog.visible = true
}

const submitGen = async () => {
  if (!Number.isInteger(genDialog.credits) || genDialog.credits <= 0 || genDialog.credits > 1000000) {
    ElMessage.warning('积分值必须是 1~1000000 的正整数')
    return
  }
  if (!Number.isInteger(genDialog.count) || genDialog.count <= 0 || genDialog.count > 1000) {
    ElMessage.warning('数量必须是 1~1000 的正整数')
    return
  }
  if (genDialog.expires_at) {
    const t = new Date(genDialog.expires_at)
    if (Number.isNaN(t.getTime())) {
      ElMessage.warning('过期时间格式不合法')
      return
    }
  }

  genDialog.submitting = true
  try {
    genResult.value = await generateRedeemCodes({
      credits: genDialog.credits,
      count: genDialog.count,
      expires_at: genDialog.expires_at || null,
      note: genDialog.note.trim() || null,
    })
    ElMessage.success(`已生成 ${genResult.value.count} 个兑换码`)
    genDialog.visible = false
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '生成失败')
  } finally {
    genDialog.submitting = false
  }
}

// ============ 生成结果展示弹窗 ============
const genResult = ref<GenerateRedeemCodesResult | null>(null)
const resultDialogVisible = ref(false)

const closeResultDialog = () => {
  resultDialogVisible.value = false
  genResult.value = null
}

const copyAllCodes = () => {
  if (!genResult.value) return
  const text = genResult.value.codes.join('\n')
  copyText(text, `全部 ${genResult.value.count} 个兑换码`)
}

const exportCsv = () => {
  if (!genResult.value) return
  const r = genResult.value
  // CSV: code,credits,expires_at,batch_id,note
  const lines = ['code,credits,expires_at,batch_id,note']
  for (const c of r.codes) {
    const expires = r.expires_at || ''
    const note = (r.note || '').replace(/"/g, '""')
    lines.push(`${c},${r.credits},${expires},${r.batch_id},"${note}"`)
  }
  const csv = '﻿' + lines.join('\n') // BOM 让 Excel 识别 UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `redeem-codes-${r.batch_id.slice(0, 8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 CSV')
}

// 选中某个批次 → 跳到筛选
const filterByBatch = (batchId: string) => {
  filter.batch = batchId
  pagination.value.page = 1
  load()
}

// 移动端分页器适配：< 640px 时切精简布局 + 5 个页码 + small 模式
const { isMobile } = useIsMobile()

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <!-- 顶部栏 -->
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">兑换码管理</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索 code 前缀 / 兑换人邮箱"
        clearable
        class="!w-64"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select
        v-model="filter.status"
        placeholder="状态"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option label="全部状态" value="" />
        <el-option label="未使用" value="unused" />
        <el-option label="已兑换" value="used" />
        <el-option label="已过期" value="expired" />
      </el-select>

      <el-select
        v-model="filter.batch"
        placeholder="按批次筛选"
        clearable
        filterable
        class="!w-56"
        @change="handleSearch"
      >
        <el-option label="全部批次" value="" />
        <el-option
          v-for="b in batches"
          :key="b.batch_id"
          :value="b.batch_id"
          :label="`${b.batch_id.slice(0, 8)}… · ${b.total} 个${b.used ? `（已用 ${b.used}）` : ''}${b.note ? ' · ' + b.note : ''}`"
        />
      </el-select>

      <el-button @click="load">刷新</el-button>
      <el-button
        type="primary"
        class="!bg-accent-500 hover:!bg-accent-600 !border-none"
        @click="openGenDialog"
      >
        生成新批次
      </el-button>
    </div>

    <!-- 表格 -->
    <el-card shadow="never" class="!rounded-xl">
      <el-table :data="list" stripe size="default">
        <el-table-column label="兑换码" min-width="170">
          <template #default="{ row }">
            <code class="font-mono text-body-sm text-ink-900 select-all">{{ row.code }}</code>
          </template>
        </el-table-column>

        <el-table-column label="积分" width="80" align="right">
          <template #default="{ row }">
            <span class="font-semibold text-accent-700">{{ row.credits }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span
              class="inline-block px-2 py-0.5 rounded text-caption font-medium"
              :class="statusMeta(row.status).cls"
            >{{ statusMeta(row.status).label }}</span>
          </template>
        </el-table-column>

        <el-table-column label="过期时间" min-width="160">
          <template #default="{ row }">
            <span class="text-caption text-ink-700">{{ formatTime(row.expires_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="兑换人" min-width="180">
          <template #default="{ row }">
            <template v-if="row.used_by">
              <div class="flex flex-col">
                <span class="text-ink-900 text-body-sm">{{ row.user_name || row.user_email || row.used_by }}</span>
                <span class="text-xs text-ink-400">{{ row.user_email || row.used_by.slice(0, 12) }}</span>
              </div>
            </template>
            <span v-else class="text-ink-400">-</span>
          </template>
        </el-table-column>

        <el-table-column label="兑换时间" min-width="160">
          <template #default="{ row }">
            <span class="text-caption text-ink-700">{{ formatTime(row.used_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="批次" min-width="180">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              class="!font-mono !text-caption"
              @click="filterByBatch(row.batch_id)"
            >
              {{ row.batch_id.slice(0, 8) }}…
            </el-button>
            <span v-if="row.note" class="text-xs text-ink-400 ml-1">· {{ row.note }}</span>
          </template>
        </el-table-column>

        <el-table-column label="生成时间" min-width="160">
          <template #default="{ row }">
            <span class="text-caption text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" @click="copyText(row.code, '兑换码')">
              复制
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div :class="isMobile ? 'flex justify-center mt-4 overflow-x-auto py-1' : 'flex justify-end mt-4'">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :page-count="pagination.totalPages"
          :layout="isMobile ? 'prev, pager, next' : 'total, prev, pager, next, jumper'"
          :pager-count="isMobile ? 5 : 7"
          :small="isMobile"
          :background="true"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 生成批次弹窗 -->
    <el-dialog
      v-model="genDialog.visible"
      title="生成兑换码批次"
      width="520px"
      align-center
      destroy-on-close
    >
      <el-form label-width="100px" class="!space-y-1">
        <el-form-item label="每个积分" required>
          <el-input-number
            v-model="genDialog.credits"
            :min="1"
            :max="1000000"
            :step="100"
            class="!w-full"
          />
          <p class="text-caption text-ink-400 mt-1">兑换码面值（1 元 = 100 积分）</p>
        </el-form-item>

        <el-form-item label="生成数量" required>
          <el-input-number
            v-model="genDialog.count"
            :min="1"
            :max="1000"
            :step="1"
            class="!w-full"
          />
          <p class="text-caption text-ink-400 mt-1">1 ~ 1000 个</p>
        </el-form-item>

        <el-form-item label="过期时间">
          <el-date-picker
            v-model="genDialog.expires_at"
            type="datetime"
            placeholder="留空 = 永不过期"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            :default-time="new Date(2099, 11, 31, 23, 59, 59)"
            class="!w-full"
            clearable
          />
          <p class="text-caption text-ink-400 mt-1">留空则永不过期；支持点选日历或键盘输入</p>
        </el-form-item>

        <el-form-item label="批次备注">
          <el-input
            v-model="genDialog.note"
            maxlength="200"
            show-word-limit
            placeholder="可选，例如「国庆活动」"
          />
        </el-form-item>

        <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3 text-caption text-amber-800">
          <strong>共将生成 {{ genDialog.count }} 个兑换码</strong>，每个可兑换 {{ genDialog.credits }} 积分。
          生成后请妥善保管，列表页可随时查看兑换状态。
        </div>
      </el-form>

      <template #footer>
        <el-button @click="genDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="genDialog.submitting"
          class="!bg-accent-500 hover:!bg-accent-600 !border-none"
          @click="submitGen"
        >
          生成
        </el-button>
      </template>
    </el-dialog>

    <!-- 生成结果展示弹窗 -->
    <el-dialog
      :model-value="resultDialogVisible"
      title="生成成功"
      width="560px"
      align-center
      @close="closeResultDialog"
    >
      <template v-if="genResult">
        <p class="text-body-sm text-ink-700 mb-3">
          批次 <code class="font-mono px-1.5 py-0.5 rounded bg-surface-2 text-caption">{{ genResult.batch_id }}</code>
          · 共 {{ genResult.count }} 个 · 每个 {{ genResult.credits }} 积分
        </p>
        <el-input
          :model-value="genResult.codes.join('\n')"
          type="textarea"
          :rows="10"
          readonly
          class="!font-mono"
        />
        <p class="text-caption text-ink-400 mt-2">
          {{ genResult.note ? '备注：' + genResult.note + ' · ' : '' }}
          过期：{{ genResult.expires_at ? formatTime(genResult.expires_at) : '永不过期' }}
        </p>
      </template>

      <template #footer>
        <el-button @click="exportCsv">导出 CSV</el-button>
        <el-button @click="copyAllCodes">一键复制全部</el-button>
        <el-button type="primary" @click="closeResultDialog">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>