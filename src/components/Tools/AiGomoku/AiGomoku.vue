<script setup lang="ts">
import { reactive, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

/* ========== 基本配置 ========== */
const info = reactive({ title: "AI五子棋" })

const boardSize = 15
const cellSize = 40
const boardPadding = 20

const boardStyle = {
  width: `${boardSize * cellSize + boardPadding * 2}px`,
  height: `${boardSize * cellSize + boardPadding * 2}px`
}

/* ========== 游戏状态 ========== */
const gameState = reactive({
  board: Array(boardSize).fill(null).map(() => Array(boardSize).fill(0)), // 0:空,1:黑,2:白
  currentPlayer: 1,
  gameOver: false,
  winner: 0
})

// 单独管理 aiThinking，避免命名冲突/Proxy 问题
const aiThinking = ref(false)

/* ========== AI 参数（可调） ========== */
const AI = {
  me: 2,
  maxDepth: 6,
  timeLimitPerMove: 600,
  searchRadius: 2
}

/* ========== Zobrist 哈希（置换表支持） ========== */
const zobristTable = (() => {
  const rand32 = () => (Math.floor(Math.random() * 0x100000000) >>> 0)
  const table: number[][][] = []
  for (let r = 0; r < boardSize; r++) {
    table[r] = []
    for (let c = 0; c < boardSize; c++) {
      table[r][c] = [rand32(), rand32()]
    }
  }
  return table
})()

const zobristHash = (board: number[][]) => {
  let h = 0 >>> 0
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const v = board[r][c]
      if (v === 1) h = (h ^ (zobristTable[r][c][0] >>> 0)) >>> 0
      else if (v === 2) h = (h ^ (zobristTable[r][c][1] >>> 0)) >>> 0
    }
  }
  return h >>> 0
}

type TTEntry = { depth: number, value: number }
const transposition = new Map<number, TTEntry>()

/* ========== 候选生成 ========== */
const inBounds = (r: number, c: number) => r >= 0 && r < boardSize && c >= 0 && c < boardSize

const generateCandidates = (board: number[][], radius = AI.searchRadius) => {
  const hasNeighbor = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false))
  let hasAnyPiece = false
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] !== 0) {
        hasAnyPiece = true
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const nr = r + dr, nc = c + dc
            if (inBounds(nr, nc) && board[nr][nc] === 0) hasNeighbor[nr][nc] = true
          }
        }
      }
    }
  }

  const cand: { row: number, col: number }[] = []
  if (!hasAnyPiece) {
    const mid = Math.floor(boardSize / 2)
    cand.push({ row: mid, col: mid })
    return cand
  }

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 0 && hasNeighbor[r][c]) cand.push({ row: r, col: c })
    }
  }

  return cand
}

/* ========== 评估函数 ========== */
const directions = [[1,0],[0,1],[1,1],[1,-1]]

const patternScore = (consec: number, openEnds: number) => {
  if (consec >= 5) return 100000000
  if (consec === 4 && openEnds === 2) return 10000000
  if (consec === 4 && openEnds === 1) return 1000000
  if (consec === 3 && openEnds === 2) return 100000
  if (consec === 3 && openEnds === 1) return 10000
  if (consec === 2 && openEnds === 2) return 1000
  if (consec === 2 && openEnds === 1) return 100
  return consec * 10
}

const evaluateForPlayer = (board: number[][], player: number): number => {
  let score = 0
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] !== player) continue
      for (const [dr, dc] of directions) {
        let consec = 1
        let openEnds = 0
        // forward
        for (let i = 1; i < 5; i++) {
          const nr = r + dr * i, nc = c + dc * i
          if (!inBounds(nr, nc)) break
          if (board[nr][nc] === player) consec++
          else { if (board[nr][nc] === 0) openEnds++; break }
        }
        // backward
        for (let i = 1; i < 5; i++) {
          const nr = r - dr * i, nc = c - dc * i
          if (!inBounds(nr, nc)) break
          if (board[nr][nc] === player) consec++
          else { if (board[nr][nc] === 0) openEnds++; break }
        }
        score += patternScore(consec, openEnds)
      }
    }
  }
  return score
}

const centerControl = (board: number[][]) => {
  const center = (boardSize - 1) / 2
  let s = 0
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] !== 0) {
        const dist = Math.abs(r - center) + Math.abs(c - center)
        s -= dist
      }
    }
  }
  return s
}

const evaluateBoard = (board: number[][], me: number): number => {
  const opp = me === 1 ? 2 : 1
  const myScore = evaluateForPlayer(board, me)
  const oppScore = evaluateForPlayer(board, opp)
  return myScore - oppScore * 1.1 + centerControl(board) * 20
}

