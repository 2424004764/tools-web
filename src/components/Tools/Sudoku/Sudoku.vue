<script setup lang="ts">
import { reactive, ref, onMounted, computed, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { Refresh, Edit, Check } from '@element-plus/icons-vue'

const info = reactive({
  title: "数独游戏",
})

interface Cell {
  value: number
  isFixed: boolean
  isError: boolean
  notes: number[]
  row: number
  col: number
}

interface GameState {
  board: Cell[][]
  selectedCell: { row: number; col: number } | null
  difficulty: 'easy' | 'medium' | 'hard'
  time: number
  isPlaying: boolean
  isCompleted: boolean
  timer: any
  mistakes: number
  hints: number
}

const gameState = reactive<GameState>({
  board: [],
  selectedCell: null,
  difficulty: 'easy',
  time: 0,
  isPlaying: false,
  isCompleted: false,
  timer: null,
  mistakes: 0,
  hints: 0,
})

const noteMode = ref(false)

// 计算属性：确保棋盘已初始化
const board = computed(() => {
  if (!gameState.board || gameState.board.length === 0) {
    return initEmptyBoard()
  }
  return gameState.board
})

// 初始化空棋盘
const initEmptyBoard = (): Cell[][] => {
  const board: Cell[][] = []
  for (let row = 0; row < 9; row++) {
    board[row] = []
    for (let col = 0; col < 9; col++) {
      board[row][col] = {
        value: 0,
        isFixed: false,
        isError: false,
        notes: [],
        row,
        col
      }
    }
  }
  return board
}

// 生成数独谜题
const generateSudoku = (difficulty: 'easy' | 'medium' | 'hard') => {
  // 生成完整的数独解
  const solution = generateSolution()
  
  // 根据难度移除数字
  const cellsToRemove = {
    easy: 30,
    medium: 40,
    hard: 50
  }[difficulty]
  
  const puzzle = solution.map(row => row.map(cell => cell))
  
  // 随机移除数字
  const positions: number[] = []
  for (let i = 0; i < 81; i++) {
    positions.push(i)
  }
  
  for (let i = 0; i < cellsToRemove; i++) {
    const randomIndex = Math.floor(Math.random() * positions.length)
    const pos = positions.splice(randomIndex, 1)[0]
    const row = Math.floor(pos / 9)
    const col = pos % 9
    puzzle[row][col] = 0
  }
  
  return { puzzle, solution }
}

// 生成完整的数独解
const generateSolution = (): number[][] => {
  // 正确初始化二维数组
  const board: number[][] = []
  for (let i = 0; i < 9; i++) {
    board[i] = []
    for (let j = 0; j < 9; j++) {
      board[i][j] = 0
    }
  }
  
  // 填充对角线上的3个3x3宫格
  fillBox(board, 0, 0)
  fillBox(board, 3, 3)
  fillBox(board, 6, 6)
  
  // 填充剩余的数字
  solveSudoku(board)
  
  return board
}

// 填充3x3宫格
const fillBox = (board: number[][], row: number, col: number) => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const randomIndex = Math.floor(Math.random() * numbers.length)
      const num = numbers.splice(randomIndex, 1)[0]
      board[row + i][col + j] = num
    }
  }
}

// 解数独
const solveSudoku = (board: number[][]): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num
            if (solveSudoku(board)) {
              return true
            }
            board[row][col] = 0
          }
        }
        return false
      }
    }
  }
  return true
}

// 检查数字是否有效
const isValid = (board: number[][], row: number, col: number, num: number): boolean => {
  // 检查行
  for (let x = 0; x < 9; x++) {
    if (board[row][x] === num) return false
  }
  
  // 检查列
  for (let x = 0; x < 9; x++) {
    if (board[x][col] === num) return false
  }
  
  // 检查3x3宫格
  const startRow = Math.floor(row / 3) * 3
  const startCol = Math.floor(col / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num) return false
    }
  }
  
  return true
}

// 初始化游戏
const initGame = () => {
  // 先初始化空棋盘
  gameState.board = initEmptyBoard()
  
  const { puzzle } = generateSudoku(gameState.difficulty)
  
  // 填充谜题数据
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      gameState.board[row][col].value = puzzle[row][col]
      gameState.board[row][col].isFixed = puzzle[row][col] !== 0
      gameState.board[row][col].isError = false
      gameState.board[row][col].notes = []
    }
  }
  
  gameState.selectedCell = null
  gameState.time = 0
  gameState.isPlaying = false
  gameState.isCompleted = false
  gameState.mistakes = 0
  gameState.hints = 0
  
  if (gameState.timer) {
    clearInterval(gameState.timer)
    gameState.timer = null
  }
}

