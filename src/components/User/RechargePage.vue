<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { redeemCode } from '@/api/me'
import ArrowLeft from '~icons/ep/arrowLeft'

const router = useRouter()
const userStore = useUserStore()

// ============ 在线充值（发卡网）============
/**
 * 充值套餐：每项对应一个发卡网商品链接。
 * 后续新增金额只需追加一项即可，UI 会自动按 grid 渲染。
 * - price: 人民币元
 * - credits: 对应积分（按 1 元 = 100 积分）
 * - url: 发卡网该商品的下单页链接
 */
interface RechargePackage {
  id: string
  name: string
  price: number
  credits: number
  url: string
  tag?: string
  highlight?: boolean
}

const packages: RechargePackage[] = [
  {
    id: 'pkg-1yuan',
    name: '基础体验包',
    price: 1,
    credits: 100,
    url: 'https://9wa.br3.cn/vw',
    tag: '入门',
  },
]

const balance = ref(0)

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    router.replace(
      `/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`,
    )
    return
  }
  // 拉取最新余额（force=true 避免被 creditsLoaded 缓存命中）
  await userStore.fetchCredits(true)
  balance.value = userStore.credits.balance
})

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

// ============ 兑换码 ============
const codeInput = ref('')
const submitting = ref(false)

const submitRedeem = async () => {
  const raw = codeInput.value.trim()
  if (!raw) {
    ElMessage.warning('请输入兑换码')
    return
  }
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
    return
  }
  submitting.value = true
  try {
    const res = await redeemCode(raw)
    // 直接用后端返回的新余额更新本地 store，避免再发请求
    userStore.setBalance(res.balance_after)
    balance.value = res.balance_after
    ElMessage.success(`兑换成功，获得 ${res.credits_granted} 积分`)
    codeInput.value = ''
  } catch (err: any) {
    const msg = err?.response?.data?.error || '兑换失败'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <!-- 顶部：返回 + 标题 -->
    <div class="flex items-center gap-3 rounded-2xl bg-white border border-border-subtle p-4 mb-3">
      <button
        type="button"
        @click="goBack"
        class="flex items-center gap-2 text-ink-700 hover:text-accent-600 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-accent-50"
        aria-label="返回"
      >
        <el-icon :size="20"><ArrowLeft /></el-icon>
        <span class="text-body-sm font-medium">返回</span>
      </button>
      <h1 class="text-h3 font-semibold text-ink-900 flex-1 min-w-0 truncate">
        积分充值
      </h1>
    </div>

    <!-- 当前余额卡片 -->
    <div class="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-6 mb-3">
      <div class="text-caption text-emerald-700 mb-1">当前积分余额</div>
      <div class="flex items-baseline gap-2">
        <span class="text-h1 font-bold text-emerald-700 tabular-nums">{{ balance.toLocaleString('zh-CN') }}</span>
        <span class="text-body-sm text-emerald-600">积分</span>
      </div>
      <div class="text-caption text-emerald-600 mt-2">
        累计获得 {{ userStore.credits.total_earned.toLocaleString('zh-CN') }} · 累计消费 {{ userStore.credits.total_spent.toLocaleString('zh-CN') }}
      </div>
    </div>

    <!-- 在线充值卡片（发卡网） -->
    <div class="rounded-2xl bg-white border border-border-subtle p-6 mb-3">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="text-body-lg font-semibold text-ink-900 flex items-center gap-2">
          <svg class="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          在线充值
        </h2>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 text-accent-700 text-caption font-medium ring-1 ring-accent-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          兑换比例：1 元 = 100 积分
        </span>
      </div>
      <p class="text-caption text-ink-500 mb-4">
        通过合作发卡平台选购充值套餐，付款后会获得兑换码，再回到本页下方「兑换码」区域输入即可到账。
      </p>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <a
          v-for="pkg in packages"
          :key="pkg.id"
          :href="pkg.url"
          target="_blank"
          rel="noopener noreferrer"
          :class="[
            'group relative rounded-xl border-2 bg-surface-1 transition-all p-4 block no-underline',
            pkg.highlight
              ? 'border-accent-500 ring-1 ring-accent-200 hover:bg-accent-50'
              : 'border-border-default hover:border-accent-500 hover:bg-accent-50',
          ]"
        >
          <span
            v-if="pkg.tag"
            class="absolute -top-2 left-3 inline-flex items-center px-2 py-0.5 rounded-full bg-accent-500 text-white text-caption font-medium shadow-sm"
          >
            {{ pkg.tag }}
          </span>
          <div class="flex items-baseline gap-1 pt-1">
            <span class="text-caption text-ink-500">¥</span>
            <span class="text-h2 font-bold text-ink-900 tabular-nums">{{ pkg.price }}</span>
          </div>
          <div class="text-caption text-ink-500 mt-1">{{ pkg.name }}</div>
          <div class="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
            <span class="text-caption text-ink-600 tabular-nums">+{{ pkg.credits.toLocaleString('zh-CN') }} 积分</span>
            <span class="text-caption text-accent-600 group-hover:text-accent-700 font-medium inline-flex items-center gap-1">
              前往发卡网
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6.75h6m-6 0v6m0-6L9 14.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
        </a>
      </div>

      <p class="text-caption text-ink-400 mt-3">
        提示：点击套餐后会跳转至发卡网付款页；付款成功后请复制您获得的兑换码，回到下方「兑换码」处粘贴即可即时到账。
      </p>
    </div>

    <!-- 兑换码卡片 -->
    <div class="rounded-2xl bg-white border border-border-subtle p-6 mb-3">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="text-body-lg font-semibold text-ink-900">兑换码</h2>
        <!-- 兑换比例备注 -->
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 text-accent-700 text-caption font-medium ring-1 ring-accent-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          兑换比例：1 元 = 100 积分
        </span>
      </div>
      <p class="text-caption text-ink-500 mb-4">
        输入兑换码即可获得对应积分。可来源于上方发卡网自动发放，也可由站长手动发放（人民币与积分按 1 : 100 兑换）。
      </p>

      <form @submit.prevent="submitRedeem" class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="codeInput"
          type="text"
          placeholder="请输入兑换码（区分大小写）"
          :disabled="submitting"
          class="flex-1 px-4 py-2.5 rounded-lg border border-border-default bg-surface-1 text-ink-900 placeholder:text-ink-400 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:opacity-50"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          type="submit"
          :disabled="submitting || !codeInput.trim()"
          class="px-5 py-2.5 rounded-lg bg-accent-500 text-white font-medium hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 min-w-[88px]"
        >
          <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          {{ submitting ? '兑换中' : '兑换' }}
        </button>
      </form>

      <p class="text-caption text-ink-400 mt-2">
        兑换码为 12 位大写字母+数字，由管理员生成。如兑换异常请联系站长处理。
      </p>
    </div>

    <!-- 充值说明 -->
    <div class="rounded-2xl bg-white border border-border-subtle p-6">
      <h2 class="text-body-lg font-semibold text-ink-900 mb-3">如何获取积分</h2>

      <!-- 方式一：在线充值（发卡网） -->
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-caption font-semibold">1</span>
          <span class="text-body-sm font-medium text-ink-900">方式一：在线充值（推荐）</span>
        </div>
        <ol class="ml-7 space-y-1.5 text-body-sm text-ink-600">
          <li class="flex gap-2">
            <span class="text-ink-400">①</span>
            <span>在「在线充值」区域选择适合的金额套餐，点击后跳转至发卡网付款</span>
          </li>
          <li class="flex gap-2">
            <span class="text-ink-400">②</span>
            <span>在发卡网完成付款后，复制您收到的兑换码（通常在订单页或短信/邮件中）</span>
          </li>
          <li class="flex gap-2">
            <span class="text-ink-400">③</span>
            <span>回到本页「兑换码」处粘贴兑换码并点击「兑换」，积分将即时到账</span>
          </li>
        </ol>
      </div>

      <!-- 方式二：向站长申请 -->
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-caption font-semibold">2</span>
          <span class="text-body-sm font-medium text-ink-900">方式二：向站长申请</span>
        </div>
        <ol class="ml-7 space-y-1.5 text-body-sm text-ink-600">
          <li class="flex gap-2">
            <span class="text-ink-400">①</span>
            <span>联系站长购买兑换码（按 1 元 = 100 积分），管理员生成后会通过私信发送给你</span>
          </li>
          <li class="flex gap-2">
            <span class="text-ink-400">②</span>
            <span>收到兑换码后在「兑换码」处粘贴并点击「兑换」，积分即时到账</span>
          </li>
        </ol>
      </div>

      <!-- 其他 -->
      <div class="pt-3 border-t border-border-subtle text-caption text-ink-500">
        如兑换异常（兑换码无效、不到账等），请联系站长处理；积分消耗明细请前往「积分消耗明细」页面查看。
      </div>
    </div>
  </div>
</template>