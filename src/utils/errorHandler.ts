import { ElMessage } from 'element-plus'
import { logout, isTokenExpired, getLocalToken } from './user'
import { createDpopProof } from './dpop'

let clearInMemoryAuthState: (() => void) | undefined
let handling401 = false

export function registerAuthStateClearer(clearer: () => void): void {
  clearInMemoryAuthState = clearer
}

export interface ErrorHandlerOptions {
  /** 是否显示错误消息 */
  showMessage?: boolean
  /** 是否自动跳转登录页 */
  autoRedirectLogin?: boolean
  /** 自定义错误消息 */
  customMessage?: string
  /** 是否为特殊API（如笔记API） */
  isSpecialApi?: boolean
}

/**
 * 统一的401错误处理
 */
export function handle401Error(options: ErrorHandlerOptions = {}) {
  const {
    showMessage = true,
    autoRedirectLogin = true,
    customMessage,
    isSpecialApi = false
  } = options

  if (!isSpecialApi && handling401) return

  const token = getLocalToken()
  const expired = token ? isTokenExpired(token) : true

  let message = customMessage
  if (!message) {
    if (isSpecialApi) {
      message = '未登录状态，部分功能受限'
    } else {
      message = expired ? '登录已过期，请重新登录' : '身份验证失败'
    }
  }

  if (isSpecialApi) {
    if (showMessage) {
      ElMessage({
        message,
        type: 'error',
        duration: 2500,
        showClose: true
      })
    }
    return
  }

  handling401 = true
  setTimeout(() => {
    handling401 = false
  }, 1000)
  logout()
  clearInMemoryAuthState?.()

  if (showMessage) {
    ElMessage({
      message,
      type: 'error',
      duration: 2500,
      showClose: true
    })
  }

  if (autoRedirectLogin && typeof window !== 'undefined') {
    setTimeout(() => {
      if (!window.location.pathname.includes('/login')) {
        const currentPath = window.location.pathname + window.location.search + window.location.hash
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
      }
    }, 0)
  }
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false

  const requestUrl = input instanceof Request ? input.url : String(input)
  try {
    const url = new URL(requestUrl, window.location.href)
    return url.origin === window.location.origin && (url.pathname === '/api' || url.pathname.startsWith('/api/'))
  } catch {
    return false
  }
}

/**
 * 从 fetch init.headers 中读取指定 header（支持 Headers 实例与普通对象）。
 * 返回 null 表示请求未显式声明该 header（或 input 为 Request 对象的调用形式，保守跳过）
 */
function getInitHeader(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers
  if (!h) return null
  if (h instanceof Headers) return h.get(name)
  const record = h as Record<string, string>
  // 大小写不敏感查找普通对象形式的 header
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase())
  const value = key ? record[key] : null
  return typeof value === 'string' ? value : null
}

/**
 * 请求目标是否本站 API 路径（/api 开头）。相对路径按当前 origin 解析。
 * 只对这类请求注入 DPoP，避免把 proof 发给第三方域。
 */
function isApiPathRequest(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
    return url.pathname === '/api' || url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

export function installFetch401Handler(): void {
  if (typeof window === 'undefined') return
  const fetch = window.fetch as typeof window.fetch & { __handlesApi401?: boolean }
  if (fetch.__handlesApi401) return

  const originalFetch = window.fetch.bind(window)
  const wrappedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // DPoP 自动注入：绕过 axios 的原生 fetch（ai-proxy 流式、letters/links、
    // shopping-lists keepalive 等）带了 Bearer 时，同样要带 proof 才能通过
    // 绑定 token 的鉴权。签名是亚毫秒级异步操作，keepalive 卸载请求也可承受
    const bearer = getInitHeader(init, 'Authorization')
    const hasDpop = getInitHeader(init, 'DPoP') !== null
    if (bearer && bearer.startsWith('Bearer ') && !hasDpop && isApiPathRequest(input)) {
      try {
        const htu = new URL(
          input instanceof Request ? input.url : String(input),
          window.location.href
        ).href.replace(/[?#].*$/, '')
        const dpop = await createDpopProof((init!.method || 'GET').toUpperCase(), htu)
        // Headers 实例直接展开会丢失全部条目，先归一为普通对象再合并
        const baseHeaders = init!.headers instanceof Headers
          ? Object.fromEntries(init!.headers.entries())
          : (init!.headers as Record<string, string>)
        init = {
          ...init,
          headers: {
            ...baseHeaders,
            DPoP: dpop
          }
        }
      } catch {
        /* proof 生成失败：交由后端判定 */
      }
    }
    return originalFetch(input, init).then((response) => {
      if (response.status === 401 && isSameOriginApiRequest(input)) {
        handle401Error()
      }
      return response
    })
  }) as typeof window.fetch & { __handlesApi401?: boolean }

  wrappedFetch.__handlesApi401 = true
  window.fetch = wrappedFetch
}

/**
 * 统一的HTTP错误处理
 */
export function handleHttpError(status: number, options: ErrorHandlerOptions = {}) {
  const { showMessage = true } = options

  let message = ''
  
  switch (status) {
    case 401:
      return handle401Error(options)
    case 403:
      message = '无权限访问'
      break
    case 404:
      message = '接口不存在'
      break
    case 500:
      message = '服务器内部错误'
      break
    case 502:
      message = '网关错误'
      break
    case 503:
      message = '服务暂时不可用'
      break
    case 504:
      message = '网关超时'
      break
    default:
      message = `请求失败: ${status}`
  }

  if (showMessage) {
    ElMessage({
      message,
      type: 'error',
      duration: 2500,
      showClose: true
    })
  }

  return { status, message }
}

/**
 * 检查请求前token状态
 */
export function checkTokenBeforeRequest(): boolean {
  const token = getLocalToken()
  if (!token) {
    return false
  }
  
  // 如果token即将过期（提前5分钟），提醒用户
  const payload = token ? isTokenExpired(token) : true
  if (payload) {
    ElMessage({
      message: '登录即将过期，请及时保存数据',
      type: 'warning',
      duration: 3000,
      showClose: true
    })
    return false
  }
  
  return true
}
