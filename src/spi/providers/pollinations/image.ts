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
    model: options?.model || 'sdxl',
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
    `${this.proxyUrl}?path=prompt/${encodeURIComponent(prompt)}&target=${this.imageUrl}&params=${queryString}`,
    {
      headers: {
        Authorization: 'Bearer ' + this.apiKey,
      },
      responseType: 'blob',
    }
  )

  const blob = new Blob([response.data], { type: 'image/png' })
  const url = URL.createObjectURL(blob)

  return {
    url,
    model: options?.model || 'sdxl',
    metadata: {
      width: options?.width || 1024,
      height: options?.height || 1024,
      seed: params.seed
    }
  }
}
