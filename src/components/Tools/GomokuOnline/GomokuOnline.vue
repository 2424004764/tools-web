<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import ChatPanel from '@/components/Tools/Common/ChatPanel.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Close } from '@element-plus/icons-vue'
import QrcodeVue3 from 'qrcode-vue3'
import { gomokuDb, type GomokuGame, type UndoRequest } from '@/utils/gomokuDb'
import { supabase } from '@/utils/supabase'

/* ========== 基本配置 ========== */
const info = reactive({ title: '双人对战五子棋' })

const boardSize = 15
const cellSize = 32
const boardPadding = 16
const coordinatePadding = 20 // 坐标标签额外空间

const boardStyle = computed(() => ({
  width: `${boardSize * cellSize + boardPadding * 2 + coordinatePadding}px`,
  height: `${boardSize * cellSize + boardPadding * 2 + coordinatePadding}px`,
  paddingLeft: `${coordinatePadding}px`,
  paddingTop: `${coordinatePadding}px`
}))

/* ========== 游戏状态 ========== */
const roomId = ref('')
const nickname = ref('')
const isJoined = ref(false)
const myRole = ref<'player' | 'spectator'>('spectator')
const myColor = ref<'black' | 'white' | null>(null)
const board = ref<number[][]>(Array(boardSize).fill(null).map(() => Array(boardSize).fill(0)))
const currentPlayer = ref<'black' | 'white'>('black')
const gameStatus = ref<'waiting' | 'playing' | 'finished'>('waiting')
const winner = ref<string | null>(null)
const lastMove = ref<{ row: number; col: number } | null>(null)

const blackPlayer = ref<string | null>(null)
const whitePlayer = ref<string | null>(null)
const spectatorCount = ref(0)
const undoRequest = ref<UndoRequest | null>(null)
const showQrcode = ref(false)
const showChat = ref(true)
const showMoveNumbers = ref(true)
const soundEnabled = ref(true)

// 用于判断订阅回调是否应该跳过更新（避免覆盖自己的更新）
// 记录自己最后落子的时间
const myLastMoveTime = ref(0)

const myNicknames = ref<string[]>([])
const currentUserId = ref(`user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`)

const isConnecting = ref(false)

// 落子历史记录（用于显示序号）
const moveHistory = ref<Array<{ row: number; col: number; player: 'black' | 'white'; number: number }>>([])

// 落子音效
const playMoveSound = () => {
  if (!soundEnabled.value) return
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (e) {
    console.warn('播放音效失败:', e)
  }
}

// 方向向量（用于胜负检测）
const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]

// Supabase channels
let gameChannel: any = null
let undoChannel: any = null
let presenceChannel: any = null
let movesChannel: any = null

/* ========== 路由处理 ========== */
const route = useRoute()

/* ========== 工具函数 ========== */
const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  roomId.value = result
}

const generateNickname = () => {
  const adjectives = ['快乐的', '聪明的', '可爱的', '勇敢的', '温柔的', '活泼的', '神秘的', '优雅的']
  const nouns = ['小猫', '小狗', '兔子', '熊猫', '狐狸', '松鼠', '海豚', '企鹅']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  nickname.value = adj + noun
}

const getRoomLink = computed(() => {
  if (!roomId.value) return ''
  const baseUrl = window.location.origin + '/gomoku-online'
  return `${baseUrl}?room=${roomId.value}`
})

const loadRoomFromUrl = () => {
  const roomParam = route.query.room as string
  if (roomParam) {
    roomId.value = roomParam.toUpperCase()
    return true
  }
  return false
}

const saveNickname = (nick: string) => {
  const saved = localStorage.getItem('gomoku-mynicknames')
  let nicknames: string[] = []
  if (saved) {
    try {
      nicknames = JSON.parse(saved)
    } catch {
      nicknames = []
    }
  }

  if (!nicknames.includes(nick)) {
    nicknames.push(nick)
    if (nicknames.length > 20) {
      nicknames = nicknames.slice(-20)
    }
    localStorage.setItem('gomoku-mynicknames', JSON.stringify(nicknames))
  }

  myNicknames.value = nicknames
  localStorage.setItem('gomoku-current-nickname', nick)
}

