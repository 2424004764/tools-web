<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

/* ========== 基本配置 ========== */
const info = reactive({ title: "井字棋" })

/* ========== 模式与设置 ========== */
type Mode = 'ai' | 'pvp' // 人机对战 / 双人同屏
type Difficulty = 'easy' | 'medium' | 'hard'

const mode = ref<Mode>('ai')
const difficulty = ref<Difficulty>('hard')
// 人机模式下玩家执子：1 = X 先手，2 = O 后手
const playerSide = ref<1 | 2>(1)

const modeOptions: { value: Mode, label: string }[] = [
  { value: 'ai', label: '🤖 人机对战' },
  { value: 'pvp', label: '👥 双人同屏' },
]
const difficultyOptions: { value: Difficulty, label: string, desc: string }[] = [
  { value: 'easy', label: '简单', desc: 'AI 随意走，适合练手' },
  { value: 'medium', label: '中等', desc: '会抓机会也会防守' },
  { value: 'hard', label: '困难', desc: '完美求解，无法战胜' },
]
const sideOptions: { value: 1 | 2, label: string }[] = [
  { value: 1, label: '你先手（X）' },
  { value: 2, label: 'AI 先手（X）' },
]

/* ========== 游戏状态 ========== */
// 棋盘：0 空，1 = X，2 = O（下标 0-8，行优先）
const cells = ref<number[]>(Array(9).fill(0))
const currentPlayer = ref<1 | 2>(1)
const gameOver = ref(false)
const winner = ref(0) // 0 平局，1 X 胜，2 O 胜
const winLine = ref<number[] | null>(null)
const moveHistory = ref<number[]>([]) // 悔棋用
const aiThinking = ref(false)
const lastMove = ref(-1) // 最近一手，棋盘角标提示
// 对局结束时的比分入账类型，悔棋复活对局时回滚
let lastResult: 1 | 2 | 0 | null = null

/* 比分：同一设置下多局累计，调整设置即清零 */
const score = reactive({ x: 0, o: 0, draw: 0 })

/* ========== 胜负判定 ========== */
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // 竖
  [0, 4, 8], [2, 4, 6], // 斜
]

const winnerLine = (b: number[]): { p: number, line: number[] } | null => {
  for (const line of LINES) {
    const [a, c, d] = line
    if (b[a] !== 0 && b[a] === b[c] && b[a] === b[d]) return { p: b[a], line }
  }
  return null
}

// p 的「成三点」：下一手落在这里就三连（用于必胜 / 必堵）
const winPointFor = (b: number[], p: number): number => {
  for (const [a, c, d] of LINES) {
    if (b[a] === p && b[c] === p && b[d] === 0) return d
    if (b[a] === p && b[d] === p && b[c] === 0) return c
    if (b[c] === p && b[d] === p && b[a] === 0) return a
  }
  return -1
}

/* ========== AI：Minimax + α-β 剪枝（井字棋完全可解） ========== */
// 返回对 AI 的分值：胜为正、负为负，加减 depth 让 AI 偏好最快取胜、最晚认输
const minimax = (b: number[], turn: number, ai: number, depth: number, alpha: number, beta: number): number => {
  const w = winnerLine(b)
  if (w) return w.p === ai ? 10 - depth : depth - 10
  if (b.every(v => v !== 0)) return 0

  if (turn === ai) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (b[i] !== 0) continue
      b[i] = turn
      best = Math.max(best, minimax(b, 3 - turn, ai, depth + 1, alpha, beta))
      b[i] = 0
      if ((alpha = Math.max(alpha, best)) >= beta) break
    }
    return best
  }
  let best = Infinity
  for (let i = 0; i < 9; i++) {
    if (b[i] !== 0) continue
    b[i] = turn
    best = Math.min(best, minimax(b, 3 - turn, ai, depth + 1, alpha, beta))
    b[i] = 0
    if ((beta = Math.min(beta, best)) <= alpha) break
  }
  return best
}

