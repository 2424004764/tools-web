<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "单词记忆卡片",
})

// 学习模式
const studyModes = [
  { label: '英→中', value: 'en2zh' },
  { label: '中→英', value: 'zh2en' },
  { label: '混合模式', value: 'mixed' }
]

// 默认单词库
const defaultWordList = [
  { english: "apple", chinese: "苹果", example: "I eat an apple every day." },
  { english: "book", chinese: "书", example: "I'm reading an interesting book." },
  { english: "computer", chinese: "电脑", example: "I use my computer for work." },
  { english: "water", chinese: "水", example: "Drink plenty of water every day." },
  { english: "friend", chinese: "朋友", example: "She is my best friend." },
  { english: "time", chinese: "时间", example: "Time is precious." },
  { english: "music", chinese: "音乐", example: "I love listening to music." },
  { english: "school", chinese: "学校", example: "I go to school by bus." },
  { english: "family", chinese: "家庭", example: "Family is important to me." },
  { english: "food", chinese: "食物", example: "Chinese food is delicious." }
]

// 状态管理
const state = reactive({
  currentMode: 'en2zh',
  currentIndex: 0,
  isFlipped: false,
  showAnswer: false,
  isPlaying: false,
  progress: 0,
  correctCount: 0,
  totalCount: 0,
  studySession: [] as any[],
  userWordList: [] as any[],
  customWords: ''
})

// 获取当前单词
const currentWord = ref(defaultWordList[0])

// 初始化学习会话
const initStudySession = () => {
  const words = state.userWordList.length > 0 ? state.userWordList : defaultWordList
  state.studySession = [...words].sort(() => Math.random() - 0.5)
  state.totalCount = words.length
  state.correctCount = 0
  state.currentIndex = 0
  state.progress = 0
  state.isPlaying = true
  state.isFlipped = false
  state.showAnswer = false
  currentWord.value = state.studySession[0]
}

// 开始学习
const startStudy = () => {
  initStudySession()
}

// 下一个单词
const nextWord = () => {
  if (state.currentIndex < state.studySession.length - 1) {
    state.currentIndex++
    state.isFlipped = false
    state.showAnswer = false
    currentWord.value = state.studySession[state.currentIndex]
    state.progress = Math.round((state.currentIndex / state.studySession.length) * 100)
  } else {
    // 学习完成
    state.isPlaying = false
  }
}

// 上一个单词
const prevWord = () => {
  if (state.currentIndex > 0) {
    state.currentIndex--
    state.isFlipped = false
    state.showAnswer = false
    currentWord.value = state.studySession[state.currentIndex]
    state.progress = Math.round((state.currentIndex / state.studySession.length) * 100)
  }
}


// 标记为已掌握
const markAsKnown = () => {
  state.correctCount++
  nextWord()
}

// 标记为需要复习
const markForReview = () => {
  nextWord()
}


// 解析自定义单词
const parseCustomWords = () => {
  if (!state.customWords.trim()) {
    state.userWordList = []
    return
  }

  const lines = state.customWords.trim().split('\n')
  const words = lines.map(line => {
    const parts = line.split(/[=：]/)
    if (parts.length >= 2) {
      return {
        english: parts[0].trim(),
        chinese: parts[1].trim(),
        example: parts[2] ? parts[2].trim() : ''
      }
    }
    return null
  }).filter(Boolean)

  state.userWordList = words
}

// 重置学习
const resetStudy = () => {
  state.isPlaying = false
  state.currentIndex = 0
  state.progress = 0
  state.correctCount = 0
  state.isFlipped = false
  state.showAnswer = false
}

// 格式化进度
const formatProgress = () => {
  return `${state.currentIndex + 1} / ${state.studySession.length}`
}

