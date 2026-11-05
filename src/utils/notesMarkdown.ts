import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'

function isSafeNoteLink(href: string) {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  if (href.startsWith('#')) return true
  try {
    return ['http:', 'https:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content || '')
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => self.renderToken(tokens, index, options)
markdown.renderer.rules.link_close = (tokens, index, options, _env, self) => self.renderToken(tokens, index, options)

function secureInlineTokens(tokens: Token[]) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type !== 'link_open') continue
    const href = token.attrGet('href') || ''
    if (!isSafeNoteLink(href)) {
      token.tag = 'span'
      token.attrs = null
      for (let closeIndex = index + 1; closeIndex < tokens.length; closeIndex += 1) {
        if (tokens[closeIndex].type === 'link_close') {
          tokens[closeIndex].tag = 'span'
          break
        }
      }
    } else {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer nofollow')
    }
  }
}

export function renderSafeNoteMarkdown(source: string) {
  const tokens = markdown.parse(source || '', {})
  for (const token of tokens) {
    if (token.type === 'inline' && token.children) secureInlineTokens(token.children)
  }
  return markdown.renderer.render(tokens, markdown.options, {})
}