// 最优走法：同分走法里随机挑一个，避免每局下得一模一样
const bestMove = (b: number[], ai: number): number => {
  let bestVal = -Infinity
  let pool: number[] = []
  for (let i = 0; i < 9; i++) {
    if (b[i] !== 0) continue
    b[i] = ai
    const v = minimax(b, 3 - ai, ai, 1, -Infinity, Infinity)
    b[i] = 0
    if (v > bestVal) { bestVal = v; pool = [i] }
    else if (v === bestVal) pool.push(i)
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

const randomMove = (b: number[]): number => {
  const empties: number[] = []
  for (let i = 0; i < 9; i++) if (b[i] === 0) empties.push(i)
  return empties[Math.floor(Math.random() * empties.length)]
}

// 按难度出招：
// 简单 = 偶尔抓必胜点，其余随手走
// 中等 = 必胜/必堵点全守，其余一半概率最优
// 困难 = 永远最优（完美策略，最多被逼平）
const pickAiMove = (b: number[], ai: number): number => {
  if (difficulty.value === 'hard') return bestMove(b, ai)
  const win = winPointFor(b, ai)
  const block = winPointFor(b, 3 - ai)
  if (difficulty.value === 'medium') {
    if (win >= 0) return win
    if (block >= 0) return block
    return Math.random() < 0.5 ? bestMove(b, ai) : randomMove(b)
  }
  if (win >= 0 && Math.random() < 0.3) return win
  return randomMove(b)
}

/* ========== 对局流程 ========== */
const aiSide = computed<1 | 2>(() => (playerSide.value === 1 ? 2 : 1))
let aiTimer: number | null = null
const clearAiTimer = () => {
  if (aiTimer !== null) {
    window.clearTimeout(aiTimer)
    aiTimer = null
  }
}

const place = (idx: number) => {
  cells.value[idx] = currentPlayer.value
  moveHistory.value.push(idx)
  lastMove.value = idx
}

// 结算当前局面；返回 true 表示对局已结束
const settle = (): boolean => {
  const w = winnerLine(cells.value)
  if (w) {
    gameOver.value = true
    winner.value = w.p
    winLine.value = w.line
    if (w.p === 1) score.x++
    else score.o++
    lastResult = w.p === 1 ? 1 : 2
    return true
  }
  if (cells.value.every(v => v !== 0)) {
    gameOver.value = true
    winner.value = 0
    score.draw++
    lastResult = 0
    return true
  }
  return false
}

// AI 延迟落子：留一点"思考"时间，观感更自然
const scheduleAiMove = (delay = 480) => {
  aiThinking.value = true
  aiTimer = window.setTimeout(() => {
    aiTimer = null
    const idx = pickAiMove(cells.value.slice(), aiSide.value)
    aiThinking.value = false
    if (idx < 0) return
    place(idx)
    if (settle()) return
    currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
  }, delay)
}

const canPlay = (idx: number): boolean => {
  if (gameOver.value || cells.value[idx] !== 0) return false
  if (mode.value === 'ai') {
    return !aiThinking.value && currentPlayer.value === playerSide.value
  }
  return true
}

const makeMove = (idx: number) => {
  if (!canPlay(idx)) return
  place(idx)
  if (settle()) return
  currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
  if (mode.value === 'ai') scheduleAiMove()
}

const resetGame = () => {
  clearAiTimer()
  cells.value = Array(9).fill(0)
  currentPlayer.value = 1
  gameOver.value = false
  winner.value = 0
  winLine.value = null
  moveHistory.value = []
  aiThinking.value = false
  lastMove.value = -1
  lastResult = null
  // AI 执 X 先手时，开局自动走一步
  if (mode.value === 'ai' && playerSide.value === 2) scheduleAiMove(400)
}

/* ========== 悔棋 ========== */
// 人机：撤「AI 最近一手 + 玩家上一手」，回到玩家上次落子前；若 AI 未回应则只撤玩家一手
// 双人：只撤一手。撤的是已结束的对局时，顺带回滚比分
const canUndo = computed(() => {
  if (aiThinking.value || moveHistory.value.length === 0) return false
  if (mode.value === 'pvp') return true
  // 历史里至少要有一手是玩家下的（第 i 手由 i%2===0 ? X : O 执）
  return moveHistory.value.some((_, i) => (i % 2 === 0 ? 1 : 2) === playerSide.value)
})

const popOne = () => {
  const idx = moveHistory.value.pop()
  if (idx === undefined) return
  cells.value[idx] = 0
  const rest = moveHistory.value
  lastMove.value = rest.length ? rest[rest.length - 1] : -1
}

const undoMove = () => {
  if (!canUndo.value) return
  clearAiTimer()
  aiThinking.value = false
  // 已结束的对局：先回滚比分再复活
  if (gameOver.value) {
    if (lastResult === 1) score.x--
    else if (lastResult === 2) score.o--
    else if (lastResult === 0) score.draw--
    lastResult = null
    gameOver.value = false
    winner.value = 0
    winLine.value = null
  }
  if (mode.value === 'ai') {
    const k = moveHistory.value.length
    const lastMover = (k - 1) % 2 === 0 ? 1 : 2
    if (lastMover === aiSide.value && k >= 2) {
      popOne() // AI 一手
      popOne() // 玩家一手
    } else {
      popOne() // AI 未回应，只撤玩家一手
    }
    currentPlayer.value = playerSide.value
  } else {
    popOne()
    // 回合退回被撤那一手的执子方：撤后历史长度为偶数轮到 X
    currentPlayer.value = moveHistory.value.length % 2 === 0 ? 1 : 2
  }
}

/* ========== UI 辅助 ========== */
const markOf = (p: number) => (p === 1 ? 'X' : 'O')

const ghostMark = computed<1 | 2>(() => (mode.value === 'ai' ? playerSide.value : currentPlayer.value))

const statusText = computed(() => {
  if (gameOver.value) {
    if (winner.value === 0) return '平局！棋逢对手 🤝'
    if (mode.value === 'pvp') {
      return `玩家${winner.value === 1 ? '一（X）' : '二（O）'}获胜！🎉`
    }
    return winner.value === playerSide.value ? '恭喜，你赢了！🎉' : 'AI 赢了，再来一局？'
  }
  if (aiThinking.value) return 'AI 思考中…'
  if (mode.value === 'ai') return `轮到你落子（${markOf(playerSide.value)}）`
  return `轮到玩家${currentPlayer.value === 1 ? '一' : '二'}落子（${markOf(currentPlayer.value)}）`
})

const scoreLabelX = computed(() =>
  mode.value === 'ai' ? (playerSide.value === 1 ? '你' : 'AI') : '玩家一',
)
const scoreLabelO = computed(() =>
  mode.value === 'ai' ? (playerSide.value === 2 ? '你' : 'AI') : '玩家二',
)

const isXTurn = computed(() => !gameOver.value && currentPlayer.value === 1)
const isOTurn = computed(() => !gameOver.value && currentPlayer.value === 2)

// 获胜连线：从首个胜格中心连到末个胜格中心（viewBox 300×300，每格 100）
const strike = computed(() => {
  if (!winLine.value) return null
  const pt = (i: number) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 })
  const a = pt(winLine.value[0])
  const c = pt(winLine.value[2])
  return { x1: a.x, y1: a.y, x2: c.x, y2: c.y }
})

