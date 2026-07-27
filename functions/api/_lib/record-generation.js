// 生成记录 helper（两段式：开始插入 in_progress，结束 UPDATE 终态）
// best-effort：所有写入失败仅 log，绝不影响业务响应。
//
// 为什么要两段式：
//   - worker 中途被 CF 平台强行终止时，catch 块不会跑，状态会卡在 in_progress，
//     后台可直接看到"卡死的请求"——比"完全无记录"更易排查。
//   - 同时也能让后台实时看到在跑的请求（仪表感）。
//
// 字段说明：
//   - startGeneration: 写入 status='in_progress'，final 字段为 NULL，duration_ms=0
//   - finalizeGeneration: 根据 startOk 走 UPDATE 或 INSERT；写入失败不影响业务响应

const RAW_DATA_MAX_LEN = 4000
const ERROR_MAX_LEN = 500

/** 显式 null，避免把 undefined 透传到 D1 bind（会抛错被静默吞） */
function truncate(str, maxLen) {
  if (str == null) return null
  return str.length > maxLen ? str.slice(0, maxLen) + '…(truncated)' : str
}

/**
 * 请求发起时插入 in_progress 记录
 * @returns {Promise<boolean>} 是否成功插入
 */
export async function startGeneration(env, recordId, fields) {
  try {
    const db = env.DB
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await db
      .prepare(
        `INSERT INTO generation_records (
           id, uid, source, mode, model, status, cost,
           duration_ms, idempotency_key, tx_id, raw_data, created_at
         ) VALUES (?, ?, ?, ?, ?, 'in_progress', ?, 0, ?, ?, ?, ?)`,
      )
      .bind(
        recordId,
        fields.uid ?? null,
        fields.source,
        fields.mode ?? null,
        fields.model ?? null,
        fields.cost ?? 0,
        fields.idempotencyKey ?? null,
        fields.txId ?? null,
        truncate(JSON.stringify(fields.rawData ?? {})),
        now,
      )
      .run()
    return true
  } catch (err) {
    console.error('[generation_records] start failed:', err?.message || err)
    return false
  }
}

/**
 * 请求结束时更新最终状态
 * - startOk=true：UPDATE in_progress 行（UPDATE 影响 0 行说明被并发/外部删了，记 warn）
 * - startOk=false：fallback INSERT（in_progress 插入失败的情况）
 * @returns {Promise<boolean>}
 */
export async function finalizeGeneration(env, recordId, fields) {
  try {
    const db = env.DB
    const errorMessage = truncate(fields.errorMessage, ERROR_MAX_LEN)
    const rawData = fields.rawData != null
      ? truncate(JSON.stringify(fields.rawData))
      : null

    if (fields.startOk) {
      const updateResult = await db
        .prepare(
          `UPDATE generation_records
           SET status             = ?,
               result_url         = ?,
               error_message      = ?,
               duration_ms        = ?,
               upstream_duration_ms = ?,
               upstream_status    = ?,
               raw_data           = COALESCE(?, raw_data)
           WHERE id = ?`,
        )
        .bind(
          fields.status,
          fields.resultUrl ?? null,
          errorMessage,
          fields.durationMs,
          fields.upstreamDurationMs ?? null,
          fields.upstreamStatus ?? null,
          rawData,
          recordId,
        )
        .run()

      const changes =
        updateResult?.meta?.changes ?? updateResult?.changes ?? 0
      if (changes === 0) {
        console.warn('[generation_records] UPDATE matched 0 rows (可能被并发删除)', {
          recordId,
          status: fields.status,
        })
      } else {
        console.log('[generation_records] finalize OK', {
          recordId,
          status: fields.status,
          changes,
        })
      }
      return true
    }

    // startOk=false：startGeneration 失败 → 直接 INSERT 终态
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    await db
      .prepare(
        `INSERT INTO generation_records (
           id, uid, source, mode, model, status, cost,
           result_url, error_message,
           duration_ms, upstream_duration_ms, upstream_status,
           idempotency_key, tx_id, raw_data, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        recordId,
        fields.uid ?? null,
        fields.source,
        fields.mode ?? null,
        fields.model ?? null,
        fields.status,
        fields.cost ?? 0,
        fields.resultUrl ?? null,
        errorMessage,
        fields.durationMs,
        fields.upstreamDurationMs ?? null,
        fields.upstreamStatus ?? null,
        fields.idempotencyKey ?? null,
        fields.txId ?? null,
        rawData,
        now,
      )
      .run()
    console.log('[generation_records] finalize INSERT fallback OK', {
      recordId,
      status: fields.status,
    })
    return true
  } catch (err) {
    console.error('[generation_records] finalize failed:', err?.message || err, {
      recordId,
      status: fields.status,
    })
    return false
  }
}