// 选择单元格
const selectCell = (row: number, col: number) => {
  gameState.selectedCell = { row, col }
  
  if (!gameState.isPlaying) {
    startGame()
  }
}

// 输入数字
const inputNumber = (num: number) => {
  if (!gameState.selectedCell) return
  
  const { row, col } = gameState.selectedCell
  const cell = gameState.board[row][col]
  
  if (cell.isFixed) return
  
  if (noteMode.value) {
    // 笔记模式
    const noteIndex = cell.notes.indexOf(num)
    if (noteIndex > -1) {
      cell.notes.splice(noteIndex, 1)
    } else {
      cell.notes.push(num)
      cell.notes.sort()
    }
  } else {
    // 正常输入模式
    cell.value = num
    cell.notes = []
    
    // 检查错误
    if (num !== 0) {
      const isValid = checkCellValid(row, col, num)
      cell.isError = !isValid
      
      if (!isValid) {
        gameState.mistakes++
      }
    } else {
      cell.isError = false
    }
    
    // 检查是否完成
    checkCompletion()
  }
}

// 检查单元格是否有效
const checkCellValid = (row: number, col: number, num: number): boolean => {
  // 检查行
  for (let x = 0; x < 9; x++) {
    if (x !== col && gameState.board[row][x].value === num) return false
  }
  
  // 检查列
  for (let x = 0; x < 9; x++) {
    if (x !== row && gameState.board[x][col].value === num) return false
  }
  
  // 检查3x3宫格
  const startRow = Math.floor(row / 3) * 3
  const startCol = Math.floor(col / 3) * 3
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = i + startRow
      const c = j + startCol
      if ((r !== row || c !== col) && gameState.board[r][c].value === num) return false
    }
  }
  
  return true
}

// 检查游戏是否完成
const checkCompletion = () => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (gameState.board[row][col].value === 0) return
    }
  }
  
  // 检查是否有错误
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (gameState.board[row][col].isError) return
    }
  }
  
  gameState.isCompleted = true
  gameState.isPlaying = false
  if (gameState.timer) {
    clearInterval(gameState.timer)
    gameState.timer = null
  }
}

// 开始游戏
const startGame = () => {
  gameState.isPlaying = true
  gameState.timer = setInterval(() => {
    gameState.time++
  }, 1000)
}

// 重新开始
const restartGame = () => {
  if (gameState.timer) {
    clearInterval(gameState.timer)
    gameState.timer = null
  }
  initGame()
}

// 切换难度
const changeDifficulty = () => {
  restartGame()
}

// 获取提示
const getHint = () => {
  if (!gameState.selectedCell) return
  
  const { row, col } = gameState.selectedCell
  const cell = gameState.board[row][col]
  
  if (cell.isFixed || cell.value !== 0) return
  
  // 找到第一个空单元格
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (gameState.board[r][c].value === 0) {
        // 这里应该从解决方案中获取正确答案
        // 简化版本：随机填入1-9中的一个有效数字
        for (let num = 1; num <= 9; num++) {
          if (checkCellValid(r, c, num)) {
            gameState.board[r][c].value = num
            gameState.hints++
            return
          }
        }
      }
    }
  }
}

// 格式化时间
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 计算每个数字在棋盘中的出现次数
const getNumberCount = (num: number) => {
  let count = 0
  // 确保棋盘已初始化
  if (!gameState.board || gameState.board.length === 0) {
    return 0
  }
  
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (gameState.board[row][col] && gameState.board[row][col].value === num) {
        count++
      }
    }
  }
  return count
}

// 检查数字是否已满
const isNumberFull = (num: number) => {
  return getNumberCount(num) >= 9
}

