<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({ title: '点灯小游戏' })

// ---------- 基础配置 ----------
// 棋盘尺寸（响应式，可切换 5/6/7/8）
const sizeOptions = [
  { label: '5×5', value: 5 },
  { label: '6×6', value: 6 },
  { label: '7×7', value: 7 },
  { label: '8×8', value: 8 },
]

// 难度配置：随机点击次数（次数越多越难）
const difficultyOptions = [
  { label: '简单', value: 3, desc: '3 次随机点击生成' },
  { label: '普通', value: 5, desc: '5 次随机点击生成' },
  { label: '困难', value: 8, desc: '8 次随机点击生成' },
  { label: '地狱', value: 12, desc: '12 次随机点击生成' },
]

// ---------- 响应式状态 ----------
const size = ref(5)
const grid = ref<boolean[][]>([])
const moves = ref(0)
const time = ref(0)
const isPlaying = ref(false)
const won = ref(false)
const difficulty = ref(5)
const history = ref<string[]>([]) // 撤销栈，记录每次点击的坐标 "r,c"
const hintCell = ref<{ r: number; c: number } | null>(null)
// 最佳纪录按尺寸分别存储，避免互相覆盖
const bestRecordKey = computed(() => `lightsOut_bestRecord_${size.value}`)
const bestRecord = reactive<{ moves: number | null; time: number | null }>({
  moves: null,
  time: null,
})

let timer: ReturnType<typeof setInterval> | null = null

// ---------- 工具函数 ----------
// 创建空白网格（全灭）
const createEmptyGrid = (n: number): boolean[][] =>
  Array.from({ length: n }, () => Array.from({ length: n }).map(() => false))

// 拷贝网格
const cloneGrid = (g: boolean[][]) => g.map((row) => row.slice())

// 在 (r,c) 处切换一次（连带上下左右）
const toggleAt = (g: boolean[][], r: number, c: number) => {
  const dirs = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  const n = g.length
  for (const [dr, dc] of dirs) {
    const nr = r + dr
    const nc = c + dc
    if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
      g[nr][nc] = !g[nr][nc]
    }
  }
}

// 把一维索引转 (r,c)
const indexToRC = (i: number, n: number) => ({ r: Math.floor(i / n), c: i % n })

// 判断是否胜利：全灭
const isWin = (g: boolean[][]) => g.every((row) => row.every((v) => !v))

// ---------- 游戏初始化 ----------
// 通过 N 次随机点击生成开局（保证可解）
const generateByRandomClicks = (clickCount: number, n: number) => {
  const g = createEmptyGrid(n)
  const used = new Set<number>()
  while (used.size < clickCount) {
    const i = Math.floor(Math.random() * n * n)
    if (!used.has(i)) {
      used.add(i)
      const { r, c } = indexToRC(i, n)
      toggleAt(g, r, c)
    }
  }
  return g
}

// 计时
const startTimer = () => {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (isPlaying.value) time.value++
  }, 1000)
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const resetTimer = () => {
  stopTimer()
  time.value = 0
}

const startNewGame = () => {
  grid.value = generateByRandomClicks(difficulty.value, size.value)
  moves.value = 0
  history.value = []
  won.value = false
  hintCell.value = null
  isPlaying.value = true
  resetTimer()
  startTimer()
}

const giveUp = () => {
  if (!isPlaying.value) return
  stopTimer()
  isPlaying.value = false
}

// ---------- 玩家操作 ----------
const handleClick = (r: number, c: number) => {
  if (!isPlaying.value || won.value) return
  hintCell.value = null
  // 记录这次点击（撤销用）
  history.value.push(`${r},${c}`)
  const next = cloneGrid(grid.value)
  toggleAt(next, r, c)
  grid.value = next
  moves.value++
  if (isWin(grid.value)) {
    won.value = true
    isPlaying.value = false
    stopTimer()
    onWin()
  }
}

