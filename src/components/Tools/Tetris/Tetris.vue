<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "俄罗斯方块",
})

// 游戏状态
const gameState = reactive({
  isPlaying: false,
  score: 0,
  highScore: 0,
  level: 1,
  lines: 0,
  gameOver: false,
})

// 游戏配置
const config = reactive({
  boardWidth: window.innerWidth < 768 ? 10 : 12, // 移动端10列，桌面端12列
  boardHeight: window.innerWidth < 768 ? 20 : 22, // 移动端20行，桌面端22行
  cellSize: window.innerWidth < 768 ? 25 : 30,
  speed: window.innerWidth < 768 ? 800 : 600, // H5端默认慢速，PC端默认正常
})

// 游戏板
const board = ref<number[][]>([])
const currentPiece = ref<{ shape: number[][], x: number, y: number, type: string } | null>(null)
const nextPiece = ref<{ shape: number[][], x: number, y: number, type: string } | null>(null)

let gameTimer: number | null = null

// 方块形状定义
const tetrominoes = {
  I: [
    [1, 1, 1, 1]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
}

const pieceColors = {
  I: '#00f5ff',
  O: '#ffff00',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#ffa000'
}

// 初始化游戏板
const initBoard = () => {
  board.value = Array(config.boardHeight).fill(null).map(() => Array(config.boardWidth).fill(0))
}

// 生成随机方块
const generatePiece = () => {
  const types = Object.keys(tetrominoes)
  const type = types[Math.floor(Math.random() * types.length)]
  return {
    shape: tetrominoes[type as keyof typeof tetrominoes],
    type: type,
    x: Math.floor(config.boardWidth / 2) - Math.floor(tetrominoes[type as keyof typeof tetrominoes][0].length / 2),
    y: 0
  }
}

// 检查碰撞
const checkCollision = (piece: { shape: number[][], x: number, y: number }, board: number[][]) => {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardX = piece.x + x
        const boardY = piece.y + y
        
        if (boardX < 0 || boardX >= config.boardWidth || 
            boardY >= config.boardHeight || 
            (boardY >= 0 && board[boardY][boardX])) {
          return true
        }
      }
    }
  }
  return false
}

// 放置方块
const placePiece = () => {
  if (!currentPiece.value) return
    
  for (let y = 0; y < currentPiece.value.shape.length; y++) {
    for (let x = 0; x < currentPiece.value.shape[y].length; x++) {
      if (currentPiece.value.shape[y][x]) {
        const boardX = currentPiece.value.x + x
        const boardY = currentPiece.value.y + y
        
        if (boardY >= 0) {
          board.value[boardY][boardX] = 1
        }
      }
    }
  }
  
  // 检查消除行
  checkLines()
  
  // 生成新方块
  currentPiece.value = nextPiece.value
  nextPiece.value = generatePiece()
  
  // 检查游戏结束
  if (currentPiece.value && checkCollision(currentPiece.value, board.value)) {
    gameOver()
  }
}

// 检查消除行
const checkLines = () => {
  let linesCleared = 0
  
  for (let y = config.boardHeight - 1; y >= 0; y--) {
    if (board.value[y].every(cell => cell === 1)) {
      board.value.splice(y, 1)
      board.value.unshift(Array(config.boardWidth).fill(0))
      linesCleared++
      y++ // 重新检查这一行
    }
  }
  
  if (linesCleared > 0) {
    gameState.lines += linesCleared
    gameState.score += linesCleared * 100 * gameState.level
    
    // 升级
    const newLevel = Math.floor(gameState.lines / 10) + 1
    if (newLevel > gameState.level) {
      gameState.level = newLevel
      // 加快速度
      if (gameTimer) {
        clearInterval(gameTimer)
        gameTimer = setInterval(gameLoop, Math.max(100, config.speed - gameState.level * 50))
      }
    }
  }
}

