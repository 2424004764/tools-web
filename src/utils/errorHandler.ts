import { ElMessage } from 'element-plus'
import { logout, isTokenExpired, getLocalToken } from './user'

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

  // 检查token是否过期
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

  // 显示错误消息
  if (showMessage) {
    ElMessage.error(message)
  }

  // 对于特殊API（如笔记），不自动处理登录态
  if (isSpecialApi) {
    return
  }

  // 清空登录态
  logout()

  // 自动跳转登录页
  if (autoRedirectLogin) {
    setTimeout(() => {
      // 如果当前不在登录页，则跳转
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }, 1000)
  }
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
    ElMessage.error(message)
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
    ElMessage.warning('登录即将过期，请及时保存数据')
    return false
  }
  
  return true
}
