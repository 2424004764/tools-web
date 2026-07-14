import { createApp } from 'vue'
import App from './App.vue'
//vite-plugin-svg-icons
import 'virtual:svg-icons-register'
//router
import router from './router'
//styles
import './styles/tailwind.css'
// loading.css 已删除（Phase 1 清理：全代码库零引用，原 .route-loading 仅占首屏 CSS 字节）
//pinia
import pinia from './store'
import { useUserStore } from './store/modules/user'
import { initializeAIProviders } from './spi/init'
import { injectCloudflareAnalytics } from './utils/analytics'
import { startVersionGuard } from './utils/version-guard'

const app = createApp(App)
app.use(pinia)
app.use(router)
// 全局初始化登录态：刷新后从 localStorage 还原 isLoggedIn / user，
// 否则未在 onMounted 显式 initUserState() 的页面守卫会误判未登录，导致死循环
useUserStore().initUserState()
// 版本指纹守卫：检测 CF 重新部署后让用户透明刷新到新版本
startVersionGuard()
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

// 仅生产环境注入 Cloudflare Web Analytics（避免 HMR 把开发流量打进去）
if (import.meta.env.PROD) {
  injectCloudflareAnalytics()
}

/**
 * 反注册任何残留的 Service Worker。
 *
 * 背景：项目历史上短暂启用过 vite-plugin-pwa（dev-dist/sw.js）做 PWA 测试，
 * 即使现在生产构建不再生成 SW，老用户浏览器里可能还驻留着 SW。
 * 残留的 SW 会无视 _headers 缓存控制，按自己的策略响应 fetch，
 * 导致"刷新页面但内容没变"。这里在每次应用启动时主动清理。
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.unregister().then((ok) => {
          if (ok) console.info('[main] 已清理残留 service worker:', reg.scope)
        })
      })
    })
  })
}
