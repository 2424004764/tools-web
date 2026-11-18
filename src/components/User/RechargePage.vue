<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { redeemCode } from '@/api/me'
import { fetchRechargeConfig, type RechargePackageInfo, type RechargeMode } from '@/api/site-config'
import ArrowLeft from '~icons/ep/arrowLeft'

const router = useRouter()
const userStore = useUserStore()

// ============ 充值方式（后台 site_config 配置，默认发卡网）============
// recharge_mode = faka：展示套餐并跳转发卡网付款（套餐存于 recharge_packages，未配置回退内置默认）
// recharge_mode = contact：不展示发卡网，改为展示站长 QQ（recharge_contact_qq）
const rechargeMode = ref<RechargeMode>('faka')
/** 联系站长模式下的站长 QQ（仅 contact 模式有值） */
const contactQq = ref('')
/** 发卡网套餐：price 人民币元，credits 对应积分（按 1 元 = 100 积分） */
const packages = ref<RechargePackageInfo[]>([])

const balance = ref(0)
/** 页面初始加载中：余额与充值配置未就绪前展示骨架屏，避免先闪现 0 / 空白套餐 */
const pageLoading = ref(true)

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    router.replace(
      `/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`,
    )
    return
  }
  try {
    // 充值配置与最新余额并行拉取（force=true 避免被 creditsLoaded 缓存命中）；
    // allSettled：单项失败不阻塞另一项，余额拉取失败时仍按配置渲染充值区域
    const [creditsResult, configResult] = await Promise.allSettled([
      userStore.fetchCredits(true),
      fetchRechargeConfig(),
    ])
    if (creditsResult.status === 'fulfilled') {
      balance.value = userStore.credits.balance
    }
    if (configResult.status === 'fulfilled') {
      rechargeMode.value = configResult.value.mode
      contactQq.value = configResult.value.qq
      packages.value = configResult.value.packages
    }
  } finally {
    pageLoading.value = false
  }
})

