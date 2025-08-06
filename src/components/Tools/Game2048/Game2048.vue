<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "2048",
})

// 游戏状态
const gameState = reactive({
  isPlaying: false,
  score: 0,
  highScore: 0,
  gameOver: false,
  won: false,
  bestTile: 0,
})

// 游戏配置
const config = reactive({
  gridSize: window.innerWidth < 768 ? 4 : 4, // 统一使用4x4
  cellSize: window.innerWidth < 768 ? 60 : 80,
  cellGap: 8,
})

// 游戏板
const board = ref<number[][]>([])

// 初始化游戏板
const initBoard = () => {
  board.value = Array(config.gridSize).fill(null).map(() => Array(config.gridSize).fill(0))
}

// 在随机位置添加新数字
const addRandomTile = () => {
  const emptyCells: Array<{ row: number, col: number }> = []
  for (let i = 0; i < config.gridSize; i++) {
    for (let j = 0; j < config.gridSize; j++) {
      if (board.value[i][j] === 0) {
        emptyCells.push({ row: i, col: j })
      }
    }
  }
  
  if (emptyCells.length > 0) {
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    // 90%概率生成2，10%概率生成4
    board.value[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4
  }
}

// 检查游戏是否结束
const checkGameOver = () => {
  // 检查是否有空格
  for (let i = 0; i < config.gridSize; i++) {
    for (let j = 0; j < config.gridSize; j++) {
      if (board.value[i][j] === 0) {
        return false
      }
    }
  }
  
  // 检查是否可以合并
  for (let i = 0; i < config.gridSize; i++) {
    for (let j = 0; j < config.gridSize; j++) {
      const current = board.value[i][j]
      // 检查右边
      if (j < config.gridSize - 1 && board.value[i][j + 1] === current) {
        return false
      }
      // 检查下边
      if (i < config.gridSize - 1 && board.value[i + 1][j] === current) {
        return false
      }
    }
  }
  
  return true
}

// 检查是否获胜
const checkWin = () => {
  for (let i = 0; i < config.gridSize; i++) {
    for (let j = 0; j < config.gridSize; j++) {
      if (board.value[i][j] >= 2048) {
        return true
      }
    }
  }
  return false
}

// 更新最高分和最佳方块
const updateStats = () => {
  let maxTile = 0
  for (let i = 0; i < config.gridSize; i++) {
    for (let j = 0; j < config.gridSize; j++) {
      if (board.value[i][j] > maxTile) {
        maxTile = board.value[i][j]
      }
    }
  }
  
  gameState.bestTile = Math.max(gameState.bestTile, maxTile)
  
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score
    localStorage.setItem('game2048HighScore', gameState.highScore.toString())
  }
}

// 移动和合并逻辑
const moveLeft = () => {
  let moved = false
  for (let i = 0; i < config.gridSize; i++) {
    const row = board.value[i].filter(cell => cell !== 0)
    for (let j = 0; j < row.length - 1; j++) {
      if (row[j] === row[j + 1]) {
        row[j] *= 2
        gameState.score += row[j]
        row.splice(j + 1, 1)
      }
    }
    const newRow = row.concat(Array(config.gridSize - row.length).fill(0))
    if (JSON.stringify(board.value[i]) !== JSON.stringify(newRow)) {
      moved = true
    }
    board.value[i] = newRow
  }
  return moved
}

const moveRight = () => {
  let moved = false
  for (let i = 0; i < config.gridSize; i++) {
    const row = board.value[i].filter(cell => cell !== 0)
    for (let j = row.length - 1; j > 0; j--) {
      if (row[j] === row[j - 1]) {
        row[j] *= 2
        gameState.score += row[j]
        row.splice(j - 1, 1)
        j--
      }
    }
    const newRow = Array(config.gridSize - row.length).fill(0).concat(row)
    if (JSON.stringify(board.value[i]) !== JSON.stringify(newRow)) {
      moved = true
    }
    board.value[i] = newRow
  }
  return moved
}

