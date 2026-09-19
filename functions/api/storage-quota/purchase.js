// 积分购买存储额度
// POST /api/storage-quota/purchase
//   Body: { units: number }（1 单元 = 1 积分 = 100MB，1~100）
//   返回 { ok: true, balance, quotaBytes, usedBytes, pendingBytes, remainingBytes }
//   余额不足 → 400 { ok: false, error }
//
// 原子性：db.batch 隐式事务；并发下扣积分条件更新失败时补偿回滚赠送（见 storageQuotaService）

import { extractUidFromRequest } from '../_lib/model-resolver.js'
import { purchaseStorage } from '../../services/storageQuotaService.js'
import {
  STORAGE_BYTES_PER_CREDIT,
  STORAGE_MIN_UNITS,
  STORAGE_MAX_UNITS,
} from '../../config/storage.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env?.DB
  if (!db) return jsonError('数据库未配置', 500)

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return jsonError('请先登录', 401)

  try {
    const body = await request.json().catch(() => ({}))
    const units = Math.floor(Number(body?.units))
    if (!Number.isFinite(units) || units < STORAGE_MIN_UNITS || units > STORAGE_MAX_UNITS) {
      return jsonError(`购买数量不合法（${STORAGE_MIN_UNITS} ~ ${STORAGE_MAX_UNITS}）`, 400)
    }

    const result = await purchaseStorage(db, uid, units)
    if (!result.ok) {
      const balance = result.balance ?? 0
      if (result.reason === 'insufficient') {
        return jsonError(`积分余额不足：当前 ${balance} 积分，本次需 ${units} 积分`, 400)
      }
      return jsonError('购买数量不合法', 400)
    }

    return json({
      ok: true,
      uid,
      balance: result.balance,
      quotaBytes: result.quotaBytes,
      usedBytes: result.usedBytes,
      pendingBytes: result.pendingBytes,
      remainingBytes: result.remainingBytes,
      purchased: {
        units,
        credits: units,
        bytes: units * STORAGE_BYTES_PER_CREDIT,
      },
    })
  } catch (error) {
    console.error('/api/storage-quota/purchase error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}
