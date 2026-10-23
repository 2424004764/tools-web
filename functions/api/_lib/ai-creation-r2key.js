// ai-creations 删除路径共用的 R2 key 解析与命名空间守卫
//
// 安全约束（渗透测试 HIGH 发现的 IDOR 修复）：
//   1. 对象身份只信任 confirm 时落库的 r2_key 列；列缺失（老数据）才从
//      media_url 反推（inferR2Key），反推结果同样要过命名空间校验。
//   2. 只有 key 位于 ai-creations/{uid}/ 下才允许删除对象 / 退还存储额度；
//      generated-images/{uid}/ 是生成持久化对象（只解除画廊引用）；
//      其余（他人命名空间 / 异常数据）一律 foreign：不删对象、不退额度，
//      记 warn 日志留审计痕迹。

const MAX_KEY_LENGTH = 512
// 服务端生成的 key 只含 [A-Za-z0-9/._-]；出现其他字符说明是异常/毒化数据
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/

// 从 media_url 推断 r2_key（confirm 服务端计算 URL 之前的历史数据回退路径）：
//   - R2 公网 URL（host 等于 R2_PUBLIC_HOST）→ 取 pathname
//   - 裸 key 字符串（本地开发 / R2_PUBLIC_HOST 未配置时期的数据）→ 去掉前导斜杠
export function inferR2Key(env, mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null
  const host = env.R2_PUBLIC_HOST
  if (!/^https?:\/\//i.test(mediaUrl)) {
    return mediaUrl.replace(/^\/+/, '')
  }
  if (!host) return null
  try {
    const u = new URL(mediaUrl)
    if (u.host !== host) return null
    let p = u.pathname.replace(/^\/+/, '')
    try {
      p = decodeURIComponent(p)
    } catch {
      /* ignore */
    }
    return p
  } catch {
    return null
  }
}

/**
 * 解析一行 ai_creation_images 的对象 key，并判定可执行的操作类别。
 *
 * @param {object} env
 * @param {{r2_key?: string|null, media_url?: string|null}} row DB 行
 * @param {string} uid   当前登录用户（同时是删除请求发起者）
 * @returns {{key: string, kind: 'owned'|'generated'|'foreign'} | null}
 *   owned     → ai-creations/{uid}/…   可删对象、可退额度
 *   generated → generated-images/{uid}/… 只删 DB 行，不动对象
 *   foreign   → 命名空间之外的 key     只删 DB 行，不动对象，调用方记日志
 *   null      → 无法解析出 key         只删 DB 行
 */
export function resolveAiCreationKey(env, row, uid) {
  const raw = (row?.r2_key && String(row.r2_key).trim())
    || inferR2Key(env, row?.media_url)
  if (!raw) return null
  if (raw.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(raw)) {
    return { key: raw, kind: 'foreign' }
  }
  if (raw.startsWith(`generated-images/${uid}/`)) {
    return { key: raw, kind: 'generated' }
  }
  if (raw.startsWith(`ai-creations/${uid}/`)) {
    return { key: raw, kind: 'owned' }
  }
  return { key: raw, kind: 'foreign' }
}
