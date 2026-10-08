// 博客 Markdown 渲染实例（详情页正文 + 编辑器实时预览共用）
// 安全策略：html:false —— 投稿正文里的原生 HTML 标签一律转义展示，
// 只保留 Markdown 语法本身，杜绝投稿注入脚本/恶意标签。
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

// 外链统一新窗口打开 + nofollow（引流与安全双保险）
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// 图片懒加载
const defaultImage =
  md.renderer.rules.image ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy')
  return defaultImage(tokens, idx, options, env, self)
}

/** 渲染 Markdown 为 HTML（不可信输入安全） */
export function renderMarkdown(source: string): string {
  if (!source) return ''
  return md.render(source)
}

/** 渲染 Markdown 为 HTML，并给 h2/h3 注入锚点 id，同时提取目录（文档页左侧目录用） */
export function renderMarkdownWithToc(
  source: string,
): { html: string; toc: { id: string; text: string; level: number }[] } {
  if (!source) return { html: '', toc: [] }
  const tokens = md.parse(source, {})
  const toc: { id: string; text: string; level: number }[] = []
  let pending: { id: string; text: string; level: number } | null = null
  let n = 0
  for (const token of tokens) {
    if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
      pending = { id: `doc-h-${++n}`, text: '', level: token.tag === 'h2' ? 2 : 3 }
      token.attrSet('id', pending.id)
    } else if (pending && token.type === 'inline' && !pending.text) {
      pending.text = token.content.trim()
      toc.push(pending)
      pending = null
    }
  }
  return { html: md.renderer.render(tokens, md.options, {}), toc }
}

/** 剥掉 Markdown 语法取纯文本（列表卡片摘要兜底用） */
export function stripMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' [图片] ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[*\-+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/---+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
