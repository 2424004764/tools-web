<script setup lang="ts">
// OAuth2 子站接入文档（公开页，供接入方在线查阅）
// 内容单一来源：docs/oauth-provider.md，构建时以 ?raw 内联，避免两份文案不同步
import { computed } from 'vue'
import { renderMarkdown } from '@/components/Blog/blog-markdown'
import docSource from '../../../docs/oauth-provider.md?raw'

const html = computed(() => renderMarkdown(docSource))
</script>

<template>
  <div class="max-w-[860px] mx-auto px-4 py-8">
    <div class="bg-surface-0 border border-border-subtle rounded-2xl px-6 md:px-10 py-8 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.08)]">
      <div class="doc-markdown" v-html="html"></div>
    </div>
  </div>
</template>

<style scoped>
.doc-markdown {
  color: rgb(var(--ink-700));
  font-size: 14.5px;
  line-height: 1.75;
  word-break: break-word;
}
.doc-markdown :deep(h1),
.doc-markdown :deep(h2),
.doc-markdown :deep(h3),
.doc-markdown :deep(h4) {
  color: rgb(var(--ink-900));
  font-weight: 600;
  margin: 1.4em 0 0.6em;
  line-height: 1.35;
}
.doc-markdown :deep(h1) {
  font-size: 1.5em;
  margin-top: 0;
  padding-bottom: 0.4em;
  border-bottom: 1px solid rgb(var(--border-subtle));
}
.doc-markdown :deep(h2) {
  font-size: 1.25em;
}
.doc-markdown :deep(h3) {
  font-size: 1.1em;
}
.doc-markdown :deep(h4) {
  font-size: 1em;
}
.doc-markdown :deep(p) {
  margin: 0.85em 0;
}
.doc-markdown :deep(a) {
  color: rgb(var(--accent-600));
  text-decoration: none;
}
.doc-markdown :deep(a:hover) {
  text-decoration: underline;
}
.doc-markdown :deep(ul),
.doc-markdown :deep(ol) {
  padding-left: 1.5em;
  margin: 0.85em 0;
}
.doc-markdown :deep(ul) {
  list-style: disc;
}
.doc-markdown :deep(ol) {
  list-style: decimal;
}
.doc-markdown :deep(li) {
  margin: 0.3em 0;
}
.doc-markdown :deep(li > ul),
.doc-markdown :deep(li > ol) {
  margin: 0.3em 0;
}
.doc-markdown :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid rgb(var(--accent-400));
  background: rgb(var(--surface-1));
  border-radius: 0 8px 8px 0;
  color: rgb(var(--ink-600));
}
.doc-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875em;
  background: rgb(var(--surface-2));
  padding: 0.15em 0.4em;
  border-radius: 5px;
  color: rgb(var(--accent-700));
}
html.dark .doc-markdown :deep(code) {
  color: rgb(var(--accent-300));
}
.doc-markdown :deep(pre) {
  margin: 1em 0;
  padding: 14px 16px;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--border-subtle));
  border-radius: 10px;
  overflow-x: auto;
  line-height: 1.6;
}
.doc-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: rgb(var(--ink-800));
  font-size: 13px;
}
html.dark .doc-markdown :deep(pre code) {
  color: rgb(var(--ink-300));
}
.doc-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 13.5px;
  display: block;
  overflow-x: auto;
}
.doc-markdown :deep(th),
.doc-markdown :deep(td) {
  border: 1px solid rgb(var(--border-subtle));
  padding: 7px 12px;
  text-align: left;
}
.doc-markdown :deep(th) {
  background: rgb(var(--surface-1));
  font-weight: 600;
  color: rgb(var(--ink-800));
  white-space: nowrap;
}
.doc-markdown :deep(hr) {
  border: none;
  border-top: 1px solid rgb(var(--border-subtle));
  margin: 1.6em 0;
}
.doc-markdown :deep(img) {
  max-width: 100%;
}
</style>
