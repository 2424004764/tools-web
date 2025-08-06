<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "扫雷",
})

// 游戏状态
const gameState = reactive({
  isPlaying: false,
  gameOver: false,
  won: false,
  time: 0,
  highScore: 0,
  minesLeft: 0,
  revealedCount: 0,
})

// 游戏配置
const config = reactive({
  width: window.innerWidth < 768 ? 7 : 16, // 移动端9x9，桌面端16x16
  height: window.innerWidth < 768 ? 7 : 16,
  mines: window.innerWidth < 768 ? 10 : 40, // 移动端10个雷，桌面端40个雷
  cellSize: window.innerWidth < 768 ? 35 : 30,
})

// 游戏板
const board = ref<Array<Array<{
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  neighborMines: number
}>>>([])

let gameTimer: number | null = null

// 初始化游戏板
const initBoard = () => {
  board.value = Array(config.height).fill(null).map(() => 
    Array(config.width).fill(null).map(() => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0
    }))
  )
}

// 随机放置地雷
const placeMines = (firstX: number, firstY: number) => {
  let minesPlaced = 0
  while (minesPlaced < config.mines) {
    const x = Math.floor(Math.random() * config.width)
    const y = Math.floor(Math.random() * config.height)
    
    // 避免在第一次点击的位置及其周围放置地雷
    if (!board.value[y][x].isMine && 
        (Math.abs(x - firstX) > 1 || Math.abs(y - firstY) > 1)) {
      board.value[y][x].isMine = true
      minesPlaced++
    }
  }
  
  // 计算每个格子周围的地雷数
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (!board.value[y][x].isMine) {
        board.value[y][x].neighborMines = countNeighborMines(x, y)
      }
    }
  }
}

// 计算周围地雷数
const countNeighborMines = (x: number, y: number) => {
  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const newY = y + dy
      const newX = x + dx
      if (newY >= 0 && newY < config.height && 
          newX >= 0 && newX < config.width &&
          board.value[newY][newX].isMine) {
        count++
      }
    }
  }
  return count
}

// 揭示格子
const revealCell = (x: number, y: number) => {
  if (board.value[y][x].isRevealed || board.value[y][x].isFlagged) {
    return
  }
  
  // 第一次点击时放置地雷
  if (gameState.revealedCount === 0) {
    placeMines(x, y)
    gameState.isPlaying = true
    startTimer()
  }
  
  board.value[y][x].isRevealed = true
  gameState.revealedCount++
  
  if (board.value[y][x].isMine) {
    // 踩到地雷，游戏结束
    gameOver()
    return
  }
  
  // 如果周围没有地雷，自动揭示周围的格子
  if (board.value[y][x].neighborMines === 0) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const newY = y + dy
        const newX = x + dx
        if (newY >= 0 && newY < config.height && 
            newX >= 0 && newX < config.width &&
            !board.value[newY][newX].isRevealed &&
            !board.value[newY][newX].isFlagged) {
          revealCell(newX, newY)
        }
      }
    }
  }
  
  // 检查是否获胜
  if (gameState.revealedCount === config.width * config.height - config.mines) {
    win()
  }
}

// 标记/取消标记格子
const toggleFlag = (x: number, y: number) => {
  if (board.value[y][x].isRevealed) {
    return
  }
  
  // 只有在未标记时才添加标记，避免重复切换
  if (!board.value[y][x].isFlagged) {
    board.value[y][x].isFlagged = true
    gameState.minesLeft--
  }
}

// 开始计时
const startTimer = () => {
  gameTimer = setInterval(() => {
    if (gameState.isPlaying) {
      gameState.time++
    }
  }, 1000)
}

// 游戏结束
const gameOver = () => {
  gameState.isPlaying = false
  gameState.gameOver = true
  
  // 显示所有地雷
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board.value[y][x].isMine) {
        board.value[y][x].isRevealed = true
      }
    }
  }
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
}

// 获胜
const win = () => {
  gameState.isPlaying = false
  gameState.won = true
  
  // 标记所有地雷
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      if (board.value[y][x].isMine) {
        board.value[y][x].isFlagged = true
      }
    }
  }
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  
  // 更新最高分
  if (gameState.time < gameState.highScore || gameState.highScore === 0) {
    gameState.highScore = gameState.time
    localStorage.setItem('minesweeperHighScore', gameState.highScore.toString())
  }
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = false
  gameState.gameOver = false
  gameState.won = false
  gameState.time = 0
  gameState.revealedCount = 0
  gameState.minesLeft = config.mines
  
  initBoard()
}