const moveUp = () => {
  let moved = false
  for (let j = 0; j < config.gridSize; j++) {
    const column: number[] = []
    for (let i = 0; i < config.gridSize; i++) {
      if (board.value[i][j] !== 0) {
        column.push(board.value[i][j])
      }
    }
    for (let i = 0; i < column.length - 1; i++) {
      if (column[i] === column[i + 1]) {
        column[i] *= 2
        gameState.score += column[i]
        column.splice(i + 1, 1)
      }
    }
    const newColumn = column.concat(Array(config.gridSize - column.length).fill(0))
    for (let i = 0; i < config.gridSize; i++) {
      if (board.value[i][j] !== newColumn[i]) {
        moved = true
      }
      board.value[i][j] = newColumn[i]
    }
  }
  return moved
}

const moveDown = () => {
  let moved = false
  for (let j = 0; j < config.gridSize; j++) {
    const column: number[] = []
    for (let i = 0; i < config.gridSize; i++) {
      if (board.value[i][j] !== 0) {
        column.push(board.value[i][j])
      }
    }
    for (let i = column.length - 1; i > 0; i--) {
      if (column[i] === column[i - 1]) {
        column[i] *= 2
        gameState.score += column[i]
        column.splice(i - 1, 1)
        i--
      }
    }
    const newColumn = Array(config.gridSize - column.length).fill(0).concat(column)
    for (let i = 0; i < config.gridSize; i++) {
      if (board.value[i][j] !== newColumn[i]) {
        moved = true
      }
      board.value[i][j] = newColumn[i]
    }
  }
  return moved
}

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (!gameState.isPlaying) return
  
  let moved = false
  
  switch (event.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      event.preventDefault()
      moved = moveLeft()
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      event.preventDefault()
      moved = moveRight()
      break
    case 'ArrowUp':
    case 'w':
    case 'W':
      event.preventDefault()
      moved = moveUp()
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      event.preventDefault()
      moved = moveDown()
      break
  }
  
  if (moved) {
    addRandomTile()
    updateStats()
    
    if (checkWin() && !gameState.won) {
      gameState.won = true
    }
    
    if (checkGameOver()) {
      gameOver()
    }
  }
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = true
  gameState.gameOver = false
  gameState.won = false
  gameState.score = 0
  
  initBoard()
  addRandomTile()
  addRandomTile() // 开始时有2个数字
}

// 游戏结束
const gameOver = () => {
  gameState.isPlaying = false
  gameState.gameOver = true
  
  // 保存最高分
  localStorage.setItem('game2048HighScore', gameState.highScore.toString())
}

// 重新开始
const restartGame = () => {
  startGame()
}

// 获取方块颜色
const getTileColor = (value: number) => {
  const colors = {
    0: 'bg-gray-200',
    2: 'bg-[#EEE4DA]',
    4: 'bg-[#EDE0C8]',
    8: 'bg-[#F2B179]',
    16: 'bg-[#F59563]',
    32: 'bg-[#F67C5F]',
    64: 'bg-[#F65E3B]',
    128: 'bg-[#EDCF72]',
    256: 'bg-[#EDCC61]',
    512: 'bg-[#EDC850]',
    1024: 'bg-[#EDC53F]',
    2048: 'bg-[#EDC22E]',
  }
  return colors[value as keyof typeof colors] || 'bg-[#3C3A32]'
}

// 获取方块文字颜色
const getTileTextColor = (value: number) => {
  if (value <= 4) return 'text-[#776E65]'
  return 'text-[#F9F6F2]'
}

// 触摸控制相关变量
let touchStartX = 0
let touchStartY = 0
let touchEndX = 0
let touchEndY = 0

// 处理触摸开始
const handleTouchStart = (event: Event) => {
  if (!gameState.isPlaying) return
  
  const touch = (event as TouchEvent).touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  
  // 阻止默认行为，防止页面滚动
  event.preventDefault()
}

// 处理触摸移动
const handleTouchMove = (event: Event) => {
  if (!gameState.isPlaying) return
  
  // 阻止默认行为，防止页面滚动
  event.preventDefault()
}