// 获取格子的背景颜色类
const getCellBackgroundClass = (row: number, col: number) => {
  if (!gameState.selectedCell) return ''
  
  const selectedRow = gameState.selectedCell.row
  const selectedCol = gameState.selectedCell.col
  
  // 选中的格子
  if (row === selectedRow && col === selectedCol) {
    return 'bg-blue-200 border-blue-600'
  }
  
  // 计算到选中格子的距离（只考虑四个方向）
  const rowDistance = Math.abs(row - selectedRow)
  const colDistance = Math.abs(col - selectedCol)
  
  // 计算3x3宫格的起始位置
  const selectedBoxRow = Math.floor(selectedRow / 3) * 3
  const selectedBoxCol = Math.floor(selectedCol / 3) * 3
  const currentBoxRow = Math.floor(row / 3) * 3
  const currentBoxCol = Math.floor(col / 3) * 3
  
  // 检查是否在同一行或同一列（十字架效果）
  const isInCross = (row === selectedRow || col === selectedCol)
  
  // 检查是否在同一个3x3宫格内
  const isInSameBox = (currentBoxRow === selectedBoxRow && currentBoxCol === selectedBoxCol)
  
  // 如果在十字架上，使用十字架颜色
  if (isInCross) {
    const distance = Math.max(rowDistance, colDistance)
    if (distance > 0) {
      return 'bg-blue-100'
    }
  }
  
  // 如果在同一个3x3宫格内（但不是十字架），使用宫格颜色
  if (isInSameBox && !isInCross) {
    return 'bg-blue-50'
  }
  
  return ''
}

// 添加键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!gameState.selectedCell) return
  
  const { row, col } = gameState.selectedCell
  const cell = gameState.board[row][col]
  
  // 如果是固定数字，不允许修改
  if (cell.isFixed) return
  
  // 数字键 1-9
  if (event.key >= '1' && event.key <= '9') {
    const num = parseInt(event.key)
    inputNumber(num)
  }
  
  // 删除键或退格键
  if (event.key === 'Delete' || event.key === 'Backspace') {
    inputNumber(0)
  }
  
  // 方向键移动选择
  if (event.key === 'ArrowUp' && row > 0) {
    gameState.selectedCell = { row: row - 1, col }
  } else if (event.key === 'ArrowDown' && row < 8) {
    gameState.selectedCell = { row: row + 1, col }
  } else if (event.key === 'ArrowLeft' && col > 0) {
    gameState.selectedCell = { row, col: col - 1 }
  } else if (event.key === 'ArrowRight' && col < 8) {
    gameState.selectedCell = { row, col: col + 1 }
  }
}

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (gameState.timer) {
    clearInterval(gameState.timer)
    gameState.timer = null
  }
  document.removeEventListener('keydown', handleKeydown)
})

