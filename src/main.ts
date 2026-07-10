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

const app = createApp(App)
app.use(pinia)
app.use(router)
// 全局初始化登录态：刷新后从 localStorage 还原 isLoggedIn / user，
// 否则未在 onMounted 显式 initUserState() 的页面守卫会误判未登录，导致死循环
useUserStore().initUserState()
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

// 仅生产环境注入 Cloudflare Web Analytics（避免 HMR 把开发流量打进去）
if (import.meta.env.PROD) {
  injectCloudflareAnalytics()
}