// 处理触摸结束
const handleTouchEnd = (event: Event) => {
  if (!gameState.isPlaying) return
  
  const touch = (event as TouchEvent).changedTouches[0]
  touchEndX = touch.clientX
  touchEndY = touch.clientY
  
  // 阻止默认行为，防止页面滚动
  event.preventDefault()
  
  handleSwipe()
}

// 处理滑动
const handleSwipe = () => {
  const deltaX = touchEndX - touchStartX
  const deltaY = touchEndY - touchStartY
  const minSwipeDistance = 30 // 最小滑动距离
  
  let moved = false
  
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // 水平滑动
    if (Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // 向右滑动
        moved = moveRight()
      } else {
        // 向左滑动
        moved = moveLeft()
      }
    }
  } else {
    // 垂直滑动
    if (Math.abs(deltaY) > minSwipeDistance) {
      if (deltaY > 0) {
        // 向下滑动
        moved = moveDown()
      } else {
        // 向上滑动
        moved = moveUp()
      }
    }
  }
  
  if (moved) {
    addRandomTile()
    updateStats()
    
    if (checkWin() && !gameState.won) {
      gameState.won = true
    }
    
    if (checkGameOver()) {
      gameOver()
    }
  }
}

// 鼠标控制相关变量
let mouseStartX = 0
let mouseStartY = 0
let mouseEndX = 0
let mouseEndY = 0
let isMouseDown = false

// 处理鼠标按下
const handleMouseDown = (event: Event) => {
  if (!gameState.isPlaying) return
  
  isMouseDown = true
  mouseStartX = (event as MouseEvent).clientX
  mouseStartY = (event as MouseEvent).clientY
}

// 处理鼠标移动
const handleMouseMove = (event: Event) => {
  if (!gameState.isPlaying || !isMouseDown) return
  
  // 阻止默认行为
  event.preventDefault()
}

// 处理鼠标松开
const handleMouseUp = (event: Event) => {
  if (!gameState.isPlaying || !isMouseDown) return
  
  isMouseDown = false
  mouseEndX = (event as MouseEvent).clientX
  mouseEndY = (event as MouseEvent).clientY
  
  handleMouseSwipe()
}

// 处理鼠标滑动
const handleMouseSwipe = () => {
  const deltaX = mouseEndX - mouseStartX
  const deltaY = mouseEndY - mouseStartY
  const minSwipeDistance = 30 // 最小滑动距离
  
  let moved = false
  
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // 水平滑动
    if (Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // 向右滑动
        moved = moveRight()
      } else {
        // 向左滑动
        moved = moveLeft()
      }
    }
  } else {
    // 垂直滑动
    if (Math.abs(deltaY) > minSwipeDistance) {
      if (deltaY > 0) {
        // 向下滑动
        moved = moveDown()
      } else {
        // 向上滑动
        moved = moveUp()
      }
    }
  }
  
  if (moved) {
    addRandomTile()
    updateStats()
    
    if (checkWin() && !gameState.won) {
      gameState.won = true
    }
    
    if (checkGameOver()) {
      gameOver()
    }
  }
}

