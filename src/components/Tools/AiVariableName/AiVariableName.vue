<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { chat } from '@/components/Tools/AiTextToVideo/api'

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

    // 构建 Agnes 对话请求
    const content = await chat('agnes/agnes-2.5-flash', [
      { role: 'user', content: prompt }
    ])

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
    <div class="p-4 rounded-2xl bg-white dark:bg-surface-0 border border-transparent dark:border-border-default shadow-sm">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-body-sm text-ink-700">需求描述</label>
              <button
                type="button"
                class="px-2 py-1 text-caption rounded-lg bg-surface-2 text-ink-700 hover:bg-accent-50 hover:text-accent-600 dark:bg-surface-2 dark:hover:bg-surface-3"
                @click="fillExample"
              >
                示例
              </button>
            </div>
            <textarea
              v-model="description"
              class="w-full p-3 min-h-[120px] rounded-lg border border-border-default bg-surface-1 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              placeholder="例如：为订单金额生成有语义的变量名"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-body-sm text-ink-700 mb-2">命名风格</label>
              <select
                v-model="style"
                class="w-full p-2 rounded-lg border border-border-default bg-surface-1 text-ink-900 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              >
                <option value="camelCase">camelCase</option>
                <option value="PascalCase">PascalCase</option>
                <option value="snake_case">snake_case</option>
                <option value="kebab-case">kebab-case</option>
              </select>
            </div>
            <div>
              <label class="block text-body-sm text-ink-700 mb-2">语言</label>
              <select
                v-model="lang"
                class="w-full p-2 rounded-lg border border-border-default bg-surface-1 text-ink-900 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              >
                <option value="en">英文</option>
                <option value="pinyin">拼音</option>
              </select>
            </div>
            <div>
              <label class="block text-body-sm text-ink-700 mb-2">数量</label>
              <input
                v-model.number="count"
                type="number"
                min="1"
                max="50"
                class="w-full p-2 rounded-lg border border-border-default bg-surface-1 text-ink-900 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              />
            </div>
          </div>

          <button
            type="button"
            @click="generate"
            :disabled="!canGenerate"
            :class="[
              'py-3 px-6 rounded-lg w-full transition',
              !canGenerate
                ? 'bg-surface-3 text-ink-400 cursor-not-allowed'
                : 'bg-accent-600 hover:bg-accent-700 text-white'
            ]"
          >
            {{ isLoading ? '生成中...' : '生成变量名' }}
          </button>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-body-sm text-ink-600">生成结果</div>
            <button
              type="button"
              class="px-3 py-1 text-body-sm rounded-lg bg-emerald-600 text-white transition-all duration-150 hover:bg-emerald-500 disabled:bg-surface-3 disabled:text-ink-400 disabled:cursor-not-allowed"
              :disabled="!results.length"
              @click="copyAll"
              @mousedown="handleButtonPress"
              @touchstart="handleButtonPress"
            >
              复制全部
            </button>
          </div>

          <div class="min-h-[220px] rounded-lg p-3 border border-border-default bg-surface-1">
            <div v-if="isLoading" class="text-ink-500">生成中...</div>
            <ul v-else class="space-y-2">
              <li
                v-for="(r, i) in results"
                :key="i"
                class="flex items-center justify-between p-2 rounded-lg border border-border-default bg-surface-2"
              >
                <span class="truncate mr-3 text-ink-900 font-mono">{{ r }}</span>
                <button
                  type="button"
                  class="px-2 py-1 text-caption rounded-lg bg-accent-600 text-white transition-all duration-150 hover:bg-accent-700"
                  @click="copyOne(r)"
                  @mousedown="handleButtonPress"
                  @touchstart="handleButtonPress"
                >
                  复制
                </button>
              </li>
              <div v-if="!results.length" class="text-ink-400 text-body-sm">暂无结果</div>
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
