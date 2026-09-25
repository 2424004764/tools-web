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

// AI 最近一手落子位置：用于棋盘标记动画，让玩家一眼看清 AI 下在哪
const lastAiMove = ref<{ row: number, col: number } | null>(null)

// 落子历史（悔棋用）：按顺序记录双方每一手
const moveHistory = ref<{ row: number, col: number, player: number }[]>([])

/* ========== AI 参数（可调） ========== */
const AI = {
  me: 2,
  maxDepth: 16,
  timeLimitPerMove: 1000,
  searchRadius: 2
}

/* ========== 引擎：常量与预计算 ========== */
const SIZE = boardSize
const CELLS = SIZE * SIZE
const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]
const WIN = 1e9

// 棋型分值：活四 > 冲四 ≈ 双活三 > 活三 > …（相对大小决定取舍）
const SC = {
  FIVE: 10_000_000,
  OPEN4: 1_000_000,
  RUSH4: 120_000,
  LIVE3: 60_000,
  SLEEP3: 800,
  LIVE2: 200,
  ONE: 5
}

// 预计算所有 ≥5 长度的线（横/竖/两向对角），以及每格所属的线
const LINES: number[][] = []
const CELL_LINES: number[][] = Array.from({ length: CELLS }, () => [])
{
  const addLine = (cells: number[]) => {
    if (cells.length >= 5) {
      const id = LINES.length
      LINES.push(cells)
      for (const x of cells) CELL_LINES[x].push(id)
    }
  }
  for (let r = 0; r < SIZE; r++) addLine(Array.from({ length: SIZE }, (_, c) => r * SIZE + c))
  for (let c = 0; c < SIZE; c++) addLine(Array.from({ length: SIZE }, (_, r) => r * SIZE + c))
  for (let s = -(SIZE - 1); s < SIZE; s++) { // ↘ 对角线 r-c=s
    const cells: number[] = []
    for (let r = 0; r < SIZE; r++) { const c = r - s; if (c >= 0 && c < SIZE) cells.push(r * SIZE + c) }
    addLine(cells)
  }
  for (let s = 0; s < 2 * SIZE - 1; s++) { // ↗ 对角线 r+c=s
    const cells: number[] = []
    for (let r = 0; r < SIZE; r++) { const c = s - r; if (c >= 0 && c < SIZE) cells.push(r * SIZE + c) }
    addLine(cells)
  }
}

// Zobrist：低 32 位 + 高 21 位合成 53 位 key，双哈希降碰撞
const zLo: number[][] = [], zHi: number[][] = []
for (let i = 0; i < CELLS; i++) {
  zLo.push([(Math.random() * 0x100000000) >>> 0, (Math.random() * 0x100000000) >>> 0])
  zHi.push([((Math.random() * 0x100000000) >>> 0) & 0x1fffff, ((Math.random() * 0x100000000) >>> 0) & 0x1fffff])
}

// 位置权重：靠中心的棋子略加分（决胜用的小权重）
const POS = new Int32Array(CELLS)
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    POS[r * SIZE + c] = (14 - Math.abs(r - 7) - Math.abs(c - 7)) * 8
  }
}

// 置换表：f=0 精确值 / 1 下界 / 2 上界，m=最佳走法（跨步保留，带容量上限）
type TTEntry = { d: number, v: number, f: number, m: number }
const TT = new Map<number, TTEntry>()

/* ========== 滑窗棋型评估 ==========
   对每条线做 5 格滑窗统计（不含对方子的窗口才有意义）：
   4 子 + 1 空 = "四点"。两个四点 = 活四级（如 .xxxx. / .xx.xx.，无法双防）；
   一个四点 = 冲四（含 xxx.x 跳四，天然覆盖）；活三/眠三/活二同理按窗口数分级。
   该方法对直/跳/多重棋型统一处理，比枚举字符串模式更准也更快。 */
