/**
 * 阿里云 OSS 浏览器端客户端
 *
 * 使用 STS 临时凭证进行签名与请求。
 * 浏览器需要 OSS Bucket 配置 CORS 规则允许当前域名 PUT/GET/DELETE/HEAD。
 */

export interface StsCredentials {
  accessKeyId: string
  accessKeySecret: string
  /** 阿里云 STS 临时凭证 token。直接 AccessKey 模式（不走 RAM）时为空字符串 */
  securityToken: string
  expiration: string
  config: {
    id: string
    name: string
    region: string
    bucket: string
    endpoint?: string
  }
}

export interface OssObject {
  name: string
  key: string
  type: 'file' | 'directory'
  size?: number
  lastModified?: string
  etag?: string
}

export interface ListResult {
  objects: OssObject[]
  prefixes: string[]
  nextContinuationToken?: string
  isTruncated: boolean
}

// utf8 helpers
const utf8 = (s: string) => new TextEncoder().encode(s)

// SHA-256 hex digest
async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', utf8(input))
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// HMAC-SHA256，返回 Uint8Array（用于 v4 签名派生 key）
async function hmacSha256Raw(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, utf8(data))
  return new Uint8Array(sig)
}

// 把字符串或 buffer 统一成 BufferSource（兼容 TS Strict ArrayBuffer 检查）
function keyData(k: Uint8Array): Uint8Array<ArrayBuffer> {
  return k as Uint8Array<ArrayBuffer>
}

// HMAC-SHA256，hex 字符串
async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  const sig = await hmacSha256Raw(key, data)
  return Array.from(sig)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// RFC 3986 percent encoding（OSS 用）
function pctEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
    .replace(/'/g, '%27')
}

/**
 * 阿里云 SDK encodeString：encodeURIComponent + 对 !'()* 额外编码
 * 用于 CanonicalURI 等需要保留分隔符（/）但编码其它特殊字符的场景
 */
function encodeOssPath(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )
}

/**
 * 构造 OSS v4 签名（浏览器端推荐）
 *  - 使用 x-oss-date 自定义头（fetch() 不会被浏览器丢弃）
 *  - UNSIGNED-PAYLOAD：不签名 body（TLS 已经保护了 body）
 *  - 参考：https://help.aliyun.com/zh/oss/developer-reference/oss-api-overview-v4
 */
