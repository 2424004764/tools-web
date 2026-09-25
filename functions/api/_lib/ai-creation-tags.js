// ai_creation_groups.tags 的读写约定（与前端 src/api/ai-creations.ts 的 parseTagInput 保持一致）：
//   - 存储格式：逗号分隔文本，如 '风景,头像'；空串 = 未打标签（默认）
//   - 输入可以是数组或字符串，统一拆分 / 修剪 / 去重后序列化
//   - 精确筛选走 (',' || tags || ',') LIKE '%,tag,%'（LIKE 通配符需转义）

export const MAX_TAGS = 10
export const MAX_TAG_LEN = 24

/** 把任意输入（数组 / 逗号分隔字符串）归一化成去重后的标签数组 */
export function normalizeTagInput(input) {
  if (input == null) return []
  const raw = Array.isArray(input) ? input : String(input).split(/[,，]/)
  const out = []
  const seen = new Set()
  for (let item of raw) {
    let tag = String(item ?? '').trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, MAX_TAG_LEN)
    if (!tag) continue
    if (seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

/** 归一化后序列化成入库文本（空数组 → ''） */
export function serializeTagInput(input) {
  return normalizeTagInput(input).join(',')
}

/** SQLite LIKE 转义（配合 ESCAPE '\'），用于标签精确匹配 */
export function escapeLike(text) {
  return String(text).replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** 精确匹配某个标签的 LIKE 模式 + 转义后的值；配合 (',' || tags || ',') LIKE ? ESCAPE '\' 使用 */
export function exactTagLike(tag) {
  return `%,${escapeLike(String(tag).trim())},%`
}
