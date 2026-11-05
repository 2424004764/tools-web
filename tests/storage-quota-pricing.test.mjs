import assert from 'node:assert/strict'
import test from 'node:test'

import { getStorageBytesPerCredit, purchaseStorage } from '../functions/services/storageQuotaService.js'
import { STORAGE_BYTES_PER_CREDIT } from '../functions/config/storage.js'

function pricingDb(configuredValue) {
  const statements = []
  const db = {
    statements,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql,
            args,
            first: async () => {
              if (sql.includes('FROM site_config')) return configuredValue == null ? null : { value: configuredValue }
              if (sql.includes('SELECT balance FROM user_credits')) return { balance: 10 }
              if (sql.includes('SELECT quota_bytes, used_bytes')) return { quota_bytes: 0, used_bytes: 0 }
              if (sql.includes('SUM(bytes)')) return { total: 0 }
              return null
            },
            run: async () => ({ meta: { changes: 1 } }),
          }
        },
      }
    },
    async batch(items) {
      statements.push(...items)
      return items.map(() => ({ meta: { changes: 1 } }))
    },
  }
  return db
}

test('storage exchange rate falls back to 100 MiB for missing or invalid config', async () => {
  assert.equal(await getStorageBytesPerCredit(pricingDb(null)), STORAGE_BYTES_PER_CREDIT)
  assert.equal(await getStorageBytesPerCredit(pricingDb('invalid')), STORAGE_BYTES_PER_CREDIT)
  assert.equal(await getStorageBytesPerCredit(pricingDb('0')), STORAGE_BYTES_PER_CREDIT)
})

test('purchase grants the configured bytes per credit', async () => {
  const db = pricingDb(String(250 * 1024 * 1024))
  const result = await purchaseStorage(db, 'user-1', 2)
  assert.equal(result.ok, true)
  assert.equal(result.purchasedBytes, 500 * 1024 * 1024)
  assert.equal(db.statements[1].args[1], 500 * 1024 * 1024)
  assert.equal(await getStorageBytesPerCredit(db), 250 * 1024 * 1024)
})
