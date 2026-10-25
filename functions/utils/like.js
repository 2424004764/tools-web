// SQLite LIKE 搜索值的通配符处理。
//
// 用户输入直接拼进 `%${kw}%` 时，输入里的 % / _ 会被当作 LIKE 通配符
// （如单个 % 匹配全部行），既是搜索语义 bug 也放大了全表扫描面。
// 这里把用户输入中的 % 和 _ 替换为空格，使其只做字面量匹配；
// 采用"剥离"而非 ESCAPE 转义，无需改动各处 SQL 片段，与
// admin/blog/posts.js 的既有做法一致。
//
// 前后缀的 % 由本模块自己控制，用户输入不参与通配符语义。

export function stripLikeWildcards(value) {
  return String(value ?? '').replace(/[%_]/g, ' ')
}

/** 模糊包含：%字面量化后的输入% */
export function likeContains(value) {
  return `%${stripLikeWildcards(value)}%`
}

/** 前缀匹配：字面量化后的输入% */
export function likePrefix(value) {
  return `${stripLikeWildcards(value)}%`
}
