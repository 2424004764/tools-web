import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { getLocalToken } from './user'
import { handleHttpError } from './errorHandler'

// Admin 接口 403 兜底：前端路由守卫只校验 token 里的 is_admin 声明，
// 管理员被降权后旧 token 仍能进入后台页面，但所有接口会被后端 _middleware.js
// 以 403 拒绝。此时提示并弹回首页，避免停留在后台空壳页。
// 一个页面会并发多个 admin 请求，用标志位保证只提示/跳转一次。
let handlingAdmin403 = false

function handleAdmin403(message: string): void {
  if (handlingAdmin403) return
  handlingAdmin403 = true
  ElMessage({
    message: `${message}，即将返回首页`,
    type: 'error',
    duration: 2000,
    showClose: true,
  })
  setTimeout(() => {
    // replace 而非 href，避免返回键又退回无权限的后台页面
    window.location.replace('/')
  }, 1500)
}

// 创建functions代理专用的axios实例
class FunctionsRequest {
  private instance: AxiosInstance
  private proxyUrl: string

  constructor() {
    // 获取代理URL，优先使用环境变量，否则使用默认值
    this.proxyUrl = import.meta.env.VITE_SITE_URL
    
    this.instance = axios.create({
      baseURL: this.proxyUrl,
      timeout: 30000, // 30秒超时
    })

    // 请求拦截器 - 自动添加TOKEN
    this.instance.interceptors.request.use(
      (config) => {
        const token = getLocalToken()
        if (token) {
          config.headers = config.headers || {}
          // 后端auth中间件期望Bearer token格式
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器 - 处理错误
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        if (Number(response.data?.code) === 401) {
          handleHttpError(401)
        }
        return response
      },
      (error) => {
        let message = '请求失败'
        const status = error.response?.status
        if (status === 401) {
          handleHttpError(status)
        } else if (
          status === 403 &&
          typeof error.config?.url === 'string' &&
          error.config.url.startsWith('/api/admin/')
        ) {
          // 后端判定无管理员权限（token 声明与真实权限不一致）：提示后弹回首页
          const backendMessage =
            typeof error.response?.data?.error === 'string' && error.response.data.error
              ? error.response.data.error
              : '无管理员权限'
          handleAdmin403(backendMessage)
        } else if (typeof error.response?.data?.error === 'string' && error.response.data.error) {
          message = error.response.data.error
          ElMessage.error(message)
        } else if (error.response) {
          switch (status) {
            case 403:
              message = '无权限访问'
              break
            case 404:
              message = '接口不存在'
              break
            case 500:
              message = '服务器内部错误'
              break
            default:
              message = `请求失败: ${status}`
          }
          ElMessage.error(message)
        } else if (error.request) {
          ElMessage.error('网络连接失败')
        } else {
          ElMessage.error(message)
        }

        return Promise.reject(error)
      }
    )
  }

  // GET请求
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get(url, config)
  }

  // POST请求
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data, config)
  }

  // PUT请求
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data, config)
  }

  // PATCH请求
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch(url, data, config)
  }

  // DELETE请求
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete(url, config)
  }

  // 获取当前代理URL
  getProxyUrl(): string {
    return this.proxyUrl
  }
}

// 导出单例实例
export const functionsRequest = new FunctionsRequest()
export default functionsRequest
