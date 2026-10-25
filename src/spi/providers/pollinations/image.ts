import { ImageOptions, ImageResponse } from '../../common/interfaces'
import axios from 'axios'

export async function generateImage(
  this: any,
  prompt: string, 
  options?: ImageOptions
): Promise<ImageResponse> {
  if (!this.apiKey || !this.proxyUrl || !this.imageUrl) {
    throw new Error('API配置不完整')
  }

  // 构造查询参数
  const params = {
    model: options?.model || 'flux',
    width: options?.width || 1024,
    height: options?.height || 1024,
    nologo: 'true',
    seed: Math.floor(Math.random() * 100000000).toString(),
  }

  // 移除未定义的参数并确保所有值都是字符串
  const filteredParams = Object.fromEntries(
    Object.entries(params)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  )

  // 添加时间戳避免缓存
  filteredParams._t = String(Date.now())

  // 将 filteredParams 转成 GET 参数拼接
  const queryString = new URLSearchParams(filteredParams).toString()
  
  const response = await axios.get(
    `${this.proxyUrl}?path=image/${encodeURIComponent(prompt)}&target=${encodeURIComponent(this.imageUrl)}&params=${queryString}`,
    {
      headers: {
        Authorization: 'Bearer ' + this.apiKey,
      },
      responseType: 'blob',
      // axios 默认 timeout=0（永不超时），图片生成请求会无限挂起、loading 永不结束
      timeout: 60_000,
    }
  )

  const contentType = response.headers['content-type']
  const blob = new Blob([response.data], {
    type: (typeof contentType === 'string' && contentType) || 'image/jpeg',
  })
  const url = URL.createObjectURL(blob)
  // blob URL 不主动 revoke 会常驻内存；延迟 10 分钟回收（展示/下载窗口），
  // 防止连续生成时内存无限累积
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000)

  return {
    url,
    model: options?.model || 'flux',
    metadata: {
      width: options?.width || 1024,
      height: options?.height || 1024,
      seed: params.seed
    }
  }
}
