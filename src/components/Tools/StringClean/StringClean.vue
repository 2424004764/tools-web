<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

// 去空格模式类型
type CleanMode = 'all' | 'edges' | 'extra' | 'lines'

const inputText = ref('')
const selectedMode = ref<CleanMode>('all')

// 计算处理后的结果
const cleanedText = computed(() => {
  if (!inputText.value) return ''

  switch (selectedMode.value) {
    case 'all':
      // 去除所有空格（包括空格、制表符等）
      return inputText.value.replace(/\s/g, '')

    case 'edges':
      // 去除首尾空格
      return inputText.value.trim()

    case 'extra':
      // 去除多余空格（多个连续空格变成一个）
      return inputText.value.replace(/\s+/g, ' ').trim()

    case 'lines':
      // 去除所有空行
      return inputText.value
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n')

    default:
      return inputText.value
  }
})

// 统计信息
const originalStats = computed(() => ({
  chars: inputText.value.length,
  lines: inputText.value ? inputText.value.split('\n').length : 0,
  spaces: (inputText.value.match(/\s/g) || []).length
}))

const cleanedStats = computed(() => ({
  chars: cleanedText.value.length,
  lines: cleanedText.value ? cleanedText.value.split('\n').length : 0,
  spaces: (cleanedText.value.match(/\s/g) || []).length
}))

const savedChars = computed(() => originalStats.value.chars - cleanedStats.value.chars)

// 清空内容
const clearContent = () => {
  inputText.value = ''
}

// 复制结果
const copyResult = async () => {
  if (cleanedText.value) {
    await copy(cleanedText.value)
  }
}