onMounted(() => {
  // 从localStorage加载用户单词列表
  const savedWords = localStorage.getItem('flashcardWords')
  if (savedWords) {
    state.customWords = savedWords
    parseCustomWords()
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-4xl mx-auto">
        
        <!-- 学习控制区 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <!-- 模式选择 -->
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900 mb-3">学习模式</h3>
            <div class="space-y-2">
              <el-radio-group v-model="state.currentMode">
                <el-radio 
                  v-for="mode in studyModes" 
                  :key="mode.value" 
                  :label="mode.value"
                  :disabled="state.isPlaying"
                >
                  {{ mode.label }}
                </el-radio>
              </el-radio-group>
            </div>
          </div>

          <!-- 进度统计 -->
          <div class="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 class="text-sm font-medium text-green-900 mb-3">学习进度</h3>
            <div v-if="state.isPlaying" class="text-center">
              <p class="text-2xl font-bold text-green-600">{{ formatProgress() }}</p>
              <p class="text-sm text-green-500 mt-1">已掌握: {{ state.correctCount }} 个</p>
              <el-progress :percentage="state.progress" class="mt-2" />
            </div>
            <div v-else class="text-center text-gray-500">
              点击开始学习
            </div>
          </div>

          <!-- 控制按钮 -->
          <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900 mb-3">学习控制</h3>
            <div class="flex flex-col gap-2">
              <el-button 
                v-if="!state.isPlaying" 
                @click="startStudy" 
                type="primary" 
                class="w-full"
              >
                开始学习
              </el-button>
              <el-button 
                v-if="state.isPlaying" 
                @click="resetStudy" 
                type="warning" 
                class="w-full"
              >
                重新开始
              </el-button>
              <el-button 
                v-if="state.isPlaying" 
                @click="state.showAnswer = !state.showAnswer" 
                type="info" 
                class="w-full"
              >
                {{ state.showAnswer ? '隐藏答案' : '显示答案' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 单词卡片区域 -->
        <div v-if="state.isPlaying" class="mb-6">
          <div class="bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
            <!-- 卡片内容 -->
            <div class="text-center mb-6">
              <div v-if="state.currentMode !== 'zh2en'" class="mb-4">
                <p class="text-sm text-gray-500 mb-1">英文</p>
                <p class="text-3xl font-bold text-blue-600">{{ currentWord.english }}</p>
              </div>
              
              <div v-if="state.currentMode !== 'en2zh'" class="mb-4">
                <p class="text-sm text-gray-500 mb-1">中文</p>
                <p class="text-2xl font-bold text-green-600">{{ currentWord.chinese }}</p>
              </div>

              <!-- 例句 -->
              <div v-if="currentWord.example" class="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                <p class="text-sm text-yellow-700">{{ currentWord.example }}</p>
              </div>

              <!-- 答案提示 -->
              <div v-if="state.showAnswer" class="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                <p class="text-sm text-blue-700">
                  {{ state.currentMode === 'en2zh' ? currentWord.chinese : currentWord.english }}
                </p>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex justify-center gap-4">
              <el-button @click="prevWord" :disabled="state.currentIndex === 0" type="info">
                上一个
              </el-button>
              <el-button @click="markAsKnown" type="success">
                已掌握 ✓
              </el-button>
              <el-button @click="markForReview" type="warning">
                需要复习
              </el-button>
              <el-button @click="nextWord" :disabled="state.currentIndex === state.studySession.length - 1" type="primary">
                下一个
              </el-button>
            </div>
          </div>
        </div>

        <!-- 自定义单词输入 -->
        <div class="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-6">
          <h3 class="text-sm font-medium text-orange-900 mb-3">自定义单词库</h3>
          <p class="text-sm text-orange-700 mb-3">
            格式：英文=中文=例句（可选）<br>
            例如：apple=苹果=I eat an apple every day.
          </p>
          <el-input
            v-model="state.customWords"
            type="textarea"
            :rows="6"
            placeholder="输入自定义单词，每行一个"
            @blur="parseCustomWords"
          />
          <div class="mt-3 flex justify-between items-center">
            <span class="text-sm text-gray-500">
              已添加 {{ state.userWordList.length }} 个单词
            </span>
            <el-button @click="parseCustomWords" type="primary" size="small">
              解析单词
            </el-button>
          </div>
        </div>

        <!-- 默认单词库预览 -->
        <div v-if="!state.isPlaying" class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 class="text-sm font-medium text-gray-900 mb-3">默认单词库预览</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div 
              v-for="(word, index) in defaultWordList.slice(0, 6)" 
              :key="index"
              class="p-2 bg-white rounded border border-gray-200"
            >
              <p class="text-sm font-medium text-blue-600">{{ word.english }}</p>
              <p class="text-xs text-gray-500">{{ word.chinese }}</p>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        单词记忆卡片 - 高效的语言学习工具：<br><br>
        
        🎯 功能特点：<br>
        • 支持英→中、中→英、混合三种学习模式<br>
        • 内置常用英语单词库，支持自定义单词添加<br>
        • 实时学习进度跟踪和掌握率统计<br>
        • 例句展示，帮助理解单词用法<br>
        • 本地存储，保存你的学习记录和自定义单词<br><br>

        📚 学习模式：<br>
        • 英→中模式：显示英文，回忆中文意思<br>
        • 中→英模式：显示中文，回忆英文单词<br>
        • 混合模式：随机显示英文或中文<br><br>

        💡 使用技巧：<br>
        • 定期复习已标记的单词<br>
        • 利用例句加深理解<br>
        • 自定义添加专业词汇<br>
        • 结合发音练习效果更佳
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.flip-enter-active, .flip-leave-active {
  transition: transform 0.6s;
}
.flip-enter-from, .flip-leave-to {
  transform: rotateY(180deg);
}
.flip-enter-to, .flip-leave-from {
  transform: rotateY(0deg);
}

.word-card {
  transition: all 0.3s ease;
}
.word-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>