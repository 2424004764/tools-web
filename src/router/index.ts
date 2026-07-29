//通过vue-router插件实现模板路由配置
import { createRouter, createWebHistory } from 'vue-router'
import { constantRoute } from './router'
import { isAppStale, isVersionCheckComplete } from '@/utils/version-guard'
import { useUserStore } from '@/store/modules/user'

// 硬刷防循环 flag：硬刷后落到新页面，afterEach 清除（导航成功才清）。
// 配合 router.onError 双重防循环：flag 存在 → onError 跳 /404 而非再次 reload
const HARD_RELOAD_FLAG = '__hard_reload_guard__'

// 同一会话最多硬刷 N 次，超出后停止硬刷避免死循环
// （典型场景：CDN 边缘缓存返回老 hash 导致 isAppStale() 永远 true）
const MAX_RELOADS_PER_SESSION = 3
const RELOAD_COUNT_KEY = '__reload_count__'
// 两次硬刷之间最短间隔（ms），防止 scroll→router.replace→硬刷→scroll→... 的快速循环
const MIN_RELOAD_INTERVAL = 5000
const LAST_RELOAD_TIME_KEY = '__last_reload_ts__'

//创建路由器
const router = createRouter({
  history: createWebHistory(),
  routes: constantRoute,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false
    return { left: 0, top: 0 }
  },
})

// SEO meta 数据源：每个路由的 meta 字段（见 router.ts）
// - keywords / description / og:* 等由 index.html 静态 + Vite 构建时注入（首页）+ 路由 meta 三层共同决定
// - 运行时（SPA 内部导航）只更新 document.title 即可；爬虫读静态 HTML，不执行 JS，
//   所以 querySelector 改 keywords/description 对 SEO 无意义，且会触发布局抖动。

const APP_TITLE = import.meta.env.VITE_APP_TITLE as string
const APP_DESC = import.meta.env.VITE_APP_DESC as string

router.beforeEach((to, _from, next) => {
  // 版本过期：CF 已重新部署，但当前 SPA 还停在旧 chunk 上。
  // 直接硬刷到目标 URL —— 用户感受是"点完就到目标页"，无感知。
  // 受 MAX_RELOADS_PER_SESSION 上限保护，超过后停止硬刷（CDN 缓存异常场景下的死循环兜底）。
  if (isAppStale()) {
    const reloadCount = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10)
    const lastReload = parseInt(sessionStorage.getItem(LAST_RELOAD_TIME_KEY) || '0', 10)
    const now = Date.now()

    // 两次硬刷之间最小间隔，防止 scroll → router.replace → 硬刷 的紧密循环
    if (reloadCount < MAX_RELOADS_PER_SESSION && (now - lastReload) > MIN_RELOAD_INTERVAL) {
      sessionStorage.setItem(HARD_RELOAD_FLAG, '1')
      sessionStorage.setItem(RELOAD_COUNT_KEY, String(reloadCount + 1))
      sessionStorage.setItem(LAST_RELOAD_TIME_KEY, String(now))
      window.location.replace(to.fullPath || '/')
      return // 不调用 next()，中断当前 SPA 导航
    }
    if (reloadCount >= MAX_RELOADS_PER_SESSION) {
      console.warn('[version-guard] 已达硬刷上限，跳过本轮。')
    }
  } else if (isVersionCheckComplete()) {
    // hash 一致 且 已至少完成一次版本检查 → 重置计数（成功落到新版本）
    // 注意：仅在检查完成后重置，避免页面刚加载时 latestFingerprint 为空导致误清除
    if (sessionStorage.getItem(RELOAD_COUNT_KEY)) {
      sessionStorage.removeItem(RELOAD_COUNT_KEY)
    }
    if (sessionStorage.getItem(LAST_RELOAD_TIME_KEY)) {
      sessionStorage.removeItem(LAST_RELOAD_TIME_KEY)
    }
  }

  // ===== Admin 后台鉴权 =====
  // 前端守卫仅改善体验；真正拦截由后端 _middleware.js 二次把关。
  // 鉴权失败规则：
  //   - 未登录：跳 /login?redirect=原路径
  //   - 已登录但非管理员：跳首页
  if (to.path.startsWith('/admin')) {
    const userStore = useUserStore()
    userStore.initUserState()
    if (!userStore.getLoginStatus) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
    }
    if (!userStore.getIsAdmin) {
      return next({ path: '/' })
    }
  }

  next()
})

// 兜底：chunk 404（轮询窗口期内罕见发生）。硬刷到目标 URL。
// 双重防循环：
//   1. HARD_RELOAD_FLAG：前一次硬刷仍有效 → 跳 404（afterEach 仅成功导航后清除）
//   2. CHUNK_ERROR_COUNT：同一会话累计超过 3 次 → 跳 404（防止 afterEach 因故未清除 flag）
const CHUNK_ERROR_KEY = '__chunk_error_count__'
const MAX_CHUNK_ERRORS = 3
router.onError((error) => {
  console.warn('[router] chunk load failed, hard reloading:', error)
  if (sessionStorage.getItem(HARD_RELOAD_FLAG)) {
    sessionStorage.removeItem(HARD_RELOAD_FLAG)
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
    router.replace('/404')
    return
  }
  // 兜底计数器：防止 flag 机制失效导致无限 reload
  const errCount = parseInt(sessionStorage.getItem(CHUNK_ERROR_KEY) || '0', 10)
  if (errCount >= MAX_CHUNK_ERRORS) {
    console.warn('[router] chunk error 已达上限，跳转 /404')
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
    router.replace('/404')
    return
  }
  sessionStorage.setItem(CHUNK_ERROR_KEY, String(errCount + 1))
  sessionStorage.setItem(HARD_RELOAD_FLAG, '1')
  window.location.replace(router.currentRoute.value.fullPath || '/')
})

// 路由后置：仅更新 document.title（SPA 内部导航的用户体验优化）
// 并清除硬刷防循环 flag（导航成功完成才清除，避免 beforeEnter 提前清除导致 onError 防循环失效）
router.afterEach((to) => {
  if (sessionStorage.getItem(HARD_RELOAD_FLAG)) {
    sessionStorage.removeItem(HARD_RELOAD_FLAG)
  }
  document.title = to.meta.title
    ? `${to.meta.title as string}-${APP_TITLE}`
    : `${APP_TITLE}-${APP_DESC}`
})

export default router