// 模式配置
const modeOptions = [
  {
    value: 'all' as CleanMode,
    label: '去除所有空格',
    desc: '删除文本中的所有空白字符（包括空格、制表符、换行符等）',
    icon: '🗑️',
    color: 'from-red-500 to-pink-500'
  },
  {
    value: 'edges' as CleanMode,
    label: '去除首尾空格',
    desc: '仅删除文本开头和结尾的空白字符',
    icon: '✂️',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    value: 'extra' as CleanMode,
    label: '去除多余空格',
    desc: '将多个连续空格合并为一个，并删除首尾空格',
    icon: '🔧',
    color: 'from-green-500 to-emerald-500'
  },
  {
    value: 'lines' as CleanMode,
    label: '去除空行',
    desc: '删除文本中的所有空行，保留非空内容',
    icon: '📝',
    color: 'from-purple-500 to-violet-500'
  }
]
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="字符串去空格"></DetailHeader>

    <!-- 模式选择卡片 -->
    <div class="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="mode in modeOptions"
        :key="mode.value"
        @click="selectedMode = mode.value"
        :class="[
          'relative overflow-hidden rounded-xl p-4 cursor-pointer',
          'border-2 shadow-lg',
          selectedMode === mode.value
            ? `bg-gradient-to-br ${mode.color} border-white shadow-2xl`
            : 'bg-white border-gray-200 hover:shadow-xl hover:scale-105 hover:border-gray-300'
        ]"
      >
        <!-- 选中状态的光晕效果 -->
        <transition name="pulse-fade">
          <div
            v-show="selectedMode === mode.value"
            class="absolute inset-0 bg-white opacity-10"
          ></div>
        </transition>

        <div class="relative">
          <div class="flex items-center mb-2">
            <span class="text-2xl mr-2">{{ mode.icon }}</span>
            <span
              :class="[
                'font-semibold text-sm',
                selectedMode === mode.value ? 'text-white' : 'text-gray-800'
              ]"
            >
              {{ mode.label }}
            </span>
          </div>
          <p
            :class="[
              'text-xs leading-relaxed',
              selectedMode === mode.value ? 'text-white/90' : 'text-gray-600'
            ]"
          >
            {{ mode.desc }}
          </p>
        </div>

        <!-- 选中标记 -->
        <div
          v-if="selectedMode === mode.value"
          class="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
        >
          <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 主操作区域 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <!-- 输入区域 -->
      <div class="bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-gray-800 flex items-center">
            <span class="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
            原始文本
          </h3>
          <el-tag size="small" type="info">{{ originalStats.chars }} 字符</el-tag>
        </div>
        <el-input
          type="textarea"
          :rows="10"
          v-model="inputText"
          placeholder="请输入需要处理的文本内容..."
          class="custom-textarea"
        ></el-input>

        <!-- 统计信息 -->
        <div class="mt-3 grid grid-cols-3 gap-2">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-blue-600">{{ originalStats.chars }}</div>
            <div class="text-xs text-gray-600 mt-1">总字符数</div>
          </div>
          <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-green-600">{{ originalStats.lines }}</div>
            <div class="text-xs text-gray-600 mt-1">行数</div>
          </div>
          <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-orange-600">{{ originalStats.spaces }}</div>
            <div class="text-xs text-gray-600 mt-1">空格数</div>
          </div>
        </div>
      </div>

      <!-- 输出区域 -->
      <div class="bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-gray-800 flex items-center">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            处理结果
          </h3>
          <el-tag size="small" type="success">{{ cleanedStats.chars }} 字符</el-tag>
        </div>
        <div class="relative">
          <el-input
            type="textarea"
            :rows="10"
            :model-value="cleanedText"
            readonly
            placeholder="处理结果将实时显示在这里..."
            class="custom-textarea"
          ></el-input>

          <!-- 复制按钮 -->
          <transition name="fade">
            <el-button
              v-if="cleanedText"
              @click="copyResult"
              type="primary"
              size="small"
              class="absolute top-3 right-3 shadow-lg hover:shadow-xl transition-all"
              style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none;"
            >
              <template #icon>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </template>
              复制
            </el-button>
          </transition>
        </div>

        <!-- 统计信息 -->
        <div class="mt-3 grid grid-cols-3 gap-2">
          <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-purple-600">{{ cleanedStats.chars }}</div>
            <div class="text-xs text-gray-600 mt-1">总字符数</div>
          </div>
          <div class="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-pink-600">{{ cleanedStats.lines }}</div>
            <div class="text-xs text-gray-600 mt-1">行数</div>
          </div>
          <div class="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 text-center">
            <div class="text-2xl font-bold text-cyan-600">{{ cleanedStats.spaces }}</div>
            <div class="text-xs text-gray-600 mt-1">剩余空格</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 优化统计卡片 -->
    <transition name="slide-up">
      <div
        v-if="savedChars > 0"
        class="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-5 mb-4 shadow-lg text-white"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="text-4xl mr-4">✨</div>
            <div>
              <div class="text-2xl font-bold">优化完成！</div>
              <div class="text-white/90 mt-1">
                成功减少了 <span class="text-3xl font-bold mx-1">{{ savedChars }}</span> 个字符
              </div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-5xl font-bold">{{ ((savedChars / originalStats.chars) * 100).toFixed(1) }}%</div>
            <div class="text-white/90 text-sm">压缩率</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 操作按钮 -->
    <div class="flex gap-3 mb-4">
      <el-button
        @click="copyResult"
        :disabled="!cleanedText"
        type="primary"
        size="large"
        class="flex-1 shadow-lg hover:shadow-xl transition-all"
        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none;"
      >
        <template #icon>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </template>
        复制结果
      </el-button>
      <el-button
        @click="clearContent"
        :disabled="!inputText"
        type="danger"
        size="large"
        class="shadow-lg hover:shadow-xl transition-all"
      >
        <template #icon>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </template>
        清空内容
      </el-button>
    </div>

    <!-- 功能说明 -->
    <ToolDetail title="功能说明">
      <div class="space-y-4">
        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border-l-4 border-blue-500">
          <h4 class="font-bold text-gray-800 mb-2 flex items-center">
            <span class="mr-2">🗑️</span> 去除所有空格
          </h4>
          <p class="text-gray-700 text-sm leading-relaxed">
            删除文本中的所有空白字符，包括空格、制表符（Tab）、换行符等。适用于需要紧凑文本的场景。
          </p>
          <div class="mt-2 bg-white rounded-lg p-3 text-xs font-mono">
            <div class="text-gray-500 mb-1">示例：</div>
            <div>"Hello  World!" → "HelloWorld!"</div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-l-4 border-green-500">
          <h4 class="font-bold text-gray-800 mb-2 flex items-center">
            <span class="mr-2">✂️</span> 去除首尾空格
          </h4>
          <p class="text-gray-700 text-sm leading-relaxed">
            仅删除文本开头和结尾的空白字符，保留文本内部的空格。适用于清理用户输入或格式化文本。
          </p>
          <div class="mt-2 bg-white rounded-lg p-3 text-xs font-mono">
            <div class="text-gray-500 mb-1">示例：</div>
            <div>"  Hello World!  " → "Hello World!"</div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 border-l-4 border-purple-500">
          <h4 class="font-bold text-gray-800 mb-2 flex items-center">
            <span class="mr-2">🔧</span> 去除多余空格
          </h4>
          <p class="text-gray-700 text-sm leading-relaxed">
            将多个连续的空格合并为一个空格，并删除首尾空格。适用于规范化文本格式，保持可读性。
          </p>
          <div class="mt-2 bg-white rounded-lg p-3 text-xs font-mono">
            <div class="text-gray-500 mb-1">示例：</div>
            <div>"Hello    World!  " → "Hello World!"</div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border-l-4 border-pink-500">
          <h4 class="font-bold text-gray-800 mb-2 flex items-center">
            <span class="mr-2">📝</span> 去除空行
          </h4>
          <p class="text-gray-700 text-sm leading-relaxed">
            删除文本中的所有空行，只保留包含内容的行。适用于清理段落之间的多余空行。
          </p>
          <div class="mt-2 bg-white rounded-lg p-3 text-xs font-mono">
            <div class="text-gray-500 mb-1">示例：</div>
            <div>"Line 1\n\n\nLine 2" → "Line 1\nLine 2"</div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border-l-4 border-yellow-500">
          <h4 class="font-bold text-gray-800 mb-2 flex items-center">
            <span class="mr-2">💡</span> 使用场景
          </h4>
          <ul class="text-gray-700 text-sm space-y-2 leading-relaxed">
            <li class="flex items-start">
              <span class="text-yellow-500 mr-2">•</span>
              <span><strong>数据清洗：</strong>清理Excel、CSV等数据源中的不规则空格</span>
            </li>
            <li class="flex items-start">
              <span class="text-yellow-500 mr-2">•</span>
              <span><strong>代码优化：</strong>删除代码中的多余空格，减小文件体积</span>
            </li>
            <li class="flex items-start">
              <span class="text-yellow-500 mr-2">•</span>
              <span><strong>文本处理：</strong>规范化用户输入，提升数据质量</span>
            </li>
            <li class="flex items-start">
              <span class="text-yellow-500 mr-2">•</span>
              <span><strong>格式转换：</strong>为后续文本处理准备干净的数据</span>
            </li>
          </ul>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.custom-textarea :deep(textarea) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 脉冲淡入动画 - 用于光晕效果 */
.pulse-fade-enter-active {
  transition: opacity 0.5s ease;
}

.pulse-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pulse-fade-enter-from,
.pulse-fade-leave-to {
  opacity: 0;
}

/* 滑入动画 */
.slide-up-enter-active {
  transition: all 0.5s ease;
}

.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
