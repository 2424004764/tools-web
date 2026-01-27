<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import axios from 'axios'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || '')
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL)
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL)

const info = reactive({
  title: 'AI起变量名',
  desc: '根据描述自动生成符合命名规范的变量名，支持多种命名风格与语言'
})

const description = ref('')
const style = ref<'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case'>('camelCase')
const lang = ref<'en' | 'pinyin'>('en')
const count = ref(2)
const isLoading = ref(false)
const results = ref<string[]>([])

const canGenerate = computed(() => !!description.value.trim() && !isLoading.value)

const examples: string[] = [
  '为订单金额生成有语义的变量名',
  '用户登录状态布尔值变量',
  '商品库存数量',
  '文件上传进度百分比',
  '用户上次登录时间',
  '购物车商品列表',
  '是否开启暗色主题开关',
  '最大重试次数',
]

const fillExample = () => {
  if (!examples.length) return
  const i = Math.floor(Math.random() * examples.length)
  description.value = examples[i]
}

const buildPrompt = () => {
  const langText = lang.value === 'en' ? '使用英文' : '使用拼音'
  return [
    `请根据以下需求，生成 ${count.value} 个合适的变量名：`,
    `- 命名风格：${style.value}`,
    `- 语言：${langText}`,
    `- 规则：语义准确、简洁、无空格和非法字符；仅输出变量名列表，每行一个，不要额外说明。`,
    `需求：${description.value.trim()}`
  ].join('\n')
}

const generate = async () => {
  if (!canGenerate.value) return
  isLoading.value = true
  results.value = []
  try {
    const prompt = buildPrompt()

    // 构建 OpenAI 格式请求
    const requestBody = {
      model: 'nova-fast',
      messages: [
        { role: 'user', content: prompt }
      ]
    }

    const resp = await axios.post(
      pollinationsProxyUrl.value,
      requestBody,
      {
        params: {
          target: `${pollinationsTextUrl.value}/v1/chat/completions`
        },
        headers: {
          'Authorization': `Bearer ${pollinationsApiKey.value}`,
          'Content-Type': 'application/json'
        }
      }
    )

    // 解析 OpenAI 格式响应
    const content = resp.data?.choices?.[0]?.message?.content || ''
    const lines = content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(s => s.trim().replace(/^\d+\.\s*/,'').replace(/^-+\s*/,''))
      .filter(s => s.length > 0)
    results.value = (Array.from(new Set(lines)) as string[]).slice(0, count.value)
  } catch (e) {
    console.error('生成失败:', e)
    alert('生成失败，请稍后重试')
  } finally {
    isLoading.value = false
  }
}

const copyOne = (s: string) => copy(s)
const copyAll = () => results.value.length && copy(results.value.join('\n'))

// 添加按下效果的方法
const handleButtonPress = (event: Event) => {
  const button = event.target as HTMLElement
  button.classList.add('button-pressed')
  setTimeout(() => {
    button.classList.remove('button-pressed')
  }, 150)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />
    <div class="p-4 rounded-2xl bg-white">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm text-gray-700">需求描述</label>
              <button class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded" @click="fillExample">示例</button>
            </div>
            <textarea
              v-model="description"
              class="w-full p-3 border rounded-lg min-h-[120px]"
              placeholder="例如：为订单金额生成有语义的变量名"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-700 mb-2">命名风格</label>
              <select v-model="style" class="w-full p-2 border rounded-lg">
                <option value="camelCase">camelCase</option>
                <option value="PascalCase">PascalCase</option>
                <option value="snake_case">snake_case</option>
                <option value="kebab-case">kebab-case</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-2">语言</label>
              <select v-model="lang" class="w-full p-2 border rounded-lg">
                <option value="en">英文</option>
                <option value="pinyin">拼音</option>
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-700 mb-2">数量</label>
              <input v-model.number="count" type="number" min="1" max="50" class="w-full p-2 border rounded-lg" />
            </div>
          </div>

          <button
            @click="generate"
            :disabled="!canGenerate"
            :class="[
              'py-3 px-6 rounded-lg w-full transition',
              !canGenerate ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
          >
            {{ isLoading ? '生成中...' : '生成变量名' }}
          </button>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">生成结果</div>
            <button
              class="px-3 py-1 text-sm bg-emerald-500 text-white rounded transition-all duration-150 hover:bg-emerald-600"
              :disabled="!results.length"
              @click="copyAll"
              @mousedown="handleButtonPress"
              @touchstart="handleButtonPress"
            >
              复制全部
            </button>
          </div>

          <div class="min-h-[220px] border rounded-lg p-3 bg-gray-50">
            <div v-if="isLoading" class="text-gray-500">生成中...</div>
            <ul v-else class="space-y-2">
              <li v-for="(r, i) in results" :key="i" class="flex items-center justify-between bg-white p-2 rounded border">
                <span class="truncate mr-3">{{ r }}</span>
                <button 
                  class="px-2 py-1 text-xs bg-blue-500 text-white rounded transition-all duration-150 hover:bg-blue-600" 
                  @click="copyOne(r)"
                  @mousedown="handleButtonPress"
                  @touchstart="handleButtonPress"
                >
                  复制
                </button>
              </li>
              <div v-if="!results.length" class="text-gray-400 text-sm">暂无结果</div>
            </ul>
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
.button-pressed {
  transform: scale(0.95) !important;
  filter: brightness(0.9) !important;
}
</style>
