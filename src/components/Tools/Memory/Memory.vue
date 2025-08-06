<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "记忆力翻牌",
})

// 游戏状态
const gameState = reactive({
  isPlaying: false,
  score: 0,
  highScore: 0,
  gameOver: false,
  moves: 0,
  time: 0,
})

// 游戏配置
const config = reactive({
  gridSize: window.innerWidth < 768 ? 4 : 6, // 移动端4x4，桌面端6x6
  cardSize: window.innerWidth < 768 ? 60 : 80,
  flipDuration: 500,
  matchDelay: 1000,
})

// 卡片数据
const cards = ref<Array<{
  id: number
  value: string
  isFlipped: boolean
  isMatched: boolean
  isLocked: boolean
}>>([])

// 当前翻开的卡片
const flippedCards = ref<number[]>([])
let gameTimer: number | null = null

// 卡片符号
const cardSymbols = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦆', '🦅', '🦉']

// 初始化游戏
const initGame = () => {
  const totalCards = config.gridSize * config.gridSize
  const symbols = cardSymbols.slice(0, totalCards / 2)
  const gameCards: Array<{
    id: number
    value: string
    isFlipped: boolean
    isMatched: boolean
    isLocked: boolean
  }> = []
  
  // 创建配对卡片
  for (let i = 0; i < symbols.length; i++) {
    gameCards.push(
      { id: i * 2, value: symbols[i], isFlipped: false, isMatched: false, isLocked: false },
      { id: i * 2 + 1, value: symbols[i], isFlipped: false, isMatched: false, isLocked: false }
    )
  }
  
  // 随机打乱卡片
  cards.value = gameCards.sort(() => Math.random() - 0.5)
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = true
  gameState.gameOver = false
  gameState.score = 0
  gameState.moves = 0
  gameState.time = 0
  flippedCards.value = []
  
  initGame()
  
  // 开始计时
  gameTimer = setInterval(() => {
    if (gameState.isPlaying) {
      gameState.time++
    }
  }, 1000)
}

// 翻牌
const flipCard = (index: number) => {
  if (!gameState.isPlaying || cards.value[index].isLocked || cards.value[index].isMatched) {
    return
  }
  
  // 如果已经翻开了两张卡片，不能再翻
  if (flippedCards.value.length >= 2) {
    return
  }
  
  // 如果这张卡片已经翻开，不能再翻
  if (cards.value[index].isFlipped) {
    return
  }
  
  // 翻开卡片
  cards.value[index].isFlipped = true
  flippedCards.value.push(index)
  
  // 如果翻开了两张卡片，检查是否匹配
  if (flippedCards.value.length === 2) {
    gameState.moves++
    const [index1, index2] = flippedCards.value
    const card1 = cards.value[index1]
    const card2 = cards.value[index2]
    
    if (card1.value === card2.value) {
      // 匹配成功
      card1.isMatched = true
      card2.isMatched = true
      gameState.score += 10
      flippedCards.value = []
      
      // 检查游戏是否结束
      if (cards.value.every(card => card.isMatched)) {
        gameOver()
      }
    } else {
      // 匹配失败，延迟后翻回
      setTimeout(() => {
        card1.isFlipped = false
        card2.isFlipped = false
        flippedCards.value = []
      }, config.matchDelay)
    }
  }
}

// 游戏结束
const gameOver = () => {
  gameState.isPlaying = false
  gameState.gameOver = true
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  
  // 计算最终得分（基于时间、步数等）
  const timeBonus = Math.max(0, 100 - gameState.time * 2)
  const moveBonus = Math.max(0, 50 - gameState.moves * 2)
  gameState.score += timeBonus + moveBonus
  
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score
  }
}

// 重新开始
const restartGame = () => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  startGame()
}

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 生命周期
onMounted(() => {
  // 从localStorage加载最高分
  const savedHighScore = localStorage.getItem('memoryHighScore')
  if (savedHighScore) {
    gameState.highScore = parseInt(savedHighScore)
  }
})