// 重新开始
const restartGame = () => {
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  startGame()
}

// 格式化时间
const formatTime = (seconds: number) => {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

// 获取格子样式
const getCellClass = (cell: any) => {
  const baseClass = 'border border-gray-400 flex items-center justify-center font-bold transition-all duration-200'
  
  if (cell.isRevealed) {
    if (cell.isMine) {
      return `${baseClass} bg-gray-200 text-gray-800` // 改为灰色背景
    }
    return `${baseClass} bg-gray-200 text-gray-800`
  }
  
  if (cell.isFlagged) {
    return `${baseClass} bg-yellow-400 text-yellow-800`
  }
  
  return `${baseClass} bg-gray-100 hover:bg-gray-200 text-gray-600`
}

// 获取格子内容（使用图片）
const getCellContent = (cell: any) => {
  if (cell.isFlagged) {
    return '🚩'
  }
  
  if (!cell.isRevealed) {
    return ''
  }
  
  if (cell.isMine) {
    return `<img src="/images/logo/mines.png" alt="地雷" class="w-4 h-4" />`
  }
  
  if (cell.neighborMines === 0) {
    return ''
  }
  
  return cell.neighborMines.toString()
}

// 获取数字颜色
const getNumberColor = (cell: any) => {
  if (!cell.isRevealed || cell.isMine) return ''
  
  const colors = {
    1: 'text-blue-600',
    2: 'text-green-600',
    3: 'text-red-600',
    4: 'text-purple-600',
    5: 'text-yellow-600',
    6: 'text-cyan-600',
    7: 'text-pink-600',
    8: 'text-gray-600'
  }
  return colors[cell.neighborMines as keyof typeof colors] || ''
}

// 触摸控制相关变量
let touchStartTime = 0
let touchTimer: number | null = null
let longPressThreshold = 500 // 长按阈值（毫秒）
let hasLongPressed = false // 标记是否已经长按过

// 处理触摸开始
const handleTouchStart = (_event: TouchEvent, x: number, y: number) => {
  if (!gameState.isPlaying || board.value[y][x].isRevealed) return
  
  touchStartTime = Date.now()
  hasLongPressed = false
  
  // 设置长按定时器，500毫秒后立即标记
  touchTimer = setTimeout(() => {
    if (!board.value[y][x].isFlagged) {
      toggleFlag(x, y)
    }
    hasLongPressed = true
  }, longPressThreshold)
}

// 处理触摸结束
const handleTouchEnd = (_event: TouchEvent, x: number, y: number) => {
  if (!gameState.isPlaying) return
  
  const touchDuration = Date.now() - touchStartTime
  
  // 清除长按定时器
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
  
  // 如果是短按且不是长按，则揭示格子
  if (touchDuration < longPressThreshold && !hasLongPressed) {
    revealCell(x, y)
  }
}

// 处理触摸移动
const handleTouchMove = (_event: TouchEvent) => {
  // 清除长按定时器，防止意外触发
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
}

// 生命周期
onMounted(() => {
  // 从localStorage加载最高分
  const savedHighScore = localStorage.getItem('minesweeperHighScore')
  if (savedHighScore) {
    gameState.highScore = parseInt(savedHighScore)
  }
  
  // 自动开始游戏
  startGame()
})

onUnmounted(() => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-4xl mx-auto">
        <!-- 游戏信息 -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">时间</h3>
            <p class="text-xl font-bold text-blue-600">{{ formatTime(gameState.time) }}</p>
          </div>
          <div class="text-center bg-green-50 p-3 rounded-lg border border-green-200">
            <h3 class="text-sm font-medium text-green-900">最高分</h3>
            <p class="text-xl font-bold text-green-600">{{ formatTime(gameState.highScore) }}</p>
          </div>
          <div class="text-center bg-red-50 p-3 rounded-lg border border-red-200">
            <h3 class="text-sm font-medium text-red-900">剩余地雷</h3>
            <p class="text-xl font-bold text-red-600">{{ gameState.minesLeft }}</p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">游戏板</h3>
            <p class="text-xl font-bold text-purple-600">{{ config.width }}×{{ config.height }}</p>
          </div>
          <div class="text-center bg-orange-50 p-3 rounded-lg border border-orange-200">
            <h3 class="text-sm font-medium text-orange-900">地雷数</h3>
            <p class="text-xl font-bold text-orange-600">{{ config.mines }}</p>
          </div>
        </div>

        <!-- 游戏控制 -->
        <div class="flex justify-center mb-6">
          <el-button 
            v-if="gameState.gameOver || gameState.won"
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
            class="bg-gray-300 p-4 rounded-lg shadow-lg"
            :style="{
              display: 'grid',
              gridTemplateColumns: `repeat(${config.width}, ${config.cellSize}px)`,
              gap: '1px'
            }"
          >
            <template v-for="(row, y) in board" :key="`row-${y}`">
              <template v-for="(cell, x) in row" :key="`${x}-${y}`">
                <div
                  class="cursor-pointer select-none"
                  :class="getCellClass(cell)"
                  :style="{
                    width: config.cellSize + 'px',
                    height: config.cellSize + 'px',
                    fontSize: config.cellSize * 0.4 + 'px'
                  }"
                  @click="revealCell(x, y)"
                  @contextmenu.prevent="toggleFlag(x, y)"
                  @touchstart="handleTouchStart($event, x, y)"
                  @touchend="handleTouchEnd($event, x, y)"
                  @touchmove="handleTouchMove($event)"
                >
                  <span :class="getNumberColor(cell)" v-html="getCellContent(cell)">
                  </span>
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- 获胜提示 -->
        <div v-if="gameState.won" class="text-center mb-6">
          <div class="bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-green-900 mb-2">恭喜获胜！</h3>
            <p class="text-green-600">用时: {{ formatTime(gameState.time) }}</p>
            <p v-if="gameState.time < gameState.highScore || gameState.highScore === 0" class="text-yellow-600 font-medium mt-2">
              新纪录！恭喜你创造了新的最快时间！
            </p>
          </div>
        </div>

        <!-- 游戏结束提示 -->
        <div v-if="gameState.gameOver" class="text-center mb-6">
          <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-red-900 mb-2">游戏结束！</h3>
            <p class="text-red-600">用时: {{ formatTime(gameState.time) }}</p>
            <p class="text-red-600">踩到地雷了，再接再厉！</p>
          </div>
        </div>

        <!-- 游戏说明 -->
        <div class="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 shadow-sm">
          <h3 class="text-lg font-medium text-gray-900 mb-3">游戏说明</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-blue-600">游戏目标：</strong>找出所有地雷，避免踩到地雷</p>
              <p><strong class="text-blue-600">操作方式：</strong></p>
              <ul class="list-disc list-inside ml-2 mt-1 space-y-1">
                <li>PC端：左键点击揭示，右键标记地雷</li>
                <li>移动端：短按揭示，长按500毫秒标记地雷</li>
              </ul>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-green-600">数字含义：</strong>数字表示周围8个格子中地雷的数量</p>
              <p><strong class="text-red-600">挑战：</strong>用最短时间找出所有地雷</p>
            </div>
          </div>
          
          <!-- 详细玩法说明 -->
          <div class="mt-4 bg-white p-4 rounded border border-gray-200">
            <h4 class="text-md font-medium text-gray-800 mb-2">详细玩法：</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p class="font-medium text-gray-700 mb-2">🎯 游戏规则：</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>游戏开始时，地雷随机分布在格子中</li>
                  <li>第一次点击永远不会踩到地雷</li>
                  <li>数字表示周围8个格子中地雷的数量</li>
                  <li>空白格子会自动揭示周围的格子</li>
                  <li>标记所有地雷或揭示所有安全格子获胜</li>
                </ul>
              </div>
              <div>
                <p class="font-medium text-gray-700 mb-2">🎮 操作技巧：</p>
                <ul class="list-disc list-inside space-y-1">
                  <li>从角落开始，更容易找到突破口</li>
                  <li>利用数字信息推理地雷位置</li>
                  <li>标记确定的地雷，避免重复点击</li>
                  <li>注意剩余地雷数量，帮助判断</li>
                  <li>遇到困难时，可以重新开始游戏</li>
                </ul>
              </div>
            </div>
            
            <div class="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
              <p class="text-sm text-yellow-800">
                <strong>💡 提示：</strong>游戏会自动记录你的最快完成时间，挑战自己的记录吧！
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        经典扫雷游戏，考验你的逻辑推理能力：<br><br>
        
        游戏特色：经典扫雷玩法，数字提示系统，实时计时统计<br>
        操作方式：左键点击揭示格子，右键标记地雷，数字表示周围地雷数<br>
        游戏目标：找出所有地雷，避免踩到地雷，挑战最快时间<br>
        训练效果：锻炼逻辑思维、推理能力和空间判断能力<br><br>
        
        适合所有年龄段，是经典的益智游戏。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 格子悬停效果 */
.cell-hover:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 揭示动画 */
@keyframes reveal {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.reveal-animation {
  animation: reveal 0.2s ease-out;
}
</style> 