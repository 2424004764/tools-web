import { buildR2PublicUrl, signR2PutUrl } from './r2.js'

const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const DEFAULT_CONTENT_TYPE = 'image/png'

function contentTypeToExtension(contentType) {
  const value = String(contentType || '').toLowerCase().split(';')[0].trim()
  if (value === 'image/jpeg' || value === 'image/jpg') return 'jpg'
  if (value === 'image/webp') return 'webp'
  if (value === 'image/gif') return 'gif'
  if (value === 'image/avif') return 'avif'
  return 'png'
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?((?:;[^,]+)*),(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('无效的图片 data URL')

  const contentType = match[1] || DEFAULT_CONTENT_TYPE
  const metadata = match[2] || ''
  const payload = match[3] || ''
  if (!/;base64/i.test(metadata)) throw new Error('仅支持 base64 图片 data URL')

  let binary
  try {
    binary = atob(payload)
  } catch {
    throw new Error('图片 base64 数据无效')
  }

  if (binary.length > MAX_IMAGE_BYTES) throw new Error('生成图片超过 50MB 限制')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { body: bytes, contentType }
}

async function loadImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl) {
    throw new Error('生成结果图片地址为空')
  }

  if (imageUrl.startsWith('data:')) return parseDataUrl(imageUrl)

  let parsed
  try {
    parsed = new URL(imageUrl)
  } catch {
    throw new Error('生成结果图片地址无效')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('生成结果图片地址协议不受支持')
  }

  const response = await fetch(parsed.toString())
  if (!response.ok) throw new Error(`拉取生成图片失败：HTTP ${response.status}`)

  const contentType = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error(`生成结果不是图片：${contentType || '未知类型'}`)
  }

  const contentLength = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error('生成图片超过 50MB 限制')
  }

  const body = new Uint8Array(await response.arrayBuffer())
  if (body.byteLength > MAX_IMAGE_BYTES) throw new Error('生成图片超过 50MB 限制')
  return { body, contentType }
}

/**
 * 将生成结果持久化到 R2，并返回可公开访问的 URL。
 * 生成记录只保存这个 URL，避免依赖上游临时图床地址。
 */
export async function persistGeneratedImage(env, { uid, recordId, imageUrl }) {
  if (!recordId) throw new Error('R2 持久化需要生成记录身份')
  if (!env?.R2_PUBLIC_HOST) throw new Error('R2_PUBLIC_HOST 未配置，无法生成图片公网地址')

  const bucket = env.R2_BUCKET_NAME
  const { body, contentType } = await loadImage(imageUrl)
  const extension = contentTypeToExtension(contentType)
  const ownerKey = uid || 'anonymous'
  const r2Key = `generated-images/${ownerKey}/${recordId}.${extension}`
  const { uploadUrl } = await signR2PutUrl(env, bucket, r2Key, contentType)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => '')
    throw new Error(`上传生成图片到 R2 失败：HTTP ${uploadResponse.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`)
  }

  const publicUrl = buildR2PublicUrl(env, r2Key)
  if (!publicUrl) throw new Error('R2 公网地址构造失败')
  return { publicUrl, r2Key, contentType, size: body.byteLength }
}