const difficultyDesc = computed(() =>
  difficultyOptions.find(d => d.value === difficulty.value)?.desc || '',
)

// 调整模式 / 难度 / 先手 = 换一种玩法：清空比分并开新局
watch([mode, difficulty, playerSide], () => {
  score.x = 0
  score.o = 0
  score.draw = 0
  resetGame()
})

onBeforeUnmount(clearAiTimer)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex flex-col items-center">

        <!-- 模式 / 难度 / 先手 设置 -->
        <div class="w-full max-w-md space-y-3 mb-5">
          <div class="flex bg-gray-100 rounded-xl p-1">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="mode === opt.value
                ? 'bg-white text-blue-600 shadow'
                : 'text-gray-500 hover:text-gray-700'"
              @click="mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>

          <template v-if="mode === 'ai'">
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500 shrink-0 w-10">难度</span>
              <div class="flex bg-gray-100 rounded-lg p-1 flex-1">
                <button
                  v-for="opt in difficultyOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-1 py-1.5 rounded-md text-sm transition-colors"
                  :class="difficulty === opt.value
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-500 hover:text-gray-700'"
                  @click="difficulty = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500 shrink-0 w-10">先手</span>
              <div class="flex bg-gray-100 rounded-lg p-1 flex-1">
                <button
                  v-for="opt in sideOptions"
                  :key="opt.value"
                  type="button"
                  class="flex-1 py-1.5 rounded-md text-sm transition-colors"
                  :class="playerSide === opt.value
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-500 hover:text-gray-700'"
                  @click="playerSide = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <p class="text-xs text-gray-400 text-center">{{ difficultyDesc }}；调整设置会开新局并清空比分</p>
          </template>
          <p v-else class="text-xs text-gray-400 text-center">两位好友轮流用同一台电脑落子，比分自动累计</p>
        </div>

        <!-- 状态 -->
        <div class="text-lg font-semibold mb-3">{{ statusText }}</div>

        <!-- 比分 -->
        <div class="flex items-center gap-2 mb-4">
          <div
            class="min-w-[92px] px-4 py-2 rounded-xl bg-blue-50 text-center transition-shadow"
            :class="isXTurn ? 'ring-2 ring-blue-300' : ''"
          >
            <div class="text-xs text-blue-500">{{ scoreLabelX }} · X</div>
            <div class="text-xl font-bold text-blue-700">{{ score.x }}</div>
          </div>
          <div class="min-w-[72px] px-3 py-2 rounded-xl bg-gray-100 text-center">
            <div class="text-xs text-gray-500">平局</div>
            <div class="text-xl font-bold text-gray-600">{{ score.draw }}</div>
          </div>
          <div
            class="min-w-[92px] px-4 py-2 rounded-xl bg-red-50 text-center transition-shadow"
            :class="isOTurn ? 'ring-2 ring-red-300' : ''"
          >
            <div class="text-xs text-red-500">{{ scoreLabelO }} · O</div>
            <div class="text-xl font-bold text-red-700">{{ score.o }}</div>
          </div>
        </div>

        <!-- 棋盘 -->
        <div class="relative aspect-square" style="width: min(78vw, 320px)">
          <div class="grid grid-cols-3 gap-2 w-full h-full">
            <button
              v-for="(cell, i) in cells"
              :key="i"
              type="button"
              class="tictac-cell bg-gray-50 rounded-xl"
              :class="[
                winLine && winLine.includes(i) ? (winner === 1 ? 'win-x' : 'win-o') : '',
                lastMove === i ? 'last-move' : '',
              ]"
              :disabled="!canPlay(i)"
              :aria-label="`第 ${i + 1} 格`"
              @click="makeMove(i)"
            >
              <!-- 悬停预览：当前执子方的浅色虚影 -->
              <svg v-if="cell === 0 && canPlay(i)" class="mark ghost" viewBox="0 0 100 100" aria-hidden="true">
                <template v-if="ghostMark === 1">
                  <line x1="26" y1="26" x2="74" y2="74" />
                  <line x1="74" y1="26" x2="26" y2="74" />
                </template>
                <circle v-else cx="50" cy="50" r="27" />
              </svg>
              <svg v-if="cell === 1" class="mark mark-x" viewBox="0 0 100 100" aria-hidden="true">
                <line x1="26" y1="26" x2="74" y2="74" pathLength="1" />
                <line x1="74" y1="26" x2="26" y2="74" pathLength="1" />
              </svg>
              <svg v-else-if="cell === 2" class="mark mark-o" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="27" pathLength="1" />
              </svg>
            </button>
          </div>

          <!-- 获胜连线 -->
          <svg
            v-if="strike"
            class="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 300 300"
            aria-hidden="true"
          >
            <line
              class="strike-line"
              :x1="strike.x1" :y1="strike.y1" :x2="strike.x2" :y2="strike.y2"
              :stroke="winner === 1 ? '#3b82f6' : '#ef4444'"
              pathLength="1"
            />
          </svg>
        </div>

        <!-- 操作 -->
        <div class="flex items-center justify-center gap-3 mt-5">
          <button
            type="button"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            @click="resetGame"
          >
            重新开始
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            :disabled="!canUndo"
            @click="undoMove"
          >
            悔棋
          </button>
        </div>

        <!-- 游戏说明 -->
        <div class="mt-5 text-center text-gray-600 text-sm space-y-1">
          <template v-if="mode === 'ai'">
            <p>X 先手，横、竖、斜先连成三子者获胜。</p>
            <p>困难难度的 AI 是完美玩家——你最多能逼平它，想赢就选前两档。</p>
          </template>
          <template v-else>
            <p>玩家一执 X 先手，玩家二执 O，轮流点击落子。</p>
            <p>先连成三子者获胜；下满未分胜负为平局。</p>
          </template>
        </div>
      </div>
    </div>

    <!-- 玩法说明 -->
    <ToolDetail title="玩法说明">
      <el-text>
        井字棋（Tic-Tac-Toe，又叫圈叉棋、三子棋）在 3×3 棋盘上进行：双方轮流落子，X 先手，任意一方率先在横、竖或斜方向连成三子即获胜，棋盘下满仍未分出胜负则为平局。
        本工具支持两种模式：人机对战可选简单 / 中等 / 困难三档 AI 难度，也可以选择自己先手或让 AI 先手；双人同屏模式无需联网，两位好友在同一台电脑上轮流点击即可对弈，比分自动累计，随时悔棋。
      </el-text>
    </ToolDetail>

    <!-- AI 算法说明 -->
    <ToolDetail title="AI算法原理">
      <div class="space-y-4">
        <div>
          <h4 class="font-semibold text-lg mb-2">核心算法</h4>
          <div class="space-y-3">
            <div>
              <h5 class="font-medium text-blue-600">1. Minimax 完全搜索</h5>
              <p class="text-gray-600 text-sm">
                井字棋是一个「完全可解」的游戏：整局最多只有 9! = 362880 种落子序列，状态空间极小，AI 可以把每一步之后的胜负彻底算完。
                Minimax 递归模拟「我方挑最有利的、对方挑对我最不利的」交替决策，从而得到当前局面的精确胜负结论，而不只是启发式估计。
              </p>
            </div>
            <div>
              <h5 class="font-medium text-blue-600">2. Alpha-Beta 剪枝</h5>
              <p class="text-gray-600 text-sm">
                搜索时维护上下界（alpha / beta），一旦某分支的结果不可能影响根节点决策就立即剪掉，绝大多数无效分支不再展开，搜索量大幅下降，落子几乎瞬间完成。
              </p>
            </div>
            <div>
              <h5 class="font-medium text-blue-600">3. 深度加权评分</h5>
              <p class="text-gray-600 text-sm">
                胜局计 10 - depth、负局计 depth - 10：同样是赢，步数越少分越高；同样是输，撑得越久分越高。因此 AI 会主动抢最快取胜的路线，处于劣势时也会选择最顽强的抵抗。
              </p>
            </div>
            <div>
              <h5 class="font-medium text-blue-600">4. 同分随机选路</h5>
              <p class="text-gray-600 text-sm">
                多个走法评分相同时随机挑选其一，避免每一局都走出完全相同的棋谱，对局更有变化。
              </p>
            </div>
            <div>
              <h5 class="font-medium text-blue-600">5. 难度分级</h5>
              <p class="text-gray-600 text-sm">
                简单档大部分随机、偶尔抓一下成三点；中等档必胜点必抓、必堵点必堵，其余一半概率走最优；困难档永远走 Minimax 最优解。通过「战术检测 + 概率切换」在同一个引擎上实现平滑的难度梯度。
              </p>
            </div>
          </div>
        </div>

        <div class="bg-blue-50 p-3 rounded-lg">
          <p class="text-blue-800 text-sm">
            <strong>你知道吗：</strong>在双方都不失误的情况下，井字棋的最终结果必然是平局。
            困难难度的 AI 就是这样一个「完美玩家」——战胜它是不可能的，你能达到的最好成绩就是逼平它。
          </p>
        </div>

        <div class="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
          <p class="text-gray-700 text-sm">
            <strong>源码地址：</strong>
            <a
              href="https://github.com/2424004764/tools-web/blob/master/src/components/Tools/TicTacToe/TicTacToe.vue"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              GitHub - 井字棋组件源码
            </a>
            <br>
            <span class="text-gray-500 text-xs">欢迎查看完整实现，了解算法细节和代码结构</span>
          </p>
        </div>
      </div>
    </ToolDetail>

  </div>
