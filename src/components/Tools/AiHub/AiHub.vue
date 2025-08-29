<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: 'AI工具导航',
})

type LinkItem = { title: string; url: string; desc?: string; logo?: string; rating?: number }
type Cate = { title: string; list: LinkItem[] }

const cates: Cate[] = [
  {
    title: '音色克隆 / TTS',
    list: [
      { title: 'voicv', url: 'https://voicv.com/', rating: 3, desc: '支持音色克隆，每天签到可领积分，支持API调用' },
      { title: 'ElevenLabs', url: 'https://elevenlabs.io/', rating: 4.5, desc: '高质量文本转语音（TTS）与声音克隆，支持多语种与情感，赠送1w积分，1个字1积分。英文音色偏多' },
    ],
  },
  {
    title: '对话 / 智能体',
    list: [
      { title: 'Google aistudio', url: 'https://aistudio.google.com/', rating: 4.0, desc: '谷歌Ai实验室' },
      { title: 'OpenAI', url: 'https://chatgpt.com/', rating: 4.5, desc: 'ChatGPT 对话助手，支持多轮问答、写作、编程与多模态' },
      { title: 'Perplexity', url: 'https://www.perplexity.ai/', rating: 4.5, desc: '检索增强问答（RAG）搜索助手，引用来源清晰、追问便捷' },
      { title: 'Poe', url: 'https://poe.com/', rating: 4.0, desc: '聚合多模型的对话平台，支持自建 Bot 与模型切换' },
      { title: 'Google Gemini', url: 'https://gemini.google.com/', rating: 4.0, desc: '谷歌多模态大模型应用入口，支持图文理解与创作' },
    ],
  },
  {
    title: 'AI 创作平台',
    list: [
      { title: 'Media.io', url: 'https://www.media.io/', rating: 4.5, desc: '全能AI创作平台，支持视频、图片、音频的AI生成与编辑，包含Veo3视频生成、AI图像增强、音视频处理等强大功能' },
      { title: 'v0', url: 'https://v0.app/', rating: 4.0, desc: 'Vercel推出的AI界面生成工具，通过自然语言描述快速生成React组件和现代化UI界面' },
      { title: 'CodeBuddy', url: 'https://copilot.tencent.com/', rating: 4.5, desc: '腾讯推出的全栈AI编程助手，支持自然语言需求规划、设计到代码转换、全栈代码生成与优化等功能' },
      { title: 'Trae.cn', url: 'https://trae.cn/', rating: 4.0, desc: '字节推出的AI代码编辑器，提供智能代码补全、代码评审、单元测试生成等功能，助力开发者高效编程' },
    ],
  },
  {
    title: '翻译 / 文档',
    list: [
      { title: 'DeepL', url: 'https://www.deepl.com/', rating: 4.5, desc: '广受好评的高质量机器翻译，擅长细腻语义与术语处理' },
    ],
  },
]
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="space-y-6">
        <ToolDetail v-for="cate in cates" :key="cate.title" :title="cate.title">
          <div class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <a
              v-for="item in cate.list"
              :key="item.title"
              class="group border rounded-xl p-3 sm:p-4 hover:shadow-md transition bg-white flex flex-col items-start gap-3 overflow-hidden"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="w-full">
                <div class="flex items-center gap-2">
                  <div class="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
                    {{ item.title[0] }}
                  </div>
                  <div class="flex-1 min-w-0 font-medium text-gray-900 group-hover:text-blue-600 truncate">
                    {{ item.title }}
                  </div>
                  <!-- H5 数字评分；仅移动端展示 -->
                  <span class="text-xs text-gray-600 sm:hidden flex-shrink-0">{{ ((item.rating ?? 0)).toFixed(1) }}/5</span>
                  <span class="text-gray-400 group-hover:text-blue-500 flex-shrink-0">→</span>
                </div>
                <!-- 平板及以上：星星评分单独一行显示 -->
                <div class="mt-1 hidden sm:block">
                  <el-rate
                    :model-value="item.rating ?? 0"
                    disabled
                    allow-half
                    :max="5"
                    size="small"
                  />
                </div>
                <div class="text-gray-500 text-sm whitespace-pre-line break-words mt-2" v-if="item.desc">
                  {{ item.desc }}
                </div>
              </div>
            </a>
          </div>
        </ToolDetail>
      </div>
    </div>

    <ToolDetail title="说明">
      <el-text>收录常用第三方AI工具，点击卡片将在新窗口打开；</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>