async function signOssV4(opts: {
  method: string
  bucket: string
  objectKey: string
  query?: Record<string, string>
  headers?: Record<string, string>
  sts: StsCredentials
}): Promise<Record<string, string>> {
  const { method, bucket, objectKey, query = {}, headers: rawHeaders = {}, sts } = opts

  const region = (sts.config.region || 'cn-hangzhou').replace(/^oss-/, '')
  const product = 'oss'
  const now = new Date()
  // yyyymmdd
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  // yyyymmddTHHMMSSZ
  const timestamp = now.toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/[-:]/g, '')

  // 1) 合并请求头（小写 key，去除两端空白）
  const headerMap = new Map<string, string>()
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (v == null) continue
    headerMap.set(k.toLowerCase(), String(v).trim())
  }
  // 必填头：host（v4 必须签）、x-oss-date、x-oss-content-sha256
  const host = buildEndpoint(sts).replace(/^https?:\/\//, '')
  headerMap.set('host', host)
  headerMap.set('x-oss-date', timestamp)
  headerMap.set('x-oss-content-sha256', 'UNSIGNED-PAYLOAD')
  // 仅在有 STS token 时加（直接 AccessKey 模式无 token）
  if (sts.securityToken) {
    headerMap.set('x-oss-security-token', sts.securityToken.trim())
  }

  // 2) CanonicalHeaders / AdditionalHeaders
  //    CanonicalHeaders:  所有签名头的列表（进 CanonicalRequest 第 4 行）
  //    AdditionalHeaders: 只放"额外"头（不进 x-oss-* / content-type / content-md5），
  //                       用于 CanonicalRequest 第 5 行 + Authorization 头
  //                       （OSS v4 与 AWS SigV4 的差异点！）
  const sortedHeaderKeys = Array.from(headerMap.keys()).sort()
  const canonicalHeaders = sortedHeaderKeys
    .map(k => `${k}:${headerMap.get(k)}\n`)
    .join('')
  const additionalHeaders = sortedHeaderKeys
    .filter(k =>
      k !== 'content-type' &&
      k !== 'content-md5' &&
      !k.startsWith('x-oss-')
    )
    .join(';')

  // 3) CanonicalQueryString（空值不输出 =，与 OSS 期望一致）
  const sortedQueryKeys = Object.keys(query).sort()
  const canonicalQuery = sortedQueryKeys
    .map(k => {
      const v = query[k]
      return v === '' || v == null ? pctEncode(k) : `${pctEncode(k)}=${pctEncode(v)}`
    })
    .join('&')

  // 4) CanonicalURI: /bucket/object-key（按 SDK 做法先 encodeURIComponent 再把 %2F 还原为 /）
  const rawURI = '/' + bucket + '/' + (objectKey ? objectKey.replace(/^\/+/, '') : '')
  const canonicalURI = encodeOssPath(rawURI).replace(/%2F/g, '/')

  // 5) CanonicalRequest（OSS v4 第 5 行是 AdditionalHeaders，不是 SignedHeaders）
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalURI,
    canonicalQuery,
    canonicalHeaders,
    additionalHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  // 6) StringToSign
  const scope = `${date}/${region}/${product}/aliyun_v4_request`
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest)
  const stringToSign = [
    'OSS4-HMAC-SHA256',
    timestamp,
    scope,
    hashedCanonicalRequest
  ].join('\n')

  // 7) 派生 Signing Key
  let k: Uint8Array = utf8('aliyun_v4' + sts.accessKeySecret)
  k = await hmacSha256Raw(k, date)
  k = await hmacSha256Raw(k, region)
  k = await hmacSha256Raw(k, product)
  k = await hmacSha256Raw(k, 'aliyun_v4_request')

  // 8) Signature
  const signature = await hmacSha256Hex(k, stringToSign)

  // 9) Authorization（OSS v4 使用 AdditionalHeaders 而非 SignedHeaders）
  const additionalHeadersValue = additionalHeaders ? `AdditionalHeaders=${additionalHeaders},` : ''
  const authorization =
    `OSS4-HMAC-SHA256 Credential=${sts.accessKeyId}/${scope},` +
    additionalHeadersValue +
    `Signature=${signature}`

  // 10) 组装最终请求头（OSS v4 显式要求发出 x-oss-content-sha256）
  const result: Record<string, string> = { ...rawHeaders }
  result['x-oss-date'] = timestamp
  result['x-oss-content-sha256'] = 'UNSIGNED-PAYLOAD'
  result['Authorization'] = authorization
  if (sts.securityToken) {
    result['x-oss-security-token'] = sts.securityToken
  }
  return result
}

/**
 * 构造 endpoint
 * - 用户填了 endpoint 直接用
 * - 否则按 region 自动拼接（公网）
 */
