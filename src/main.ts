import { createApp } from 'vue'
import App from './App.vue'
//vite-plugin-svg-icons
import 'virtual:svg-icons-register'
//router
import router from './router'
//styles
import './styles/tailwind.css'
// 自托管 Inter Variable 字体（仅拉丁子集，~30KB woff2）；中文走系统 PingFang/Microsoft YaHei 兜底
// 1) 触发 Vite 把 woff2 资源打包进 dist/assets/ 并自动加 contenthash（受 _headers 缓存 1 年）
// 2) 自动注入 @font-face CSS，配合 Tailwind fontFamily.display/body 在字体加载后切换
import '@fontsource-variable/inter/wght.css'
// loading.css 已删除（Phase 1 清理：全代码库零引用，原 .route-loading 仅占首屏 CSS 字节）
//pinia
import pinia from './store'
import { useUserStore } from './store/modules/user'
import { initializeAIProviders } from './spi/init'
import { injectCloudflareAnalytics } from './utils/analytics'
import { initTheme } from './composables/useTheme'

const app = createApp(App)
app.use(pinia)
app.use(router)

// 恢复主题偏好（light/dark，见 useTheme.ts），须在挂载前执行避免闪白
initTheme()

// v-md-editor 懒加载：仅在 /markdown/ 页面首次访问时动态 import 并注册，
// 避免首屏就把 v-md-editor + prism + vuepress 主题一起打包进来。
// Notes.vue 已不用 v-md-editor（改用自建 textarea + markdown-it 预览），
// 所以绝大多数用户根本不会触发这段加载。
let mdEditorRegistered = false
router.beforeEach(async (to) => {
  if (!mdEditorRegistered && to.path.startsWith('/markdown')) {
    mdEditorRegistered = true
    const { setupMdEditor } = await import('./plugins/v-md-editor')
    setupMdEditor(app)
  }
})
// 全局初始化登录态：刷新后从 localStorage 还原 isLoggedIn / user，
// 否则未在 onMounted 显式 initUserState() 的页面守卫会误判未登录，导致死循环
useUserStore().initUserState()
// 版本指纹守卫：检测 CF 重新部署后让用户透明刷新到新版本。
// 路由跳转时后台非阻塞探测（见 router.beforeEach 调用 guardStaleVersion），
// 导航不等待探测结果，无 setInterval 轮询，探测有 TTL 限频。
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

// 仅生产环境注入 Cloudflare Web Analytics（避免 HMR 把开发流量打进去）
if (import.meta.env.PROD) {
  injectCloudflareAnalytics()
}

// PWA Service Worker：仅生产环境、非自动化环境注册（与 vite.config injectRegister: null 配套）。
// vite.config 里 registerType: 'autoUpdate'：生成的 sw.js 自带 skipWaiting + clientsClaim，
// 发版后新 SW 装完立即接管，这里裸注册即可，无需手动发 SKIP_WAITING。
// puppeteer 预渲染时 navigator.webdriver === true，必须跳过，避免 SW 缓存逻辑干扰快照产物
if (import.meta.env.PROD && !navigator.webdriver) {
  // updateViaCache: 'none'：SW 更新检查一律绕过 HTTP 缓存。
  // 2026-10 线上实测 sw.js 被 Cloudflare 以 max-age=14400 下发（_headers 的 no-cache
  // 被 zone 的 Browser Cache TTL 改写），4 小时内浏览器拿不到新 sw.js，发版后旧 SW 滞留
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .catch(() => { /* SW 注册失败静默 */ })

  // 新 SW（skipWaiting）接管本页时刷新一次：接管瞬间可能出现"旧 HTML 引用的
  // 旧 hash 资源已 404"（无样式页面），刷新后 SW / HTML / 资源三者重新一致。
  // 首次安装（本页此前没有 controller）不刷；OAuth 回调页不刷（code 是一次性的）
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return
    if (/\/(?:github|google|gitee|qq|linuxdo)-auth$/.test(location.pathname)) return
    refreshing = true
    window.location.reload()
  })
}