const undo = () => {
  if (!history.value.length || won.value) return
  const last = history.value.pop()!
  const [r, c] = last.split(',').map(Number)
  const next = cloneGrid(grid.value)
  // 再点击一次相当于撤销
  toggleAt(next, r, c)
  grid.value = next
  moves.value = Math.max(0, moves.value - 1)
}

// ---------- 提示 ----------
// 使用经典 Lights Out 的"光追踪"算法（light chasing）：
// 1. 枚举第一行 2^N 种点击方案
// 2. 根据第一行按下后，下面每一行的点击由上一行剩下的亮灯决定
// 3. 滚到第 N 行时，如果最后一行全灭，则该方案有解
// 4. 取解中第一步的格子作为提示
const solveFirstStep = (initial: boolean[][]): { r: number; c: number } | null => {
  const start = cloneGrid(initial)
  const N = start.length

  // 对某个第一行方案，求完整解（包含所有要按的格子）
  const tryFirstRow = (mask: number): { r: number; c: number }[] | null => {
    const g = cloneGrid(start)
    const presses: { r: number; c: number }[] = []

    // 第 0 行按 mask
    for (let c = 0; c < N; c++) {
      if ((mask >> c) & 1) {
        toggleAt(g, 0, c)
        presses.push({ r: 0, c })
      }
    }

    // 1..N-1 行：把上一行灭掉
    for (let r = 1; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (g[r - 1][c]) {
          toggleAt(g, r, c)
          presses.push({ r, c })
        }
      }
    }

    // 检查最后一行是否全灭
    if (g[N - 1].every((v) => !v)) return presses
    return null
  }

  // 在所有有解的方案里，挑按的格子最少的
  let best: { r: number; c: number }[] | null = null
  const total = 1 << N
  for (let mask = 0; mask < total; mask++) {
    const sol = tryFirstRow(mask)
    if (sol && (!best || sol.length < best.length)) {
      best = sol
    }
  }

  return best && best.length ? best[0] : null
}

const showHint = () => {
  if (!isPlaying.value || won.value) return
  const step = solveFirstStep(grid.value)
  if (step) {
    hintCell.value = step
    setTimeout(() => {
      if (hintCell.value && hintCell.value.r === step.r && hintCell.value.c === step.c) {
        hintCell.value = null
      }
    }, 2500)
  }
}

// ---------- 胜利结算 ----------
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const score = computed(() => {
  // 越快步数越少，得分越高
  if (!won.value) return 0
  const moveScore = Math.max(0, 1000 - moves.value * 20)
  const timeScore = Math.max(0, 500 - time.value * 5)
  return moveScore + timeScore
})

const isNewRecord = computed(() => won.value && (
  bestRecord.moves === null ||
  moves.value < bestRecord.moves ||
  (moves.value === bestRecord.moves && time.value < (bestRecord.time ?? Infinity))
))

const onWin = () => {
  if (
    bestRecord.moves === null ||
    moves.value < bestRecord.moves ||
    (moves.value === bestRecord.moves && time.value < (bestRecord.time ?? Infinity))
  ) {
    bestRecord.moves = moves.value
    bestRecord.time = time.value
    try {
      localStorage.setItem(bestRecordKey.value, JSON.stringify(bestRecord))
    } catch (_) {}
  }
}

const loadBestRecord = () => {
  bestRecord.moves = null
  bestRecord.time = null
  try {
    const raw = localStorage.getItem(bestRecordKey.value)
    if (raw) {
      const data = JSON.parse(raw)
      if (typeof data.moves === 'number') bestRecord.moves = data.moves
      if (typeof data.time === 'number') bestRecord.time = data.time
    }
  } catch (_) {}
}

// 切换尺寸时：重置游戏状态 + 加载对应尺寸的最佳纪录 + 刷新预览盘面
const onSizeChange = () => {
  stopTimer()
  isPlaying.value = false
  won.value = false
  moves.value = 0
  history.value = []
  hintCell.value = null
  grid.value = generateByRandomClicks(difficulty.value, size.value)
  loadBestRecord()
}

// 监听尺寸变化
watch(size, onSizeChange)