const lineBuf = new Int8Array(SIZE + 2)
const scoreLineFor = (b: Int8Array, cells: number[], p: number): number => {
  const n = cells.length
  for (let i = 0; i < n; i++) {
    const v = b[cells[i]]
    lineBuf[i] = v === 0 ? 0 : v === p ? 1 : -1
  }
  let w4 = 0, w3 = 0, w2 = 0, w1 = 0
  for (let j = 0; j + 5 <= n; j++) {
    let mine = 0, emp = 0, dead = false
    for (let k = j; k < j + 5; k++) {
      const v = lineBuf[k]
      if (v === 1) mine++
      else if (v === 0) emp++
      else { dead = true; break }
    }
    if (dead) continue
    if (mine === 5) return SC.FIVE
    if (mine === 4) { if (emp === 1) w4++ }
    else if (mine === 3) { if (emp === 2) w3++ }
    else if (mine === 2) { if (emp === 3) w2++ }
    else if (mine === 1) { if (emp === 4) w1++ }
  }
  let sc = 0
  if (w4 >= 2) sc += SC.OPEN4
  else if (w4 === 1) sc += SC.RUSH4
  if (w3 >= 2) sc += SC.LIVE3
  else if (w3 === 1) sc += SC.SLEEP3
  return sc + w2 * SC.LIVE2 + w1 * SC.ONE
}

const checkWinAt = (b: Int8Array, idx: number, p: number): boolean => {
  const r = (idx / SIZE) | 0, c = idx % SIZE
  for (const [dr, dc] of DIRS) {
    let cnt = 1
    for (let k = 1; k < 5; k++) {
      const nr = r + dr * k, nc = c + dc * k
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr * SIZE + nc] !== p) break
      cnt++
    }
    for (let k = 1; k < 5; k++) {
      const nr = r - dr * k, nc = c - dc * k
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr * SIZE + nc] !== p) break
      cnt++
    }
    if (cnt >= 5) return true
  }
  return false
}

// 落子后是否形成"四"（含跳四）——用于威胁延伸搜索
const createsFour = (b: Int8Array, idx: number, p: number): boolean => {
  const r = (idx / SIZE) | 0, c = idx % SIZE
  for (const [dr, dc] of DIRS) {
    for (let off = -4; off <= 0; off++) {
      let mine = 0, emp = 0, ok = true
      for (let k = 0; k < 5; k++) {
        const nr = r + (off + k) * dr, nc = c + (off + k) * dc
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { ok = false; break }
        const v = b[nr * SIZE + nc]
        if (v === p) mine++
        else if (v === 0) emp++
        else { ok = false; break }
      }
      if (ok && (mine >= 5 || (mine === 4 && emp === 1))) return true
    }
  }
  return false
}

/* ========== 战术前置：成五点检测（我方取胜 / 对方必堵） ========== */
const winPointFor = (b: Int8Array, p: number): number => {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const idx = r * SIZE + c
      if (b[idx] !== 0) continue
      let adj = false
      search: for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          const nr = r + dr, nc = c + dc
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && b[nr * SIZE + nc] !== 0) { adj = true; break search }
        }
      }
      if (!adj) continue
      b[idx] = p
      const w = checkWinAt(b, idx, p)
      b[idx] = 0
      if (w) return idx
    }
  }
  return -1
}

// 让出主线程的 yield：setTimeout 在后台标签会被钳到 1s，MessageChannel 不受影响
const yieldFrame = () => new Promise<void>(resolve => {
  const ch = new MessageChannel()
  ch.port1.onmessage = () => resolve()
  ch.port2.postMessage(0)
})

