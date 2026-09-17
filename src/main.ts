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

const app = createApp(App)
app.use(pinia)
app.use(router)

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
// 已改造为「只在路由跳转时检查」（见 router.beforeEach 调用 checkAppStale），
// 不再有 setInterval 轮询，避免浪费 CF Pages 请求次数。
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

// 仅生产环境注入 Cloudflare Web Analytics（避免 HMR 把开发流量打进去）
if (import.meta.env.PROD) {
  injectCloudflareAnalytics()
}
