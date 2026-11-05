import assert from 'node:assert/strict'
import test from 'node:test'

import { onRequest as siteConfigRequest } from '../functions/api/admin/site-config.js'
import { grantRegistrationRewards } from '../functions/services/registrationRewardService.js'

function configDb(rows = []) {
  const writes = []
  const db = {
    writes,
    prepare(sql) {
      return {
        all: async () => ({ results: rows }),
        bind(...args) {
          return {
            all: async () => ({ results: rows }),
            run: async () => {
              writes.push({ sql, args })
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }
  return db
}

test('registration reward settings default to zero and accept only non-negative integers', async () => {
  const db = configDb()
  const response = await siteConfigRequest({ request: new Request('https://example.test/api/admin/site-config'), env: { DB: db } })
  const data = (await response.json()).data
  assert.equal(data.values.registration_storage_bytes, '')
  assert.equal(data.values.registration_credits, '')
  assert.equal(data.values.storage_bytes_per_credit, '')

  const valid = await siteConfigRequest({
    request: new Request('https://example.test/api/admin/site-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_storage_bytes: 104857600, registration_credits: 25, storage_bytes_per_credit: 209715200 }),
    }),
    env: { DB: db },
  })
  assert.equal(valid.status, 200)
  assert.deepEqual(db.writes.map(({ args }) => args.slice(0, 2)), [
    ['registration_storage_bytes', '104857600'],
    ['registration_credits', '25'],
    ['storage_bytes_per_credit', '209715200'],
  ])

  for (const [key, value] of [['registration_credits', -1], ['storage_bytes_per_credit', 0], ['storage_bytes_per_credit', -10], ['storage_bytes_per_credit', '1.5'], ['storage_bytes_per_credit', 'Infinity']]) {
    const invalid = await siteConfigRequest({
      request: new Request('https://example.test/api/admin/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      }),
      env: { DB: db },
    })
    assert.equal(invalid.status, 400)
  }
})

test('registration rewards atomically add storage and ledgered credits', async () => {
  const statements = []
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          const statement = { sql, args }
          statements.push(statement)
          return statement
        },
      }
    },
    async batch(batchStatements) {
      assert.deepEqual(batchStatements, statements)
      return []
    },
  }
  const config = {
    prepare(sql) {
      assert.match(sql, /FROM site_config/)
      return { all: async () => ({ results: [
        { key: 'registration_storage_bytes', value: '104857600' },
        { key: 'registration_credits', value: '12' },
      ] }) }
    },
  }
  const rewardDb = Object.create(db)
  rewardDb.prepare = (sql) => sql.includes('site_config') ? config.prepare(sql) : db.prepare(sql)
  const result = await grantRegistrationRewards(rewardDb, 'new-user')
  assert.deepEqual(result, { storageBytes: 104857600, credits: 12 })
  assert.equal(statements.length, 3)
  assert.match(statements[0].sql, /INSERT INTO user_storage_quota/)
  assert.deepEqual(statements[0].args.slice(0, 2), ['new-user', 104857600])
  assert.match(statements[1].sql, /INSERT INTO user_credits/)
  assert.deepEqual(statements[1].args.slice(0, 3), ['new-user', 12, 12])
  assert.match(statements[2].sql, /INSERT INTO credit_transactions/)
  assert.deepEqual(statements[2].args.slice(1, 4), ['new-user', 12, 'new-user'])
  assert.equal(statements[2].args[4], '新用户注册奖励')
})

test('zero registration rewards do not write user balances or quota rows', async () => {
  let batchCalled = false
  const db = {
    prepare() {
      return { all: async () => ({ results: [] }) }
    },
    async batch() {
      batchCalled = true
    },
  }
  assert.deepEqual(await grantRegistrationRewards(db, 'new-user'), { storageBytes: 0, credits: 0 })
  assert.equal(batchCalled, false)
})