/* ========== 主搜索引擎：Negamax + α-β + 迭代加深 + 威胁延伸 ========== */
const searchBestMove = async (board2D: number[][], me: number, maxDepth: number, timeLimitMs: number): Promise<number> => {
  const start = performance.now()
  const deadline = start + timeLimitMs
  let aborted = false
  let nodes = 0

  const b = new Int8Array(CELLS)
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) b[r * SIZE + c] = board2D[r][c]

  // 增量状态：Zobrist、双方棋型总分、位置分
  let hLo = 0, hHi = 0
  const tot = [0, 0]
  const posTot = [0, 0]
  const lineVal = new Int32Array(LINES.length * 2)
  for (let L = 0; L < LINES.length; L++) {
    const v0 = scoreLineFor(b, LINES[L], 1)
    const v1 = scoreLineFor(b, LINES[L], 2)
    lineVal[L * 2] = v0
    lineVal[L * 2 + 1] = v1
    tot[0] += v0
    tot[1] += v1
  }
  for (let i = 0; i < CELLS; i++) {
    if (b[i] === 1) { hLo ^= zLo[i][0]; hHi ^= zHi[i][0]; posTot[0] += POS[i] }
    else if (b[i] === 2) { hLo ^= zLo[i][1]; hHi ^= zHi[i][1]; posTot[1] += POS[i] }
  }

  // 邻域计数增量维护：半径 2 内有子的空点才是候选
  const R = AI.searchRadius
  const nearCnt = new Int16Array(CELLS)
  const bumpNear = (idx: number, d: number) => {
    const r = (idx / SIZE) | 0, c = idx % SIZE
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        if (!dr && !dc) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) nearCnt[nr * SIZE + nc] += d
      }
    }
  }
  for (let i = 0; i < CELLS; i++) if (b[i]) bumpNear(i, 1)

  // 落子/回退：只重算经过该点的 ≤4 条线，双方总分 O(1) 可读
  const place = (idx: number, p: number) => {
    const li = p - 1
    hLo ^= zLo[idx][li]; hHi ^= zHi[idx][li]
    const lines = CELL_LINES[idx]
    for (const L of lines) { tot[0] -= lineVal[L * 2]; tot[1] -= lineVal[L * 2 + 1] }
    b[idx] = p
    for (const L of lines) {
      const v0 = scoreLineFor(b, LINES[L], 1)
      const v1 = scoreLineFor(b, LINES[L], 2)
      lineVal[L * 2] = v0; lineVal[L * 2 + 1] = v1
      tot[0] += v0; tot[1] += v1
    }
    posTot[li] += POS[idx]
    bumpNear(idx, 1)
  }
  const unplace = (idx: number, p: number) => {
    const li = p - 1
    bumpNear(idx, -1)
    posTot[li] -= POS[idx]
    hLo ^= zLo[idx][li]; hHi ^= zHi[idx][li]
    const lines = CELL_LINES[idx]
    for (const L of lines) { tot[0] -= lineVal[L * 2]; tot[1] -= lineVal[L * 2 + 1] }
    b[idx] = 0
    for (const L of lines) {
      const v0 = scoreLineFor(b, LINES[L], 1)
      const v1 = scoreLineFor(b, LINES[L], 2)
      lineVal[L * 2] = v0; lineVal[L * 2 + 1] = v1
      tot[0] += v0; tot[1] += v1
    }
  }

  // 叶子评估：side-to-move（轮走方）威胁 ×1.4（先手价值）；
  // 若轮走方盘面已有"四"且存在成五点 → 下一手直接赢，按必胜计（静态分看不到这一层，必须显式判）
  const hasFivePoint = (p: number): boolean => {
    for (let i = 0; i < CELLS; i++) {
      if (b[i] !== 0 || nearCnt[i] === 0) continue
      b[i] = p
      const w = checkWinAt(b, i, p)
      b[i] = 0
      if (w) return true
    }
    return false
  }
  const tacticalEval = (justMoved: number, ply: number): number => {
    const mi = justMoved - 1
    const stm = 3 - justMoved
    const si = stm - 1
    if (tot[si] >= SC.RUSH4 && hasFivePoint(stm)) return -(WIN - ply - 2)
    return (tot[mi] + posTot[mi]) - (tot[si] + posTot[si]) * 1.4
  }

  // 排序启发：历史分（截断时按深度平方累积）+ 杀手走法
  const history = new Int32Array(CELLS)
  const killers = new Int32Array(64).fill(-1)

  // 攻防点评分：直连长度 + "落子即成四"强加成（覆盖 xx.xx 跳型枢纽点，防止裁剪丢关键防点）
  const quickPoint = (idx: number): number => {
    const r = (idx / SIZE) | 0, c = idx % SIZE
    let s = 0
    for (const p of [me, 3 - me]) {
      let w = 0
      b[idx] = p
      if (createsFour(b, idx, p)) w += 300000
      b[idx] = 0
      for (const [dr, dc] of DIRS) {
        let f = 0
        for (;;) {
          const nr = r + dr * (f + 1), nc = c + dc * (f + 1)
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr * SIZE + nc] !== p) break
          if (++f >= 4) break
        }
        let g = 0
        for (;;) {
          const nr = r - dr * (g + 1), nc = c - dc * (g + 1)
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || b[nr * SIZE + nc] !== p) break
          if (++g >= 4) break
        }
        const len = 1 + f + g
        w += len >= 4 ? 100000 : len === 3 ? 8000 : len === 2 ? 800 : len * 20
      }
      s += p === me ? w : w * 0.9
    }
    return s + POS[idx]
  }

  const genCands = (withScore: boolean): { i: number, s: number }[] => {
    const out: { i: number, s: number }[] = []
    for (let i = 0; i < CELLS; i++) {
      if (b[i] === 0 && nearCnt[i] > 0) out.push({ i, s: withScore ? quickPoint(i) : history[i] })
    }
    return out
  }

  const negamax = (depth: number, alpha: number, beta: number, player: number, ply: number, extLeft: number): number => {
    if ((++nodes & 255) === 0 && performance.now() > deadline) { aborted = true; return 0 }

    const key = hLo + hHi * 4294967296
    let ttMove = -1
    const e = TT.get(key)
    if (e && e.d >= depth) {
      ttMove = e.m
      if (Math.abs(e.v) < 1e8) {
        if (e.f === 0) return e.v
        if (e.f === 1 && e.v > alpha) alpha = e.v
        else if (e.f === 2 && e.v < beta) beta = e.v
        if (alpha >= beta) return e.v
      }
    }

    const cands = genCands(depth >= 3)
    if (!cands.length) return 0

    if (ttMove >= 0 && b[ttMove] === 0 && nearCnt[ttMove] > 0) {
      for (const cd of cands) if (cd.i === ttMove) { cd.s = Infinity; break }
    }
    if (ply < 64 && killers[ply] >= 0 && b[killers[ply]] === 0 && nearCnt[killers[ply]] > 0) {
      for (const cd of cands) if (cd.i === killers[ply]) { cd.s = Math.max(cd.s, 1e12); break }
    }
    cands.sort((x, y) => y.s - x.s)
    const nTry = Math.min(depth >= 4 ? 12 : 8, cands.length)

    let best = -Infinity
    let bestMove = -1
    const a0 = alpha
    for (let t = 0; t < nTry; t++) {
      const idx = cands[t].i
      place(idx, player)
      let val: number
      if (checkWinAt(b, idx, player)) {
        val = WIN - ply
      } else {
        // 威胁延伸：形成四的强制手段不降层（类 VCF），总延伸次数封顶防爆炸
        const four = createsFour(b, idx, player)
        let nd = depth - 1, ne = extLeft
        if (four && extLeft > 0) { nd = depth; ne = extLeft - 1 }
        val = nd <= 0 ? tacticalEval(player, ply + 1) : -negamax(nd, -beta, -alpha, 3 - player, ply + 1, ne)
      }
      unplace(idx, player)
      if (aborted) return 0
      if (val > best) { best = val; bestMove = idx }
      if (val > alpha) alpha = val
      if (alpha >= beta) {
        history[idx] += depth * depth
        if (ply < 64) killers[ply] = idx
        break
      }
    }

    if (!aborted && bestMove >= 0 && Math.abs(best) < 1e8) {
      if (TT.size > 300000) TT.clear()
      const f = best <= a0 ? 2 : best >= beta ? 1 : 0
      TT.set(key, { d: depth, v: best, f, m: bestMove })
    }
    return best
  }

  /* 根节点：迭代加深（浅层结果作深层排序先验，超时即用已有最佳） */
  let stoneCount = 0
  for (let i = 0; i < CELLS; i++) if (b[i]) stoneCount++
  if (stoneCount === 0) return (SIZE >> 1) * SIZE + (SIZE >> 1) // 空盘落天元

  // 根节点用精确增量收益排序：我方棋型增益 + 削减对方棋型（防守权重略高）
  const gainOf = (idx: number): number => {
    const mi = me - 1, oi = 2 - me
    const myB = tot[mi], opB = tot[oi]
    place(idx, me)
    const myA = tot[mi], opA = tot[oi]
    unplace(idx, me)
    return (myA - myB) + (opB - opA) * 1.05
  }
  const rootCands = genCands(false).map(cd => ({ i: cd.i, s: gainOf(cd.i) })).sort((x, y) => y.s - x.s).slice(0, 20)
  if (!rootCands.length) {
    for (let i = 0; i < CELLS; i++) if (b[i] === 0) return i
    return -1
  }
  if (rootCands.length === 1) return rootCands[0].i

  let bestIdx = rootCands[0].i
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (performance.now() > deadline - 20) break
    rootCands.sort((x, y) => (y.i === bestIdx ? 1e13 : y.s) - (x.i === bestIdx ? 1e13 : x.s))
    let alpha = -Infinity
    let iterBest = -1
    for (const cd of rootCands) {
      const idx = cd.i
      place(idx, me)
      let val: number
      if (checkWinAt(b, idx, me)) {
        val = WIN
      } else {
        const four = createsFour(b, idx, me)
        const nd = four ? depth : depth - 1
        const ne = four ? 2 : 3
        val = nd <= 0 ? tacticalEval(me, 1) : -negamax(nd, -Infinity, -alpha, 3 - me, 1, ne)
      }
      unplace(idx, me)
      if (aborted) break
      if (val > alpha) { alpha = val; iterBest = idx }
    }
    if (aborted) break
    if (iterBest >= 0) bestIdx = iterBest
    if (alpha > WIN - 1000) break // 已找到必胜
    await yieldFrame()
  }
  return bestIdx
}

