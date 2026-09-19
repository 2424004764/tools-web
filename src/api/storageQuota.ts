// 统一存储额度 API 客户端
// 后端：
//   GET  /api/me/storage-quota        查询额度（含价格配置）
//   POST /api/storage-quota/purchase  积分购买额度（1 积分 = 100MB）
//   POST /api/storage-quota/release   释放上传预留（放弃上传时调用）
//
// 所有接口要求登录（后端校验 uid）。

import { functionsRequest } from '@/utils/functionsRequest'

export interface StorageQuotaInfo {
  quotaBytes: number
  usedBytes: number
  /** 未过期上传预留占用的字节数（签名后未 confirm 的部分） */
  pendingBytes: number
  remainingBytes: number
  price: {
    /** 购买 1 单元需要的积分 */
    credits: number
    /** 1 单元对应的字节数（100MB） */
    bytes: number
  }
}

export interface PurchaseResult {
  balance: number
  quotaBytes: number
  usedBytes: number
  pendingBytes: number
  remainingBytes: number
  purchased: {
    units: number
    credits: number
    bytes: number
  }
}

/** 查询当前用户的存储额度；未登录时后端 401，由调用方处理 */
export async function getStorageQuota(): Promise<StorageQuotaInfo> {
  const res = await functionsRequest.get('/api/me/storage-quota')
  return res.data as StorageQuotaInfo
}

/** 积分购买存储额度（units：1 积分 = 100MB）；余额不足时后端返回 400 */
export async function purchaseStorageQuota(units: number): Promise<PurchaseResult> {
  const res = await functionsRequest.post('/api/storage-quota/purchase', { units })
  return res.data as PurchaseResult
}

/** 释放上传预留（放弃上传）；幂等，失败静默（预留超时也会自动失效） */
export async function releaseStorageReservation(reservationId: string): Promise<void> {
  if (!reservationId) return
  try {
    await functionsRequest.post('/api/storage-quota/release', { reservationId })
  } catch {
    /* 静默：预留 1 小时后自动失效 */
  }
}

/** 字节数 → 人类可读（MB 为主，与"1 积分 = 100MB"口径一致） */
export function formatStorageBytes(bytes: number): string {
  const value = Number(bytes) || 0
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${value} B`
}