// 根据棋盘尺寸自适应单元格大小，避免大棋盘溢出
const cellSize = computed(() => {
  switch (size.value) {
    case 5: return '56px'
    case 6: return '50px'
    case 7: return '44px'
    case 8: return '40px'
    default: return '56px'
  }
})

// 初始化时给一个初始盘面让用户感受
grid.value = generateByRandomClicks(difficulty.value, size.value)
loadBestRecord()

onUnmounted(() => stopTimer())
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-2xl mx-auto">
        <!-- 信息面板 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="text-center bg-amber-50 p-3 rounded-lg border border-amber-200">
            <h3 class="text-sm font-medium text-amber-900">步数</h3>
            <p class="text-xl font-bold text-amber-600">{{ moves }}</p>
          </div>
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">用时</h3>
            <p class="text-xl font-bold text-blue-600">{{ formatTime(time) }}</p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">最佳步数</h3>
            <p class="text-xl font-bold text-purple-600">
              {{ bestRecord.moves === null ? '—' : bestRecord.moves }}
            </p>
          </div>
          <div class="text-center bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <h3 class="text-sm font-medium text-emerald-900">最佳用时</h3>
            <p class="text-xl font-bold text-emerald-600">
              {{ bestRecord.time === null ? '—' : formatTime(bestRecord.time) }}
            </p>
          </div>
        </div>

        <!-- 棋盘尺寸 + 难度选择 -->
        <div class="flex justify-center mb-5">
          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 w-full">
            <div class="flex flex-col md:flex-row md:items-center md:justify-around gap-4">
              <div>
                <h3 class="text-sm font-medium text-gray-700 mb-2 text-center">棋盘尺寸</h3>
                <div class="flex flex-wrap justify-center gap-2">
                  <el-button
                    v-for="opt in sizeOptions"
                    :key="opt.value"
                    :type="size === opt.value ? 'primary' : 'default'"
                    size="small"
                    :disabled="isPlaying && !won"
                    @click="size = opt.value"
                  >
                    {{ opt.label }}
                  </el-button>
                </div>
              </div>
              <div>
                <h3 class="text-sm font-medium text-gray-700 mb-2 text-center">难度</h3>
                <div class="flex flex-wrap justify-center gap-2">
                  <el-button
                    v-for="opt in difficultyOptions"
                    :key="opt.value"
                    :type="difficulty === opt.value ? 'primary' : 'default'"
                    size="small"
                    :disabled="isPlaying && !won"
                    @click="difficulty = opt.value"
                  >
                    {{ opt.label }}
                    <span class="text-xs opacity-70 ml-1">({{ opt.desc }})</span>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="flex flex-wrap justify-center mb-6 gap-3">
          <el-button
            v-if="!isPlaying || won"
            @click="startNewGame"
            type="primary"
            class="bg-amber-500 hover:bg-amber-600 border-amber-600"
          >
            {{ won ? '再来一局' : '开始游戏' }}
          </el-button>
          <el-button
            v-if="isPlaying && !won"
            @click="undo"
            :disabled="!history.length"
            type="info"
          >
            撤销
          </el-button>
          <el-button
            v-if="isPlaying && !won"
            @click="showHint"
            type="warning"
          >
            提示
          </el-button>
          <el-button
            v-if="isPlaying && !won"
            @click="giveUp"
            type="danger"
            plain
          >
            放弃
          </el-button>
          <el-button
            v-if="isPlaying && !won"
            @click="startNewGame"
            type="info"
            plain
          >
            重新开始
          </el-button>
        </div>

        <!-- 棋盘 -->
        <div class="flex justify-center mb-6 overflow-x-auto">
          <div
            class="lights-grid grid p-3 rounded-xl shadow-inner border-2 border-gray-800"
            :style="{
              '--cell-size': cellSize,
              gridTemplateColumns: `repeat(${size}, var(--cell-size))`,
              gap: '8px',
              background: '#0f172a',
            }"
          >
            <button
              v-for="(row, r) in grid"
              :key="r + '-row'"
              class="grid-row inline-flex"
              style="display: contents"
            >
              <div
                v-for="(on, c) in row"
                :key="`${r}-${c}`"
                class="cell"
                :class="{
                  'cell--on': on,
                  'cell--off': !on,
                  'cell--hint': hintCell && hintCell.r === r && hintCell.c === c,
                }"
                @click="handleClick(r, c)"
                :title="`(${r + 1}, ${c + 1})`"
              ></div>
            </button>
          </div>
        </div>

        <!-- 胜利 / 状态信息 -->
        <transition name="fade">
          <div v-if="won" class="mb-6">
            <div class="bg-green-50 border-2 border-green-300 rounded-lg p-4 shadow-md text-center">
              <h3 class="text-lg font-medium text-green-900 mb-2">🎉 全部熄灭！挑战成功！</h3>
              <p class="text-green-700">用时：{{ formatTime(time) }}　步数：{{ moves }}</p>
              <p class="text-green-700">得分：{{ score }}</p>
              <p v-if="isNewRecord" class="text-yellow-600 font-medium mt-2">
                🏆 新纪录！
              </p>
            </div>
          </div>
        </transition>

        <!-- 玩法说明 -->
        <div class="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 shadow-sm">
          <h3 class="text-lg font-medium text-gray-900 mb-3">玩法说明</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-amber-600">目标：</strong>把所有灯都熄灭</p>
              <p><strong class="text-amber-600">操作：</strong>点击任意一盏灯</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-blue-600">联动：</strong>点击一盏灯时，它自身和上下左右四盏灯会一起切换状态</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-purple-600">辅助：</strong>支持撤销、提示（新局生成保证有解）</p>
            </div>
            <div class="bg-white p-3 rounded border border-gray-200">
              <p><strong class="text-emerald-600">挑战：</strong>用最少的步数和最短的时间完成</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        经典点灯小游戏（Lights Out）：在一片由 {{ size }}×{{ size }} 个灯泡组成的棋盘上，点击任意一盏灯，
        它自身以及上下左右四盏邻居灯会一起切换亮灭。<br><br>
        你的目标是<strong>把所有灯都熄灭</strong>，用尽量少的步数和尽量短的时间完成挑战。<br><br>

        游戏特色：<br>
        · 支持 5×5 / 6×6 / 7×7 / 8×8 四种棋盘尺寸，难度越高推演越复杂<br>
        · 多种难度可选，难度越高初始点亮灯越多<br>
        · 实时计时与步数统计，按尺寸自动保存最佳纪录<br>
        · 一键撤销、提示算法（光追踪）快速给出可解路径<br>
        · 新生成的每个局面都保证有解，避免无解卡关<br>
        · 纯前端实现，无后端依赖，开箱即玩
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.cell {
  width: var(--cell-size, 56px);
  height: var(--cell-size, 56px);
  border-radius: 10px;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.1s ease,
    border-color 0.2s ease;
  border: 2px solid transparent;
}

.cell--off {
  background-color: #334155;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.5);
}

.cell--on {
  background-color: #fbbf24;
  background-image: radial-gradient(circle at 30% 30%, #fef3c7, #fbbf24 60%, #f59e0b);
  box-shadow:
    0 0 14px rgba(251, 191, 36, 0.85),
    0 0 28px rgba(251, 191, 36, 0.45),
    inset 0 1px 4px rgba(255, 255, 255, 0.6);
}

.cell:hover {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.4);
}

.cell:active {
  transform: scale(0.96);
}

.cell--hint {
  animation: hintPulse 0.6s ease-in-out infinite;
  border-color: #ef4444;
}

@keyframes hintPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7), 0 0 14px rgba(239, 68, 68, 0.6);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0), 0 0 22px rgba(239, 68, 68, 0.9);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配：再缩小一档，避免 8×8 在窄屏溢出 */
@media (max-width: 640px) {
  .lights-grid {
    --cell-size: 36px;
  }
}
</style>