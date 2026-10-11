// 第 0 步验证：R2 是否强制执行预签名 PUT URL 中的 content-length 签名
// 用法（仓库根目录）：node temp/verify-r2-content-length.mjs
//   Case A：签 content-length=11，PUT 11 字节        → 期望 2xx（正常上传成功）
//   Case B：签 content-length=11，PUT 22 字节（不符） → 期望 403 SignatureDoesNotMatch
//           ← 这一条通过，说明"大小不符在 R2 上传时直接拒绝"成立
// 凭据读 .dev.vars（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY），
// 测试对象落在 songs/_sigv4-test/ 下（token 最小权限范围 songs/* 内），结束后删除。
import { readFileSync } from 'node:fs'
import { signR2PutUrl, deleteR2Object } from '../functions/services/r2.js'

const devVars = {}
for (const line of readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line)
  if (m && m[1] && !(m[1] in devVars)) devVars[m[1]] = m[2]
}

const env = {
  R2_ACCOUNT_ID: devVars.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: devVars.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: devVars.R2_SECRET_ACCESS_KEY,
}
if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error('FAIL: .dev.vars 缺少 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY')
  process.exit(1)
}
const bucket = devVars.R2_BUCKET_NAME || 'tools-web'

const declared = 11
const bodyOk = Buffer.alloc(declared, 0x41) // 11 字节
const bodyBad = Buffer.alloc(declared * 2, 0x42) // 22 字节（不符）
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const r2Key = `songs/_sigv4-test/content-length-${stamp}.txt`
const contentType = 'text/plain'

async function put(presign, body) {
  return fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: new Uint8Array(body),
  })
}

try {
  // Case A：大小一致，应当成功
  const presignOk = await signR2PutUrl(env, bucket, r2Key, contentType, { contentLength: declared })
  const resA = await put(presignOk, bodyOk)
  const textA = await resA.text().catch(() => '')
  console.log(`Case A（11=11）: HTTP ${resA.status} ${textA.slice(0, 200)}`)
  if (!resA.ok) {
    console.error(`FAIL: 大小一致的正常上传都没过（HTTP ${resA.status}）。请检查 R2 token 权限/桶名，先修这个再谈 content-length。`)
    process.exit(1)
  }

  // Case B：大小不符，应当被 R2 拒绝（关键验证）
  const presignBad = await signR2PutUrl(env, bucket, `${r2Key}.mismatch`, contentType, { contentLength: declared })
  const resB = await put(presignBad, bodyBad)
  const textB = await resB.text().catch(() => '')
  console.log(`Case B（22≠11）: HTTP ${resB.status} ${textB.slice(0, 300)}`)
  if (resB.ok) {
    console.error('FAIL: R2 接受了大小不符的上传 —— content-length 签名未被强制执行，"上传时拒绝"不成立，需要换方案（worker 事后删除或代理上传）。')
    process.exit(1)
  }
  if (resB.status === 403 && /Signature/i.test(textB)) {
    console.log('PASS: R2 强制执行 content-length 签名，大小不符被 403 拒绝。方案前提成立 ✓')
  } else {
    console.log(`PASS（弱）: 大小不符被拒绝（HTTP ${resB.status}），但错误码不是 SignatureDoesNotMatch，人工确认一下原因。`)
  }
} finally {
  for (const key of [r2Key, `${r2Key}.mismatch`]) {
    try {
      await deleteR2Object(env, bucket, key)
      console.log(`已清理测试对象: ${key}`)
    } catch (e) {
      console.warn(`清理失败（请手动删）: ${key} — ${e.message}`)
    }
  }
}