/* ========== 快速检测 ========== */
const checkWinStatic = (board: number[][], row: number, col: number, player: number) => {
  for (const [dr, dc] of directions) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const nr = row + dr * i, nc = col + dc * i
      if (!inBounds(nr, nc) || board[nr][nc] !== player) break
      count++
    }
    for (let i = 1; i < 5; i++) {
      const nr = row - dr * i, nc = col - dc * i
      if (!inBounds(nr, nc) || board[nr][nc] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

const findImmediateWin = (board: number[][], player: number) => {
  const cands = generateCandidates(board)
  for (const mv of cands) {
    board[mv.row][mv.col] = player
    const win = checkWinStatic(board, mv.row, mv.col, player)
    board[mv.row][mv.col] = 0
    if (win) return mv
  }
  return null
}

/* ========== Negamax + Alpha-Beta ========== */
type BestMove = { row: number, col: number } | null

const negamax = (board: number[][], depth: number, alpha: number, beta: number, color: number, me: number, startTime: number, timeLimit: number): { value: number, move: BestMove, aborted?: boolean } => {
  if (performance.now() - startTime > timeLimit) return { value: 0, move: null, aborted: true }
  const hash = zobristHash(board)
  const tt = transposition.get(hash)
  if (tt && tt.depth >= depth) return { value: tt.value, move: null }

  const immediateWin = findImmediateWin(board, me * color)
  if (immediateWin) {
    const winVal = 100000000 + depth
    return { value: winVal, move: immediateWin }
  }
  if (depth === 0) {
    const evalv = color * evaluateBoard(board, me)
    return { value: evalv, move: null }
  }

  let bestValue = -Infinity
  let bestMove: BestMove = null

  const cands = generateCandidates(board)
  const scored = cands.map(mv => {
    board[mv.row][mv.col] = me * color
    const v = evaluateBoard(board, me)
    board[mv.row][mv.col] = 0
    return { mv, v }
  }).sort((a,b) => b.v - a.v).map(x => x.mv)

  for (const mv of scored) {
    board[mv.row][mv.col] = me * color
    const rec = negamax(board, depth - 1, -beta, -alpha, -color, me, startTime, timeLimit)
    board[mv.row][mv.col] = 0

    if (rec.aborted) return { value: 0, move: null, aborted: true }
    const val = -rec.value
    if (val > bestValue) { bestValue = val; bestMove = mv }
    alpha = Math.max(alpha, val)
    if (alpha >= beta) break
  }

  transposition.set(hash, { depth, value: bestValue })
  return { value: bestValue, move: bestMove }
}

const computeBestMove = async (board: number[][], me: number, maxDepth: number, timeLimitMs: number) => {
  const start = performance.now()
  transposition.clear()
  let bestMove: BestMove = null
  let bestVal = -Infinity
  for (let depth = 1; depth <= maxDepth; depth++) {
    const remain = timeLimitMs - (performance.now() - start)
    if (remain <= 10) break
    const res = negamax(board, depth, -Infinity, Infinity, 1, me, start, timeLimitMs)
    if (res.aborted) break
    if (res.move) { bestMove = res.move; bestVal = res.value }
    if (bestVal > 50000000) break
    await new Promise(r => setTimeout(r, 0))
  }
  return bestMove
}

/* ========== 集成到游戏流程 ========== */
const applyAIMove = (row: number, col: number) => {
  gameState.board[row][col] = AI.me
  if (checkWin(row, col, AI.me)) {
    gameState.gameOver = true
    gameState.winner = AI.me
  } else if (checkDraw()) {
    gameState.gameOver = true
    gameState.winner = 0
  } else {
    gameState.currentPlayer = 1
  }
  aiThinking.value = false
}

const makeMove = (row: number, col: number) => {
  // debug 打印，帮助确认类型和值
  // 你可以在控制台看到类型和值变化
  // console.log('before move aiThinking type:', typeof aiThinking.value, aiThinking.value)

  if (gameState.gameOver || gameState.board[row][col] !== 0 || aiThinking.value) return

  // 玩家落子
  gameState.board[row][col] = gameState.currentPlayer

  // 检查获胜/平局
  if (checkWin(row, col, gameState.currentPlayer)) {
    gameState.gameOver = true
    gameState.winner = gameState.currentPlayer
    return
  }
  if (checkDraw()) {
    gameState.gameOver = true
    gameState.winner = 0
    return
  }

  // 切换到 AI
  gameState.currentPlayer = AI.me
  aiThinking.value = false;

  (async () => {
    const cloned = gameState.board.map(r => r.slice())
    const myWin = findImmediateWin(cloned, AI.me)
    if (myWin) { applyAIMove(myWin.row, myWin.col); return }
    const block = findImmediateWin(cloned, 1)
    if (block) { applyAIMove(block.row, block.col); return }

    const best = await computeBestMove(cloned, AI.me, AI.maxDepth, AI.timeLimitPerMove)
    if (best) applyAIMove(best.row, best.col)
    else {
      const cands = generateCandidates(cloned)
      if (cands.length > 0) {
        const mv = cands[Math.floor(Math.random() * cands.length)]
        applyAIMove(mv.row, mv.col)
      } else {
        aiThinking.value = false
        gameState.currentPlayer = 1
      }
    }
  })()
}

/* ========== 你的原有辅助函数 ========== */
const checkWin = (row: number, col: number, player: number): boolean => {
  for (const [dr, dc] of directions) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const newRow = row + dr * i
      const newCol = col + dc * i
      if (newRow < 0 || newRow >= boardSize || newCol < 0 || newCol >= boardSize ||
          gameState.board[newRow][newCol] !== player) break
      count++
    }
    for (let i = 1; i < 5; i++) {
      const newRow = row - dr * i
      const newCol = col - dc * i
      if (newRow < 0 || newRow >= boardSize || newCol < 0 || newCol >= boardSize ||
          gameState.board[newRow][newCol] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

const checkDraw = (): boolean => gameState.board.every(row => row.every(cell => cell !== 0))

const resetGame = () => {
  gameState.board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(0))
  gameState.currentPlayer = 1
  gameState.gameOver = false
  gameState.winner = 0
  aiThinking.value = false
}

/* ========== UI 辅助 ========== */
const getCellClass = (row: number, col: number) => {
  const cell = gameState.board[row][col]
  if (cell === 0) return 'empty'
  if (cell === 1) return 'black'
  if (cell === 2) return 'white'
  return ''
}

const getStatusText = () => {
  if (gameState.gameOver) {
    if (gameState.winner === 0) return '游戏结束，平局！'
    if (gameState.winner === 1) return '恭喜！你赢了！'
    if (gameState.winner === 2) return 'AI赢了！再试一次吧！'
  }
  if (aiThinking.value) return 'AI正在思考...'
  if (gameState.currentPlayer === 1) return '轮到你了（黑子）'
  return '轮到AI（白子）'
}
</script>



<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex flex-col items-center">
        <!-- 游戏状态 -->
        <div class="mb-4 text-center">
          <div class="text-lg font-semibold mb-2">{{ getStatusText() }}</div>
          <button 
            @click="resetGame" 
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重新开始
          </button>
        </div>

        <!-- 棋盘 -->
        <div class="relative" :style="boardStyle">
          <!-- 棋盘背景 -->
          <div class="absolute inset-0 bg-amber-100 rounded-lg"></div>
          
          <!-- 网格线 -->
          <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${boardSize * cellSize + boardPadding * 2} ${boardSize * cellSize + boardPadding * 2}`">
            <!-- 垂直线 -->
            <line 
              v-for="i in boardSize" 
              :key="`v${i}`"
              :x1="boardPadding + (i - 1) * cellSize" 
              :y1="boardPadding" 
              :x2="boardPadding + (i - 1) * cellSize" 
              :y2="boardPadding + (boardSize - 1) * cellSize"
              stroke="#8B4513" 
              stroke-width="1"
            />
            <!-- 水平线 -->
            <line 
              v-for="i in boardSize" 
              :key="`h${i}`"
              :x1="boardPadding" 
              :y1="boardPadding + (i - 1) * cellSize" 
              :x2="boardPadding + (boardSize - 1) * cellSize" 
              :y2="boardPadding + (i - 1) * cellSize"
              stroke="#8B4513" 
              stroke-width="1"
            />
          </svg>

          <!-- 棋子 -->
          <div 
            v-for="row in boardSize" 
            :key="`row-${row-1}`"
            class="absolute"
            :style="{
              top: `${boardPadding + (row-1) * cellSize - cellSize/2}px`,
              left: `${boardPadding - cellSize/2}px`,
              width: `${boardSize * cellSize}px`,
              height: `${cellSize}px`
            }"
          >
            <div 
              v-for="col in boardSize" 
              :key="`${row-1}-${col-1}`"
              class="absolute cursor-pointer transition-all duration-200 hover:scale-110"
              :class="getCellClass(row-1, col-1)"
              :style="{
                left: `${(col-1) * cellSize}px`,
                width: `${cellSize}px`,
                height: `${cellSize}px`
              }"
              @click="makeMove(row-1, col-1)"
            ></div>
          </div>
        </div>

        <!-- 游戏说明 -->
        <div class="mt-6 text-center text-gray-600">
          <p>点击棋盘落子，与AI对战五子棋！</p>
          <p>黑子先手，先连成五子者获胜。</p>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        AI五子棋是一款智能对战游戏，玩家执黑子，AI执白子。游戏采用经典的15×15棋盘，支持鼠标点击落子，具有智能AI对手，能够进行策略性对战。游戏包含胜负判定、平局检测等功能，适合休闲娱乐和策略思维训练。
      </el-text> 
    </ToolDetail>

    <!-- AI算法说明 -->
    <ToolDetail title="AI算法原理">
      <div class="space-y-4">
        <div>
          <h4 class="font-semibold text-lg mb-2">算法架构</h4>
          <p class="text-gray-700 mb-2">我们把AI能力分成两类职责：</p>
          <ul class="list-disc list-inside space-y-1 text-gray-600">
            <li><strong>搜索（Search）</strong>：在若干可能走法中寻找最优走子 —— 用Negamax + Alpha-Beta、迭代加深、时间限制等实现</li>
            <li><strong>评估（Evaluation）</strong>：当搜索走到深度底或叶节点时，为当前局面打分 —— 用棋型识别（活四/冲四/活三/眠三……）和位置权重</li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-lg mb-2">核心算法</h4>
          <div class="space-y-3">
            <div>
              <h5 class="font-medium text-blue-600">1. Negamax算法</h5>
              <p class="text-gray-600 text-sm">Negamax是Minimax的变体，利用对称性把"最大化对我分数 = 最小化对方分数"的关系合并成统一函数，代码更简洁，易与Alpha-Beta、置换表配合。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">2. Alpha-Beta剪枝</h5>
              <p class="text-gray-600 text-sm">在Negamax上加上下界（alpha）和上界（beta），当某个分支不能影响根节点决策时就剪掉，在合理的走法排序下能把搜索树大小从O(b^d)大幅降为O(b^{d/2})。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">3. 迭代加深</h5>
              <p class="text-gray-600 text-sm">从浅到深逐层运行搜索（深度1,2,3...），每层都保存当前最佳走法。能在任何时间点都有一个可用解，配合时间限制很重要。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">4. 候选走法生成</h5>
              <p class="text-gray-600 text-sm">只考虑靠近已有棋子的空位（搜索半径=2），或在空盘只考虑中心。五子棋的合理走子大多发生在已有棋子附近，过滤孤立点能大幅降低分支因子。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">5. 立即获胜/阻挡检测</h5>
              <p class="text-gray-600 text-sm">在正式深搜前先检测"落子立刻获胜"或"必须阻挡对手的立刻获胜"，若存在直接走法就优先执行，避免浪费搜索预算。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">6. 评估函数</h5>
              <p class="text-gray-600 text-sm">识别常见棋型并赋权：五连(1e8)、活四(1e7)、冲四(1e6)、活三(1e5)、眠三(1e4)、活二(1e3)。对敌方棋型赋负分，防守权重略微放大，促使AI在对手有威胁时更偏向阻挡。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">7. 置换表 + Zobrist哈希</h5>
              <p class="text-gray-600 text-sm">为棋盘中每个位置和每种棋子分配随机数，棋局哈希是对这些随机数做XOR的结果。用哈希把已评估局面和深度/分值缓存起来，节省大量重复计算。</p>
            </div>
            
            <div>
              <h5 class="font-medium text-blue-600">8. 走法排序</h5>
              <p class="text-gray-600 text-sm">Alpha-Beta的效率极度依赖先搜索到"好走法"。把"立即获胜走法"放在最前面，先按静态评估对候选走法排序，越早找到高分走法，越多后续分支被剪掉。</p>
            </div>
          </div>
        </div>

        <div>
          <h4 class="font-semibold text-lg mb-2">工作流程</h4>
          <ol class="list-decimal list-inside space-y-1 text-gray-600">
            <li>用户落子 → 检查胜负/平局</li>
            <li>切换AI：先查找我方必胜 → 若无，再查找必堵 → 若都无，进入深搜</li>
            <li>使用迭代加深（depth = 1..maxDepth），每层调用negamax（带alpha-beta、置换表、时间检测）</li>
            <li>搜索中若超时则中断，返回当前bestMove</li>
            <li>应用走子，更新状态，UI更新</li>
          </ol>
        </div>

        <div class="bg-blue-50 p-3 rounded-lg">
          <p class="text-blue-800 text-sm">
            <strong>技术特点：</strong>搜索深度6层，时间限制600ms，搜索半径2格，支持异步计算和超时中断，确保AI既能快速响应又具备足够的策略深度。
          </p>
        </div>
      </div>
    </ToolDetail>

  </div>
</template>

<style scoped>
.empty {
  background: transparent;
  border-radius: 50%;
}

.black {
  background: radial-gradient(circle at 30% 30%, #666, #000);
  border-radius: 50%;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.white {
  background: radial-gradient(circle at 30% 30%, #fff, #ccc);
  border-radius: 50%;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
}

.empty:hover {
  background: rgba(0,0,0,0.1);
  border-radius: 50%;
}
</style>