const loadSavedNickname = () => {
  const current = localStorage.getItem('gomoku-current-nickname')
  const saved = localStorage.getItem('gomoku-mynicknames')

  if (saved) {
    try {
      myNicknames.value = JSON.parse(saved)
    } catch {
      myNicknames.value = []
    }
  }

  if (current) {
    nickname.value = current
    return true
  }

  return false
}

/* ========== 游戏逻辑 ========== */
const inBounds = (row: number, col: number) => {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize
}

const checkWin = (row: number, col: number, player: number): boolean => {
  const playerValue = player === 1 ? 1 : 2

  for (const [dr, dc] of directions) {
    let count = 1

    for (let i = 1; i < 5; i++) {
      const nr = row + dr * i
      const nc = col + dc * i
      if (!inBounds(nr, nc) || board.value[nr][nc] !== playerValue) break
      count++
    }

    for (let i = 1; i < 5; i++) {
      const nr = row - dr * i
      const nc = col - dc * i
      if (!inBounds(nr, nc) || board.value[nr][nc] !== playerValue) break
      count++
    }

    if (count >= 5) return true
  }

  return false
}

const checkDraw = (): boolean => {
  return board.value.every(row => row.every(cell => cell !== 0))
}

const makeMove = async (row: number, col: number) => {
  // 检查是否可以落子
  if (
    gameStatus.value !== 'playing' ||
    board.value[row][col] !== 0 ||
    myRole.value !== 'player' ||
    currentPlayer.value !== myColor.value
  ) {
    return
  }

  // 使用自己的颜色来落子
  const playerValue = myColor.value === 'black' ? 1 : 2
  const movingPlayer = myColor.value

  // 本地立即更新棋盘（提升响应速度）
  // 创建全新的二维数组，确保 Vue 响应式正确追踪
  const newBoard = board.value.map(r => [...r])
  newBoard[row][col] = playerValue
  board.value = newBoard
  lastMove.value = { row, col }

  // 记录落子历史
  const moveNumber = moveHistory.value.length + 1
  moveHistory.value.push({ row, col, player: movingPlayer, number: moveNumber })

  // 播放落子音效
  playMoveSound()

  // 记录落子时间，用于订阅回调判断
  myLastMoveTime.value = Date.now()

  // 检查胜负
  if (checkWin(row, col, playerValue)) {
    const winColor = movingPlayer
    winner.value = winColor === 'black' ? blackPlayer.value || '黑方' : whitePlayer.value || '白方'

    // 更新游戏状态
    const cleanBoard = JSON.parse(JSON.stringify(board.value))
    await gomokuDb.endGame(roomId.value, winner.value, '五连珠', cleanBoard)
    gameStatus.value = 'finished'

    // 不在这里显示消息，让订阅回调统一处理
    return
  }

  if (checkDraw()) {
    const cleanBoard = JSON.parse(JSON.stringify(board.value))
    await gomokuDb.endGame(roomId.value, '平局', '平局', cleanBoard)
    gameStatus.value = 'finished'
    winner.value = '平局'

    // 不在这里显示消息，让订阅回调统一处理
    return
  }

  // 计算下一个玩家
  const nextPlayer = movingPlayer === 'black' ? 'white' : 'black'
  currentPlayer.value = nextPlayer

  // 更新游戏状态到数据库
  // 创建纯净的数组副本，避免 Vue 响应式属性干扰
  const cleanBoard = JSON.parse(JSON.stringify(board.value))
  await gomokuDb.makeMove(roomId.value, cleanBoard, nextPlayer, { row, col })
}

const requestUndo = async () => {
  if (gameStatus.value !== 'playing') return
  if (!lastMove.value) {
    ElMessage.warning('没有可以悔的棋')
    return
  }

  const target = myColor.value === 'black' ? whitePlayer.value : blackPlayer.value
  if (!target) return

  try {
    await gomokuDb.createUndoRequest(roomId.value, nickname.value, target)
    ElMessage.info('已发送悔棋请求，等待对方同意...')
  } catch (error) {
    console.error('发送悔棋请求失败:', error)
    ElMessage.error('发送悔棋请求失败')
  }
}