/** 复制站长 QQ 号 */
const copyQq = async () => {
  if (!contactQq.value) return
  try {
    await navigator.clipboard.writeText(contactQq.value)
    ElMessage.success(`已复制 QQ：${contactQq.value}`)
  } catch {
    ElMessage.warning('复制失败，请手动选择 QQ 号复制')
  }
}

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
      <!-- 加载骨架：与真实布局同结构，加载完成后不跳动 -->
      <template v-if="pageLoading">
        <div class="h-3.5 w-20 rounded bg-emerald-200/80 animate-pulse mb-2"></div>
        <div class="h-10 w-36 rounded bg-emerald-200/80 animate-pulse"></div>
        <div class="mt-3 h-3.5 w-56 rounded bg-emerald-200/60 animate-pulse"></div>
      </template>
      <template v-else>
        <div class="text-caption text-emerald-700 mb-1">当前积分余额</div>
        <div class="flex items-baseline gap-2">
          <span class="text-h1 font-bold text-emerald-700 tabular-nums">{{ balance.toLocaleString('zh-CN') }}</span>
          <span class="text-body-sm text-emerald-600">积分</span>
        </div>
        <div class="text-caption text-emerald-600 mt-2">
          累计获得 {{ userStore.credits.total_earned.toLocaleString('zh-CN') }} · 累计消费 {{ userStore.credits.total_spent.toLocaleString('zh-CN') }}
        </div>
      </template>
    </div>

    <!-- 充值方式卡片：初始加载骨架（模式未就绪，先按套餐网格占位） -->
    <div v-if="pageLoading" class="rounded-2xl bg-white border border-border-subtle p-6 mb-3" aria-busy="true" aria-label="充值信息加载中">
      <div class="h-5 w-28 rounded bg-surface-3 animate-pulse mb-2"></div>
      <div class="h-3.5 w-full max-w-xl rounded bg-surface-2 animate-pulse mb-5"></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          v-for="i in 4"
          :key="i"
          class="rounded-xl border-2 border-border-subtle bg-surface-1 p-4"
        >
          <div class="h-8 w-16 rounded bg-surface-3 animate-pulse"></div>
          <div class="mt-2 h-3.5 w-20 rounded bg-surface-2 animate-pulse"></div>
          <div class="mt-3 pt-3 border-t border-border-subtle">
            <div class="h-3.5 w-24 rounded bg-surface-2 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 在线充值卡片（发卡网） -->
    <div v-else-if="rechargeMode === 'faka'" class="rounded-2xl bg-white border border-border-subtle p-6 mb-3">
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
          class="group relative rounded-xl border-2 border-border-default bg-surface-1 transition-all p-4 block no-underline hover:border-accent-500 hover:bg-accent-50"
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

    <!-- 联系站长充值卡片（recharge_mode = contact） -->
    <div v-else class="rounded-2xl bg-white border border-border-subtle p-6 mb-3">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="text-body-lg font-semibold text-ink-900 flex items-center gap-2">
          <svg class="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          联系站长充值
        </h2>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-50 text-accent-700 text-caption font-medium ring-1 ring-accent-200">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          兑换比例：1 元 = 100 积分
        </span>
      </div>
      <p class="text-caption text-ink-500 mb-4">
        在线充值暂不可用，可直接联系站长购买兑换码：与站长确认充值金额并付款后，站长会按 1 元 = 100 积分发放兑换码，回到本页下方「兑换码」区域输入即可到账。
      </p>

      <!-- 站长 QQ 展示 + 复制 -->
      <div v-if="contactQq" class="rounded-xl bg-gradient-to-br from-accent-50 to-accent-100 border border-accent-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-caption text-accent-700 mb-1">站长 QQ</div>
          <div class="text-h2 font-bold text-ink-900 tabular-nums select-all">{{ contactQq }}</div>
        </div>
        <button
          type="button"
          @click="copyQq"
          class="px-4 py-2 rounded-lg bg-accent-500 text-white text-body-sm font-medium hover:bg-accent-600 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          复制 QQ 号
        </button>
      </div>
      <div v-else class="rounded-xl border border-dashed border-border-default py-6 text-center text-body-sm text-ink-400">
        站长联系方式暂未配置，请通过站内其他渠道（如意见反馈）联系站长充值。
      </div>

      <p class="text-caption text-ink-400 mt-3">
        提示：添加站长 QQ 时请备注「工具箱充值」，付款后获得的兑换码在下方「兑换码」处粘贴即可即时到账。
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
        <template v-if="rechargeMode === 'faka'">
          输入兑换码即可获得对应积分。可来源于上方发卡网自动发放，也可由站长手动发放（人民币与积分按 1 : 100 兑换）。
        </template>
        <template v-else>
          输入兑换码即可获得对应积分。联系站长购买后由站长发放（人民币与积分按 1 : 100 兑换）。
        </template>
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

    <!-- 充值说明（依赖充值模式，加载完成后再展示） -->
    <div v-if="!pageLoading" class="rounded-2xl bg-white border border-border-subtle p-6">
      <h2 class="text-body-lg font-semibold text-ink-900 mb-3">如何获取积分</h2>

      <!-- 方式一：在线充值（发卡网） -->
      <div v-if="rechargeMode === 'faka'" class="mb-4">
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

      <!-- 方式一（联系站长模式）：直接联系站长 -->
      <div v-else class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="shrink-0 w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-caption font-semibold">1</span>
          <span class="text-body-sm font-medium text-ink-900">方式一：联系站长充值</span>
        </div>
        <ol class="ml-7 space-y-1.5 text-body-sm text-ink-600">
          <li class="flex gap-2">
            <span class="text-ink-400">①</span>
            <span>复制上方「联系站长充值」卡片中的 QQ 号，添加站长并备注「工具箱充值」</span>
          </li>
          <li class="flex gap-2">
            <span class="text-ink-400">②</span>
            <span>与站长确认充值金额并付款（按 1 元 = 100 积分），站长生成兑换码后发送给你</span>
          </li>
          <li class="flex gap-2">
            <span class="text-ink-400">③</span>
            <span>回到本页「兑换码」处粘贴兑换码并点击「兑换」，积分将即时到账</span>
          </li>
        </ol>
      </div>

      <!-- 方式二：向站长申请（仅发卡网模式下作为备选方式展示） -->
      <div v-if="rechargeMode === 'faka'" class="mb-4">
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
        如兑换异常（兑换码无效、不到账等），请联系站长处理；积分与存储空间情况请前往「积分与存储空间」页面查看。
      </div>
    </div>
  </div>
</template>