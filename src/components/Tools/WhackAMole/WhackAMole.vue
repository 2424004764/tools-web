<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "打地鼠",
})

// 游戏状态
const gameState = reactive({
  isPlaying: false,
  score: 0,
  highScore: 0,
  time: 30, // 30秒游戏时间
  gameOver: false,
  hits: 0,
  misses: 0,
  countdown: 0, // 倒计时
  isCountdown: false, // 是否在倒计时
  moleCount: 0, // 地鼠出现次数
})

// 游戏配置
const config = reactive({
  gridSize: window.innerWidth < 768 ? 3 : 4, // 移动端3x3，桌面端4x4
  cellSize: window.innerWidth < 768 ? 80 : 100,
  moleShowTime: window.innerWidth < 768 ? 800 : 600, // H5端默认慢速，PC端默认正常
  moleHideTime: 400,
  gameDuration: 30000, // 30秒
  baseInterval: window.innerWidth < 768 ? 1500 : 1200, // 基础间隔时间
  minInterval: 300, // 最快间隔时间
})

// 地鼠洞状态
const holes = ref<Array<{ id: number, hasMole: boolean, isHit: boolean }>>([])
let gameTimer: ReturnType<typeof setInterval> | null = null
let moleTimer: ReturnType<typeof setTimeout> | null = null

// 初始化地鼠洞
const initHoles = () => {
  const totalHoles = config.gridSize * config.gridSize
  holes.value = Array.from({ length: totalHoles }, (_, i) => ({
    id: i,
    hasMole: false,
    isHit: false
  }))
}

// 随机显示地鼠
const showRandomMole = () => {
  if (!gameState.isPlaying) return
  
  // 隐藏所有地鼠
  holes.value.forEach(hole => {
    hole.hasMole = false
    hole.isHit = false
  })
  
  // 随机选择一个洞显示地鼠
  const randomIndex = Math.floor(Math.random() * holes.value.length)
  holes.value[randomIndex].hasMole = true
  
  // 根据游戏进度和地鼠出现次数动态调整地鼠显示时间
  const timeProgress = (30 - gameState.time) / 30
  const scoreProgress = Math.min(gameState.score / 200, 1)
  const progress = Math.max(timeProgress, scoreProgress)
  
  // 前3个地鼠显示时间更长，让玩家适应
  let baseShowTime = config.moleShowTime
  if (gameState.moleCount < 3) {
    baseShowTime = config.moleShowTime * 2 // 前3个地鼠显示时间翻倍
  }
  
  const minShowTime = 300
  const dynamicShowTime = baseShowTime - (baseShowTime - minShowTime) * progress
  
  // 设置地鼠消失时间
  setTimeout(() => {
    if (holes.value[randomIndex].hasMole && !holes.value[randomIndex].isHit) {
      // 地鼠消失，算作miss
      gameState.misses++
    }
  }, dynamicShowTime)
  
  // 增加地鼠出现次数计数
  gameState.moleCount++
}

// 打地鼠
const whackMole = (holeId: number) => {
  if (!gameState.isPlaying) return
  
  const hole = holes.value.find(h => h.id === holeId)
  if (hole && hole.hasMole && !hole.isHit) {
    hole.isHit = true
    hole.hasMole = false
    gameState.hits++
    gameState.score += 10
    
    // 播放击中音效（可选）
    // playHitSound()
  }
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = false
  gameState.gameOver = false
  gameState.score = 0
  gameState.time = 30
  gameState.hits = 0
  gameState.misses = 0
  gameState.moleCount = 0
  gameState.isCountdown = true
  gameState.countdown = 3
  
  initHoles()
  
  // 开始倒计时
  const countdownTimer = setInterval(() => {
    gameState.countdown--
    
    if (gameState.countdown <= 0) {
      clearInterval(countdownTimer)
      gameState.isCountdown = false
      gameState.isPlaying = true
      
      // 开始游戏计时
      gameTimer = setInterval(() => {
        if (gameState.isPlaying) {
          gameState.time--
          if (gameState.time <= 0) {
            gameOver()
          }
        }
      }, 1000)
      
      // 开始地鼠出现循环
      startMoleLoop()
    }
  }, 1000)
}