// 移动方块
const movePiece = (dx: number, dy: number) => {
  if (!currentPiece.value) return false
    
  const newPiece = {
    ...currentPiece.value,
    x: currentPiece.value.x + dx,
    y: currentPiece.value.y + dy
  }
  
  if (!checkCollision(newPiece, board.value)) {
    currentPiece.value.x = newPiece.x
    currentPiece.value.y = newPiece.y
    return true
  }
  return false
}

// 旋转方块
const rotatePiece = () => {
  if (!currentPiece.value) return
    
  const rotated = currentPiece.value.shape[0].map((_, i) => 
    currentPiece.value!.shape.map(row => row[i]).reverse()
  )
  
  const newPiece = {
    ...currentPiece.value,
    shape: rotated
  }
  
  if (!checkCollision(newPiece, board.value)) {
    currentPiece.value.shape = rotated
  }
}

// 游戏主循环
const gameLoop = () => {
  if (!gameState.isPlaying || !currentPiece.value) return
  
  if (!movePiece(0, 1)) {
    placePiece()
  }
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = true
  gameState.gameOver = false
  gameState.score = 0
  gameState.level = 1
  gameState.lines = 0
  
  initBoard()
  currentPiece.value = generatePiece()
  nextPiece.value = generatePiece()
  
  // 开始计时
  gameTimer = setInterval(gameLoop, config.speed)
}

// 游戏结束
const gameOver = () => {
  gameState.isPlaying = false
  gameState.gameOver = true
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  
  // 更新最高分
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score
    localStorage.setItem('tetrisHighScore', gameState.highScore.toString())
  }
}

// 重新开始
const restartGame = () => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  startGame()
}

// 键盘控制
const handleKeydown = (event: KeyboardEvent) => {
  if (!gameState.isPlaying) return
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      movePiece(-1, 0)
      break
    case 'ArrowRight':
      event.preventDefault()
      movePiece(1, 0)
      break
    case 'ArrowDown':
      event.preventDefault()
      movePiece(0, 1)
      break
    case 'ArrowUp':
    case ' ':
      event.preventDefault()
      rotatePiece()
      break
  }
}