const handleUndoRequest = async (request: UndoRequest, accept: boolean) => {
  try {
    await gomokuDb.handleUndoRequest(request.id, accept ? 'accepted' : 'rejected')

    if (accept && lastMove.value) {
      // 执行悔棋
      const { row, col } = lastMove.value
      // 创建全新的二维数组，确保 Vue 响应式正确追踪
      const newBoard = board.value.map(r => [...r])
      newBoard[row][col] = 0
      board.value = newBoard

      const newPlayer = currentPlayer.value === 'black' ? 'white' : 'black'
      currentPlayer.value = newPlayer

      const cleanBoard = JSON.parse(JSON.stringify(board.value))
      await gomokuDb.undoMove(roomId.value, cleanBoard, newPlayer)
      lastMove.value = null

      ElMessage.success('已同意悔棋')
    } else {
      ElMessage.info('已拒绝悔棋')
    }

    undoRequest.value = null
  } catch (error) {
    console.error('处理悔棋请求失败:', error)
    ElMessage.error('处理悔棋请求失败')
  }
}

const surrender = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要认输吗？',
      '认输确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const winnerName = myColor.value === 'black' ? whitePlayer.value : blackPlayer.value
    const cleanBoard = JSON.parse(JSON.stringify(board.value))
    await gomokuDb.endGame(roomId.value, winnerName || '对手', '认输', cleanBoard)

    winner.value = winnerName || '对手'
    gameStatus.value = 'finished'

    ElMessage.info('你已认输')
  } catch {
    // 用户取消
  }
}

const restartGame = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重新开始吗？当前对局将结束。',
      '重新开始',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await gomokuDb.restartGame(roomId.value)

    // 重置本地状态
    board.value = Array(boardSize).fill(null).map(() => Array(boardSize).fill(0))
    currentPlayer.value = 'black'
    gameStatus.value = 'playing'
    winner.value = null
    lastMove.value = null
    moveHistory.value = []

    ElMessage.success('游戏已重新开始')
  } catch {
    // 用户取消
  }
}

