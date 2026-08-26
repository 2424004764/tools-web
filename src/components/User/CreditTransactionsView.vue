<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/store/modules/user'
import { fetchMyTransactions, type CreditTransaction } from '@/api/me'
import { ElMessage } from 'element-plus'

/**
 * 公共：积分流水视图（无 dialog 包装，可被弹窗或独立页面复用）
 *
 * 用法：
 *   <CreditTransactionsView />
 *   <CreditTransactionsView tool-url="/ai-image-edit/" />
 *
 * Props:
 *   toolUrl?: 可选。若指定，则只展示该工具的流水
 *   pageSize?: 每页条数，默认 15
 */
const props = withDefaults(
  defineProps<{
    toolUrl?: string
    pageSize?: number
  }>(),
  {
    toolUrl: '',
    pageSize: 15,
  },
)

const userStore = useUserStore()
const { credits, isLoggedIn } = storeToRefs(userStore)

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

// ======== 响应式：< 640px 视为手机端 ========
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

// 进入时拉取
const load = async () => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录')
    return
  }
  loading.value = true
  try {
    const { list } = await fetchMyTransactions(1, 100)
    allList.value = list
  } catch (err: any) {
    console.warn('[CreditTransactionsView] load failed', err)
    ElMessage.error(err?.response?.data?.error || '加载流水失败')
  } finally {
    loading.value = false
  }
}

// 登录态变化时重新拉
watch(isLoggedIn, (v) => {
  if (v) load()
  else { allList.value = []; page.value = 1 }
})

// 工具过滤变化时重置页码
watch(
  () => props.toolUrl,
  () => { page.value = 1 },
)

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  // 登录态 OK 时主动拉一次（用户从无登录态 → 登录态切换）
  if (isLoggedIn.value && allList.value.length === 0) load()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

// ======== 展示 helpers ========
const typeMeta = (t: string) => {
  switch (t) {
    case 'grant':   return { label: '获得', bg: 'bg-emerald-100', text: 'text-emerald-700', amount: 'text-emerald-600', sign: '+' }
    case 'deduct':  return { label: '消费', bg: 'bg-rose-100',    text: 'text-rose-700',    amount: 'text-rose-600',    sign: '' }
    case 'reverse':
    case 'refund':  return { label: '退还', bg: 'bg-amber-100',   text: 'text-amber-700',   amount: 'text-amber-600',   sign: '+' }
    default:        return { label: t,    bg: 'bg-gray-100',    text: 'text-gray-700',    amount: 'text-gray-600',    sign: '' }
  }
}

const sourceMeta = (s: 'system' | 'admin' | 'tool' | 'recharge' | null | undefined) => {
  switch (s) {
    case 'system':   return { label: '系统',   bg: 'bg-slate-100',   text: 'text-slate-700' }
    case 'admin':    return { label: '管理员', bg: 'bg-indigo-100',  text: 'text-indigo-700' }
    case 'tool':     return { label: '工具',   bg: 'bg-emerald-100', text: 'text-emerald-700' }
    case 'recharge': return { label: '兑换码', bg: 'bg-amber-100',   text: 'text-amber-700' }
    default:         return { label: '未知',   bg: 'bg-gray-50',     text: 'text-gray-400' }
  }
}

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** 字节数 → 人类可读字符串（KB / MB 自动切换） */
const formatBytesReadable = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const humanReason = (tx: CreditTransaction): string => {
  const reason = tx.reason || ''

  // AI image edit 上游失败退还
  if (/:reverse:upstream-(\d+)/.test(reason)) {
    const code = reason.match(/:reverse:upstream-(\d+)/)?.[1]
    return `生成失败（${code}）`
  }
  if (reason.includes(':reverse:upstream-timeout')) return '生成超时，自动退还'
  if (reason.includes(':reverse:network-error'))  return '网络异常，自动退还'
  if (reason.includes(':reverse:bad-formdata'))  return '请求格式错误，自动退还'
  if (reason.includes(':reverse:empty-prompt'))  return '提示词为空，自动退还'
  if (reason.includes(':reverse:no-image-in-response')) return '上游未返回图片，自动退还'

  // 音乐播放列表
  if (reason.startsWith('music-playlist:')) {
    // 批次上传（新版 reason 编码了 batchId/size/count）
    if (reason.includes(':upload:batchId=')) {
      const sizeMatch = reason.match(/:size=(\d+)B/)
      const countMatch = reason.match(/:count=(\d+)/)
      const bytes = sizeMatch ? Number(sizeMatch[1]) : 0
      const count = countMatch ? Number(countMatch[1]) : 0
      const sizeStr = bytes > 0 ? formatBytesReadable(bytes) : ''
      if (count > 1 && sizeStr) return `上传音频（${count} 个文件，${sizeStr}）`
      if (count === 1 && sizeStr) return `上传音频（${sizeStr}）`
      if (count > 1) return `上传音频（${count} 个文件）`
      return '上传音频'
    }
    // 单文件上传（老版 reason: music-playlist:upload:size=NB）
    const m = reason.match(/size=(\d+)B/)
    if (m) return `上传音频（${formatBytesReadable(Number(m[1]))}）`
    if (reason.includes(':refund:delete:')) return '删除歌曲退还'
    if (reason.endsWith(':upload-failed') || reason.includes(':upload-failed')) return '上传失败，自动退还'
    if (reason.includes(':upload')) return '上传音频'
  }

  if (tx.type === 'deduct') {
    const idx = reason.indexOf(':')
    if (idx < 0) return reason || '积分消费'
    const tail = reason.slice(idx + 1).trim()
    return tail ? `消费（${tail}）` : '积分消费'
  }

  return reason || '积分变动'
}