onMounted(() => {
  initGame()
  // 添加键盘事件监听器
  document.addEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 游戏控制 -->
      <div class="flex flex-wrap gap-4 mb-6 items-center">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">难度：</span>
          <el-select v-model="gameState.difficulty" @change="changeDifficulty" style="width: 100px">
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
          </el-select>
        </div>
        
        <el-button type="primary" @click="restartGame" :icon="Refresh">
          重新开始
        </el-button>
        
        <el-button :type="noteMode ? 'success' : 'default'" @click="noteMode = !noteMode" :icon="Edit">
          {{ noteMode ? '笔记模式' : '输入模式' }}
        </el-button>
        
        <el-button type="warning" @click="getHint" :icon="Check" :disabled="!gameState.selectedCell">
          提示 ({{ gameState.hints }})
        </el-button>
        
        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-1">
            <span class="text-gray-600">时间：</span>
            <span class="font-bold text-green-600">{{ formatTime(gameState.time) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gray-600">错误：</span>
            <span class="font-bold text-red-600">{{ gameState.mistakes }}</span>
          </div>
        </div>
      </div>

       <!-- 数独棋盘 -->
       <div class="flex justify-center">
        <div class="grid grid-cols-9 gap-0 border-2 border-gray-800 bg-gray-800">
          <!-- 9x9 网格 -->
          <div v-for="row in 9" :key="`row-${row}`" class="contents">
            <div v-for="col in 9" :key="`cell-${row}-${col}`"
                 class="w-12 h-12 border border-gray-600 flex items-center justify-center cursor-pointer transition-colors"
                 :class="[
                   // 基础背景色
                   getCellBackgroundClass(row - 1, col - 1) || 'bg-white',
                   // 固定数字的字体加粗
                   board[row - 1][col - 1].isFixed ? 'font-bold' : '',
                   // 错误状态（只在非十字架时应用）
                   !getCellBackgroundClass(row - 1, col - 1) && board[row - 1][col - 1].isError ? 'text-red-600' : '',
                   // 3x3宫格边框（只在非十字架时应用）
                   !getCellBackgroundClass(row - 1, col - 1) ? [
                     (row - 1) % 3 === 0 ? 'border-t-2 border-t-gray-800' : '',
                     (row - 1) % 3 === 2 ? 'border-b-2 border-b-gray-800' : '',
                     (col - 1) % 3 === 0 ? 'border-l-2 border-l-gray-800' : '',
                     (col - 1) % 3 === 2 ? 'border-r-2 border-r-gray-800' : ''
                   ] : ''
                 ]"
                 @click="selectCell(row - 1, col - 1)">
              
              <!-- 数字显示 -->
              <div v-if="board[row - 1][col - 1].value !== 0" 
                   class="text-lg font-semibold">
                {{ board[row - 1][col - 1].value }}
              </div>
              
              <!-- 笔记显示 -->
              <div v-else-if="board[row - 1][col - 1].notes.length > 0" 
                   class="grid grid-cols-3 gap-0 text-xs text-gray-500">
                <div v-for="note in 9" :key="note"
                     :class="board[row - 1][col - 1].notes.includes(note) ? 'text-gray-700 font-medium' : 'text-transparent'">
                  {{ note }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 数字输入面板 -->
      <div v-if="!gameState.isCompleted" class="flex justify-center mt-6">
        <div class="flex gap-2">
          <el-button v-for="num in 9" :key="num"
                     @click="inputNumber(num)"
                     :type="gameState.selectedCell ? 'primary' : 'default'"
                     :disabled="!gameState.selectedCell || isNumberFull(num)"
                     :class="isNumberFull(num) ? 'opacity-50' : ''">
            {{ num }}
          </el-button>
          <el-button @click="inputNumber(0)" 
                     :type="gameState.selectedCell ? 'danger' : 'default'"
                     :disabled="!gameState.selectedCell">
            清除
          </el-button>
        </div>
      </div>

      <!-- 完成提示 -->
      <div v-if="gameState.isCompleted" 
           class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
        <div class="text-green-800 font-bold text-lg mb-2">🎉 恭喜完成！</div>
        <div class="text-green-600">
          用时：{{ formatTime(gameState.time) }} | 错误：{{ gameState.mistakes }} | 提示：{{ gameState.hints }}
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="游戏说明">
      <el-text>
        数独是一款经典的逻辑推理游戏，起源于瑞士，后来在日本流行并传遍世界。游戏目标是在9x9的网格中填入数字1-9，使每行、每列和每个3x3宫格都包含1-9且不重复。
        <br><br>
        <strong>游戏规则：</strong>
        <br>• 在9x9的网格中填入数字1-9
        <br>• 每行、每列、每个3x3宫格都不能有重复数字
        <br>• 灰色数字是固定的，不能修改
        <br>• 白色格子可以填入数字
        <br><br>
        <strong>操作方法：</strong>
        <br>• 点击白色格子选中要填写的单元格
        <br>• 点击数字按钮填入数字，如果是电脑端，可以按数字键1-9填入数字
        <br>• 点击"清除"按钮删除已填数字
        <br>• 笔记模式：可以记录可能的数字
        <br>• 提示功能：获得一个数字的提示
        <br><br>
        <strong>解题技巧：</strong>
        <br>• <strong>唯一候选法</strong>：某个格子只能填一个数字
        <br>• <strong>排除法</strong>：通过已知数字排除不可能的数字
        <br>• <strong>区块法</strong>：利用3x3宫格的限制条件
        <br>• <strong>X-Wing法</strong>：高级技巧，寻找特定模式
        <br>• <strong>笔记法</strong>：记录每个格子可能的数字
        <br><br>
        <strong>难度说明：</strong>
        <br>• <strong>简单</strong>：适合初学者，主要使用基础技巧
        <br>• <strong>中等</strong>：需要一些高级技巧，有一定挑战性
        <br>• <strong>困难</strong>：需要多种高级技巧，考验逻辑推理能力
        <br><br>
        <strong>游戏特色：</strong>
        <br>• 自动错误检测：实时检查填入数字的正确性
        <br>• 笔记功能：记录可能的数字组合
        <br>• 提示系统：在困难时获得帮助
        <br>• 计时统计：记录解题时间和错误次数
        <br>• 多种难度：适合不同水平的玩家
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.el-select {
  --el-select-border-color-hover: #409eff;
}

/* 自定义蓝色渐变背景 */
.bg-blue-150 {
  background-color: #dbeafe;
}

.bg-blue-75 {
  background-color: #eff6ff;
}

.bg-blue-25 {
  background-color: #f8fafc;
}
</style>
