import { ElMessage } from 'element-plus'
import { logout, isTokenExpired, getLocalToken } from './user'

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

export function installFetch401Handler(): void {
  if (typeof window === 'undefined') return
  const fetch = window.fetch as typeof window.fetch & { __handlesApi401?: boolean }
  if (fetch.__handlesApi401) return

  const originalFetch = window.fetch.bind(window)
  const wrappedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    originalFetch(input, init).then((response) => {
      if (response.status === 401 && isSameOriginApiRequest(input)) {
        handle401Error()
      }
      return response
    })) as typeof window.fetch & { __handlesApi401?: boolean }

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