/* ========== 房间管理 ========== */
const joinRoom = async () => {
  if (!roomId.value.trim()) {
    ElMessage.warning('请输入房间号')
    return
  }
  if (!nickname.value.trim()) {
    ElMessage.warning('请输入昵称')
    return
  }

  isConnecting.value = true

  try {
    // 保存昵称
    saveNickname(nickname.value)

    const normalizedRoomId = roomId.value.toUpperCase()

    // 加入游戏（自动判断是玩家还是观众）
    const game = await gomokuDb.joinGame(normalizedRoomId, nickname.value)
    if (!game) {
      throw new Error('加入游戏失败')
    }

    // 解析棋盘
    board.value = gomokuDb.parseBoard(game.board)
    currentPlayer.value = game.current_player
    gameStatus.value = game.game_status
    winner.value = game.winner
    blackPlayer.value = game.black_player
    whitePlayer.value = game.white_player
    spectatorCount.value = game.spectator_count || 0

    // 判断角色（根据更新后的游戏状态）
    if (game.black_player === nickname.value) {
      myRole.value = 'player'
      myColor.value = 'black'
    } else if (game.white_player === nickname.value) {
      myRole.value = 'player'
      myColor.value = 'white'
    } else {
      myRole.value = 'spectator'
      myColor.value = null
    }

    // 订阅游戏状态变化
    gameChannel = gomokuDb.subscribeToGame(normalizedRoomId, async (payload: any) => {
      const updatedGame = payload.new as GomokuGame

      // 检查是否是自己刚刚发起的落子更新（1秒内）
      const timeSinceMyMove = Date.now() - myLastMoveTime.value
      const isMyRecentMove = timeSinceMyMove < 1000

      // 只有当不是自己刚刚发起的更新时，才同步状态
      if (!isMyRecentMove) {
        const newBoard = gomokuDb.parseBoard(updatedGame.board)

        // 检查棋盘是否被重置（通过比较子数或检查棋盘为空）
        const stoneCount = newBoard.flat().filter(cell => cell !== 0).length
        const isGameRestarted = stoneCount < moveHistory.value.length || stoneCount <= 1
        if (isGameRestarted) {
          moveHistory.value = []
          lastMove.value = null
        }

        // 计算落子差异，添加到历史记录
        for (let row = 0; row < boardSize; row++) {
          for (let col = 0; col < boardSize; col++) {
            if (newBoard[row][col] !== 0 && board.value[row][col] === 0) {
              // 这是一个新落子
              const player = newBoard[row][col] === 1 ? 'black' : 'white'
              const moveNumber = moveHistory.value.length + 1
              moveHistory.value.push({ row, col, player, number: moveNumber })

              // 播放落子音效
              playMoveSound()
            }
          }
        }

        board.value = newBoard
        currentPlayer.value = updatedGame.current_player
        gameStatus.value = updatedGame.game_status
        winner.value = updatedGame.winner
        blackPlayer.value = updatedGame.black_player
        whitePlayer.value = updatedGame.white_player
        spectatorCount.value = updatedGame.spectator_count || 0

        // 如果游戏状态变为 finished，显示消息
        if (updatedGame.game_status === 'finished') {
          nextTick(() => {
            if (updatedGame.winner === '平局') {
              ElMessage.info('游戏平局！')
            } else if (updatedGame.winner) {
              ElMessage.success(`${updatedGame.winner}获胜！`)
            }
          })
        }
      }
      // 否则跳过自己的落子更新

    })
    undoChannel = gomokuDb.subscribeToUndoRequests(normalizedRoomId, async (payload: any) => {
      const request = payload.new as UndoRequest

      // 如果是针对我的请求
      if (request.target === nickname.value && request.status === 'pending') {
        undoRequest.value = request

        ElMessageBox.confirm(
          `${request.requestor} 请求悔棋，是否同意？`,
          '悔棋请求',
          {
            confirmButtonText: '同意',
            cancelButtonText: '拒绝',
            type: 'info',
          }
        ).then(() => {
          handleUndoRequest(request, true)
        }).catch(() => {
          handleUndoRequest(request, false)
        })
      } else if (request.requestor === nickname.value) {
        // 我发出的请求被处理了
        if (request.status === 'accepted') {
          ElMessage.success('对方同意了悔棋')
          // 本地棋盘会在游戏状态更新时同步
        } else if (request.status === 'rejected') {
          ElMessage.info('对方拒绝了悔棋')
        }
        undoRequest.value = null
      }
    })

    // 订阅落子广播
    movesChannel = gomokuDb.subscribeToMoves(normalizedRoomId, (move) => {
      lastMove.value = { row: move.row, col: move.col }
    })

    // 订阅在线状态
    presenceChannel = supabase.channel(`gomoku-presence-${normalizedRoomId}`)

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // 在线状态同步
      })
      .on('presence', { event: 'join' }, () => {
        // 有玩家加入
      })
      .on('presence', { event: 'leave' }, () => {
        // 有玩家离开
      })
      .on('broadcast', { event: 'move' }, (payload: any) => {
        const move = payload.payload
        lastMove.value = { row: move.row, col: move.col }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          gomokuDb.trackUser(presenceChannel, currentUserId.value, nickname.value, myRole.value, myColor.value)
        }
      })

    isJoined.value = true
    isConnecting.value = false

    // 更新 URL
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('room', normalizedRoomId)
    window.history.replaceState({}, '', newUrl.toString())

    ElMessage.success('成功加入游戏房间')
  } catch (error) {
    console.error('加入房间失败:', error)
    ElMessage.error('加入房间失败')
    isConnecting.value = false
  }
}

const leaveRoom = () => {
  // 清理 channels
  if (gameChannel) {
    supabase.removeChannel(gameChannel)
    gameChannel = null
  }
  if (undoChannel) {
    supabase.removeChannel(undoChannel)
    undoChannel = null
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel)
    presenceChannel = null
  }
  if (movesChannel) {
    supabase.removeChannel(movesChannel)
    movesChannel = null
  }

  // 离开游戏
  if (roomId.value && nickname.value) {
    gomokuDb.leaveGame(roomId.value, nickname.value).catch(console.error)
  }

  // 重置状态
  isJoined.value = false
  myRole.value = 'spectator'
  myColor.value = null
  board.value = Array(boardSize).fill(null).map(() => Array(boardSize).fill(0))
  currentPlayer.value = 'black'
  gameStatus.value = 'waiting'
  winner.value = null
  lastMove.value = null
  blackPlayer.value = null
  whitePlayer.value = null
  spectatorCount.value = 0
  undoRequest.value = null
  moveHistory.value = []

  generateRoomId()
  generateNickname()

  // 清除 URL 参数
  if (route.query.room) {
    window.history.pushState({}, '', '/gomoku-online')
  }
}