function buildEndpoint(sts: StsCredentials, secure = true): string {
  const cfg = sts.config
  if (cfg.endpoint) {
    // 允许用户填 http:// 或 https://
    if (/^https?:\/\//.test(cfg.endpoint)) return cfg.endpoint.replace(/\/$/, '')
    return `${secure ? 'https' : 'http'}://${cfg.endpoint.replace(/\/$/, '')}`
  }
  const proto = secure ? 'https' : 'http'
  // region 兼容：去掉可能存在的 oss- 前缀
  const region = (cfg.region || 'cn-hangzhou').replace(/^oss-/, '')
  return `${proto}://${cfg.bucket}.oss-${region}.aliyuncs.com`
}

export class OssClient {
  sts: StsCredentials

  constructor(sts: StsCredentials) {
    this.sts = sts
  }

  private async signedFetch(method: string, objectKey: string, opts: {
    query?: Record<string, string>
    headers?: Record<string, string>
    body?: BodyInit | null
    signal?: AbortSignal
  } = {}): Promise<Response> {
    const key = objectKey.replace(/^\/+/, '')
    const headers = await signOssV4({
      method,
      bucket: this.sts.config.bucket,
      objectKey: key,
      query: opts.query,
      headers: opts.headers || {},
      sts: this.sts
    })
    const qs = opts.query
      ? '?' + Object.keys(opts.query).sort().map(k =>
          `${encodeURIComponent(k)}=${encodeURIComponent(opts.query![k])}`
        ).join('&')
      : ''
    const url = `${buildEndpoint(this.sts)}/${encodeOssPath(key).replace(/%2F/g, '/')}${qs}`
    return fetch(url, {
      method,
      headers,
      body: opts.body ?? null,
      signal: opts.signal,
      mode: 'cors'
    })
  }

  /**
   * 列举对象（V2）
   */
  async listObjects(prefix: string, delimiter: string = '/', continuationToken?: string, maxKeys = 100): Promise<ListResult> {
    const query: Record<string, string> = {
      'list-type': '2',
      'max-keys': String(maxKeys),
      'prefix': prefix,
      'delimiter': delimiter
    }
    if (continuationToken) query['continuation-token'] = continuationToken
    const resp = await this.signedFetch('GET', '', { query })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`列举失败 (${resp.status}): ${text.slice(0, 200)}`)
    }
    const xml = await resp.text()
    return this.parseListResult(xml)
  }

  private parseListResult(xml: string): ListResult {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const objects: OssObject[] = []
    // 简单 parse：直接读 XML 字段
    const contents = doc.getElementsByTagName('Contents')
    for (let i = 0; i < contents.length; i++) {
      const c = contents[i]
      const key = c.getElementsByTagName('Key')[0]?.textContent || ''
      const size = parseInt(c.getElementsByTagName('Size')[0]?.textContent || '0', 10)
      const lm = c.getElementsByTagName('LastModified')[0]?.textContent || ''
      const etag = c.getElementsByTagName('ETag')[0]?.textContent || ''
      objects.push({
        name: key.split('/').filter(Boolean).pop() || key,
        key,
        type: 'file',
        size,
        lastModified: lm,
        etag
      })
    }
    const prefixes: string[] = []
    const cp = doc.getElementsByTagName('CommonPrefixes')
    for (let i = 0; i < cp.length; i++) {
      const p = cp[i].getElementsByTagName('Prefix')[0]?.textContent || ''
      prefixes.push(p)
    }
    const isTruncated = doc.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
    const nextContinuationToken = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent
    return { objects, prefixes, nextContinuationToken, isTruncated }
  }

  /**
   * 上传对象（PUT）
   */
  async putObject(objectKey: string, body: Blob | ArrayBuffer | string, contentType = 'application/octet-stream'): Promise<void> {
    const blob = typeof body === 'string' ? new Blob([body], { type: contentType }) : (body instanceof Blob ? body : new Blob([body], { type: contentType }))
    const resp = await this.signedFetch('PUT', objectKey, {
      headers: { 'Content-Type': contentType },
      body: blob
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`上传失败 (${resp.status}): ${text.slice(0, 200)}`)
    }
  }

  /**
   * 下载对象为文本
   */
  async getObjectText(objectKey: string): Promise<string> {
    const resp = await this.signedFetch('GET', objectKey)
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`下载失败 (${resp.status}): ${text.slice(0, 200)}`)
    }
    return resp.text()
  }

  /**
   * 下载对象为 Blob（用于下载到本地）
   */
  async getObjectBlob(objectKey: string): Promise<Blob> {
    const resp = await this.signedFetch('GET', objectKey)
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`下载失败 (${resp.status}): ${text.slice(0, 200)}`)
    }
    return resp.blob()
  }

  /**
   * 删除对象
   */
  async deleteObject(objectKey: string): Promise<void> {
    const resp = await this.signedFetch('DELETE', objectKey)
    if (!resp.ok && resp.status !== 204) {
      const text = await resp.text()
      throw new Error(`删除失败 (${resp.status}): ${text.slice(0, 200)}`)
    }
  }

  /**
   * HeadObject - 获取元数据
   */
  async headObject(objectKey: string): Promise<{ contentType: string; contentLength: number; etag: string } | null> {
    const resp = await this.signedFetch('HEAD', objectKey)
    if (resp.status === 404) return null
    if (!resp.ok) {
      throw new Error(`Head失败 (${resp.status})`)
    }
    return {
      contentType: resp.headers.get('Content-Type') || '',
      contentLength: parseInt(resp.headers.get('Content-Length') || '0', 10),
      etag: resp.headers.get('ETag') || ''
    }
  }

  /**
   * 获取公共读访问 URL（如果 bucket 公共读）
   */
  publicUrl(objectKey: string): string {
    return `${buildEndpoint(this.sts)}/${objectKey.replace(/^\/+/, '')}`
  }
}

