import assert from 'node:assert/strict'
import test from 'node:test'
import MarkdownIt from 'markdown-it'

function isSafeLink(href) {
  if (href.startsWith('/') && !href.startsWith('//')) return true
  if (href.startsWith('#')) return true
  try {
    return ['http:', 'https:'].includes(new URL(href).protocol)
  } catch {
    return false
  }
}

function renderSafe(source) {
  const md = new MarkdownIt({ html: false, linkify: true, validateLink: isSafeLink })
  md.renderer.rules.image = (tokens, index) => md.utils.escapeHtml(tokens[index].content || '')
  md.renderer.rules.link_open = (tokens, index, options, _env, self) => self.renderToken(tokens, index, options)
  md.renderer.rules.link_close = (tokens, index, options, _env, self) => self.renderToken(tokens, index, options)
  const tokens = md.parse(source, {})
  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) continue
    for (let index = 0; index < token.children.length; index += 1) {
      const child = token.children[index]
      if (child.type !== 'link_open') continue
      const href = child.attrGet('href') || ''
      if (!isSafeLink(href)) {
        child.tag = 'span'
        child.attrs = null
        for (let closeIndex = index + 1; closeIndex < token.children.length; closeIndex += 1) {
          if (token.children[closeIndex].type === 'link_close') {
            token.children[closeIndex].tag = 'span'
            break
          }
        }
      } else {
        child.attrSet('target', '_blank')
        child.attrSet('rel', 'noopener noreferrer nofollow')
      }
    }
  }
  return md.renderer.render(tokens, md.options, {})
}

test('note markdown never emits raw HTML, executable links, or remote media', () => {
  const html = renderSafe([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>x</svg>',
    '<iframe src="https://evil.example"></iframe>',
    '[bad](javascript:alert(1))',
    '[protocol-relative](//evil.example/track)',
    '![remote](https://evil.example/pixel.png)',
    '[safe](https://example.com)',
  ].join('\n\n'))

  assert.doesNotMatch(html, /<script\b|<img\b|<svg\b|<iframe\b/i)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/i)
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/i)
  assert.doesNotMatch(html, /href="javascript:|href="\/\/evil\.example|src="https:/i)
  assert.match(html, /\[bad\]/)
  assert.match(html, /remote/)
  assert.match(html, /href="https:\/\/example\.com"/)
  assert.match(html, /rel="noopener noreferrer nofollow"/)
})
