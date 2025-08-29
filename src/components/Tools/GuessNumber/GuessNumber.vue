<script setup lang="ts">
import { reactive, ref, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'

const info = reactive({
  title: "猜数字游戏",
})

// 范围选项
const rangeOptions = [
  { label: '简单 (1-100)', min: 1, max: 100, difficulty: '简单' },
  { label: '中等 (1-200)', min: 1, max: 200, difficulty: '中等' },
  { label: '困难 (1-300)', min: 1, max: 300, difficulty: '困难' },
  { label: '专家 (1-500)', min: 1, max: 500, difficulty: '专家' },
  { label: '地狱 (1-1000)', min: 1, max: 1000, difficulty: '地狱' },
]

// 游戏状态
const gameState = reactive({
  targetNumber: 0,
  userGuess: '',
  attempts: 0,
  gameStatus: 'playing', // playing, won, lost
  hint: '',
  gameHistory: [] as Array<{guess: number, hint: string}>,
  isGameStarted: false,
  minRange: 1,
  maxRange: 100,
  selectedRangeIndex: 0, // 默认选择第一个范围
})

const inputRef = ref()

// 生成随机数字
const generateRandomNumber = () => {
  return Math.floor(Math.random() * (gameState.maxRange - gameState.minRange + 1)) + gameState.minRange
}

// 重置到难度选择界面
const resetToSelection = () => {
  gameState.isGameStarted = false
  gameState.gameStatus = 'playing'
  gameState.userGuess = ''
  gameState.attempts = 0
  gameState.hint = ''
  gameState.gameHistory = []
  gameState.minRange = 1
  gameState.maxRange = 100
}

// 开始新游戏
const startNewGame = () => {
  const selectedRange = rangeOptions[gameState.selectedRangeIndex]
  gameState.minRange = selectedRange.min
  gameState.maxRange = selectedRange.max
  gameState.targetNumber = generateRandomNumber()
  gameState.userGuess = ''
  gameState.attempts = 0
  gameState.gameStatus = 'playing'
  gameState.gameHistory = []
  gameState.isGameStarted = true
  gameState.hint = `我已经想好了一个 ${gameState.minRange}-${gameState.maxRange} 之间的数字，开始猜吧！`
  
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 提交猜测
const submitGuess = () => {
  const guess = parseInt(gameState.userGuess)
  
  // 输入验证
  if (isNaN(guess)) {
    ElMessage.warning('请输入一个有效的数字！')
    return
  }
  
  if (guess < gameState.minRange || guess > gameState.maxRange) {
    ElMessage.warning(`请输入 ${gameState.minRange}-${gameState.maxRange} 之间的数字！`)
    return
  }
  
  gameState.attempts++
  let hint = ''
  
  if (guess === gameState.targetNumber) {
    gameState.gameStatus = 'won'
    hint = `🎉 恭喜你！猜对了！答案就是 ${gameState.targetNumber}`
    ElMessage.success(`恭喜你用 ${gameState.attempts} 次猜中了！`)
  } else if (guess < gameState.targetNumber) {
    hint = `太小了！答案比 ${guess} 大`
    gameState.minRange = Math.max(gameState.minRange, guess + 1)
  } else {
    hint = `太大了！答案比 ${guess} 小`
    gameState.maxRange = Math.min(gameState.maxRange, guess - 1)
  }
  
  gameState.gameHistory.push({ guess, hint })
  gameState.hint = hint
  gameState.userGuess = ''
  
  nextTick(() => {
    if (gameState.gameStatus === 'playing') {
      inputRef.value?.focus()
    }
  })
}

// 键盘事件
const handleKeyup = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    submitGuess()
  }
}

// 获取提示颜色
const getHintColor = (hint: string) => {
  if (hint.includes('恭喜')) return 'text-green-600'
  if (hint.includes('太小了')) return 'text-blue-600'
  if (hint.includes('太大了')) return 'text-red-600'
  return 'text-gray-600'
}

// 获取难度评价（根据不同范围调整标准）
const getDifficultyRating = () => {
  const selectedRange = rangeOptions[gameState.selectedRangeIndex]
  const totalRange = selectedRange.max - selectedRange.min + 1
  const theoreticalMin = Math.ceil(Math.log2(totalRange)) // 理论最少次数
  
  if (gameState.attempts <= theoreticalMin + 1) return { text: '天才级', color: 'text-purple-600', icon: '🧠' }
  if (gameState.attempts <= theoreticalMin + 3) return { text: '优秀', color: 'text-green-600', icon: '⭐' }
  if (gameState.attempts <= theoreticalMin + 5) return { text: '良好', color: 'text-blue-600', icon: '👍' }
  if (gameState.attempts <= theoreticalMin + 8) return { text: '一般', color: 'text-yellow-600', icon: '😊' }
  return { text: '需要加油', color: 'text-red-600', icon: '💪' }
}

