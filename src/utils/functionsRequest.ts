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
