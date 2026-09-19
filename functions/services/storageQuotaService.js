// 统一存储额度服务（所有 R2 上传业务共用）
//   - 表结构见 migrations/079_create_user_storage_quota.sql
//   - 剩余额度 = quota_bytes - used_bytes - 未过期预留(storage_reservations 内 TTL 内的行)
//   - 上传流程：签名前 reserve 预扣 → PUT 完成后 confirm 按实际大小 settle（多退少补）
//               → 放弃上传 release 释放预留；预留超时自动失效，不会永久占坑
//   - 删除文件：按实际对象大小 refundBytes 退回额度（积分不退）
//   - 并发安全：单条条件 INSERT/UPDATE 原子完成，不依赖跨语句事务

import {
  STORAGE_BYTES_PER_CREDIT,
  STORAGE_RESERVATION_TTL_SECONDS,
  STORAGE_RESERVATION_SWEEP_SECONDS,
} from '../config/storage.js'

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function intOr0(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** 读用户额度概况；行不存在 → 全 0 */
export async function getStorageQuota(db, uid) {
  const row = await db
    .prepare('SELECT quota_bytes, used_bytes FROM user_storage_quota WHERE uid = ? LIMIT 1')
    .bind(uid)
    .first()
  const quotaBytes = intOr0(row?.quota_bytes)
  const usedBytes = intOr0(row?.used_bytes)
  let pendingBytes = 0
  try {
    const pending = await db
      .prepare(
        `SELECT COALESCE(SUM(bytes), 0) AS total FROM storage_reservations
         WHERE uid = ? AND created_at >= datetime('now', ?)`,
      )
      .bind(uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`)
      .first()
    pendingBytes = intOr0(pending?.total)
  } catch {
    pendingBytes = 0
  }
  return {
    quotaBytes,
    usedBytes,
    pendingBytes,
    remainingBytes: Math.max(0, quotaBytes - usedBytes - pendingBytes),
  }
}

/** 确保额度行存在（幂等） */
async function ensureQuotaRow(db, uid) {
  await db
    .prepare(
      `INSERT INTO user_storage_quota (uid, quota_bytes, used_bytes, updated_at)
       VALUES (?, 0, 0, ?)
       ON CONFLICT(uid) DO NOTHING`,
    )
    .bind(uid, nowSql())
    .run()
}

/**
 * 上传前预留额度（原子）。成功返回预留 id，失败（额度不足）返回 null。
 * 过期预留不参与占用判定，并在任意 reserve 时被顺带清扫。
 */
export async function reserveStorage(db, uid, bytes) {
  const size = intOr0(bytes)
  if (size <= 0) return null
  const now = nowSql()

  // 顺带清扫全局超期预留（86400s 后必已失效，行也不再有任何用途）
  await db
    .prepare(`DELETE FROM storage_reservations WHERE created_at < datetime('now', ?)`)
    .bind(`-${STORAGE_RESERVATION_SWEEP_SECONDS} seconds`)
    .run()
  await ensureQuotaRow(db, uid)

  const id = crypto.randomUUID()
  // 条件 INSERT：一条语句内完成"剩余额度判定 + 预留写入"，天然原子
  const r = await db
    .prepare(
      `INSERT INTO storage_reservations (id, uid, bytes, created_at)
       SELECT ?, ?, ?, ?
       WHERE (SELECT quota_bytes - used_bytes FROM user_storage_quota WHERE uid = ?)
           - (SELECT COALESCE(SUM(bytes), 0) FROM storage_reservations
              WHERE uid = ? AND created_at >= datetime('now', ?))
           >= ?`,
    )
    .bind(
      id, uid, size, now,
      uid,
      uid, `-${STORAGE_RESERVATION_TTL_SECONDS} seconds`,
      size,
    )
    .run()
  const changes = r?.meta?.changes ?? 0
  return changes > 0 ? id : null
}

/** 预留结算：按实际大小累加 used_bytes（允许小幅透支，透支后剩余为 0 会阻止后续上传），并删除预留 */
export async function settleReservation(db, uid, reservationId, actualBytes) {
  const actual = Math.max(0, Math.floor(Number(actualBytes) || 0))
  const now = nowSql()
  await ensureQuotaRow(db, uid)
  const stmts = [
    db
      .prepare('UPDATE user_storage_quota SET used_bytes = used_bytes + ?, updated_at = ? WHERE uid = ?')
      .bind(actual, now, uid),
  ]
  if (reservationId) {
    stmts.push(
      db.prepare('DELETE FROM storage_reservations WHERE id = ? AND uid = ?').bind(reservationId, uid),
    )
  }
  await db.batch(stmts)
}

/** 直接累加用量（无预留场景，如服务端持久化 AI 生成图） */
export async function commitStorageUsage(db, uid, bytes) {
  const size = Math.max(0, Math.floor(Number(bytes) || 0))
  if (size <= 0) return
  await ensureQuotaRow(db, uid)
  await db
    .prepare('UPDATE user_storage_quota SET used_bytes = used_bytes + ?, updated_at = ? WHERE uid = ?')
    .bind(size, nowSql(), uid)
    .run()
}

/** 释放预留（放弃上传）。幂等；只能删除自己名下的预留 */
export async function releaseReservation(db, uid, reservationId) {
  if (!reservationId) return false
  const r = await db
    .prepare('DELETE FROM storage_reservations WHERE id = ? AND uid = ?')
    .bind(reservationId, uid)
    .run()
  return (r?.meta?.changes ?? 0) > 0
}

/** 删除文件后退回额度（封顶 0，防止把 used_bytes 修成负数） */
export async function refundStorageUsage(db, uid, bytes) {
  const size = Math.max(0, Math.floor(Number(bytes) || 0))
  if (size <= 0) return
  await db
    .prepare(
      `UPDATE user_storage_quota
       SET used_bytes = MAX(0, used_bytes - ?), updated_at = ?
       WHERE uid = ?`,
    )
    .bind(size, nowSql(), uid)
    .run()
}

/**
 * 积分购买额度。units × 1 积分 = units × 100MB。
 * 返回 { ok: true, balance, ...quota }；余额不足返回 { ok: false }。
 * 并发场景：先条件扣积分（batch 内），若 changes=0 则补偿回滚刚执行的赠送。
 */
export async function purchaseStorage(db, uid, units) {
  const count = Math.floor(Number(units) || 0)
  if (count <= 0) return { ok: false, reason: 'invalid' }

  const balanceRow = await db
    .prepare('SELECT balance FROM user_credits WHERE uid = ?')
    .bind(uid)
    .first()
  const balance = Number(balanceRow?.balance) || 0
  if (balance < count) return { ok: false, reason: 'insufficient', balance }

  const cost = count // 1 积分/单元
  const grantBytes = count * STORAGE_BYTES_PER_CREDIT
  const now = nowSql()
  const txId = crypto.randomUUID()

  const results = await db.batch([
    db
      .prepare(
        `UPDATE user_credits
         SET balance = balance - ?, total_spent = total_spent + ?, updated_at = ?
         WHERE uid = ? AND balance >= ?`,
      )
      .bind(cost, cost, now, uid, cost),
    db
      .prepare(
        `UPDATE user_storage_quota
         SET quota_bytes = quota_bytes + ?, updated_at = ?
         WHERE uid = ?`,
      )
      .bind(grantBytes, now, uid),
    db
      .prepare(
        `INSERT INTO credit_transactions
         (id, uid, type, amount, balance_after, reason, operator_uid, source, idempotency_key, created_at)
         VALUES (?, ?, 'deduct', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, ?, 'tool', ?, ?)`,
      )
      .bind(txId, uid, -cost, uid, `storage-quota:purchase:units=${count}:bytes=${grantBytes}B`, uid, txId, now),
  ])

  const deducted = results?.[0]?.meta?.changes ?? 0
  if (deducted === 0) {
    // 并发扣费失败：补偿回滚同事务内已执行的赠送与流水
    await db.batch([
      db
        .prepare('UPDATE user_storage_quota SET quota_bytes = MAX(0, quota_bytes - ?), updated_at = ? WHERE uid = ?')
        .bind(grantBytes, now, uid),
      db.prepare('DELETE FROM credit_transactions WHERE id = ? AND uid = ?').bind(txId, uid),
    ])
    return { ok: false, reason: 'insufficient', balance }
  }

  const quota = await getStorageQuota(db, uid)
  return { ok: true, ...quota, balance: balance - cost }
}
