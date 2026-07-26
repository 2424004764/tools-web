<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/store/modules/user'
import { fetchMyTransactions, type CreditTransaction } from '@/api/me'
import { ElMessage } from 'element-plus'

/**
 * 公共：用户积分流水弹窗
 *
 * 用法：
 *   <CreditTransactionsDialog v-model="visible" />
 *   <CreditTransactionsDialog v-model="visible" tool-url="/ai-image-edit/" title="AI 图片编辑消耗明细" />
 *
 * Props:
 *   modelValue: 是否显示（v-model）
 *   title?: 弹窗标题，默认 "积分消耗明细"
 *   toolUrl?: 可选。若指定，则只展示该工具的流水（按 tool_url 过滤 + 头部副标题）。
 *                  后端当前不支持按 tool_url 过滤，所以过滤在前端做（适合小数据量）。
 *   pageSize?: 每页条数，默认 15
 *   toolOptions?: 可选，前端已知工具的 { url, title } 列表（用于补全 tool_title 在 reason 没匹配上的情况）
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    toolUrl?: string
    pageSize?: number
  }>(),
  {
    title: '积分消耗明细',
    toolUrl: '',
    pageSize: 15,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
}>()

const userStore = useUserStore()
const { credits, isLoggedIn } = storeToRefs(userStore)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// ======== 数据 ========
const allList = ref<CreditTransaction[]>([])  // 后端返回的全量
const loading = ref(false)
const page = ref(1)

// 当前展示（前端分页 + 工具过滤）
const filteredList = computed(() => {
  if (!props.toolUrl) return allList.value
  return allList.value.filter((tx) => tx.tool_url === props.toolUrl)
})

// 翻页
const total = computed(() => filteredList.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / props.pageSize)))
const pagedList = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return filteredList.value.slice(start, start + props.pageSize)
})

// 弹窗打开时拉取
const load = async () => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    return
  }
  loading.value = true
  try {
    // 一次性拉满所有需要的数据（按 pageSize=100 上限拉）
    const { list, pagination } = await fetchMyTransactions(1, 100)
    allList.value = list
    // 同步 store 里的余额（可能因管理后台手工调整有变化）
    if (pagination?.total !== undefined) {
      // 拉到的总条数只是当前页+分页，但 total 字段是真实总数
      // 这里只能确认"有数据"，不能反推余额
    }
  } catch (err: any) {
    console.warn('[CreditTransactionsDialog] load failed', err)
    ElMessage.error(err?.response?.data?.error || '加载流水失败')
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => {
  if (v) {
    page.value = 1
    load()
  }
})

// ======== 工具过滤时重置页码 + 同步刷新余额（防止 store 过期） ========
watch(
  () => props.toolUrl,
  () => {
    page.value = 1
  },
)

// ======== 展示 helpers ========
const typeMeta = (t: string) => {
  switch (t) {
    case 'grant':   return { label: '获得', bg: 'bg-emerald-100', text: 'text-emerald-700', amount: 'text-emerald-600', sign: '+' }
    case 'deduct':  return { label: '消费', bg: 'bg-rose-100',    text: 'text-rose-700',    amount: 'text-rose-600',    sign: '' }
    case 'reverse': return { label: '退还', bg: 'bg-amber-100',   text: 'text-amber-700',   amount: 'text-amber-600',   sign: '+' }
    default:        return { label: t,    bg: 'bg-gray-100',    text: 'text-gray-700',    amount: 'text-gray-600',    sign: '' }
  }
}

// 流水来源（system / admin / tool）。迁移前的老数据为 null → 展示"未知"
const sourceMeta = (s: 'system' | 'admin' | 'tool' | null | undefined) => {
  switch (s) {
    case 'system': return { label: '系统',   bg: 'bg-slate-100',   text: 'text-slate-700' }
    case 'admin':  return { label: '管理员', bg: 'bg-indigo-100',  text: 'text-indigo-700' }
    case 'tool':   return { label: '工具',   bg: 'bg-emerald-100', text: 'text-emerald-700' }
    default:       return { label: '未知',   bg: 'bg-gray-50',     text: 'text-gray-400' }
  }
}

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

// 把机器可读的 reason 转成人类可读文案
// 数据库里保留原始 reason（审计/排查用），前端只展示人话版本。
// 来源（系统/管理员/工具）由 source chip 展示，reason 文案不再重复。
const humanReason = (tx: CreditTransaction): string => {
  const reason = tx.reason || ''

  // 退还系列：reason 含 :reverse: 关键词
  if (/:reverse:upstream-(\d+)/.test(reason)) {
    const code = reason.match(/:reverse:upstream-(\d+)/)?.[1]
    return `生成失败（${code}）`
  }
  if (reason.includes(':reverse:upstream-timeout')) return '生成超时，自动退还'
  if (reason.includes(':reverse:network-error'))  return '网络异常，自动退还'
  if (reason.includes(':reverse:bad-formdata'))  return '请求格式错误，自动退还'
  if (reason.includes(':reverse:empty-prompt'))  return '提示词为空，自动退还'
  if (reason.includes(':reverse:no-image-in-response')) return '上游未返回图片，自动退还'

  // 消费系列：reason 形如 "ai-image-edit:gpt-image-2-1k"
  // 去掉工具前缀，保留 model key（"来源"列已经显示工具名，所以这里不重复）
  if (tx.type === 'deduct') {
    const idx = reason.indexOf(':')
    if (idx < 0) return reason || '积分消费' // 上游未按约定写 reason，原样返回便于排查
    const tail = reason.slice(idx + 1).trim()
    return tail ? `消费（${tail}）` : '积分消费'
  }

  // 兜底：原样返回 reason；source chip 已能区分来源类别
  return reason || '积分变动'
}

const handlePageChange = (p: number) => {
  page.value = p
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="880px"
    :close-on-click-modal="true"
    align-center
    destroy-on-close
  >
    <div v-if="isLoggedIn">
      <!-- 头部汇总 -->
      <div class="flex items-center justify-between mb-3 px-1">
        <div class="flex items-baseline gap-2">
          <span class="text-caption text-ink-500">当前余额</span>
          <span class="text-h3 font-bold tabular-nums text-emerald-700">
            {{ credits.balance.toLocaleString('zh-CN') }}
          </span>
          <span class="text-body-sm text-ink-500">积分</span>
        </div>
        <div v-if="props.toolUrl" class="text-caption text-ink-500">
          仅显示本工具流水 · 共 <strong class="tabular-nums">{{ total }}</strong> 条
        </div>
        <div v-else class="text-caption text-ink-500">
          共 <strong class="tabular-nums">{{ total }}</strong> 条
        </div>
      </div>

      <!-- 列表 -->
      <el-table
        :data="pagedList"
        v-loading="loading"
        size="small"
        :empty-text="loading ? '加载中…' : (props.toolUrl ? '本工具暂无消耗记录' : '暂无流水记录')"
        stripe
        :max-height="420"
        class="rounded-lg"
      >
        <el-table-column label="时间" width="150">
          <template #default="{ row }">
            <span class="tabular-nums text-body-sm text-ink-700">
              {{ formatTime(row.created_at) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <span
              class="inline-block px-1.5 py-0.5 rounded text-caption font-medium"
              :class="[typeMeta(row.type).bg, typeMeta(row.type).text]"
            >{{ typeMeta(row.type).label }}</span>
          </template>
        </el-table-column>

        <el-table-column label="积分变动" width="100" align="right">
          <template #default="{ row }">
            <span
              class="tabular-nums font-semibold"
              :class="typeMeta(row.type).amount"
            >
              {{ typeMeta(row.type).sign }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="余额" width="80" align="right">
          <template #default="{ row }">
            <span class="tabular-nums text-ink-700">{{ row.balance_after }}</span>
          </template>
        </el-table-column>

        <el-table-column label="来源" width="160">
          <template #default="{ row }">
            <div class="flex flex-col items-start gap-0.5">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-caption font-medium"
                :class="[sourceMeta(row.source).bg, sourceMeta(row.source).text]"
              >{{ sourceMeta(row.source).label }}</span>
              <a
                v-if="row.source === 'tool' && row.tool_url"
                :href="row.tool_url"
                class="text-caption text-accent-600 hover:underline"
                target="_blank"
              >
                {{ row.tool_title || row.tool_url }}
              </a>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="说明" min-width="220">
          <template #default="{ row }">
            <span class="text-body-sm text-ink-600">
              {{ humanReason(row) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 翻页 -->
      <div v-if="total > pageSize" class="flex justify-end mt-3">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          :page-count="totalPages"
          layout="prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <div v-else class="py-12 text-center text-ink-500">
      请先登录后查看积分明细
    </div>
  </el-dialog>
</template>
