<script setup lang="ts">
import { ref, reactive } from 'vue'
import axios from 'axios'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: 'AI翻译',
  desc: '由AI大模型驱动，支持多语言互译，源语言可自动检测。'
})

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || '')
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL)
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL)

const langNameMap: Record<string, string> = {
  zh: 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean',
  fr: 'French', de: 'German', es: 'Spanish', pt: 'Portuguese',
  it: 'Italian', ru: 'Russian', ar: 'Arabic', vi: 'Vietnamese',
  tr: 'Turkish', id: 'Indonesian', nl: 'Dutch', pl: 'Polish'
}
const langName = (code: string) => langNameMap[code] || code

const buildPrompt = () => {
  const src = sourceLang.value
  const tgt = targetLang.value
  const srcText = sourceText.value.trim()
  const lines: string[] = [
    'You are a professional translator.',
    src === 'auto'
      ? 'Auto-detect the source language.'
      : `The source language is ${langName(src)}.`,
    `Translate the following text into ${langName(tgt)}.`,
    'Rules: preserve meaning, tone & formatting (line breaks, markdown, code blocks, URLs);',
    'keep numbers/units; do not add explanations, examples, or notes.',
    'Only output the translated text and nothing else.',
    '---TEXT START---',
    srcText,
    '---TEXT END---'
  ]
  return lines.join('\n')
}

const sourceText = ref('')
const resultText = ref('')
const loading = ref(false)

type Lang = { label: string; value: string }
const langs: Lang[] = [
  { label: '自动检测', value: 'auto' },
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
  { label: '日文', value: 'ja' },
  { label: '韩文', value: 'ko' },
  { label: '法文', value: 'fr' },
  { label: '德文', value: 'de' },
  { label: '西班牙文', value: 'es' },
  { label: '葡萄牙文', value: 'pt' },
  { label: '意大利文', value: 'it' },
  { label: '俄文', value: 'ru' },
  { label: '阿拉伯文', value: 'ar' },
  { label: '越南文', value: 'vi' },
  { label: '土耳其文', value: 'tr' },
  { label: '印尼文', value: 'id' },
  { label: '荷兰文', value: 'nl' },
  { label: '波兰文', value: 'pl' },
]

const sourceLang = ref<Lang['value']>('auto')
const targetLang = ref<Lang['value']>('zh')

const swap = () => {
  if (sourceLang.value === 'auto') return
  const s = sourceLang.value
  sourceLang.value = targetLang.value
  targetLang.value = s
  const t = sourceText.value
  sourceText.value = resultText.value
  resultText.value = t
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('已复制')
  } catch {
    alert('复制失败，请手动复制')
  }
}

const translate = async () => {
  if (!sourceText.value.trim()) return
  if (targetLang.value === 'auto') {
    alert('目标语言不能为自动检测')
    return
  }
  loading.value = true
  resultText.value = ''
  try {
    const zws = '\u200b'.repeat(1 + Math.floor(Math.random() * 3))
    const prompt = buildPrompt() + zws
    const resp = await axios.get(
      `${pollinationsProxyUrl.value}?path=${encodeURIComponent(prompt)}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()}`,
      { headers: { Authorization: 'Bearer ' + pollinationsApiKey.value } }
    )
    const text: string = typeof resp.data === 'string' ? resp.data : String(resp.data)
    resultText.value = text
  } catch (e) {
    console.error(e)
    alert('翻译失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-3">
          <div class="grid grid-cols-1 gap-2">
            <select v-model="sourceLang" class="w-full p-2 border rounded">
              <option v-for="l in langs" :key="l.value" :value="l.value">{{ l.label }}</option>
            </select>
          </div>
          <textarea
            v-model="sourceText"
            placeholder="输入要翻译的文本..."
            class="w-full p-3 border rounded min-h-[180px]"
          ></textarea>
          <div class="flex gap-2">
            <button @click="translate" :disabled="loading" class="px-4 py-2 rounded text-white"
              :class="loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'">
              {{ loading ? '翻译中...' : '开始翻译' }}
            </button>
            <button @click="swap" class="px-4 py-2 rounded border hover:bg-gray-50">交换语言与文本</button>
            <button @click="copy(sourceText)" class="px-4 py-2 rounded border hover:bg-gray-50">复制原文</button>
          </div>
        </div>
        <div class="space-y-3">
          <select v-model="targetLang" class="w-full p-2 border rounded">
            <option v-for="l in langs.filter(x=>x.value!=='auto')" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>
          <textarea
            v-model="resultText"
            readonly
            class="w-full p-3 border rounded min-h-[180px] bg-gray-50"
            placeholder="翻译结果将显示在这里"
          ></textarea>
          <div class="flex gap-2">
            <button @click="copy(resultText)" class="px-4 py-2 rounded border hover:bg-gray-50">复制译文</button>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>{{ info.desc }}</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>