/* ========== 集成到游戏流程 ========== */
const applyAIMove = (row: number, col: number) => {
  gameState.board[row][col] = AI.me
  moveHistory.value.push({ row, col, player: AI.me })
  lastAiMove.value = { row, col }
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
  moveHistory.value.push({ row, col, player: gameState.currentPlayer })

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
  aiThinking.value = true

  ;(async () => {
    // 先让"思考中"状态渲染出来（两轮事件循环确保 Vue 完成渲染 flush）
    await yieldFrame()
    await yieldFrame()

    // 战术前置：我方有成五点直接取胜，对方有成五点必须堵
    const probe = new Int8Array(CELLS)
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) probe[r * SIZE + c] = gameState.board[r][c]
    }
    const myWin = winPointFor(probe, AI.me)
    if (myWin >= 0) { applyAIMove((myWin / SIZE) | 0, myWin % SIZE); return }
    const oppWin = winPointFor(probe, 1)
    if (oppWin >= 0) { applyAIMove((oppWin / SIZE) | 0, oppWin % SIZE); return }

    // 主搜索
    const best = await searchBestMove(gameState.board, AI.me, AI.maxDepth, AI.timeLimitPerMove)
    if (best >= 0) {
      applyAIMove((best / SIZE) | 0, best % SIZE)
      return
    }
    // 兜底：理论上不会走到
    const anyEmpty = (() => {
      for (let i = 0; i < CELLS; i++) if (probe[i] === 0) return i
      return -1
    })()
    if (anyEmpty >= 0) applyAIMove((anyEmpty / SIZE) | 0, anyEmpty % SIZE)
    else { aiThinking.value = false; gameState.currentPlayer = 1 }
  })()
}

