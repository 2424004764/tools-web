import assert from 'node:assert/strict'
import test from 'node:test'

import MarkdownIt from 'markdown-it'
import { isSafeMarkdownUrl } from '../src/components/Blog/blog-markdown.ts'

const md = new MarkdownIt({ html: false, linkify: true, validateLink: isSafeMarkdownUrl })

test('blog Markdown URL policy only accepts safe HTTP(S), local, and anchor URLs', () => {
  for (const url of [
    'https://example.com/path',
    'http://example.com/path',
    '/blog/example',
    'images/cover.png',
    '#section',
  ]) {
    assert.equal(isSafeMarkdownUrl(url), true, url)
  }

  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example/track',
    'https:\\evil.example',
  ]) {
    assert.equal(isSafeMarkdownUrl(url), false, url)
  }
})

test('blog Markdown escapes raw HTML and drops dangerous link and image destinations', () => {
  const source = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>x</svg>',
    '[script](javascript:alert(1))',
    '[mixed](JaVaScRiPt:alert(1))',
    '[html](data:text/html,evil)',
    '![svg](data:image/svg+xml,evil)',
    '[safe](https://example.com/path)',
  ].join('\n\n')
  const html = md.render(source)

  assert.doesNotMatch(html, /<script\b|<img\b|<svg\b/i)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/i)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/i)
  assert.doesNotMatch(html, /href="(?:javascript|data):/i)
  assert.doesNotMatch(html, /src="data:/i)
  assert.match(html, /href="https:\/\/example\.com\/path"/i)
})
