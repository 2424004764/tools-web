import assert from 'node:assert/strict'
import test from 'node:test'

import { NotesController } from '../functions/controllers/notesController.js'
import { NotesService } from '../functions/services/notesService.js'

function createDb() {
  const calls = []
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          const call = { sql, params }
          calls.push(call)
          return {
            first: async () => ({ count: 2 }),
            all: async () => ({ results: [{ id: 'n1', uid: 'owner-1', title: 'Found', content: '', group_id: 'g1', create_time: '2026-01-01 00:00:00' }] }),
          }
        },
      }
    },
  }
  return { db, calls }
}

test('note search is owner-scoped, cross-group, parameterized, and paginated', async () => {
  const { db, calls } = createDb()
  const service = new NotesService(db)
  const pager = { pageSize: 12, offset: 0, createResult: (data, total) => ({ data, pagination: { total } }) }

  const result = await service.getAllNotes('owner-1', pager, { groupId: 'group-from-client', search: "x%' OR 1=1 --" })

  assert.equal(result.success, true)
  assert.equal(result.data.pagination.total, 2)
  assert.equal(result.data.data[0].groupId, 'g1')
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.match(call.sql, /uid = \?/)
    assert.match(call.sql, /title LIKE \? OR content LIKE \?/)
    assert.doesNotMatch(call.sql, /OR 1=1/)
    assert.equal(call.params[0], 'owner-1')
    assert.deepEqual(call.params.slice(1, 3), ["%x ' OR 1=1 --%", "%x ' OR 1=1 --%"])
  }
  assert.deepEqual(calls[1].params.slice(3), [12, 0])
  assert.doesNotMatch(calls[1].sql, /group_id/)
})

test('note search treats LIKE wildcards as literal text', async () => {
  const { db, calls } = createDb()
  const pager = { pageSize: 12, offset: 0, createResult: (data, total) => ({ data, total }) }

  await new NotesService(db).getAllNotes('owner-1', pager, { search: '%_literal' })

  assert.equal(calls[0].params[1], '%  literal%')
  assert.equal(calls[0].params[2], '%  literal%')
})

test('notes endpoint rejects oversized search terms without querying notes', async () => {
  const { db, calls } = createDb()
  const controller = new NotesController(db)
  const request = new Request(`https://example.test/api/notes?q=${'x'.repeat(101)}`)

  const response = await controller.index({ id: 'owner-1' }, {}, request, '*')

  assert.equal(response.status, 400)
  assert.deepEqual(calls, [])
})

test('notes endpoint ignores non-owner IDs and trims validated search terms', async () => {
  let received
  const controller = new NotesController({})
  controller.notesService.getAllNotes = async (...args) => {
    received = args
    return { success: true, data: { data: [], pagination: {} } }
  }
  const request = new Request('https://example.test/api/notes?uid=attacker&groupId=foreign&q=%20%20memo%20')

  await controller.index({ id: 'owner-1' }, {}, request, '*')

  assert.equal(received[0], 'owner-1')
  assert.equal(received[2].search, 'memo')
  assert.equal(received[2].groupId, 'foreign')
})