/* ========== 你的原有辅助函数 ========== */
const checkWin = (row: number, col: number, player: number): boolean => {
  for (const [dr, dc] of DIRS) {
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
  lastAiMove.value = null
  moveHistory.value = []
}

/* ========== 悔棋 ========== */
// 撤掉一手并从棋盘移除
const popOneMove = () => {
  const mv = moveHistory.value.pop()
  if (mv) gameState.board[mv.row][mv.col] = 0
}

const canUndo = () =>
  !aiThinking.value && moveHistory.value.some(m => m.player === 1)

// 悔一整轮：撤掉"AI 最近一手 + 玩家上一手"，回到玩家上次落子前的局面；
// 若最后一手是玩家自己（AI 未回应），只撤那一手
const undoMove = () => {
  if (aiThinking.value || !moveHistory.value.length) return
  const last = moveHistory.value[moveHistory.value.length - 1]
  if (last.player === AI.me) {
    popOneMove() // AI 一手
    popOneMove() // 玩家一手
  } else {
    popOneMove() // 玩家自己的一手
  }
  // 复活对局并交回合给玩家
  gameState.gameOver = false
  gameState.winner = 0
  gameState.currentPlayer = 1
  aiThinking.value = false
  // 重建 AI 落子标记：指向剩余历史中最后一手白棋
  const lastAi = [...moveHistory.value].reverse().find(m => m.player === AI.me)
  lastAiMove.value = lastAi ? { row: lastAi.row, col: lastAi.col } : null
}

/* ========== UI 辅助 ========== */
const getCellClass = (row: number, col: number) => {
  const cell = gameState.board[row][col]
  if (cell === 0) return 'empty'
  if (cell === 1) return 'black'
  if (cell === 2) return 'white'
  return ''
}

// 是否为 AI 最近一手（棋盘标记）
const isLastAiMove = (row: number, col: number) =>
  !!lastAiMove.value && lastAiMove.value.row === row && lastAiMove.value.col === col

// 坐标名：列 A-O，行 1-15
const coordName = (row: number, col: number) =>
  String.fromCharCode(65 + col) + (row + 1)

const getStatusText = () => {
  if (gameState.gameOver) {
    if (gameState.winner === 0) return '游戏结束，平局！'
    if (gameState.winner === 1) return '恭喜！你赢了！'
    if (gameState.winner === 2) return 'AI赢了！再试一次吧！'
  }
  if (aiThinking.value) return 'AI正在思考...'
  if (gameState.currentPlayer === 1) {
    const hint = lastAiMove.value ? `（AI 刚下在 ${coordName(lastAiMove.value.row, lastAiMove.value.col)}）` : ''
    return '轮到你了（黑子）' + hint
  }
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
          <div class="flex items-center justify-center gap-3">
            <button
              @click="resetGame"
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              重新开始
            </button>
            <button
              @click="undoMove"
              :disabled="!canUndo()"
              class="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              悔棋
            </button>
          </div>
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
              :class="[getCellClass(row-1, col-1), isLastAiMove(row-1, col-1) ? 'last-ai-move stone-enter' : '']"
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
          <p>下错或输了别急，点"悔棋"可以撤回你和AI的上一轮。</p>
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
              <h5 class="font-medium text-blue-600">6. 滑窗棋型评估（增量维护）</h5>
              <p class="text-gray-600 text-sm">对每条线做5格滑窗统计：窗口内不含对方子时，4子+1空=四点（两个四点即活四级威胁，一个四点即冲四，天然覆盖 xxx.x 跳四、.xx.xx. 双四等复杂棋型），同理识别活三/眠三/活二。落子/回退只重算经过该点的≤4条线，叶子评估 O(1) 读取，比全盘扫描快两个数量级。</p>
            </div>

            <div>
              <h5 class="font-medium text-blue-600">7. 威胁延伸（类VCF）</h5>
              <p class="text-gray-600 text-sm">当一手棋形成"四"（强制对手应答）时，该分支搜索深度不衰减，AI 能算清连续冲四的强制胜负序列；每条路径延伸次数封顶，防止搜索爆炸。</p>
            </div>

            <div>
              <h5 class="font-medium text-blue-600">8. 置换表 + 53位Zobrist哈希</h5>
              <p class="text-gray-600 text-sm">双32位随机哈希合成53位key（碰撞概率可忽略），增量异或维护。表项带边界标记（精确/上界/下界）与最佳走法，既做剪枝也做排序先验。</p>
            </div>

            <div>
              <h5 class="font-medium text-blue-600">9. 走法排序 + 候选裁剪</h5>
              <p class="text-gray-600 text-sm">排序优先级：置换表最佳走法 → 杀手走法 → 历史启发（截断时按深度平方累积）→ 攻防点评分（双向直连长度，防守×0.9）。候选限定在已有棋子半径2内，并按深度取前8~12个，大幅压低分支因子。</p>
            </div>
          </div>
        </div>

        <div>
          <h4 class="font-semibold text-lg mb-2">工作流程</h4>
          <ol class="list-decimal list-inside space-y-1 text-gray-600">
            <li>用户落子 → 检查胜负/平局</li>
            <li>切换AI：先查找我方必胜 → 若无，再查找必堵 → 若都无，进入深搜</li>
            <li>使用迭代加深（depth = 1..maxDepth），每层调用negamax（带alpha-beta、置换表、威胁延伸、时间检测）</li>
            <li>搜索中若超时则中断，返回上一深度已完成的结果</li>
            <li>应用走子，更新状态，UI更新</li>
          </ol>
        </div>

        <div class="bg-blue-50 p-3 rounded-lg">
          <p class="text-blue-800 text-sm">
            <strong>技术特点：</strong>迭代加深至12层（时间限制650ms/步），评估增量维护 + 候选裁剪使中盘实际搜索深度可达8层以上，威胁延伸让AI能看穿连续冲四的强制手段，支持异步计算和超时中断，确保AI既能快速响应又具备足够的策略深度。
          </p>
        </div>

        <div class="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
          <p class="text-gray-700 text-sm">
            <strong>源码地址：</strong>
            <a 
              href="https://github.com/2424004764/tools-web/blob/master/src/components/Tools/AiGomoku/AiGomoku.vue" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-800 underline"
            >
              GitHub - AI五子棋组件源码
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

/* ===== AI 最近一手标记 ===== */
/* 落子入场：棋子从放大状态落入 */
.stone-enter {
  animation: stoneDrop 0.24s cubic-bezier(0.2, 0.85, 0.35, 1.2);
}
@keyframes stoneDrop {
  from { transform: scale(1.7); opacity: 0.3; }
  to { transform: scale(1); opacity: 1; }
}

/* 常驻标记：棋子中心红点，AI 下一手之前一直在 */
.last-ai-move::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(239, 68, 68, 0.8);
  pointer-events: none;
  z-index: 2;
}

/* 提醒动画：红色圆环向外扩散三次后消失 */
.last-ai-move::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid #ef4444;
  border-radius: 50%;
  animation: lastMovePulse 1.1s ease-out 3;
  pointer-events: none;
}
@keyframes lastMovePulse {
  0% { transform: scale(0.75); opacity: 1; }
  70% { transform: scale(1.15); opacity: 0.15; }
  100% { transform: scale(1.2); opacity: 0; }
}
</style>