onUnmounted(() => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  // 保存最高分
  localStorage.setItem('memoryHighScore', gameState.highScore.toString())
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-2xl mx-auto">
        <!-- 游戏信息 -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">得分</h3>
            <p class="text-xl font-bold text-blue-600">{{ gameState.score }}</p>
          </div>
          <div class="text-center bg-green-50 p-3 rounded-lg border border-green-200">
            <h3 class="text-sm font-medium text-green-900">最高分</h3>
            <p class="text-xl font-bold text-green-600">{{ gameState.highScore }}</p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">步数</h3>
            <p class="text-xl font-bold text-purple-600">{{ gameState.moves }}</p>
          </div>
          <div class="text-center bg-orange-50 p-3 rounded-lg border border-orange-200">
            <h3 class="text-sm font-medium text-orange-900">时间</h3>
            <p class="text-xl font-bold text-orange-600">{{ formatTime(gameState.time) }}</p>
          </div>
          <div class="text-center bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <h3 class="text-sm font-medium text-indigo-900">格子数</h3>
            <p class="text-xl font-bold text-indigo-600">{{ config.gridSize }}×{{ config.gridSize }}</p>
          </div>
        </div>

        <!-- 游戏控制 -->
        <div class="flex justify-center mb-6">
          <el-button 
            v-if="!gameState.isPlaying && !gameState.gameOver"
            @click="startGame" 
            type="primary"
            class="bg-blue-500 hover:bg-blue-600 border-blue-600"
          >
            开始游戏
          </el-button>
          <el-button 
            v-if="gameState.gameOver"
            @click="restartGame" 
            type="success"
            class="bg-green-500 hover:bg-green-600 border-green-600"
          >
            重新开始
          </el-button>
        </div>

        <!-- 游戏区域 -->
        <div class="flex justify-center mb-6">
          <div 
            class="bg-gray-100 p-4 rounded-lg shadow-lg"
            :style="{
              display: 'grid',
              gridTemplateColumns: `repeat(${config.gridSize}, ${config.cardSize}px)`,
              gap: '8px'
            }"
          >
            <div
              v-for="(card, index) in cards"
              :key="card.id"
              class="relative cursor-pointer transition-all duration-300 transform hover:scale-105"
              :class="{
                'rotate-y-180': card.isFlipped || card.isMatched,
                'opacity-50': card.isMatched
              }"
              @click="flipCard(index)"
              :style="{
                width: config.cardSize + 'px',
                height: config.cardSize + 'px'
              }"
            >
              <!-- 卡片背面 -->
              <div
                v-if="!card.isFlipped && !card.isMatched"
                class="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-md flex items-center justify-center text-white text-2xl font-bold"
              >
                ?
              </div>
              
              <!-- 卡片正面 -->
              <div
                v-if="card.isFlipped || card.isMatched"
                class="absolute inset-0 bg-white rounded-lg shadow-md flex items-center justify-center text-4xl"
                :class="{
                  'bg-green-100 border-2 border-green-400': card.isMatched
                }"
              >
                {{ card.value }}
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏结束提示 -->
        <div v-if="gameState.gameOver" class="text-center mb-6">
          <div class="bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-green-900 mb-2">恭喜完成！</h3>
            <p class="text-green-600">最终得分: {{ gameState.score }}</p>
            <p class="text-green-600">用时: {{ formatTime(gameState.time) }}</p>
            <p class="text-green-600">步数: {{ gameState.moves }}</p>
            <p v-if="gameState.score > gameState.highScore" class="text-yellow-600 font-medium mt-2">
              新纪录！恭喜你创造了新的最高分！
            </p>
          </div>
        </div>

        <!-- 游戏说明 -->
        <div class="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 shadow-sm">
          <h3 class="text-lg font-medium text-gray-900 mb-3">游戏说明</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-blue-600">游戏目标：</strong>找到所有相同的卡片配对</p>
              <p><strong class="text-blue-600">操作方式：</strong>点击卡片翻开，找到相同的两张卡片</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-green-600">得分规则：</strong>每对匹配+10分，时间越短得分越高</p>
              <p><strong class="text-red-600">挑战：</strong>用最少的步数和时间完成游戏</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        记忆力翻牌配对游戏，考验你的记忆力：<br><br>
        
        游戏特色：经典翻牌配对玩法，多种可爱表情符号，实时得分统计<br>
        操作方式：点击卡片翻开，找到相同的两张卡片进行配对<br>
        游戏目标：用最少的步数和时间找到所有卡片配对<br>
        训练效果：锻炼记忆力、观察力和反应速度<br><br>
        
        适合所有年龄段，是训练大脑记忆能力的益智游戏。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 卡片翻转动画 */
.rotate-y-180 {
  transform: rotateY(180deg);
}

/* 卡片悬停效果 */
.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

/* 匹配成功的卡片动画 */
@keyframes matchPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.matched {
  animation: matchPulse 0.5s ease-in-out;
}
</style> 