/**
 * 格式化字节大小
 */
export function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * 检测 MIME Type by extension
 */
export function guessContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg'
  }
  return map[ext] || 'application/octet-stream'
}

/**
 * 是否为图片文件（按扩展名判断）
 */
export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return /^(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(ext)
}

/**
 * 判断是否为文本类文件
 */
export function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return /^(html?|css|js|mjs|json|xml|txt|md|svg|yml|yaml|ini|toml|c|cpp|h|hpp|java|py|go|rs|sh|bash|ts|tsx|vue|jsx|scss|sass|less|log|env|conf|cfg|properties)$/.test(ext)
}

/**
 * 检测错误是否为 STS 凭证失效（403 / InvalidAccessKeyId / SignatureDoesNotMatch 等）
 */
export function isStsAuthError(e: any): boolean {
  const msg: string = (e?.message || '') + ' ' + (e?.toString?.() || '')
  return /403|InvalidAccessKeyId|SignatureDoesNotMatch|SecurityToken.*[Ee]xpir|AccessDenied.*token|RequestTimeTooSkewed/i.test(msg)
}

/**
 * STS 临时凭证管理器（单例）
 *
 * 行为：
 * - 每个 configId 缓存一组 STS 凭证
 * - 凭证未到过期时间（且离过期 > refreshMarginMs）时直接复用
 * - 离过期不足 refreshMarginMs 时，下次 getSts 主动重新签发
 * - OSS 请求报错（403 等）时调用 invalidate，下次 getSts 强制重新签发
 * - 并发请求共享同一个 inflight Promise，避免短时间内重复签发
 */
export type StsFetcher = (configId: string) => Promise<StsCredentials>

export class OssStsProvider {
  private cache = new Map<string, { sts: StsCredentials; expiresAt: number }>()
  private inflight = new Map<string, Promise<StsCredentials>>()
  private refreshMarginMs: number

  constructor(
    private fetcher: StsFetcher,
    opts: { refreshMarginMs?: number } = {}
  ) {
    this.refreshMarginMs = opts.refreshMarginMs ?? 5 * 60 * 1000  // 默认提前 5 分钟
  }

  /**
   * 获取（必要时自动刷新）某个配置的 STS 凭证
   */
  async getSts(configId: string): Promise<StsCredentials> {
    const cached = this.cache.get(configId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.sts
    }

    // 防止并发签发
    const existing = this.inflight.get(configId)
    if (existing) return existing

    const promise = this.fetcher(configId)
      .then(sts => {
        const expireMs = new Date(sts.expiration).getTime()
        if (isNaN(expireMs)) {
          // 解析失败当作 1 小时兜底
          this.cache.set(configId, { sts, expiresAt: Date.now() + (60 - 5) * 60 * 1000 })
        } else {
          this.cache.set(configId, { sts, expiresAt: expireMs - this.refreshMarginMs })
        }
        return sts
      })
      .finally(() => {
        this.inflight.delete(configId)
      })

    this.inflight.set(configId, promise)
    return promise
  }

  /**
   * 获取（必要时自动刷新）某个配置的 OssClient
   * 每次返回的是新实例（OssClient 本身无状态，只持 sts 引用）
   */
  async getClient(configId: string): Promise<OssClient> {
    const sts = await this.getSts(configId)
    return new OssClient(sts)
  }

  /**
   * 强制失效某个配置的缓存（遇到 403 等鉴权错误时调用）
   */
  invalidate(configId: string): void {
    this.cache.delete(configId)
  }

  /**
   * 清空所有缓存（切换账号 / 登出时调用）
   */
  clear(): void {
    this.cache.clear()
  }
}

/**
 * 使用 Provider 执行一次 OSS 操作，自动处理凭证过期
 * - 第一次失败如果是认证错误，自动 invalidate + 重试一次
 * - 第二次仍失败则抛错
 */
export async function callWithOss<T>(
  configId: string,
  provider: OssStsProvider,
  fn: (client: OssClient) => Promise<T>
): Promise<T> {
  try {
    const client = await provider.getClient(configId)
    return await fn(client)
  } catch (e) {
    if (isStsAuthError(e)) {
      provider.invalidate(configId)
      const client = await provider.getClient(configId)
      return await fn(client)
    }
    throw e
  }
}