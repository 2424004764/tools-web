import assert from 'node:assert/strict'
import test from 'node:test'

import { onRequest } from '../functions/api/blog/my-posts/[id].js'

const secret = 'blog-author-edit-test-secret'

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

async function tokenFor(uid) {
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({ uid, ver: 0, exp: Math.floor(Date.now() / 1000) + 3600 })
  const data = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${Buffer.from(signature).toString('base64url')}`
}

function makeDb({ changes = 1 } = {}) {
  const calls = []
  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params })
          return {
            first: async () => sql.includes('token_version, is_disabled')
              ? { token_version: 0, is_disabled: 0 }
              : sql.includes('FROM blog_posts')
                ? { id: 'post-1', author_id: 'owner-1', author_type: 'user', status: 'published' }
                : null,
            run: async () => ({ meta: { changes } }),
          }
        },
      }
    },
  }
}

async function requestEdit(db, uid, body) {
  const token = await tokenFor(uid)
  return onRequest({
    request: new Request('https://example.test/api/blog/my-posts/post-1', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: { DB: db, JWT_SECRET: secret },
    params: { id: 'post-1' },
  })
}

test('author edit is scoped to the owner and always returns the post to review', async () => {
  const db = makeDb()
  const response = await requestEdit(db, 'owner-1', {
    title: 'Updated',
    content: 'Updated body',
    status: 'published',
    author_id: 'other-user',
    slug: 'take-over',
  })

  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.data.status, 'pending')
  assert.match(result.message, /审核/)

  const update = db.calls.find(({ sql }) => sql.includes('UPDATE blog_posts'))
  assert.ok(update)
  assert.match(update.sql, /status = 'pending'/)
  assert.match(update.sql, /author_id = \?/)
  assert.match(update.sql, /author_type = 'user'/)
  assert.match(update.sql, /status IN \('draft', 'pending', 'published', 'rejected'\)/)
  assert.match(update.sql, /reviewed_by = NULL/)
  assert.deepEqual(update.params.slice(-2), ['post-1', 'owner-1'])
  assert.equal(update.params.includes('take-over'), false)
  assert.equal(update.params.includes('other-user'), false)
})

test('a different user cannot edit the article', async () => {
  const db = makeDb({ changes: 0 })
  const response = await requestEdit(db, 'other-user', { title: 'Tampered', content: 'Tampered' })
  assert.equal(response.status, 404)
  assert.match((await response.json()).error, /无权编辑/)
})