// 地鼠出现循环
const startMoleLoop = () => {
  const showMole = () => {
    if (gameState.isPlaying) {
      showRandomMole()
      
      // 根据时间和得分计算动态间隔
      const timeProgress = (30 - gameState.time) / 30 // 时间进度 0-1
      const scoreProgress = Math.min(gameState.score / 200, 1) // 得分进度，最高200分
      const progress = Math.max(timeProgress, scoreProgress) // 取较大值
      
      // 前3个地鼠间隔时间更长
      let baseInterval = config.baseInterval
      if (gameState.moleCount < 3) {
        baseInterval = config.baseInterval * 1.5 // 前3个地鼠间隔时间增加50%
      }
      
      // 计算动态间隔：从基础间隔逐渐减少到最快间隔
      const dynamicInterval = baseInterval - (baseInterval - config.minInterval) * progress
      
      // 随机化间隔，增加不确定性
      const randomFactor = 0.7 + Math.random() * 0.6 // 0.7-1.3倍随机因子
      const nextInterval = Math.max(config.minInterval, dynamicInterval * randomFactor)
      
      moleTimer = setTimeout(showMole, nextInterval)
    }
  }
  
  showMole()
}

// 游戏结束
const gameOver = () => {
  gameState.isPlaying = false
  gameState.gameOver = true
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  
  if (moleTimer) {
    clearTimeout(moleTimer)
    moleTimer = null
  }
  
  // 更新最高分
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score
    localStorage.setItem('whackAMoleHighScore', gameState.highScore.toString())
  }
}

// 重新开始
const restartGame = () => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  if (moleTimer) {
    clearTimeout(moleTimer)
  }
  startGame()
}

