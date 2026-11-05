function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : 0
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function grantRegistrationRewards(db, uid) {
  const rows = await db
    .prepare("SELECT key, value FROM site_config WHERE key IN ('registration_storage_bytes', 'registration_credits')")
    .all()
  const config = new Map((rows.results || []).map(({ key, value }) => [key, value]))
  const storageBytes = positiveInteger(config.get('registration_storage_bytes'))
  const credits = positiveInteger(config.get('registration_credits'))
  if (!storageBytes && !credits) return { storageBytes: 0, credits: 0 }

  const now = nowSql()
  const statements = []
  if (storageBytes) {
    statements.push(
      db.prepare(
        `INSERT INTO user_storage_quota (uid, quota_bytes, used_bytes, updated_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(uid) DO UPDATE SET
           quota_bytes = quota_bytes + excluded.quota_bytes,
           updated_at = excluded.updated_at`,
      ).bind(uid, storageBytes, now),
    )
  }
  if (credits) {
    const txId = crypto.randomUUID()
    statements.push(
      db.prepare(
        `INSERT INTO user_credits (uid, balance, total_earned, total_spent, frozen, created_at, updated_at)
         VALUES (?, ?, ?, 0, 0, ?, ?)
         ON CONFLICT(uid) DO UPDATE SET
           balance = balance + excluded.balance,
           total_earned = total_earned + excluded.total_earned,
           updated_at = excluded.updated_at`,
      ).bind(uid, credits, credits, now, now),
      db.prepare(
        `INSERT INTO credit_transactions
         (id, uid, type, amount, balance_after, reason, operator_uid, source, created_at)
         VALUES (?, ?, 'grant', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, 'SYSTEM', 'recharge', ?)`,
      ).bind(txId, uid, credits, uid, '新用户注册奖励', now),
    )
  }

  await db.batch(statements)
  return { storageBytes, credits }
}
