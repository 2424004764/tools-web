import assert from 'node:assert/strict'
import test from 'node:test'

import { NotesService } from '../functions/services/notesService.js'
import { NotesController } from '../functions/controllers/notesController.js'

const token = 'A'.repeat(43)

function mockDb({ noteExists = true } = {}) {
  const calls = []
  let storedCiphertext = null
  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params })
          return {
            first: async () => /SELECT \* FROM notes/.test(sql)
              ? (noteExists ? { id: 'note-1', uid: 'owner-1', title: 'Example', content: 'body' } : null)
              : sql.includes('SELECT s.is_active')
                ? { is_active: 1, create_time: '2026-01-01', token_ciphertext: storedCiphertext }
                : sql.includes('SELECT n.title, n.content')
                  ? { title: 'Example', content: 'body', createTime: '2026-01-01', updateTime: '2026-01-02' }
                  : null,
            run: async () => {
              if (sql.includes('INSERT INTO note_shares')) storedCiphertext = params[3]
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }
}

const serviceEnv = { JWT_SECRET: 'test-only-secret-for-notes-share' }

test('enabling share stores only a SHA-256 hash and returns a high entropy token', async () => {
  const db = mockDb()
  const result = await new NotesService(db, serviceEnv).enableNoteShare('note-1', 'owner-1')
  assert.equal(result.success, true)
  assert.match(result.data.token, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(result.data.token, token)
  const insert = db.calls.find((call) => call.sql.includes('INSERT INTO note_shares'))
  assert.ok(insert)
  assert.equal(insert.params[0], 'note-1')
  assert.equal(insert.params[1], 'owner-1')
  assert.match(insert.params[2], /^[a-f0-9]{64}$/)
  assert.notEqual(insert.params[2], result.data.token)
  assert.match(insert.params[3], /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  assert.notEqual(insert.params[3], result.data.token)
  assert.match(insert.sql, /token_ciphertext/)
})

test('share enable is owner-scoped and does not insert when the note is not owned', async () => {
  const db = mockDb({ noteExists: false })
  const result = await new NotesService(db).enableNoteShare('note-1', 'other-user')
  assert.equal(result.success, false)
  assert.equal(result.status, 404)
  assert.equal(db.calls.some((call) => call.sql.includes('INSERT INTO note_shares')), false)
})

test('share status and revoke include owner and note ownership checks', async () => {
  const db = mockDb()
  const service = new NotesService(db, serviceEnv)
  const enabled = await service.enableNoteShare('note-1', 'owner-1')
  const status = await service.getNoteShare('note-1', 'owner-1')
  assert.equal(status.data.isActive, true)
  assert.equal(status.data.canCopy, true)
  assert.equal(status.data.token, enabled.data.token)
  assert.deepEqual(db.calls[2].params, ['note-1', 'owner-1', 'owner-1'])
  assert.match(db.calls[2].sql, /n\.uid = \?/)
  await service.revokeNoteShare('note-1', 'owner-1')
  assert.deepEqual(db.calls[3].params, ['note-1', 'owner-1', 'owner-1'])
  assert.match(db.calls[3].sql, /EXISTS \(SELECT 1 FROM notes/)
})

test('anonymous share lookup hashes token and selects only public note fields', async () => {
  const db = mockDb()
  const result = await new NotesService(db).getSharedNote('f'.repeat(64))
  assert.equal(result.success, true)
  assert.deepEqual(Object.keys(result.data).sort(), ['content', 'createTime', 'title', 'updateTime'])
  assert.deepEqual(db.calls[0].params, ['f'.repeat(64)])
  assert.match(db.calls[0].sql, /s\.token_hash = \? AND s\.is_active = 1/)
  assert.match(db.calls[0].sql, /n\.uid = s\.owner_uid/)
  assert.doesNotMatch(db.calls[0].sql, /SELECT \*/)
})

test('unknown share uses the same not-found response', async () => {
  const controller = new NotesController({})
  controller.notesService.getSharedNote = async () => ({ success: true, data: null })
  const response = await controller.getSharedNote('0'.repeat(64), '*')
  assert.equal(response.status, 404)
  assert.match(await response.text(), /分享内容不存在或已失效/)
})
