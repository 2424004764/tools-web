<script setup lang="ts">
// OAuth2 授权确认页（工具站作为授权服务器）
// 子站跳转到这里：/oauth/authorize?client_id=&redirect_uri=&state=&scope=
// - 未登录 → 去主站登录页（登录后回跳继续）
// - 已登录且授权过 → 静默发码回跳（SSO）
// - 否则展示授权确认卡片
import { ref, onMounted, computed } from 'vue'
import Loading from '~icons/ep/loading'
import IconSuccess from '~icons/ep/success-filled'
import { useUserStore } from '@/store/modules/user'
import { checkAuthorize, submitAuthorize, type AuthorizeCheckResult } from '@/api/oauth'
import { getLocalToken, isTokenExpired } from '@/utils/user'

const userStore = useUserStore()

const loading = ref(true)
const submitting = ref(false)
const errorMsg = ref('')
const info = ref<AuthorizeCheckResult | null>(null)
const redirecting = ref(false)

// 当前页面完整地址（含 query），未登录时作为登录页回跳目标
const currentAuthorizeUrl = window.location.pathname + window.location.search

const scopeItems = computed(() => {
  if (!info.value) return []
  const scopes = info.value.scope.split(' ').filter(Boolean)
  return scopes.map((s) => ({
    scope: s,
    text: info.value?.scope_descriptions?.[s] || s,
  }))
})

const hostOf = (uri: string) => {
  try {
    return new URL(uri).host
  } catch {
    return uri
  }
}

async function check() {
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') || ''
  const redirectUri = params.get('redirect_uri') || ''
  const state = params.get('state') || ''
  const scope = params.get('scope') || ''

  if (!clientId || !redirectUri) {
    errorMsg.value = '授权链接无效：缺少 client_id 或 redirect_uri 参数'
    loading.value = false
    return
  }

  try {
    const data = await checkAuthorize({ client_id: clientId, redirect_uri: redirectUri, state, scope })
    info.value = data

    // 未登录 → 去登录页，登录后回跳本页继续授权
    if (data.need_login) {
      window.location.href = `/login?redirect=${encodeURIComponent(currentAuthorizeUrl)}`
      return
    }

    // 已授权过（或本次确认完成）：直接回跳子站
    if (data.redirect_to) {
      redirecting.value = true
      window.location.href = data.redirect_to
      return
    }
  } catch (e: any) {
    errorMsg.value = e.response?.data?.error || '授权请求校验失败'
  } finally {
    loading.value = false
  }
}

async function decide(deny: boolean) {
  if (!info.value || submitting.value) return
  submitting.value = true
  try {
    const data = await submitAuthorize({
      client_id: info.value.client.client_id,
      redirect_uri: info.value.redirect_uri,
      state: info.value.state,
      scope: info.value.scope,
      deny,
    })
    redirecting.value = true
    window.location.href = data.redirect_to
  } catch (e: any) {
    submitting.value = false
    // 401 时 functionsRequest 拦截器已清掉过期 token，这里引导重新走登录
    if (e.response?.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent(currentAuthorizeUrl)}`
    }
  }
}

onMounted(async () => {
  userStore.initUserState()
  // 本地 token 已过期时先清掉，避免带着失效 token 去校验
  if (getLocalToken() && isTokenExpired()) {
    userStore.logout()
  }
  await check()
})
</script>

<template>
  <div class="oauth-page min-h-screen flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-[440px]">
      <!-- 加载中 -->
      <div v-if="loading" class="bg-surface-0 border border-border-subtle rounded-2xl p-10 flex flex-col items-center gap-3 text-ink-500">
        <Loading class="w-7 h-7 animate-spin text-accent-500" />
        <span class="text-body-sm">正在校验授权请求…</span>
      </div>

      <!-- 错误 -->
      <div v-else-if="errorMsg" class="bg-surface-0 border border-border-subtle rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
        <div class="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl">✕</div>
        <div class="text-body font-medium text-ink-800">无法继续授权</div>
        <div class="text-body-sm text-ink-500 break-all">{{ errorMsg }}</div>
        <a href="/" class="text-body-sm text-accent-600 hover:underline mt-2">返回工具箱首页</a>
      </div>

      <!-- 静默跳转中（SSO / 已完成授权） -->
      <div v-else-if="redirecting" class="bg-surface-0 border border-border-subtle rounded-2xl p-10 flex flex-col items-center gap-3 text-ink-500">
        <Loading class="w-7 h-7 animate-spin text-accent-500" />
        <span class="text-body-sm">授权完成，正在跳转回应用…</span>
      </div>

      <!-- 授权确认 -->
      <div v-else-if="info" class="bg-surface-0 border border-border-subtle rounded-2xl overflow-hidden shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)]">
        <div class="px-8 pt-8 pb-6 text-center border-b border-border-subtle">
          <div class="flex items-center justify-center gap-3">
            <img
              v-if="info.client.logo_url"
              :src="info.client.logo_url"
              :alt="info.client.name"
              class="w-14 h-14 rounded-xl object-cover border border-border-subtle bg-surface-1"
            />
            <div
              v-else
              class="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center text-xl font-bold"
            >
              {{ info.client.name.slice(0, 1) }}
            </div>
          </div>
          <h1 class="mt-4 text-heading-sm font-semibold text-ink-900">
            {{ info.client.name }} 申请访问你的账号
          </h1>
          <p v-if="info.client.description" class="mt-1.5 text-body-sm text-ink-500">
            {{ info.client.description }}
          </p>
          <p class="mt-1 text-caption text-ink-400">回调域名：{{ hostOf(info.redirect_uri) }}</p>
        </div>

        <div class="px-8 py-6">
          <!-- 当前登录用户 -->
          <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-1">
            <img
              v-if="info.user?.avatar"
              :src="info.user.avatar"
              :alt="info.user.username"
              class="w-9 h-9 rounded-full object-cover"
            />
            <div v-else class="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-medium">
              {{ (info.user?.username || '?').slice(0, 1) }}
            </div>
            <div class="min-w-0">
              <div class="text-body-sm font-medium text-ink-800 truncate">{{ info.user?.username }}</div>
              <div class="text-caption text-ink-400 truncate">{{ info.user?.email }}</div>
            </div>
            <span class="ml-auto text-caption text-ink-400 whitespace-nowrap">当前登录</span>
          </div>

          <!-- 权限列表 -->
          <div class="mt-5">
            <div class="text-body-sm font-medium text-ink-700 mb-2">该应用将获得以下权限：</div>
            <ul class="space-y-2">
              <li v-for="item in scopeItems" :key="item.scope" class="flex items-start gap-2 text-body-sm text-ink-600">
                <IconSuccess class="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                <span>{{ item.text }}</span>
              </li>
            </ul>
          </div>

          <!-- 操作按钮 -->
          <div class="mt-7 flex gap-3">
            <button
              type="button"
              class="flex-1 h-10 rounded-lg border border-border-subtle text-body-sm text-ink-600 hover:bg-surface-1 transition-colors disabled:opacity-50"
              :disabled="submitting"
              @click="decide(true)"
            >
              拒绝
            </button>
            <button
              type="button"
              class="flex-1 h-10 rounded-lg bg-accent-500 text-white text-body-sm font-medium hover:bg-accent-600 transition-colors disabled:opacity-50"
              :disabled="submitting"
              @click="decide(false)"
            >
              {{ submitting ? '处理中…' : '同意授权' }}
            </button>
          </div>

          <p class="mt-4 text-caption text-ink-400 text-center">
            同意即表示你授权该应用获取以上信息，可随时在应用侧退出登录。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
