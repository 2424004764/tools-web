// R2 (S3 兼容) 工具：SigV4 预签名 PUT 签发 + 公网 URL 构造
// 抽离自 functions/services/musicService.js (原 music 上传同款实现)，
// 现在被 music 上传与 ai-creations 保存共用，避免两套实现漂移。
//
// 设计说明：
//   - 不走 env.MEDIA binding（preview bucket 与生产桶命名差异，统一用 wrangler.toml 中的桶名）
//   - R2 endpoint：`https://{bucket}.{accountId}.r2.cloudflarestorage.com`
//   - 签名有效期默认 900 秒（15 分钟），足够前端完成 fetch + PUT
//   - Content-Type 必须由调用方锁定：签什么 header，PUT 时就要带这个 header，否则 R2 端 SignatureDoesNotMatch

const enc = new TextEncoder()
const PRESIGN_EXPIRES_SECONDS = 900 // 15 分钟

function toHex(buffer) {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

async function hmac(key, data) {
  let keyBuf
  if (typeof key === 'string') {
    keyBuf = enc.encode(key)
  } else if (key instanceof Uint8Array) {
    keyBuf = key
  } else {
    keyBuf = new Uint8Array(key)
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return await crypto.subtle.sign({ name: 'HMAC' }, cryptoKey, enc.encode(data))
}

async function sha256Hex(data) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data))
  return toHex(hash)
}

// URI 编码（RFC 3986 严格模式：~ 不编码）
function uriEncode(value, encodeSlash = true) {
  let str = String(value)
  str = encodeURIComponent(str)
  str = str
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
  str = str.replace(/%7E/g, '~')
  if (!encodeSlash) str = str.replace(/%2F/g, '/')
  return str
}

// key → S3 path-style 编码（每段单独编码后用 / 连接）
function encodeS3Key(key) {
  return key.split('/').map((seg) => uriEncode(seg, true)).join('/')
}

/**
 * 签发 R2 预签名 PUT URL
 *
 * @param {object} env       Cloudflare Pages env，需含 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID
 * @param {string} bucket    R2 桶名（一般读 env.R2_BUCKET_NAME）
 * @param {string} r2Key     对象键（如 ai-creations/{uid}/{groupId}/{uuid}.png）
 * @param {string} contentType MIME 类型（签名锁定的 Content-Type，PUT 时必须一致）
 * @returns {Promise<{uploadUrl: string, r2Key: string, expiresAt: number}>}
 */
export async function signR2PutUrl(env, bucket, r2Key, contentType) {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  const accountId = env.R2_ACCOUNT_ID
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 凭据未配置（缺少 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID）')
  }
  if (!bucket) throw new Error('R2 桶名未配置（wrangler.toml [[r2_buckets]] binding）')

  const nowDate = new Date()
  const amzDate = nowDate.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)

  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const encodedKey = encodeS3Key(r2Key)
  const canonicalUri = `/${encodedKey}`
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const signedHeaders = 'content-type;host'

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(PRESIGN_EXPIRES_SECONDS),
    'X-Amz-SignedHeaders': signedHeaders,
  })
  const sortedQuery = [...queryParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join('&')

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`
  const payloadHash = 'UNSIGNED-PAYLOAD'
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kSecret = enc.encode(`AWS4${secretAccessKey}`)
  const kDate = await hmac(kSecret, dateStamp)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  const uploadUrl = `https://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`
  const expiresAt = nowDate.getTime() + PRESIGN_EXPIRES_SECONDS * 1000

  return { uploadUrl, r2Key, expiresAt }
}

/**
 * 构造公网可访问 URL（前端可直接放 src= 加载）
 * @param {object} env
 * @param {string} r2Key
 * @returns {string} 公网 URL；R2_PUBLIC_HOST 未配置时返回空字符串
 */
export function buildR2PublicUrl(env, r2Key) {
  const host = env.R2_PUBLIC_HOST
  if (!host) return ''
  return `https://${host}/${r2Key.split('/').map((s) => encodeURIComponent(s)).join('/')}`
}

/**
 * 服务端用 SigV4 直接删 R2 对象（不走 binding，避免 preview bucket 不一致）
 * 与 signR2PutUrl 保持同一组 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID。
 * 204 = 成功，404 = 已不存在（视为成功，幂等）。
 */
export async function deleteR2Object(env, bucket, r2Key) {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  const accountId = env.R2_ACCOUNT_ID
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 凭据未配置（缺少 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID）')
  }
  if (!bucket) throw new Error('R2 桶名未配置（缺少 env.R2_BUCKET_NAME）')

  const nowDate = new Date()
  const amzDate = nowDate.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${encodeS3Key(r2Key)}`
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`

  // DELETE 无 body，只需签 host；payload 走 UNSIGNED-PAYLOAD
  // ⚠️ 不要再手动加任何 header（如 x-amz-content-sha256），
  // Cloudflare Workers fetch 转发 DELETE 请求时会把请求里出现的 header
  // 都纳入签名计算；没签进 signedHeaders 就加 header 会导致 R2 端 SignatureDoesNotMatch
  const signedHeaders = 'host'
  const canonicalHeaders = `host:${host}\n`
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '300',
    'X-Amz-SignedHeaders': signedHeaders,
  })
  const sortedQuery = [...queryParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join('&')

  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kSecret = enc.encode(`AWS4${secretAccessKey}`)
  const kDate = await hmac(kSecret, dateStamp)
  const kRegion = await hmac(kDate, 'auto')
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = toHex(await hmac(kSigning, stringToSign))

  const url = `https://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`
  const response = await fetch(url, { method: 'DELETE' })

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '')
    throw new Error(`R2 delete 失败: HTTP ${response.status} ${text}`)
  }
}