<script setup lang="ts">
import { reactive, ref, computed, onUnmounted, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'

const info = reactive({
  title: '24 点（算 24）',
})

// 难度选项（控制牌池范围）
const difficultyOptions = [
  { label: '简单 (1-9)', value: 'easy', min: 1, max: 9, count: 4, allowDecimal: false, desc: '全部为 1-9 的整数' },
  { label: '普通 (1-10)', value: 'normal', min: 1, max: 10, count: 4, allowDecimal: false, desc: '可能出现 10，但仍只用整数运算' },
  { label: '困难 (1-13)', value: 'hard', min: 1, max: 13, count: 4, allowDecimal: true, desc: '可能含 11/12/13，允许小数中间结果' },
]

// 当前难度
const selectedDifficulty = ref<'easy' | 'normal' | 'hard'>('easy')

// 游戏状态
const gameState = reactive({
  isStarted: false,
  cards: [] as number[],
  // 表达式构建相关
  expression: '' as string, // 显示用的表达式字符串
  tokens: [] as Array<{ type: 'num' | 'op' | 'lparen' | 'rparen'; value: string; auto?: boolean }>, // 表达式 token 列表（auto 表示自动补的 ×）
  remaining: [] as number[], // 剩余未使用的数字牌
  // 计时与积分
  startTime: 0,
  elapsed: 0,
  timer: null as number | null,
  streak: 0,
  bestStreak: 0,
  solvedCount: 0,
  failedCount: 0,
  // 求解
  hintVisible: false,
  hintExpression: '',
  feedback: '' as string,
  feedbackType: '' as '' | 'success' | 'error' | 'info',
  history: [] as Array<{
    cards: number[]
    solved: boolean
    expression: string
    time: number
  }>,
})

// 操作符按钮
const operators = ['+', '-', '×', '÷']

// 当前表达式预览值（实时计算）
const expressionValue = computed<number | null>(() => {
  if (!gameState.expression) return null
  return safeEval(gameState.expression)
})

// 当前表达式是否合法（不抛错即可）
const expressionIsValid = computed(() => {
  if (!gameState.expression) return false
  // 必须使用全部 4 张牌
  if (gameState.remaining.length !== 0) return false
  // 括号必须配平
  const lcnt = gameState.tokens.filter(t => t.type === 'lparen').length
  const rcnt = gameState.tokens.filter(t => t.type === 'rparen').length
  if (lcnt !== rcnt) return false
  const v = safeEval(gameState.expression)
  return v !== null && Number.isFinite(v)
})

// 当前选中的难度配置
const currentDifficulty = computed(() => {
  return difficultyOptions.find(o => o.value === selectedDifficulty.value)!
})

// =================== 游戏控制 ===================

const startGame = () => {
  gameState.cards = dealCards()
  gameState.tokens = []
  gameState.expression = ''
  gameState.remaining = [...gameState.cards]
  gameState.isStarted = true
  gameState.hintVisible = false
  gameState.hintExpression = ''
  gameState.feedback = ''
  gameState.feedbackType = ''
  gameState.startTime = Date.now()
  gameState.elapsed = 0
  startTimer()
}

const resetGame = () => {
  stopTimer()
  gameState.isStarted = false
  gameState.cards = []
  gameState.tokens = []
  gameState.expression = ''
  gameState.remaining = []
  gameState.hintVisible = false
  gameState.hintExpression = ''
  gameState.feedback = ''
  gameState.feedbackType = ''
}

// 发牌：保证有解（重试至多 200 次）
const dealCards = (): number[] => {
  const cfg = currentDifficulty.value
  for (let i = 0; i < 200; i++) {
    const arr: number[] = []
    for (let j = 0; j < cfg.count; j++) {
      arr.push(randomInt(cfg.min, cfg.max))
    }
    if (hasSolution24(arr, cfg.allowDecimal)) {
      return arr
    }
  }
  // 退化方案：直接返回经典可解题 3 3 8 8
  return [3, 3, 8, 8]
}

const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const startTimer = () => {
  stopTimer()
  gameState.timer = window.setInterval(() => {
    gameState.elapsed = Math.floor((Date.now() - gameState.startTime) / 1000)
  }, 250)
}

const stopTimer = () => {
  if (gameState.timer) {
    window.clearInterval(gameState.timer)
    gameState.timer = null
  }
}

onUnmounted(() => stopTimer())

// =================== 表达式构建 ===================

// 点击一张牌加入表达式（首次出现会消耗）
const addNumber = (val: number, idx: number) => {
  if (!gameState.isStarted) return
  const pos = gameState.remaining.indexOf(val, idx)
  if (pos === -1) return
  // 如果上一个 token 是数字或右括号，自动补 ×
  const last = gameState.tokens[gameState.tokens.length - 1]
  if (last && (last.type === 'num' || last.type === 'rparen')) {
    pushToken({ type: 'op', value: '×', auto: true })
  }
  pushToken({ type: 'num', value: String(val) })
  gameState.remaining.splice(pos, 1)
}

const addOperator = (op: string) => {
  if (!gameState.isStarted) return
  const last = gameState.tokens[gameState.tokens.length - 1]
  // 表达式开头不允许放二元运算符
  if (!last) return
  // 右括号后或数字后放运算符
  if (last.type === 'num' || last.type === 'rparen') {
    pushToken({ type: 'op', value: op })
  } else if (last.type === 'op') {
    // 替换最后一个运算符（保留 auto 标记）
    gameState.tokens[gameState.tokens.length - 1] = { type: 'op', value: op, auto: last.auto }
    rebuildExpression()
  }
  // lparen 后直接放运算符无效（忽略）
}

const addParen = (paren: '(' | ')') => {
  if (!gameState.isStarted) return
  const last = gameState.tokens[gameState.tokens.length - 1]
  if (paren === '(') {
    // 紧跟数字或右括号时自动补 ×
    if (last && (last.type === 'num' || last.type === 'rparen')) {
      pushToken({ type: 'op', value: '×', auto: true })
    }
    pushToken({ type: 'lparen', value: '(' })
  } else {
    // 只有在已有 ( 且当前 token 不是 op / lparen 时才允许 )
    const lcnt = gameState.tokens.filter(t => t.type === 'lparen').length
    const rcnt = gameState.tokens.filter(t => t.type === 'rparen').length
    if (lcnt <= rcnt) return
    if (!last || last.type === 'op' || last.type === 'lparen') return
    pushToken({ type: 'rparen', value: ')' })
  }
}

const pushToken = (tk: { type: 'num' | 'op' | 'lparen' | 'rparen'; value: string; auto?: boolean }) => {
  gameState.tokens.push(tk)
  rebuildExpression()
}

const rebuildExpression = () => {
  gameState.expression = gameState.tokens.map(t => t.value).join(' ')
}

// 撤销最后一步（数字回到手牌，括号/运算符直接丢弃；自动补的 × 同步撤销）
const undo = () => {
  if (!gameState.tokens.length) return
  const last = gameState.tokens.pop()!
  if (last.type === 'num') {
    // 数字回到手牌
    gameState.remaining.push(Number(last.value))
  }
  // 若上一个 token 是自动补的 ×，把它也撤掉
  while (gameState.tokens.length) {
    const prev = gameState.tokens[gameState.tokens.length - 1]
    if (prev.type === 'op' && prev.auto) {
      gameState.tokens.pop()
    } else {
      break
    }
  }
  rebuildExpression()
  gameState.feedback = ''
  gameState.feedbackType = ''
}

const clearExpression = () => {
  gameState.tokens = []
  gameState.remaining = [...gameState.cards]
  gameState.expression = ''
  gameState.feedback = ''
  gameState.feedbackType = ''
  gameState.hintVisible = false
}

// =================== 提交与求解 ===================

const submitAnswer = () => {
  if (!gameState.isStarted) return
  if (gameState.remaining.length > 0) {
    gameState.feedback = `还有 ${gameState.remaining.length} 张牌没用上，请用完所有牌`
    gameState.feedbackType = 'error'
    return
  }
  const value = safeEval(gameState.expression)
  if (value === null) {
    gameState.feedback = '表达式不合法，请检查'
    gameState.feedbackType = 'error'
    return
  }
  const close = Math.abs(value - 24) < 1e-6
  if (close) {
    gameState.feedback = `🎉 正确！${gameState.expression} = ${formatNumber(value)}`
    gameState.feedbackType = 'success'
    gameState.streak += 1
    gameState.solvedCount += 1
    gameState.bestStreak = Math.max(gameState.bestStreak, gameState.streak)
    gameState.history.unshift({
      cards: [...gameState.cards],
      solved: true,
      expression: gameState.expression,
      time: gameState.elapsed,
    })
    ElMessage.success(`答对了！当前连胜 ${gameState.streak} 局`)
    stopTimer()
  } else {
    gameState.feedback = `结果 ${formatNumber(value)}，不等于 24`
    gameState.feedbackType = 'error'
    gameState.streak = 0
    gameState.failedCount += 1
    gameState.history.unshift({
      cards: [...gameState.cards],
      solved: false,
      expression: gameState.expression,
      time: gameState.elapsed,
    })
  }
}

const skipCard = () => {
  if (!gameState.isStarted) return
  gameState.streak = 0
  gameState.failedCount += 1
  gameState.history.unshift({
    cards: [...gameState.cards],
    solved: false,
    expression: '跳过',
    time: gameState.elapsed,
  })
  ElMessage.info('已跳过本题')
  startGame()
}

const showHint = () => {
  if (!gameState.isStarted) return
  const sol = solve24(gameState.cards, currentDifficulty.value.allowDecimal)
  if (sol) {
    gameState.hintVisible = true
    gameState.hintExpression = sol
  } else {
    gameState.hintVisible = false
    ElMessage.warning('无解，但发牌时已保证有解，请检查输入')
  }
}

const nextRound = () => {
  startGame()
}

// =================== 工具：表达式求值 ===================

// 把当前显示表达式转成 JS 可执行：× * ÷ /，保留小数
const safeEval = (expr: string): number | null => {
  if (!expr) return null
  try {
    // 把 × ÷ 替换为 * /
    const cleaned = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '')
    // 安全检查：仅允许数字 + 运算符 + 括号 + 小数点
    if (!/^[\d+\-*/().\s]+$/.test(cleaned)) return null
    // 避免除以 0
    if (/\/\s*0(?!\d)/.test(cleaned)) return null
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${cleaned})`)
    const v = fn()
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    return v
  } catch {
    return null
  }
}

const formatNumber = (v: number) => {
  if (Number.isInteger(v)) return String(v)
  // 保留 4 位小数，去尾 0
  return parseFloat(v.toFixed(4)).toString()
}

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// =================== 求解器：穷举 ===================

// 24 点求解：对四个数字做全排列 + 三种括号形态 + 四种运算符
const solve24 = (nums: number[], allowDecimal: boolean): string | null => {
  const ops: Array<[string, (a: number, b: number) => number]> = [
    ['+', (a, b) => a + b],
    ['-', (a, b) => a - b],
    ['*', (a, b) => a * b],
    ['/', (a, b) => a / b],
  ]
  const permute = <T,>(arr: T[]): T[][] => {
    if (arr.length <= 1) return [arr]
    const result: T[][] = []
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1))
      for (const p of permute(rest)) result.push([arr[i], ...p])
    }
    return result
  }
  const isClose = (v: number) => Math.abs(v - 24) < 1e-6
  const apply = (a: number, b: number, op: typeof ops[number][1]) => {
    const r = op(a, b)
    if (r === null || r === undefined) return null
    if (!Number.isFinite(r)) return null
    if (!allowDecimal && !Number.isInteger(r)) return null
    return r
  }

  const displayOp = (op: string) => op === '*' ? '×' : op === '/' ? '÷' : op

  // 思路：对四个数字，递归地两两合并，直到剩一个数字
  // 用 dfs：list 里存 {expr, value}
  const dfs = (list: Array<{ expr: string; value: number }>): string | null => {
    if (list.length === 1) {
      if (isClose(list[0].value)) return list[0].expr
      return null
    }
    const n = list.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const a = list[i]
        const b = list[j]
        const rest = list.filter((_, idx) => idx !== i && idx !== j)
        for (const [sym, op] of ops) {
          const r = apply(a.value, b.value, op)
          if (r === null) continue
          const expr = `(${a.expr} ${displayOp(sym)} ${b.expr})`
          const found = dfs([...rest, { expr, value: r }])
          if (found) return found
        }
      }
    }
    return null
  }

  // 先做数字的全排列（包含同值去重）
  const uniqPerm = new Map<string, number[]>()
  for (const p of permute(nums)) {
    const key = p.join(',')
    if (!uniqPerm.has(key)) uniqPerm.set(key, p)
  }
  for (const arr of uniqPerm.values()) {
    const list = arr.map(v => ({ expr: String(v), value: v }))
    const sol = dfs(list)
    if (sol) return sol
  }
  return null
}

// 检查是否有解（用于发牌时筛选）
const hasSolution24 = (nums: number[], allowDecimal: boolean): boolean => {
  return solve24(nums, allowDecimal) !== null
}

// =================== 显示辅助 ===================

const cardColor = (n: number) => {
  if (n === 1) return 'from-pink-400 to-rose-500'
  if (n === 2) return 'from-orange-400 to-amber-500'
  if (n === 3) return 'from-yellow-400 to-orange-500'
  if (n === 4) return 'from-lime-400 to-green-500'
  if (n === 5) return 'from-emerald-400 to-teal-500'
  if (n === 6) return 'from-cyan-400 to-sky-500'
  if (n === 7) return 'from-blue-400 to-indigo-500'
  if (n === 8) return 'from-indigo-400 to-purple-500'
  if (n === 9) return 'from-purple-400 to-fuchsia-500'
  if (n === 10) return 'from-fuchsia-400 to-pink-500'
  if (n === 11) return 'from-rose-400 to-red-500'
  if (n === 12) return 'from-red-400 to-orange-500'
  return 'from-slate-400 to-slate-600' // 13
}

const feedbackClass = computed(() => {
  if (gameState.feedbackType === 'success') return 'bg-green-50 border-green-400 text-green-700'
  if (gameState.feedbackType === 'error') return 'bg-red-50 border-red-400 text-red-700'
  if (gameState.feedbackType === 'info') return 'bg-blue-50 border-blue-400 text-blue-700'
  return ''
})

watch(selectedDifficulty, () => {
  // 难度切换时若游戏已结束则不动作，否则重开局
  resetGame()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white shadow-sm">
      <!-- 顶部：标题与说明 -->
      <div class="text-center mb-5">
        <div class="text-3xl mb-1">🧮</div>
        <h2 class="text-xl font-bold text-gray-800 mb-1">24 点</h2>
        <p class="text-gray-500 text-xs">用四张牌的数字和 + - × ÷ （以及括号）算出 24</p>
      </div>

      <!-- 难度选择 / 游戏未开始 -->
      <div v-if="!gameState.isStarted" class="max-w-md mx-auto">
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5">
          <div class="text-4xl mb-3 text-center">🎴</div>
          <p class="text-gray-700 mb-4 text-center text-sm">
            选择难度开始游戏。系统会从牌池中随机发 4 张牌，<br>
            你需要用 +、-、×、÷ 和括号把结果算成 <b>24</b>。
          </p>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">难度</label>
            <div class="grid grid-cols-1 gap-2">
              <label
                v-for="opt in difficultyOptions"
                :key="opt.value"
                class="flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors"
                :class="selectedDifficulty === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'"
              >
                <input
                  type="radio"
                  :value="opt.value"
                  v-model="selectedDifficulty"
                  class="mt-1 accent-blue-500"
                />
                <div class="flex-1">
                  <div class="font-medium text-gray-800 text-sm">{{ opt.label }}</div>
                  <div class="text-xs text-gray-500">{{ opt.desc }}</div>
                </div>
              </label>
            </div>
          </div>

          <button
            @click="startGame"
            class="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-[1.02]"
          >
            开始游戏
          </button>
        </div>
      </div>

      <!-- 游戏进行中 -->
      <div v-else class="max-w-lg mx-auto">
        <!-- 状态栏 -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-gray-500">
          <span>难度：{{ currentDifficulty.label }}</span>
          <span>用时：<b class="text-gray-700">{{ formatTime(gameState.elapsed) }}</b></span>
          <span>连胜：<b class="text-orange-500">{{ gameState.streak }}</b></span>
          <span>最佳：<b class="text-purple-500">{{ gameState.bestStreak }}</b></span>
        </div>

        <!-- 四张牌 -->
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div
            v-for="(n, idx) in gameState.cards"
            :key="`${idx}-${n}`"
            class="aspect-[3/4] rounded-xl flex items-center justify-center text-3xl font-extrabold text-white shadow-md select-none transition-transform"
            :class="[
              'bg-gradient-to-br',
              cardColor(n),
              gameState.remaining.includes(n) ? 'cursor-pointer hover:scale-105' : 'opacity-30 grayscale',
            ]"
            @click="addNumber(n, gameState.remaining.indexOf(n))"
          >
            {{ n }}
          </div>
        </div>

        <!-- 表达式显示 -->
        <div class="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 mb-3 min-h-[64px] flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-xs text-gray-400 mb-1">表达式</div>
            <div class="text-2xl font-mono font-semibold text-gray-800 break-all leading-tight">
              {{ gameState.expression || '点击下方按钮构建表达式…' }}
            </div>
          </div>
          <div class="text-right min-w-[72px]">
            <div class="text-xs text-gray-400">实时值</div>
            <div
              class="text-2xl font-bold"
              :class="expressionValue !== null && Math.abs(expressionValue - 24) < 1e-6
                ? 'text-green-500'
                : 'text-gray-700'"
            >
              {{ expressionValue === null ? '—' : formatNumber(expressionValue) }}
            </div>
          </div>
        </div>

        <!-- 操作按钮：运算符 / 括号 / 功能键 -->
        <div class="mb-3">
          <div class="grid grid-cols-4 gap-2 mb-2">
            <button
              v-for="op in operators"
              :key="op"
              @click="addOperator(op)"
              class="py-2 text-lg font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-100 active:scale-95 transition"
            >
              {{ op }}
            </button>
            <button
              @click="addParen('(')"
              class="py-2 text-lg font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-100 active:scale-95 transition"
            >
              (
            </button>
            <button
              @click="addParen(')')"
              class="py-2 text-lg font-bold rounded-lg bg-white border border-gray-300 hover:bg-gray-100 active:scale-95 transition"
            >
              )
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="undo"
              class="py-2 text-sm font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 active:scale-95 transition"
            >
              ⬅ 撤销
            </button>
            <button
              @click="clearExpression"
              class="py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95 transition"
            >
              清空
            </button>
            <button
              @click="showHint"
              class="py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 active:scale-95 transition"
            >
              💡 提示
            </button>
          </div>
        </div>

        <!-- 提示答案 -->
        <div
          v-if="gameState.hintVisible"
          class="mb-3 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm"
        >
          <div class="font-medium text-purple-700 mb-1">参考解法</div>
          <div class="font-mono text-purple-900">{{ gameState.hintExpression }} = 24</div>
        </div>

        <!-- 反馈信息 -->
        <div
          v-if="gameState.feedback"
          class="mb-3 px-3 py-2 rounded-lg border text-sm font-medium"
          :class="feedbackClass"
        >
          {{ gameState.feedback }}
        </div>

        <!-- 提交 / 跳过 -->
        <div class="grid grid-cols-2 gap-2 mb-2">
          <button
            @click="submitAnswer"
            :disabled="!expressionIsValid"
            class="py-3 rounded-lg font-semibold text-white transition active:scale-95"
            :class="expressionIsValid
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              : 'bg-gray-300 cursor-not-allowed'"
          >
            ✅ 提交
          </button>
          <button
            @click="gameState.feedbackType === 'success' ? nextRound() : skipCard()"
            class="py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white active:scale-95 transition"
          >
            {{ gameState.feedbackType === 'success' ? '➡ 下一题' : '⏭ 跳过本题' }}
          </button>
        </div>

        <div class="text-center">
          <button
            @click="resetGame"
            class="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            返回难度选择
          </button>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div v-if="gameState.history.length" class="p-4 rounded-2xl bg-white shadow-sm mt-3">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">最近记录</h3>
      <div class="space-y-1">
        <div
          v-for="(h, i) in gameState.history.slice(0, 8)"
          :key="i"
          class="flex items-center justify-between text-xs px-2 py-1 rounded"
          :class="h.solved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
        >
          <span class="font-mono">[{{ h.cards.join(', ') }}]</span>
          <span class="flex-1 mx-2 truncate">{{ h.expression }}</span>
          <span>{{ formatTime(h.time) }}</span>
        </div>
      </div>
      <div class="mt-2 flex justify-between text-xs text-gray-500">
        <span>已解：{{ gameState.solvedCount }}</span>
        <span>跳过/失败：{{ gameState.failedCount }}</span>
        <span>最佳连胜：{{ gameState.bestStreak }}</span>
      </div>
    </div>

    <!-- 游戏说明 -->
    <ToolDetail title="玩法说明">
      <div class="space-y-2 text-sm text-gray-600">
        <p>• 点击四张牌中的数字加入到表达式中，每张牌只能用一次</p>
        <p>• 使用 +、-、×、÷ 四个运算符；可加括号改变运算顺序</p>
        <p>• 例如 <code class="bg-gray-100 px-1 rounded">3 × (8 - 6 ÷ 2) = 24</code></p>
        <p>• 表达式结果等于 24 即为通关；用时越短、连胜越多越厉害</p>
        <p>• 卡住了可点 💡 提示 查看参考解法（不计入连胜）</p>
        <p>• 困难模式下会出现 11-13，且允许除法产生小数中间结果</p>
        <p>• 系统保证每局至少有解，可以放心玩 🎲</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
button {
  user-select: none;
}
code {
  font-family: 'Courier New', monospace;
}
</style>