const handlePageChange = (p: number) => {
  page.value = p
}
</script>

<template>
  <div v-if="isLoggedIn">
    <!-- 头部汇总 -->
    <div
      class="flex mb-3 px-1 gap-2"
      :class="isMobile ? 'flex-col items-start' : 'items-center justify-between'"
    >
      <div class="flex items-baseline gap-2">
        <span class="text-caption text-ink-500">当前余额</span>
        <span
          class="font-bold tabular-nums text-emerald-700"
          :class="isMobile ? 'text-body-lg' : 'text-h3'"
        >
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

    <!-- 列表：桌面端表格 -->
    <el-table
      v-if="!isMobile"
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

    <!-- 移动端卡片列表 -->
    <div v-else v-loading="loading" class="flex flex-col gap-2">
      <div
        v-if="!loading && pagedList.length === 0"
        class="py-10 text-center text-caption text-ink-400"
      >
        {{ props.toolUrl ? '本工具暂无消耗记录' : '暂无流水记录' }}
      </div>

      <div
        v-for="row in pagedList"
        :key="row.id"
        class="rounded-lg border border-border-subtle bg-surface-0 p-3"
      >
        <div class="flex items-center justify-between gap-2 mb-2">
          <span
            class="inline-block px-1.5 py-0.5 rounded text-caption font-medium"
            :class="[typeMeta(row.type).bg, typeMeta(row.type).text]"
          >{{ typeMeta(row.type).label }}</span>
          <span
            class="tabular-nums font-semibold"
            :class="typeMeta(row.type).amount"
          >
            {{ typeMeta(row.type).sign }}{{ row.amount }}
          </span>
        </div>

        <div class="text-body-sm text-ink-700 mb-2 break-words">
          {{ humanReason(row) }}
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
          <span class="tabular-nums">{{ formatTime(row.created_at) }}</span>
          <span class="text-ink-300">·</span>
          <span>余额 <span class="tabular-nums text-ink-700">{{ row.balance_after }}</span></span>
          <span class="text-ink-300">·</span>
          <span
            class="inline-block px-1.5 py-0.5 rounded text-caption font-medium"
            :class="[sourceMeta(row.source).bg, sourceMeta(row.source).text]"
          >{{ sourceMeta(row.source).label }}</span>
          <a
            v-if="row.source === 'tool' && row.tool_url"
            :href="row.tool_url"
            class="text-accent-600 hover:underline truncate max-w-[140px]"
            target="_blank"
            :title="row.tool_title || row.tool_url"
          >
            {{ row.tool_title || row.tool_url }}
          </a>
        </div>
      </div>
    </div>

    <!-- 翻页 -->
    <div v-if="total > pageSize" class="flex justify-end mt-3">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-count="totalPages"
        :layout="isMobile ? 'prev, pager, next' : 'prev, pager, next, jumper'"
        background
        @current-change="handlePageChange"
      />
    </div>
  </div>

  <div v-else class="py-12 text-center text-ink-500">
    请先登录后查看积分明细
  </div>
</template>