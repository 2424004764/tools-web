import assert from 'node:assert/strict'
import test from 'node:test'

import { MAIN_JWT_TTL_SECONDS } from '../functions/config/auth.js'

test('all main-site login JWTs use a seven-day lifetime', () => {
  assert.equal(MAIN_JWT_TTL_SECONDS, 7 * 24 * 60 * 60)
})