// 获取当前难度信息
const getCurrentDifficulty = () => {
  return rangeOptions[gameState.selectedRangeIndex]
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white shadow-sm">
      <!-- 游戏主界面 -->
      <div class="max-w-md mx-auto">
        <!-- 游戏标题和说明 -->
        <div class="text-center mb-6">
          <div class="text-3xl mb-2">🎯</div>
          <h2 class="text-xl font-bold text-gray-800 mb-2">猜数字游戏</h2>
          <p class="text-gray-600 text-sm">选择难度，挑战你的逻辑推理能力</p>
        </div>

        <!-- 游戏未开始 -->
        <div v-if="!gameState.isGameStarted" class="text-center">
          <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-4">
            <div class="text-4xl mb-3">🎲</div>
            <p class="text-gray-700 mb-4">选择游戏难度，我会随机选择一个数字<br>你来猜猜是多少？</p>
            
            <!-- 难度选择 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">选择难度</label>
              <select 
                v-model="gameState.selectedRangeIndex"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option v-for="(option, index) in rangeOptions" :key="index" :value="index">
                  {{ option.label }}
                </option>
              </select>
            </div>
            
            <button 
              @click="startNewGame"
              class="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
            >
              开始游戏
            </button>
          </div>
        </div>

        <!-- 游戏进行中 -->
        <div v-else>
          <!-- 游戏状态 -->
          <div class="bg-gray-50 rounded-xl p-4 mb-4">
            <div class="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>范围: {{ gameState.minRange }}-{{ gameState.maxRange }}</span>
              <span>第 {{ gameState.attempts }} 次尝试</span>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-500">
              <span>难度: {{ getCurrentDifficulty().difficulty }}</span>
              <span>理论最少: {{ Math.ceil(Math.log2(getCurrentDifficulty().max - getCurrentDifficulty().min + 1)) }} 次</span>
            </div>
          </div>

          <!-- 输入区域 -->
          <div v-if="gameState.gameStatus === 'playing'" class="mb-4">
            <div class="flex gap-2">
              <input
                ref="inputRef"
                v-model="gameState.userGuess"
                @keyup="handleKeyup"
                type="number"
                :min="gameState.minRange"
                :max="gameState.maxRange"
                placeholder="输入你的猜测"
                class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-lg font-medium"
              />
              <button
                @click="submitGuess"
                :disabled="!gameState.userGuess"
                class="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
              >
                猜测
              </button>
            </div>
            <p class="text-xs text-gray-500 text-center mt-2">按 Enter 键快速提交</p>
          </div>

          <!-- 当前提示 -->
          <div v-if="gameState.hint" class="mb-4">
            <div class="bg-white border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm">
              <p :class="getHintColor(gameState.hint)" class="font-medium">
                {{ gameState.hint }}
              </p>
            </div>
          </div>

          <!-- 游戏结束 -->
          <div v-if="gameState.gameStatus === 'won'" class="text-center mb-4">
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
              <div class="text-4xl mb-3">🎉</div>
              <h3 class="text-xl font-bold text-green-600 mb-2">游戏胜利！</h3>
              <p class="text-gray-700 mb-2">你用了 <span class="font-bold text-green-600">{{ gameState.attempts }}</span> 次就猜中了</p>
              <p class="text-sm text-gray-600 mb-3">难度: {{ getCurrentDifficulty().difficulty }} ({{ getCurrentDifficulty().label }})</p>
              <div class="mb-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium" :class="`bg-gray-100 ${getDifficultyRating().color}`">
                  {{ getDifficultyRating().icon }} {{ getDifficultyRating().text }}
                </span>
              </div>
              <button 
                @click="startNewGame"
                class="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-6 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 transform hover:scale-105"
              >
                再玩一局
              </button>
            </div>
          </div>

          <!-- 游戏历史 -->
          <div v-if="gameState.gameHistory.length > 0" class="mb-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">猜测历史</h4>
            <div class="space-y-2">
              <div 
                v-for="(record, index) in gameState.gameHistory.slice().reverse()" 
                :key="index"
                class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
              >
                <span class="font-medium">{{ record.guess }}</span>
                <span :class="getHintColor(record.hint)" class="text-xs">
                  {{ record.hint.replace(/太(大|小)了！答案比 \d+ (大|小)/, '太$1了') }}
                </span>
              </div>
            </div>
          </div>

          <!-- 重新开始按钮 -->
          <div v-if="gameState.isGameStarted" class="text-center space-y-2">
            <div class="flex gap-2 justify-center">
              <button 
                v-if="gameState.attempts > 0 || gameState.gameHistory.length > 0"
                @click="startNewGame"
                class="text-blue-500 hover:text-blue-700 text-sm underline transition-colors duration-200"
              >
                重新开始
              </button>
              <span v-if="gameState.attempts > 0 || gameState.gameHistory.length > 0" class="text-gray-300">|</span>
              <button 
                @click="resetToSelection"
                class="text-gray-500 hover:text-gray-700 text-sm underline transition-colors duration-200"
              >
                选择难度
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏说明 -->
    <ToolDetail title="游戏说明">
      <div class="space-y-2 text-sm text-gray-600">
        <p>• 选择不同的难度等级，挑战不同范围的数字猜测</p>
        <p>• 系统会根据你选择的范围随机选择一个数字</p>
        <p>• 每次猜测后会给出"太大了"或"太小了"的提示</p>
        <p>• 尽量用最少的次数猜中答案</p>
        <p>• 难度越高，获得好评价需要的猜测次数也会相应调整</p>
        <p>• 理论最少次数基于二分查找算法计算</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 数字输入框样式优化 */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
