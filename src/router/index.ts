//通过vue-router插件实现模板路由配置
import { createRouter, createWebHistory } from 'vue-router'
import { constantRoute } from './router'

//创建路由器
const router = createRouter({
  //路由模式hash
  // history: createWebHashHistory(),
  history: createWebHistory(),
  routes: constantRoute,
  //滚动行为
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path === from.path) return false
    return { left: 0, top: 0 }
  },
})

// 路由预加载策略
const preloadedRoutes = new Set()

// 预加载常用路由
const commonRoutes = ['/', '/json', '/md5', '/timetran', '/qrcode', '/uuid']

// 预加载函数
function preloadRoute(path: string) {
  if (preloadedRoutes.has(path)) return
  
  const route = constantRoute.find(r => r.path === path)
  if (route && typeof route.component === 'function') {
    route.component().then(() => {
      preloadedRoutes.add(path)
    }).catch(() => {
      // 预加载失败时静默处理
    })
  }
}

// 在空闲时预加载常用路由
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    commonRoutes.forEach(preloadRoute)
  })
} else {
  // 降级方案
  setTimeout(() => {
    commonRoutes.forEach(preloadRoute)
  }, 2000)
}

// 添加全局加载状态
let loadingTimeout: number | null = null

router.beforeEach((to, _from, next) => {
  // 显示加载指示器（延迟200ms，避免快速切换时闪烁）
  loadingTimeout = window.setTimeout(() => {
    const app = document.querySelector('#app')
    if (app) {
      app.classList.add('route-loading')
    }
  }, 200)

  // 预加载目标路由的相邻路由
  if (to.path && !preloadedRoutes.has(to.path)) {
    const currentIndex = constantRoute.findIndex(r => r.path === to.path)
    if (currentIndex > -1) {
      // 预加载前后两个路由
      if (currentIndex > 0) {
        preloadRoute(constantRoute[currentIndex - 1].path)
      }
      if (currentIndex < constantRoute.length - 1) {
        preloadRoute(constantRoute[currentIndex + 1].path)
      }
    }
  }

  if (to.meta.title && to.meta.title != '') {
    let oldTitle = document.title
    document.title = <string>to.meta.title + '-' + oldTitle
  }
  next()
})

//路由后置卫士
router.afterEach((to) => {
  // 清除加载状态
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
  const app = document.querySelector('#app')
  if (app) {
    app.classList.remove('route-loading')
  }

  //填充mate元信息
  const { title , keywords, description } = to.meta
  //详情页标题
  const detailTitle = title
  //设置title
  if (detailTitle) {
    document.title = detailTitle + '-' + import.meta.env.VITE_APP_TITLE
  } else {
    document.title = import.meta.env.VITE_APP_TITLE + '-' + import.meta.env.VITE_APP_DESC
  }

  //设置meta
  document.querySelector('meta[name="keywords"]')?.setAttribute("content", `${keywords}`)
  document.querySelector('meta[name="description"]')?.setAttribute("content", `${description}`)
  //设置meta og
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${document.title}`)
  document.querySelector('meta[property="og:site_name"]')?.setAttribute("content", `${document.title}`)
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", `${description}`)
})

export default router
