import assert from 'node:assert/strict'
import test from 'node:test'

import { isAllowedImageResponse } from '../functions/api/image-proxy.js'
import { validateRecipe } from '../functions/controllers/mockSchemasController.js'
import { validateQAInput } from '../functions/routes/qa.js'
import { normalizeHttpUrl } from '../src/utils/external-url.ts'
import { matchesMusicUploadIntent } from '../functions/services/musicService.js'
import { LinksService } from '../functions/services/linksService.js'
import { takeCreateSlot } from '../functions/routes/links.js'

const validRecipe = {
  name: 'Example',
  description: '',
  isPublic: false,
  schema: [{ name: 'value', type: 'string' }],
}

const validIntent = {
  uid: 'user-1',
  song_id: 'song-1',
  r2_key: 'songs/user-1/song-1.mp3',
  mime_type: 'audio/mpeg',
  file_size: 1024,
  file_sha256: 'a'.repeat(64),
  reservation_id: 'reservation-1',
}

test('music upload confirmation requires an exact owner-bound intent match', () => {
  const expected = {
    uid: 'user-1', songId: 'song-1', r2Key: 'songs/user-1/song-1.mp3',
    mimeType: 'audio/mpeg', fileSize: 1024.8, sha256: 'a'.repeat(64), reservationId: 'reservation-1',
  }
  assert.equal(matchesMusicUploadIntent(validIntent, expected), true)
  assert.equal(matchesMusicUploadIntent(validIntent, { ...expected, uid: 'attacker' }), false)
  assert.equal(matchesMusicUploadIntent(validIntent, { ...expected, fileSize: 2048 }), false)
  assert.equal(matchesMusicUploadIntent(validIntent, { ...expected, sha256: 'b'.repeat(64) }), false)
  assert.equal(matchesMusicUploadIntent(null, expected), false)
})

test('short-link delete is scoped to owner and rate limiting uses trusted edge IP', async () => {
  let captured
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          captured = { sql, args }
          return { run: async () => ({ meta: { changes: 1 } }) }
        },
      }
    },
  }
  const service = new LinksService(db)
  assert.equal(await service.deleteLink('slug123', 'owner-1').then((r) => r.success), true)
  assert.match(captured.sql, /DELETE FROM short_links/)
  assert.match(captured.sql, /slug = \?/)
  assert.match(captured.sql, /uid = \?/)
  assert.deepEqual(captured.args, ['slug123', 'owner-1'])

  const request = new Request('https://example.test/api/links', {
    headers: { 'CF-Connecting-IP': '203.0.113.8', 'X-Forwarded-For': '198.51.100.1' },
  })
  assert.equal(await takeCreateSlot(db, request), true)
  assert.match(captured.sql, /created_count < 20/)
  assert.notEqual(captured.args[0], '203.0.113.8')
  assert.notEqual(captured.args[0], '198.51.100.1')
})

test('mock recipes reject anonymous publication and unbounded generators', () => {
  assert.equal(validateRecipe(validRecipe), '')
  assert.match(validateRecipe({ ...validRecipe, isPublic: 'true' }), /布尔值/)
  assert.match(validateRecipe({
    ...validRecipe,
    schema: [{ name: 'items', type: 'array', min: 1, max: 100000, itemType: 'string' }],
  }), /结构无效/)
  assert.match(validateRecipe({
    ...validRecipe,
    schema: [{ name: 'obj', type: 'object', children: Array.from({ length: 101 }, (_, i) => ({ name: `f${i}`, type: 'string' })) }],
  }), /结构无效/)
})

test('QA text-only publication enforces field, item, and aggregate limits', () => {
  assert.equal(validateQAInput({
    title: 'QA', qaItems: [{ question: 'Q', answer: 'A' }],
    headerContent: '<script>still literal</script>', footerContent: '',
  }), '')
  assert.match(validateQAInput({ title: 'x'.repeat(201), qaItems: [{ question: 'Q', answer: 'A' }] }), /标题/)
  assert.match(validateQAInput({ title: 'QA', qaItems: Array.from({ length: 51 }, () => ({ question: 'Q', answer: 'A' })) }), /数量/)
  assert.match(validateQAInput({ title: 'QA', qaItems: [{ question: 'Q', answer: 'A'.repeat(20001) }] }), /长度/)
})

test('image proxy rejects active content and invalid declared size', () => {
  assert.equal(isAllowedImageResponse('image/png; charset=binary', null), true)
  assert.equal(isAllowedImageResponse('IMAGE/JPEG', '52428800'), true)
  assert.equal(isAllowedImageResponse('image/svg+xml', '100'), false)
  assert.equal(isAllowedImageResponse('text/html', '100'), false)
  assert.equal(isAllowedImageResponse('image/webp', '-1'), false)
  assert.equal(isAllowedImageResponse('image/gif', '52428801'), false)
})

test('external navigation accepts HTTP(S) only', () => {
  assert.equal(normalizeHttpUrl('example.com/path'), 'https://example.com/path')
  assert.equal(normalizeHttpUrl('https://example.com'), 'https://example.com/')
  assert.equal(normalizeHttpUrl('javascript:alert(1)'), null)
  assert.equal(normalizeHttpUrl('data:text/html,hi'), null)
  assert.equal(normalizeHttpUrl('https://user:pass@example.com'), null)
  assert.equal(normalizeHttpUrl('https://example.com/\nheader'), null)
})
