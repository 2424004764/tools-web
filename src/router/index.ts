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

  if (to.meta.title) {
    document.title = to.meta.title + '-' + import.meta.env.VITE_APP_TITLE
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

//路由后置卫士
router.afterEach((to) => {
  const { title, keywords, description } = to.meta

  if (title) {
    document.title = title + '-' + import.meta.env.VITE_APP_TITLE
  } else {
    document.title = import.meta.env.VITE_APP_TITLE + '-' + import.meta.env.VITE_APP_DESC
  }

  // 批量更新 meta 标签
  const metaUpdates = [
    { selector: 'meta[name="keywords"]', attr: 'content', value: String(keywords || '') },
    { selector: 'meta[name="description"]', attr: 'content', value: String(description || '') },
    { selector: 'meta[property="og:title"]', attr: 'content', value: document.title },
    { selector: 'meta[property="og:site_name"]', attr: 'content', value: document.title },
    { selector: 'meta[property="og:description"]', attr: 'content', value: String(description || '') },
  ]

  metaUpdates.forEach(({ selector, attr, value }) => {
    document.querySelector(selector)?.setAttribute(attr, value)
  })
})

export default router
