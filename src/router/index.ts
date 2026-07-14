//通过vue-router插件实现模板路由配置
import { createRouter, createWebHistory } from 'vue-router'
import { constantRoute } from './router'
import { isAppStale } from '@/utils/version-guard'

// 硬刷防循环 flag：硬刷后落到新页面，beforeEach 检测到并清除
const HARD_RELOAD_FLAG = '__hard_reload_guard__'

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
  // 硬刷成功后第一次进入路由：清除 flag，避免误判
  if (sessionStorage.getItem(HARD_RELOAD_FLAG)) {
    sessionStorage.removeItem(HARD_RELOAD_FLAG)
  }

  // 版本过期：CF 已重新部署，但当前 SPA 还停在旧 chunk 上。
  // 直接硬刷到目标 URL —— 用户感受是"点完就到目标页"，无感知。
  if (isAppStale()) {
    sessionStorage.setItem(HARD_RELOAD_FLAG, '1')
    window.location.replace(to.fullPath || '/')
    return // 不调用 next()，中断当前 SPA 导航
  }

  next()
})

// 兜底：chunk 404（轮询窗口期内罕见发生）。硬刷到目标 URL。
// sessionStorage 防循环：硬刷过一次仍失败就跳 404。
router.onError((error) => {
  console.warn('[router] chunk load failed, hard reloading:', error)
  if (sessionStorage.getItem(HARD_RELOAD_FLAG)) {
    sessionStorage.removeItem(HARD_RELOAD_FLAG)
    router.replace('/404')
    return
  }
  sessionStorage.setItem(HARD_RELOAD_FLAG, '1')
  window.location.replace(router.currentRoute.value.fullPath || '/')
})

// 路由后置：仅更新 document.title（SPA 内部导航的用户体验优化）
router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title as string}-${APP_TITLE}`
    : `${APP_TITLE}-${APP_DESC}`
})

export default router