// 生命周期
onMounted(() => {
  // 从localStorage加载最高分
  const savedHighScore = localStorage.getItem('game2048HighScore')
  if (savedHighScore) {
    gameState.highScore = parseInt(savedHighScore)
  }
  
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)
  
  // 添加触摸事件监听
  const gameBoard = document.querySelector('.game-board')
  if (gameBoard) {
    // 触摸事件
    gameBoard.addEventListener('touchstart', handleTouchStart, { passive: false })
    gameBoard.addEventListener('touchmove', handleTouchMove, { passive: false })
    gameBoard.addEventListener('touchend', handleTouchEnd, { passive: false })
    
    // 鼠标事件
    gameBoard.addEventListener('mousedown', handleMouseDown)
    gameBoard.addEventListener('mousemove', handleMouseMove)
    gameBoard.addEventListener('mouseup', handleMouseUp)
  }
  
  // 自动开始游戏
  startGame()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  
  // 移除事件监听
  const gameBoard = document.querySelector('.game-board')
  if (gameBoard) {
    // 触摸事件
    gameBoard.removeEventListener('touchstart', handleTouchStart)
    gameBoard.removeEventListener('touchmove', handleTouchMove)
    gameBoard.removeEventListener('touchend', handleTouchEnd)
    
    // 鼠标事件
    gameBoard.removeEventListener('mousedown', handleMouseDown)
    gameBoard.removeEventListener('mousemove', handleMouseMove)
    gameBoard.removeEventListener('mouseup', handleMouseUp)
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-2xl mx-auto">
        <!-- 游戏信息 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">得分</h3>
            <p class="text-xl font-bold text-blue-600">{{ gameState.score }}</p>
          </div>
          <div class="text-center bg-green-50 p-3 rounded-lg border border-green-200">
            <h3 class="text-sm font-medium text-green-900">最高分</h3>
            <p class="text-xl font-bold text-green-600">{{ gameState.highScore }}</p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">最佳方块</h3>
            <p class="text-xl font-bold text-purple-600">{{ gameState.bestTile }}</p>
          </div>
          <div class="text-center bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <h3 class="text-sm font-medium text-indigo-900">游戏板</h3>
            <p class="text-xl font-bold text-indigo-600">{{ config.gridSize }}×{{ config.gridSize }}</p>
          </div>
        </div>

        <!-- 游戏控制 -->
        <div class="flex justify-center mb-6">
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
            class="game-board bg-gray-300 p-4 rounded-lg shadow-lg"
            :style="{
              display: 'grid',
              gridTemplateColumns: `repeat(${config.gridSize}, ${config.cellSize}px)`,
              gap: config.cellGap + 'px'
            }"
          >
            <template v-for="(row, i) in board" :key="`row-${i}`">
              <template v-for="cell in row" :key="Math.random()">
                <div
                  class="bg-gray-200 rounded-lg flex items-center justify-center font-bold transition-all duration-200"
                  :class="[
                    getTileColor(cell),
                    getTileTextColor(cell)
                  ]"
                  :style="{
                    width: config.cellSize + 'px',
                    height: config.cellSize + 'px',
                    fontSize: cell >= 1000 ? '1.5rem' : cell >= 100 ? '1.75rem' : '2rem'
                  }"
                >
                  {{ cell || '' }}
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- 获胜提示 -->
        <div v-if="gameState.won && !gameState.gameOver" class="text-center mb-6">
          <div class="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-yellow-900 mb-2">恭喜获胜！</h3>
            <p class="text-yellow-600">你已经达到了2048！可以继续游戏挑战更高分数</p>
          </div>
        </div>

        <!-- 游戏结束提示 -->
        <div v-if="gameState.gameOver" class="text-center mb-6">
          <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-red-900 mb-2">游戏结束！</h3>
            <p class="text-red-600">最终得分: {{ gameState.score }}</p>
            <p class="text-red-600">最佳方块: {{ gameState.bestTile }}</p>
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
              <p><strong class="text-blue-600">游戏目标：</strong>通过滑动合并相同数字，达到2048</p>
              <p><strong class="text-blue-600">操作方式：</strong>键盘方向键/WASD，鼠标拖拽，触摸滑动</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-green-600">合并规则：</strong>相同数字的方块相撞时会合并</p>
              <p><strong class="text-red-600">挑战：</strong>每次移动后会随机出现新的数字</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        经典2048益智游戏，考验你的策略思维和数字逻辑：<br><br>
        
        游戏特色：经典2048玩法，数字合并机制，实时得分统计<br>
        操作方式：使用方向键控制方块移动，相同数字自动合并<br>
        游戏目标：通过策略性移动，将数字合并到2048或更高<br>
        训练效果：锻炼逻辑思维、策略规划和空间布局能力<br><br>
        
        适合所有年龄段，是经典的益智游戏。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 方块动画 */
@keyframes tileAppear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.tile-appear {
  animation: tileAppear 0.2s ease-out;
}

/* 合并动画 */
@keyframes tileMerge {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.tile-merge {
  animation: tileMerge 0.3s ease-in-out;
}
</style> 