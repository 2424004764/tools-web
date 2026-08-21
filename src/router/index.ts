//通过vue-router插件实现模板路由配置
import { createRouter, createWebHistory } from 'vue-router'
import { constantRoute } from './router'
import { isAppStale, isVersionCheckComplete } from '@/utils/version-guard'
import { useUserStore } from '@/store/modules/user'

// 记录用户正在导航到的目标路径，供 onError 硬刷时使用
const TARGET_PATH_KEY = '__nav_target_path__'

// chunk 加载失败硬刷防循环：会话内累计计数，到达上限后停止硬刷，
// 避免 旧 SW / CDN 异常 / 旧 chunk 仍可访问 时反复 reload。
const CHUNK_ERROR_KEY = '__chunk_error_count__'
const MAX_CHUNK_ERRORS = 2
// 同一会话最多硬刷 N 次版本不一致，超出后停止硬刷避免死循环
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
  // 记录目标路径，供 onError 硬刷时使用（避免 currentRoute 还指向旧路由）
  sessionStorage.setItem(TARGET_PATH_KEY, to.fullPath)

  // 版本过期：CF 已重新部署，但当前 SPA 还停在旧 chunk 上。
  // 直接硬刷到目标 URL —— 用户感受是"点完就到目标页"，无感知。
  // 受 MAX_RELOADS_PER_SESSION 上限保护，超过后停止硬刷（CDN 缓存异常场景下的死循环兜底）。
  if (isAppStale()) {
    const reloadCount = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10)
    const lastReload = parseInt(sessionStorage.getItem(LAST_RELOAD_TIME_KEY) || '0', 10)
    const now = Date.now()

    // 两次硬刷之间最小间隔，防止 scroll → router.replace → 硬刷 的紧密循环
    if (reloadCount < MAX_RELOADS_PER_SESSION && (now - lastReload) > MIN_RELOAD_INTERVAL) {
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

// 兜底：动态路由 chunk 加载失败。
// 之前用单独的 flag 在 beforeEach 顶部清空，flag 永远抓不到 → 硬刷永远重来。
// 改为在 afterEach 导航成功后才清零；onError 用累加计数限制重试次数，
// 超过后渲染不依赖任何路由 chunk 的静态错误提示，避免 /404 组件也加载失败形成新循环。
router.onError((error) => {
  console.warn('[router] chunk load failed:', error)
  const errCount = parseInt(sessionStorage.getItem(CHUNK_ERROR_KEY) || '0', 10) + 1
  sessionStorage.setItem(CHUNK_ERROR_KEY, String(errCount))
  if (errCount > MAX_CHUNK_ERRORS) {
    // 多次重试仍失败：直接渲染静态错误提示，不依赖 SPA 路由
    // 提供两个按钮：
    //   ① 「强制刷新」：带 cache-bust 参数跳回原路径，绕开任何 SW / 内存缓存
    //   ② 「清理缓存」：反注册 SW + 清 Cache API + 清 sessionStorage
    //
    // 注意：不要把 JS 字符串拼接进 onclick="" 属性 —— JSON.stringify 路径里的双引号会
    // 提前闭合属性，HTML 解析器会把按钮元素本身吃掉（只剩标题/正文，按钮消失）。
    // 这里改用 createElement + addEventListener，绕开转义问题。
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
    const currentPath = (sessionStorage.getItem(TARGET_PATH_KEY) || router.currentRoute.value.fullPath || '/')
    const search = location.search || ''

    /**
     * 构造带 cache-bust 的同源 URL。
     *
     * 修复背景：之前直接 `currentPath + search + '&_cb=...'` 拼接会出 bug：
     *   - 当 currentPath 不含 query 时 → `/path&_cb=...`（少了 ?，路由 404）
     *   - 当 currentPath 含 query 时（如 /foo?id=1）→ 同时又有 search (?id=1)
     *     → 拼成 `/foo?id=1?id=1&_cb=...`（query 重复，404）
     *
     * currentPath 来自 sessionStorage / router.currentRoute.value.fullPath，
     * Vue Router 的 fullPath 已经带上了 query 和 hash，这里统一剥掉，
     * 再合并 location.search（去掉重复），最后用 URLSearchParams 加 _cb。
     */
    const buildReloadUrl = (): string => {
      const pathOnly = currentPath.split('?')[0].split('#')[0] || '/'
      const params = new URLSearchParams(search) // 自动忽略前面的 ?、处理 & 拼接
      params.set('_cb', String(Date.now()))
      return pathOnly + (params.toString() ? '?' + params.toString() : '')
    }

    const wrap = document.createElement('div')
    wrap.style.cssText =
      'display:flex;align-items:center;justify-content:center;min-height:100vh;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#666;padding:24px'

    const card = document.createElement('div')
    card.style.cssText = 'text-align:center;max-width:420px'

    const icon = document.createElement('div')
    icon.style.cssText = 'font-size:48px;margin-bottom:12px'
    icon.textContent = '⚠️'

    const title = document.createElement('h2')
    title.style.cssText = 'font-size:18px;margin:0 0 8px;color:#18181b'
    title.textContent = '页面加载失败'

    const desc = document.createElement('p')
    desc.style.cssText = 'font-size:14px;margin:0 0 20px;line-height:1.6'
    desc.textContent = '资源加载多次失败，可能是浏览器缓存了过期的 JS。请点击下方按钮一键恢复：'

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap'

    const reloadBtn = document.createElement('button')
    reloadBtn.style.cssText =
      'padding:10px 20px;border-radius:8px;border:none;background:#409EFF;color:#fff;' +
      'font-size:14px;cursor:pointer;font-weight:500'
    reloadBtn.textContent = '🔄 强制刷新'
    reloadBtn.addEventListener('click', () => {
      location.replace(buildReloadUrl())
    })

    const cleanBtn = document.createElement('button')
    cleanBtn.style.cssText =
      'padding:10px 20px;border-radius:8px;border:1px solid #dcdfe6;background:#fff;color:#409EFF;' +
      'font-size:14px;cursor:pointer;font-weight:500'
    cleanBtn.textContent = '🧹 清理缓存并刷新'
    cleanBtn.addEventListener('click', () => {
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then((rs) =>
            Promise.all(rs.map((r) => r.unregister())),
          )
        }
        if (window.caches) {
          caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
        }
        try {
          sessionStorage.clear()
        } catch (e) {
          // 忽略
        }
      } finally {
        location.replace(buildReloadUrl())
      }
    })

    const tip = document.createElement('p')
    tip.style.cssText = 'font-size:12px;margin:16px 0 0;color:#999'
    tip.textContent = '如果都试过仍然不行，请检查网络或换个网络环境'

    btnRow.appendChild(reloadBtn)
    btnRow.appendChild(cleanBtn)
    card.appendChild(icon)
    card.appendChild(title)
    card.appendChild(desc)
    card.appendChild(btnRow)
    card.appendChild(tip)
    wrap.appendChild(card)

    // 整体替换 body，绕开 SPA 的 #app 节点
    document.body.innerHTML = ''
    document.body.appendChild(wrap)
    return
  }
  // 第一次/第二次失败：硬刷到目标 URL（保留 query），由 afterEach 在成功后清零
  const targetPath = sessionStorage.getItem(TARGET_PATH_KEY) || router.currentRoute.value.fullPath || '/'
  window.location.replace(targetPath)
})

// 路由后置：仅更新 document.title（SPA 内部导航的用户体验优化）
// 同时清除动态 chunk 错误计数（导航成功说明目标 chunk 已加载完毕）
router.afterEach((to) => {
  if (sessionStorage.getItem(CHUNK_ERROR_KEY)) {
    sessionStorage.removeItem(CHUNK_ERROR_KEY)
  }
  document.title = to.meta.title
    ? `${to.meta.title as string}-${APP_TITLE}`
    : `${APP_TITLE}-${APP_DESC}`
})

export default router
