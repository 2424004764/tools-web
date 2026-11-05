<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { sanitizeCustomHtml } from '@/utils/sanitizeHtml'
import { renderSafeNoteMarkdown } from '@/utils/notesMarkdown'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import 'highlight.js/styles/github.css'

interface SharedNote {
  title: string
  content: string
  createTime: string
  updateTime: string
}

const route = useRoute()
const note = ref<SharedNote | null>(null)
const loading = ref(true)
const unavailable = ref(false)

const renderedContent = (content: string) => sanitizeCustomHtml(renderSafeNoteMarkdown(content))
const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN')
}

onMounted(async () => {
  let referrerMeta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]')
  if (!referrerMeta) {
    referrerMeta = document.createElement('meta')
    referrerMeta.name = 'referrer'
    document.head.appendChild(referrerMeta)
  }
  referrerMeta.content = 'no-referrer'

  const token = typeof route.params.token === 'string' ? route.params.token : ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    unavailable.value = true
    loading.value = false
    referrerMeta.content = 'no-referrer'
    return
  }
  try {
    const response = await axios.get(`/api/notes-share/${token}`, {
      baseURL: import.meta.env.VITE_SITE_URL,
      timeout: 30000,
      withCredentials: false,
    })
    const value = response.data?.data ?? response.data
    if (!value || typeof value.title !== 'string' || typeof value.content !== 'string') throw new Error('invalid share')
    note.value = value
    document.title = `${value.title} | 备忘录分享`
  } catch {
    unavailable.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="share-page">
    <DetailHeader title="备忘录分享" />
    <main class="share-main" aria-live="polite">
      <div v-if="loading" class="share-state">正在加载…</div>
      <section v-else-if="unavailable || !note" class="share-state">
        <h1>分享内容不可用</h1>
        <p>链接可能已失效，或内容已被所有者删除。</p>
      </section>
      <article v-else class="share-note">
        <header class="share-heading">
          <h1>{{ note.title }}</h1>
          <p v-if="note.updateTime">更新于 {{ formatDate(note.updateTime) }}</p>
        </header>
        <div class="markdown-body" v-html="renderedContent(note.content)"></div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.share-page { min-height: 100vh; padding: 12px 20px 48px; background: #f3f6fb; }
.share-main { width: min(900px, 100%); margin: 28px auto; }
.share-note, .share-state { padding: 32px; background: #fff; border: 1px solid #e5eaf2; border-radius: 12px; box-shadow: 0 8px 28px rgba(24, 39, 75, .06); }
.share-heading { padding-bottom: 20px; margin-bottom: 24px; border-bottom: 1px solid #edf0f5; }
.share-heading h1 { margin: 0; color: #1f2937; font-size: 28px; line-height: 1.35; overflow-wrap: anywhere; }
.share-heading p { margin: 12px 0 0; color: #8792a5; font-size: 13px; }
.share-state { text-align: center; color: #748096; }
.share-state h1 { margin: 0 0 8px; color: #273449; font-size: 20px; }
.share-state p { margin: 0; }
.markdown-body { color: #344054; line-height: 1.8; overflow-wrap: anywhere; }
.markdown-body :deep(img), .markdown-body :deep(iframe), .markdown-body :deep(svg), .markdown-body :deep(video), .markdown-body :deep(audio) { display: none; }
.markdown-body :deep(a) { color: #4361ee; text-decoration: underline; }
.markdown-body :deep(pre) { overflow-x: auto; padding: 16px; background: #f5f7fa; border-radius: 8px; }
.markdown-body :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
.markdown-body :deep(th), .markdown-body :deep(td) { padding: 8px 12px; border: 1px solid #e5eaf2; }
@media (max-width: 640px) { .share-page { padding: 8px 12px 32px; } .share-note, .share-state { padding: 20px; } .share-heading h1 { font-size: 23px; } }
</style>