// 生命周期
onMounted(() => {
  // 从localStorage加载最高分
  const savedHighScore = localStorage.getItem('tetrisHighScore')
  if (savedHighScore) {
    gameState.highScore = parseInt(savedHighScore)
  }
  
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (gameTimer) {
    clearInterval(gameTimer)
  }
  window.removeEventListener('keydown', handleKeydown)
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
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">等级</h3>
            <p class="text-xl font-bold text-purple-600">{{ gameState.level }}</p>
          </div>
          <div class="text-center bg-orange-50 p-3 rounded-lg border border-orange-200">
            <h3 class="text-sm font-medium text-orange-900">消除行数</h3>
            <p class="text-xl font-bold text-orange-600">{{ gameState.lines }}</p>
          </div>
          <div class="text-center bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <h3 class="text-sm font-medium text-indigo-900">游戏板</h3>
            <p class="text-xl font-bold text-indigo-600">{{ config.boardWidth }}×{{ config.boardHeight }}</p>
          </div>
          <div class="text-center bg-red-50 p-3 rounded-lg border border-red-200">
            <h3 class="text-sm font-medium text-red-900">速度</h3>
            <p class="text-xl font-bold text-red-600">{{ config.speed }}ms</p>
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
          <div class="flex gap-8">
            <!-- 游戏板 -->
            <div class="bg-gray-100 p-4 rounded-lg shadow-lg">
              <div 
                class="border-2 border-gray-400 bg-gray-800 relative"
                :style="{
                  width: config.boardWidth * config.cellSize + 'px',
                  height: config.boardHeight * config.cellSize + 'px'
                }"
              >
                <!-- 游戏板格子 -->
                <template v-for="(row, y) in board" :key="y">
                  <template v-for="(cell, x) in row" :key="`${x}-${y}`">
                    <div
                      class="border border-gray-600 absolute"
                      :class="{
                        'bg-gray-700': cell === 0,
                        'bg-blue-500': cell === 1
                      }"
                      :style="{
                        width: config.cellSize + 'px',
                        height: config.cellSize + 'px',
                        left: x * config.cellSize + 'px',
                        top: y * config.cellSize + 'px'
                      }"
                    ></div>
                  </template>
                </template>
                
                <!-- 当前方块 -->
                <template v-if="currentPiece && gameState.isPlaying">
                  <template v-for="(row, y) in currentPiece.shape" :key="`piece-row-${y}`">
                    <template v-for="(cell, x) in row" :key="`piece-${x}-${y}`">
                      <div
                        v-if="cell"
                        class="border border-gray-600 absolute"
                        :style="{
                          width: config.cellSize + 'px',
                          height: config.cellSize + 'px',
                          backgroundColor: pieceColors[currentPiece.type as keyof typeof pieceColors],
                          left: (currentPiece.x + x) * config.cellSize + 'px',
                          top: (currentPiece.y + y) * config.cellSize + 'px'
                        }"
                      ></div>
                    </template>
                  </template>
                </template>
              </div>
            </div>

            <!-- 下一个方块预览 -->
            <div class="bg-gray-100 p-4 rounded-lg shadow-lg">
              <h3 class="text-lg font-medium text-gray-900 mb-3">下一个</h3>
              <div 
                class="border-2 border-gray-400 bg-gray-800 p-2"
                :style="{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${nextPiece?.shape[0]?.length || 4}, ${config.cellSize * 0.8}px)`,
                  gap: '1px'
                }"
              >
                <template v-if="nextPiece">
                  <div
                    v-for="cell in nextPiece.shape.flat()"
                    :key="Math.random()"
                    class="border border-gray-600"
                    :class="{
                      'bg-gray-700': !cell,
                      'bg-blue-500': cell
                    }"
                    :style="{
                      width: config.cellSize * 0.8 + 'px',
                      height: config.cellSize * 0.8 + 'px',
                      backgroundColor: cell ? pieceColors[nextPiece.type as keyof typeof pieceColors] : '#374151'
                    }"
                  ></div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏结束提示 -->
        <div v-if="gameState.gameOver" class="text-center mb-6">
          <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow-md">
            <h3 class="text-lg font-medium text-red-900 mb-2">游戏结束！</h3>
            <p class="text-red-600">最终得分: {{ gameState.score }}</p>
            <p class="text-red-600">消除行数: {{ gameState.lines }}</p>
            <p class="text-red-600">达到等级: {{ gameState.level }}</p>
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
              <p><strong class="text-blue-600">游戏目标：</strong>消除完整的横行，获得高分</p>
              <p><strong class="text-blue-600">操作方式：</strong>方向键控制移动，空格键旋转</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-green-600">得分规则：</strong>每消除一行+100分×当前等级</p>
              <p><strong class="text-red-600">升级机制：</strong>每消除10行升一级，速度加快</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        经典俄罗斯方块游戏，考验你的空间思维和反应速度：<br><br>
        
        游戏特色：经典俄罗斯方块玩法，7种不同形状的方块，实时得分统计<br>
        操作方式：方向键控制移动，空格键旋转方块，消除完整横行<br>
        游戏目标：尽可能多地消除横行，获得高分，挑战更高等级<br>
        训练效果：锻炼空间思维能力、反应速度和策略规划<br><br>
        
        适合所有年龄段，是经典的益智游戏。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 游戏板样式 */
.game-board {
  position: relative;
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
}

/* 方块动画 */
@keyframes pieceDrop {
  0% {
    transform: translateY(-10px);
    opacity: 0.8;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.piece-drop {
  animation: pieceDrop 0.2s ease-out;
}

/* 消除行动画 */
@keyframes lineClear {
  0% {
    background-color: #fbbf24;
  }
  50% {
    background-color: #f59e0b;
  }
  100% {
    background-color: #1f2937;
  }
}

.line-clear {
  animation: lineClear 0.5s ease-in-out;
}
</style> 