// 格式化时间
const formatTime = (seconds: number) => {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

// 计算命中率
const accuracy = computed(() => {
  const total = gameState.hits + gameState.misses
  return total > 0 ? Math.round((gameState.hits / total) * 100) : 0
})

// 生命周期
onMounted(() => {
  // 从localStorage加载最高分
  const savedHighScore = localStorage.getItem('whackAMoleHighScore')
  if (savedHighScore) {
    gameState.highScore = parseInt(savedHighScore)
  }
})

onUnmounted(() => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  if (moleTimer) {
    clearTimeout(moleTimer)
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-4xl mx-auto">
        <!-- 游戏信息 -->
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">得分</h3>
            <p class="text-xl font-bold text-blue-600">{{ gameState.score }}</p>
          </div>
          <div class="text-center bg-green-50 p-3 rounded-lg border border-green-200">
            <h3 class="text-sm font-medium text-green-900">最高分</h3>
            <p class="text-xl font-bold text-green-600">{{ gameState.highScore }}</p>
          </div>
          <div class="text-center bg-red-50 p-3 rounded-lg border border-red-200">
            <h3 class="text-sm font-medium text-red-900">时间</h3>
            <p class="text-xl font-bold text-red-600">{{ formatTime(gameState.time) }}</p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">命中</h3>
            <p class="text-xl font-bold text-purple-600">{{ gameState.hits }}</p>
          </div>
          <div class="text-center bg-orange-50 p-3 rounded-lg border border-orange-200">
            <h3 class="text-sm font-medium text-orange-900">命中率</h3>
            <p class="text-xl font-bold text-orange-600">{{ accuracy }}%</p>
          </div>
          <div class="text-center bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <h3 class="text-sm font-medium text-indigo-900">游戏板</h3>
            <p class="text-xl font-bold text-indigo-600">{{ config.gridSize }}×{{ config.gridSize }}</p>
          </div>
        </div>

        <!-- 游戏控制 -->
        <div class="flex justify-center mb-6">
          <el-button 
            v-if="!gameState.isPlaying && !gameState.gameOver && !gameState.isCountdown"
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
        <div class="flex justify-center mb-6 relative">
          <!-- 漂浮倒计时 -->
          <div
            v-if="gameState.isCountdown"
            class="absolute inset-0 flex items-center justify-center z-10"
          >
            <div class="bg-yellow-100 border-4 border-yellow-400 rounded-full p-8 shadow-2xl">
              <div class="text-center">
                <div class="text-6xl font-bold text-yellow-600 mb-2">{{ gameState.countdown }}</div>
                <div class="text-lg text-yellow-700">准备开始</div>
              </div>
            </div>
          </div>
          
          <div 
            class="bg-green-100 p-6 rounded-lg shadow-lg"
            :class="{
              'opacity-50': gameState.isCountdown
            }"
            :style="{
              display: 'grid',
              gridTemplateColumns: `repeat(${config.gridSize}, ${config.cellSize}px)`,
              gap: '10px'
            }"
          >
            <div
              v-for="hole in holes"
              :key="hole.id"
              class="relative cursor-pointer transition-all duration-200 transform hover:scale-105"
              :class="{
                'cursor-not-allowed': gameState.isCountdown
              }"
              @click="gameState.isCountdown ? null : whackMole(hole.id)"
              :style="{
                width: config.cellSize + 'px',
                height: config.cellSize + 'px'
              }"
            >
              <!-- 地鼠洞 -->
              <div class="absolute inset-0 bg-gray-800 rounded-full border-4 border-gray-600 shadow-inner"></div>
              
              <!-- 地鼠 -->
              <div
                v-if="hole.hasMole && !gameState.isCountdown"
                class="absolute inset-0 flex items-center justify-center"
                :class="{
                  'animate-bounce': hole.hasMole && !hole.isHit,
                  'animate-pulse': hole.isHit
                }"
              >
                <div 
                  class="w-3/4 h-3/4 bg-amber-500 rounded-full border-4 border-amber-700 flex items-center justify-center shadow-lg"
                  :class="{
                    'bg-red-500 border-red-700': hole.isHit
                  }"
                >
                  <!-- 地鼠眼睛 -->
                  <div class="flex space-x-3">
                    <div class="w-3 h-3 bg-black rounded-full border border-white"></div>
                    <div class="w-3 h-3 bg-black rounded-full border border-white"></div>
                  </div>
                  <!-- 地鼠鼻子 -->
                  <div class="absolute bottom-2 w-2 h-2 bg-pink-400 rounded-full"></div>
                </div>
              </div>
              
              <!-- 击中效果 -->
              <div
                v-if="hole.isHit && !gameState.isCountdown"
                class="absolute inset-0 flex items-center justify-center text-2xl font-bold text-yellow-400"
              >
                +10
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏结束提示 -->
        <div v-if="gameState.gameOver" class="text-center mb-6">
          <div class="bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-green-900 mb-2">游戏结束！</h3>
            <p class="text-green-600">最终得分: {{ gameState.score }}</p>
            <p class="text-green-600">命中次数: {{ gameState.hits }}</p>
            <p class="text-green-600">命中率: {{ accuracy }}%</p>
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
              <p><strong class="text-blue-600">游戏目标：</strong>在30秒内击中尽可能多的地鼠</p>
              <p><strong class="text-blue-600">操作方式：</strong>点击出现的地鼠进行击中</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-green-600">得分规则：</strong>每击中一个地鼠+10分</p>
              <p><strong class="text-red-600">挑战：</strong>提高命中率，获得更高分数</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        经典打地鼠游戏，考验你的反应速度和手眼协调：<br><br>
        
        游戏特色：经典打地鼠玩法，随机出现的地鼠，实时得分统计<br>
        操作方式：点击出现的地鼠进行击中，30秒倒计时挑战<br>
        游戏目标：在限定时间内击中尽可能多的地鼠，获得高分<br>
        训练效果：锻炼反应速度、手眼协调能力和注意力集中<br><br>
        
        适合所有年龄段，是经典的街机游戏。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 地鼠动画 */
@keyframes molePop {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  50% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.mole-pop {
  animation: molePop 0.3s ease-out;
}

/* 击中效果动画 */
@keyframes hitEffect {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

.hit-effect {
  animation: hitEffect 0.5s ease-in-out;
}

/* 地鼠洞悬停效果 */
.hole-hover:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}
</style> 