/* ========== UI 辅助 ========== */
const isLastMove = (row: number, col: number) => {
  return lastMove.value && lastMove.value.row === row && lastMove.value.col === col
}

const getCellClass = (row: number, col: number) => {
  try {
    if (!board.value || !board.value[row]) {
      return 'empty'
    }
    const cell = board.value[row][col]
    if (cell === 0) return 'empty'
    if (cell === 1) return 'black'
    if (cell === 2) return 'white'
    return 'empty'
  } catch (e) {
    return 'empty'
  }
}

const canMove = (row: number, col: number) => {
  try {
    if (!board.value || !board.value[row]) {
      return false
    }
    const cellValue = board.value[row][col]
    return (
      gameStatus.value === 'playing' &&
      cellValue === 0 &&
      myRole.value === 'player' &&
      currentPlayer.value === myColor.value
    )
  } catch (e) {
    return false
  }
}

const getMoveNumber = (row: number, col: number): number | null => {
  const move = moveHistory.value.find(m => m.row === row && m.col === col)
  return move ? move.number : null
}

const getCoordinateLabel = (index: number, type: 'row' | 'col'): string => {
  if (type === 'col') {
    // 列使用字母 A-O
    return String.fromCharCode(65 + index)
  } else {
    // 行使用数字 1-15
    return String(index + 1)
  }
}

const getStatusText = () => {
  if (gameStatus.value === 'finished') {
    if (winner.value === '平局') return '游戏结束，平局！'
    if (winner.value === blackPlayer.value) return `${blackPlayer.value}（黑方）获胜！`
    if (winner.value === whitePlayer.value) return `${whitePlayer.value}（白方）获胜！`
    return '游戏结束'
  }

  if (gameStatus.value === 'waiting') {
    const missing = !blackPlayer.value ? '黑方' : '白方'
    return `等待${missing}玩家加入...`
  }

  if (myRole.value === 'spectator') {
    return `观战中 - ${currentPlayer.value === 'black' ? '黑方' : '白方'}落子`
  }

  if (currentPlayer.value === myColor.value) {
    return `轮到你（${myColor.value === 'black' ? '黑' : '白'}子）`
  }

  return `等待对手（${currentPlayer.value === 'black' ? '黑' : '白'}子）落子...`
}

