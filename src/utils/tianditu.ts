// 天地图 JS API 4.0 动态加载器
//
// 天地图的 SDK 只能通过 <script> 注入，加载完成后挂在全局 window.T 上。
// 这里做单例缓存：同一页面多个地图组件（编辑器 / 分享页 / 广场预览）只会注入一次。
// 加载模式参照 src/components/Tools/WeChatFormat/utils/exportPDF.ts。

const SDK_VERSION = '4.0'
const SCRIPT_FLAG = 'data-tianditu-sdk'

let loadPromise: Promise<any> | null = null

/** 密钥是否已配置。未配置时调用方应展示引导，而不是让地图白屏。 */
export function hasTiandituKey(): boolean {
  return Boolean(getTiandituKey())
}

export function getTiandituKey(): string {
  const key = import.meta.env.VITE_TIANDITU_KEY
  return typeof key === 'string' ? key.trim() : ''
}

/**
 * 加载天地图 SDK，resolve 出全局的 T 命名空间。
 * 并发调用共享同一个 Promise；失败后会清空缓存，允许重试。
 */
export function loadTianditu(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('天地图 SDK 只能在浏览器环境加载'))
  }

  // SDK 已就绪（可能来自上一次加载，或页面里已有的 script）
  if ((window as any).T?.Map) {
    return Promise.resolve((window as any).T)
  }

  if (loadPromise) return loadPromise

  const key = getTiandituKey()
  if (!key) {
    return Promise.reject(
      new Error('未配置天地图密钥：请在 .env 中填写 VITE_TIANDITU_KEY')
    )
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api.tianditu.gov.cn/api?v=${SDK_VERSION}&tk=${encodeURIComponent(key)}`
    script.async = true
    script.setAttribute(SCRIPT_FLAG, '')

    script.onload = () => {
      const T = (window as any).T
      if (T?.Map) {
        resolve(T)
      } else {
        // 脚本 200 了但没挂上 T：几乎都是密钥无效或域名不在白名单
        loadPromise = null
        script.remove()
        reject(new Error('天地图 SDK 加载异常：请检查密钥是否有效、当前域名是否已加入密钥白名单'))
      }
    }

    script.onerror = () => {
      loadPromise = null
      script.remove()
      reject(new Error('天地图 SDK 加载失败：请检查网络连接'))
    }

    document.head.appendChild(script)
  })

  return loadPromise
}
