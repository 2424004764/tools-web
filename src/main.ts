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
 * 清理残留的 Service Worker / Cache API（与 About.vue 的「清理缓存并刷新」同源逻辑）。
 *
 * 背景：项目历史上短暂启用过 vite-plugin-pwa（dev-dist/sw.js）做 PWA 测试，
 * 即使现在生产构建不再生成 SW，老用户浏览器里可能还驻留着 SW。
 * 残留的 SW 会无视 _headers 缓存控制，按自己的策略响应 fetch，
 * 并用预缓存里的旧入口 HTML 干扰版本探测 → 触发 location.replace() 循环。
 * 这里在每次应用启动时主动反注册 SW 并清理同源 Cache API。
 *
 * 仅在确认真清掉了东西时刷新一次（一次性标记防循环），正常用户无感知。
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const markerKey = '__sw_cleaned__'
    if (sessionStorage.getItem(markerKey)) return

    const cleanupPromise = (async () => {
      let clearedAny = false
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          regs.map(async (reg) => {
            const ok = await reg.unregister()
            if (ok) {
              clearedAny = true
              console.info('[main] 已清理残留 service worker:', reg.scope)
            }
          }),
        )
      } catch (e) {
        // 静默：注册信息读取失败不影响主流程
      }
      if ('caches' in window) {
        try {
          const keys = await caches.keys()
          if (keys.length > 0) {
            await Promise.all(keys.map((k) => caches.delete(k)))
            clearedAny = true
            console.info('[main] 已清理残留 Cache API:', keys.length, '个 cache')
          }
        } catch (e) {
          // 静默
        }
      }
      return clearedAny
    })()

    cleanupPromise.then((cleared) => {
      if (cleared) {
        sessionStorage.setItem(markerKey, '1')
        // 用 replace 重新拉取入口，避免 bfcache 还原旧页面
        window.location.replace(location.pathname + location.search + location.hash)
      }
    })
  })
}