const copyRoomId = async () => {
  try {
    await navigator.clipboard.writeText(roomId.value)
    ElMessage.success('房间号已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

const copyRoomLink = async () => {
  try {
    await navigator.clipboard.writeText(getRoomLink.value)
    ElMessage.success('链接已复制，分享给好友即可加入')
  } catch {
    ElMessage.error('复制失败')
  }
}

/* ========== 生命周期 ========== */
onMounted(() => {
  const hasSaved = loadSavedNickname()
  if (!hasSaved) {
    generateNickname()
  }

  const hasRoomParam = loadRoomFromUrl()
  if (hasRoomParam && roomId.value) {
    nextTick(() => {
      joinRoom()
    })
  } else {
    generateRoomId()
  }
})

onUnmounted(() => {
  leaveRoom()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 未加入房间时显示加入界面 -->
      <div v-if="!isJoined" class="max-w-md mx-auto">
        <div class="text-center mb-6">
          <div class="text-6xl mb-4">⚫⚪</div>
          <h2 class="text-xl font-semibold text-gray-800 mb-2">双人对战五子棋</h2>
          <p class="text-gray-500 text-sm">与好友在线对弈，支持悔棋和聊天</p>
        </div>

        <div class="space-y-4">
          <!-- 房间号输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">房间号</label>
            <div class="flex gap-2">
              <el-input
                v-model="roomId"
                placeholder="输入房间号加入，或使用随机房间号"
                maxlength="10"
                class="flex-1"
                @keyup.enter="joinRoom"
              />
              <el-button @click="generateRoomId">随机</el-button>
            </div>
          </div>

          <!-- 昵称输入 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">昵称</label>
            <div class="flex gap-2">
              <el-input
                v-model="nickname"
                placeholder="输入你的昵称"
                maxlength="20"
                class="flex-1"
                @keyup.enter="joinRoom"
              />
              <el-button @click="generateNickname">随机</el-button>
            </div>
          </div>

          <!-- 加入按钮 -->
          <el-button
            type="primary"
            class="w-full"
            size="large"
            :loading="isConnecting"
            @click="joinRoom"
          >
            {{ isConnecting ? '连接中...' : '加入游戏' }}
          </el-button>
        </div>
      </div>

      <!-- 已加入房间时显示游戏界面 -->
      <div v-else class="flex flex-col lg:flex-row gap-4">
        <!-- 左侧：游戏区域 -->
        <div class="flex-1 flex flex-col items-center">
          <!-- 顶部信息栏 -->
          <div class="w-full flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">房间:</span>
              <span class="font-mono font-semibold text-primary">{{ roomId }}</span>
              <el-button size="small" text @click="copyRoomId">
                <el-icon :size="16"><CopyDocument /></el-icon>
              </el-button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">{{ nickname }}</span>
              <span v-if="myRole === 'player'" class="px-2 py-0.5 text-xs rounded-full"
                :class="myColor === 'black' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-800'">
                {{ myColor === 'black' ? '黑方' : '白方' }}
              </span>
              <span v-else class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                观众
              </span>
            </div>
            <div class="flex items-center gap-2">
              <el-button size="small" @click="showQrcode = true">二维码</el-button>
              <el-button size="small" @click="copyRoomLink">分享链接</el-button>
              <el-button size="small" @click="showChat = !showChat">
                {{ showChat ? '隐藏' : '聊天' }}
              </el-button>
              <el-button type="danger" size="small" @click="leaveRoom">离开</el-button>
            </div>
          </div>

          <!-- 玩家信息 -->
          <div class="w-full flex items-center justify-between mb-4 px-4">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm">
                ⚫
              </div>
              <div>
                <div class="text-sm font-medium">{{ blackPlayer || '等待加入...' }}</div>
                <div class="text-xs text-gray-500">黑方</div>
              </div>
            </div>
            <div class="text-lg font-bold text-gray-300">VS</div>
            <div class="flex items-center gap-2">
              <div>
                <div class="text-sm font-medium text-right">{{ whitePlayer || '等待加入...' }}</div>
                <div class="text-xs text-gray-500 text-right">白方</div>
              </div>
              <div class="w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-sm">
                ⚪
              </div>
            </div>
          </div>

          <!-- 游戏状态 -->
          <div class="mb-3 text-center">
            <div class="text-lg font-semibold" :class="{
              'text-blue-600': gameStatus === 'waiting',
              'text-green-600': gameStatus === 'playing',
              'text-red-600': gameStatus === 'finished',
            }">
              {{ getStatusText() }}
            </div>
          </div>

          <!-- 操作按钮 -->
          <div v-if="myRole === 'player' && gameStatus === 'playing'" class="flex gap-2 mb-3 flex-wrap justify-center">
            <el-button size="small" @click="requestUndo" :disabled="!lastMove">
              悔棋
            </el-button>
            <el-button size="small" type="warning" @click="surrender">
              认输
            </el-button>
            <el-button size="small" @click="soundEnabled = !soundEnabled">
              {{ soundEnabled ? '🔊 音效开' : '🔇 音效关' }}
            </el-button>
            <el-button size="small" @click="showMoveNumbers = !showMoveNumbers">
              {{ showMoveNumbers ? '显示序号' : '隐藏序号' }}
            </el-button>
          </div>

          <div v-if="gameStatus === 'finished'" class="flex gap-2 mb-3 flex-wrap justify-center">
            <el-button size="small" type="primary" @click="restartGame">
              重新开始
            </el-button>
            <el-button size="small" @click="soundEnabled = !soundEnabled">
              {{ soundEnabled ? '🔊 音效开' : '🔇 音效关' }}
            </el-button>
            <el-button size="small" @click="showMoveNumbers = !showMoveNumbers">
              {{ showMoveNumbers ? '显示序号' : '隐藏序号' }}
            </el-button>
          </div>

          <!-- 观众也可以控制音效和序号显示 -->
          <div v-if="myRole === 'spectator'" class="flex gap-2 mb-3 flex-wrap justify-center">
            <el-button size="small" @click="soundEnabled = !soundEnabled">
              {{ soundEnabled ? '🔊 音效开' : '🔇 音效关' }}
            </el-button>
            <el-button size="small" @click="showMoveNumbers = !showMoveNumbers">
              {{ showMoveNumbers ? '显示序号' : '隐藏序号' }}
            </el-button>
          </div>

          <!-- 棋盘 -->
          <div class="relative" :style="boardStyle">
            <!-- 棋盘背景 -->
            <div class="absolute inset-0 bg-amber-100 rounded-lg shadow-inner" :style="{
              left: `${coordinatePadding}px`,
              top: `${coordinatePadding}px`,
              width: `${boardSize * cellSize + boardPadding * 2}px`,
              height: `${boardSize * cellSize + boardPadding * 2}px`
            }"></div>

            <!-- 坐标标签 -->
            <div class="absolute" :style="{
              top: `0px`,
              left: `${coordinatePadding + boardPadding}px`,
              width: `${boardSize * cellSize}px`,
              height: `16px`
            }">
              <div
                v-for="col in boardSize"
                :key="`col-label-${col-1}`"
                class="absolute text-xs text-gray-600 font-medium"
                :style="{
                  left: `${(col-1) * cellSize + cellSize/2}px`,
                  transform: 'translateX(-50%)'
                }"
              >
                {{ getCoordinateLabel(col-1, 'col') }}
              </div>
            </div>

            <div class="absolute" :style="{
              top: `${coordinatePadding + boardPadding}px`,
              left: `0px`,
              width: `16px`,
              height: `${boardSize * cellSize}px`
            }">
              <div
                v-for="row in boardSize"
                :key="`row-label-${row-1}`"
                class="absolute text-xs text-gray-600 font-medium"
                :style="{
                  top: `${(row-1) * cellSize + cellSize/2}px`,
                  transform: 'translateY(-50%)'
                }"
              >
                {{ getCoordinateLabel(row-1, 'row') }}
              </div>
            </div>

            <!-- 网格线 -->
            <svg class="absolute" :style="{
              left: `${coordinatePadding}px`,
              top: `${coordinatePadding}px`
            }" :width="`${boardSize * cellSize + boardPadding * 2}`" :height="`${boardSize * cellSize + boardPadding * 2}`" :viewBox="`0 0 ${boardSize * cellSize + boardPadding * 2} ${boardSize * cellSize + boardPadding * 2}`">
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
              <!-- 天元和星位 -->
              <circle v-if="boardSize === 15" cx="50%" cy="50%" r="3" fill="#8B4513" />
              <circle v-if="boardSize === 15" :cx="boardPadding + 3 * cellSize" :cy="boardPadding + 3 * cellSize" r="2" fill="#8B4513" />
              <circle v-if="boardSize === 15" :cx="boardPadding + 11 * cellSize" :cy="boardPadding + 3 * cellSize" r="2" fill="#8B4513" />
              <circle v-if="boardSize === 15" :cx="boardPadding + 3 * cellSize" :cy="boardPadding + 11 * cellSize" r="2" fill="#8B4513" />
              <circle v-if="boardSize === 15" :cx="boardPadding + 11 * cellSize" :cy="boardPadding + 11 * cellSize" r="2" fill="#8B4513" />
            </svg>

            <!-- 棋子 -->
            <div
              v-for="row in boardSize"
              :key="`row-${row-1}`"
              class="absolute"
              :style="{
                top: `${coordinatePadding + boardPadding + (row-1) * cellSize - cellSize/2}px`,
                left: `${coordinatePadding + boardPadding - cellSize/2}px`,
                width: `${boardSize * cellSize}px`,
                height: `${cellSize}px`
              }"
            >
              <div
                v-for="col in boardSize"
                :key="`${row-1}-${col-1}`"
                class="absolute transition-transform duration-200"
                :class="[
                  getCellClass(row-1, col-1),
                  canMove(row-1, col-1) ? 'cursor-pointer hover:scale-110 can-move' : '',
                  isLastMove(row-1, col-1) ? 'last-move' : ''
                ]"
                :style="{
                  left: `${(col-1) * cellSize}px`,
                  width: `${cellSize}px`,
                  height: `${cellSize}px`
                }"
                :data-can-move="canMove(row-1, col-1) ? 'true' : 'false'"
                @click="makeMove(row-1, col-1)"
              >
                <!-- 落子序号 -->
                <span
                  v-if="showMoveNumbers && getMoveNumber(row-1, col-1)"
                  class="move-number"
                  :class="board?.[row-1]?.[col-1] === 1 ? 'text-white' : 'text-gray-800'"
                >
                  {{ getMoveNumber(row-1, col-1) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 观众提示 -->
          <div v-if="myRole === 'spectator'" class="mt-3 text-sm text-gray-500">
            您当前为观众，房间满员后自动成为观众
          </div>
        </div>

        <!-- 右侧：聊天面板 -->
        <div v-if="showChat" class="w-full lg:w-80 flex-shrink-0">
          <ChatPanel
            :room-id="roomId"
            :nickname="nickname"
            :my-nicknames="myNicknames"
          />
        </div>
      </div>

      <!-- 二维码弹窗 -->
      <div v-if="showQrcode" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showQrcode = false">
        <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4" @click.stop>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">扫码加入游戏</h3>
            <el-button text @click="showQrcode = false">
              <el-icon :size="20"><Close /></el-icon>
            </el-button>
          </div>
          <div class="flex flex-col items-center">
            <div class="bg-white p-4 rounded-lg border-2 border-gray-200">
              <QrcodeVue3
                :value="getRoomLink"
                :size="200"
                :margin="2"
                :level="'M'"
              />
            </div>
            <p class="mt-4 text-sm text-gray-500 mb-2">房间号: <span class="font-mono font-bold">{{ roomId }}</span></p>
            <el-button size="small" @click="copyRoomLink">复制链接分享给好友</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <el-text>
        双人对战五子棋是一款在线对弈游戏，支持两位玩家实时对战，具备聊天、悔棋等功能。游戏采用经典的15×15棋盘，黑子先手，先连成五子者获胜。
        <br><br>
        <strong>功能特点：</strong>
        <br>• <strong>房间机制</strong>：创建房间或输入房间号加入，支持二维码和链接分享
        <br>• <strong>实时对战</strong>：基于 Supabase Realtime 实现毫秒级同步
        <br>• <strong>悔棋功能</strong>：可向对方发起悔棋请求，对方同意后回退一步
        <br>• <strong>聊天功能</strong>：内置聊天面板，支持实时聊天和表情
        <br>• <strong>观战模式</strong>：房间满员后，后续加入者自动成为观众
        <br>• <strong>状态恢复</strong>：刷新页面后自动恢复游戏状态
        <br><br>
        <strong>使用方法：</strong>
        <br>1. 创建房间或输入已有房间号
        <br>2. 设置你的昵称
        <br>3. 点击"加入游戏"
        <br>4. 分享房间号或二维码邀请好友
        <br>5. 两位玩家加入后游戏自动开始
        <br>6. 点击棋盘落子，先连成五子者获胜
        <br><br>
        <strong>游戏规则：</strong>
        <br>• 黑子先手，双方轮流落子
        <br>• 先在横、竖、斜任意方向连成五子者获胜
        <br>• 悔棋需对方同意
        <br>• 可随时认输结束游戏
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.text-primary {
  color: #409eff;
}

.empty {
  background: transparent;
  border-radius: 50%;
  width: 100%;
  height: 100%;
}

.black {
  background: radial-gradient(circle at 30% 30%, #666, #000);
  border-radius: 50%;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.white {
  background: radial-gradient(circle at 30% 30%, #fff, #ccc);
  border-radius: 50%;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* 落子序号样式 */
.move-number {
  position: absolute;
  font-size: 10px;
  font-weight: 600;
  pointer-events: none;
  z-index: 1;
}

/* 落子动画 */
@keyframes placeStone {
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

.black:not(.empty),
.white:not(.empty) {
  animation: placeStone 0.2s ease-out;
}

/* 单元格过渡效果 - 只对 transform 属性添加过渡 */
.absolute {
  transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

/* 只有可以落子时才显示 hover 效果 - 使用属性选择器 */
.empty[data-can-move="true"]:hover {
  background: rgba(0,0,0,0.1) !important;
  border-radius: 50%;
}

.last-move {
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.6), 2px 2px 4px rgba(0,0,0,0.3);
}

@media (max-width: 1024px) {
  .chat-panel {
    width: 100% !important;
  }
}
</style>