</template>

<style scoped>
.tictac-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.tictac-cell:disabled {
  cursor: default;
}
.tictac-cell:enabled:hover {
  background-color: rgba(59, 130, 246, 0.08);
}
.tictac-cell:enabled:active {
  transform: scale(0.96);
}

/* ===== X / O 手绘描线动画（pathLength=1 归一化，dash 从 1 画到 0） ===== */
.mark {
  width: 68%;
  height: 68%;
  pointer-events: none;
}
.mark line,
.mark circle {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}
.mark-x line {
  stroke: #3b82f6;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ttt-draw 0.2s ease-out forwards;
}
.mark-x line:nth-of-type(2) {
  animation-delay: 0.16s;
}
.mark-o circle {
  stroke: #ef4444;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ttt-draw 0.32s ease-out forwards;
}
@keyframes ttt-draw {
  to { stroke-dashoffset: 0; }
}

/* 悬停虚影：默认全透明，悬停格子时淡入 */
.ghost line,
.ghost circle {
  stroke: #94a3b8;
}
.ghost {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.tictac-cell:enabled:hover .ghost {
  opacity: 0.35;
}

/* ===== 获胜格高亮 + 连线 ===== */
.win-x {
  background-color: rgba(59, 130, 246, 0.16);
}
.win-o {
  background-color: rgba(239, 68, 68, 0.14);
}
.strike-line {
  stroke-width: 12;
  stroke-linecap: round;
  opacity: 0.85;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ttt-draw 0.45s ease-out 0.15s forwards;
}

/* ===== 最近一手：右上角小灰点 ===== */
.last-move::after {
  content: '';
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(100, 116, 139, 0.45);
  pointer-events: none;
}
</style>
