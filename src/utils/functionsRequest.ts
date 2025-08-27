import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { getLocalToken } from './user'
import { handleHttpError } from './errorHandler'

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
        return response
      },
      (error) => {
        if (error.response) {
          const status = error.response.status
          
          if (status === 401) {
            ElMessage.error('登录已过期，即将跳转到登录页')
            setTimeout(() => {
              window.location.href = '/login'
            }, 1000)
          } else {
            handleHttpError(status)
          }
        } else if (error.request) {
          ElMessage.error('网络连接失败')
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
