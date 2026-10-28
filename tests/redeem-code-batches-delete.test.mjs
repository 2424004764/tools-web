import assert from 'node:assert/strict'
import test from 'node:test'

import { onRequest } from '../functions/api/admin/redeem-code-batches/[batchId].js'

function createDb({ deleted = 2, batch = null } = {}) {
  const calls = []
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args })
          return {
            run: async () => ({ meta: { changes: deleted } }),
            first: async () => batch,
          }
        },
      }
    },
  }
  return { db, calls }
}

function request(method = 'DELETE') {
  return new Request('https://example.test/api/admin/redeem-code-batches/batch-1', { method })
}

function context(db, method = 'DELETE') {
  return { request: request(method), env: { DB: db }, params: { batchId: 'batch-1' }, data: { adminUid: 'admin-1' } }
}

test('deletes only the requested unused batch and returns deleted count', async () => {
  const { db, calls } = createDb({ deleted: 3 })
  const response = await onRequest(context(db))
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.deleted, 3)
  assert.equal(body.data.batch_id, 'batch-1')
  assert.match(calls[0].sql, /DELETE FROM credit_redeem_codes/)
  assert.match(calls[0].sql, /WHERE batch_id = \?/)
  assert.match(calls[0].sql, /NOT EXISTS/)
  assert.deepEqual(calls[0].args, ['batch-1', 'batch-1'])
})

test('rejects a batch with used codes without deleting it', async () => {
  const { db, calls } = createDb({ deleted: 0, batch: { total: 3, used: 1 } })
  const response = await onRequest(context(db))
  const body = await response.json()

  assert.equal(response.status, 409)
  assert.match(body.error, /已兑换码/)
  assert.equal(calls.length, 2)
  assert.match(calls[1].sql, /SELECT COUNT\(\*\)/)
})

test('returns not found when batch does not exist', async () => {
  const { db } = createDb({ deleted: 0, batch: { total: 0, used: 0 } })
  const response = await onRequest(context(db))
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error, '批次不存在')
})

test('rejects methods other than GET, PUT, and DELETE', async () => {
  const { db, calls } = createDb()
  const response = await onRequest(context(db, 'PATCH'))

  assert.equal(response.status, 405)
  assert.equal(calls.length, 0)
})
