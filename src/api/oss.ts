import functionsRequest from '@/utils/functionsRequest'
import { OssStsProvider, type StsCredentials } from '@/utils/oss'

export interface OssConfig {
  id: string
  uid?: string
  name: string
  region: string
  bucket: string
  endpoint?: string
  roleArn?: string
  hasPolicy?: boolean
  durationSeconds: number
  isDefault: number
  accessKeyIdMasked?: string
  createTime: string
  updateTime: string
}

export interface OssConfigInput {
  name: string
  region: string
  bucket: string
  endpoint?: string
  accessKeyId: string
  accessKeySecret: string
  roleArn?: string
  policy?: string
  durationSeconds?: number
  isDefault?: boolean
}

export const ossApi = {
  list(): Promise<{ data: { success: boolean; data?: OssConfig[]; error?: string } }> {
    return functionsRequest.get('/api/oss-configs') as any
  },
  get(id: string) {
    return functionsRequest.get(`/api/oss-configs/${id}`) as any
  },
  create(payload: OssConfigInput) {
    return functionsRequest.post('/api/oss-configs', payload) as any
  },
  update(id: string, payload: Partial<OssConfigInput>) {
    return functionsRequest.put(`/api/oss-configs/${id}`, payload) as any
  },
  delete(id: string) {
    return functionsRequest.delete(`/api/oss-configs/${id}`) as any
  },
  // 交换 STS 临时凭证
  sts(configId: string) {
    return functionsRequest.post('/api/oss-sts', { config_id: configId }) as any
  }
}

/**
 * 全局 STS Provider 单例
 *
 * - 内部按 configId 缓存 STS 凭证，过期前 5 分钟自动刷新
 * - OSS 操作遇到 403 时调用 ossStsProvider.invalidate(id) 强制刷新
 * - 推荐用法：await callWithOss(id, ossStsProvider, async client => { ... })
 */
export const ossStsProvider = new OssStsProvider(async (configId: string): Promise<StsCredentials> => {
  const res: any = await ossApi.sts(configId)
  if (!res?.data?.success) {
    throw new Error(res?.data?.error || 'STS 签发失败')
  }
  return res.data.data
})