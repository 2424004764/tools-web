<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { toMorse, toText } from '@/utils/morse'
import { ElMessage } from 'element-plus'

const info = reactive({
  title: "摩斯电码",
  content: '支持中文的摩斯电码编码(Encode)解码(Decode)',
  tranRes: '',
})

const isPlaying = ref(false)
const playProgress = ref('')
const currentCharIndex = ref(-1)
const progressPercent = ref(0)
const smoothProgress = ref(0)
const morseChars = ref<string[]>([])
const currentSymbolIndex = ref(-1)
let stopFlag = false
let animFrameId = 0

const toEncode = () => {
  info.tranRes = toMorse(info.content)
}

const toDecode = () => {
  info.tranRes = toText(info.content)
}

const clear = () => {
  info.content = ''
  info.tranRes = ''
  stopPlay()
}

//copy
const copyRes = async (resStr: string) => {
  copy(resStr)
}

// 摩斯电码播放
const DOT_DURATION = 100   // 点的持续时间(ms)
const DASH_DURATION = 300  // 划的持续时间(ms)
const SYMBOL_GAP = 80      // 点划之间的间隔
const CHAR_GAP = 250       // 字符之间的间隔
const WORD_GAP = 500       // 单词之间的间隔
const FREQUENCY = 700      // 蜂鸣频率(Hz)

// 平滑动画：从 basePercent 到 targetPercent，在 duration 毫秒内匀速推进
const animateProgress = (basePercent: number, targetPercent: number, duration: number) => {
  const startTime = performance.now()
  const tick = (now: number) => {
    const elapsed = now - startTime
    const ratio = Math.min(elapsed / duration, 1)
    smoothProgress.value = basePercent + (targetPercent - basePercent) * ratio
    if (ratio < 1 && !stopFlag) {
      animFrameId = requestAnimationFrame(tick)
    }
  }
  animFrameId = requestAnimationFrame(tick)
}

const playBeep = (audioCtx: AudioContext, duration: number, basePercent: number, targetPercent: number): Promise<void> => {
  return new Promise((resolve) => {
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = FREQUENCY
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration / 1000 - 0.01)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + duration / 1000)
    // 播放期间驱动平滑进度动画
    animateProgress(basePercent, targetPercent, duration)
    oscillator.onended = () => resolve()
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const playMorse = async () => {
  const morseStr = info.tranRes.trim()
  if (!morseStr) {
    ElMessage.warning('请先生成摩斯编码')
    return
  }

  isPlaying.value = true
  stopFlag = false

  const audioCtx = new AudioContext()

  try {
    const chars = morseStr.split(' ')
    morseChars.value = chars
    const totalSymbols = chars.reduce((sum, c) => sum + (c ? c.replace(/[^.\-]/g, '').length : 0), 0)
    let playedSymbols = 0

    for (let i = 0; i < chars.length; i++) {
      if (stopFlag) break
      const char = chars[i]
      if (!char) {
        await sleep(WORD_GAP)
        continue
      }
      currentCharIndex.value = i
      playProgress.value = char
      for (let j = 0; j < char.length; j++) {
        if (stopFlag) break
        currentSymbolIndex.value = j
        const symbol = char[j]
        const basePercent = (playedSymbols / totalSymbols) * 100
        const targetPercent = ((playedSymbols + 1) / totalSymbols) * 100
        if (symbol === '.') {
          await playBeep(audioCtx, DOT_DURATION, basePercent, targetPercent)
          playedSymbols++
        } else if (symbol === '-') {
          await playBeep(audioCtx, DASH_DURATION, basePercent, targetPercent)
          playedSymbols++
        }
        smoothProgress.value = targetPercent
        if (j < char.length - 1) {
          await sleep(SYMBOL_GAP)
        }
      }
      currentSymbolIndex.value = -1
      if (i < chars.length - 1) {
        await sleep(CHAR_GAP)
      }
    }
  } finally {
    cancelAnimationFrame(animFrameId)
    audioCtx.close()
    isPlaying.value = false
    playProgress.value = ''
    currentCharIndex.value = -1
    currentSymbolIndex.value = -1
    smoothProgress.value = 0
    progressPercent.value = 0
    morseChars.value = []
  }
}

const stopPlay = () => {
  stopFlag = true
}

onUnmounted(() => {
  stopPlay()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white ">
      <div>
        <el-input type="textarea" :rows="8" v-model="info.content"></el-input>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <el-button type="primary" @click="toEncode">摩斯编码</el-button>
        <el-button type="primary" @click="toDecode">摩斯解码</el-button>
        <el-button type="success" @click="playMorse" :loading="isPlaying" :disabled="!info.tranRes">
          {{ isPlaying ? '播放中...' : '播放摩斯码' }}
        </el-button>
        <el-button v-if="isPlaying" type="warning" @click="stopPlay">停止播放</el-button>
        <el-button type="primary" @click="copyRes(info.tranRes)">复制结果</el-button>
        <el-button type="danger" @click="clear">清空内容</el-button>
      </div>

      <!-- 播放进度指示 -->
      <div v-if="isPlaying" class="mt-3 p-4 bg-gray-50 rounded-xl space-y-3">
        <!-- 视频风格进度条 -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1 shrink-0">
            <span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span class="text-sm text-gray-600">正在播放</span>
          </div>
          <div class="flex-1 relative h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer">
            <div
              class="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
              :style="{ width: smoothProgress + '%', transition: 'none' }"
            ></div>
            <!-- 进度滑块 -->
            <div
              class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-green-500 rounded-full shadow-sm"
              :style="{ left: `calc(${smoothProgress}% - 7px)` }"
            ></div>
          </div>
          <span class="text-xs text-gray-500 shrink-0 w-10 text-right">{{ Math.round(smoothProgress) }}%</span>
        </div>

        <!-- 当前播放符号可视化 -->
        <div v-if="playProgress" class="flex items-center gap-2">
          <span class="text-xs text-gray-500">当前：</span>
          <div class="flex items-end gap-0.5">
            <template v-for="(s, si) in playProgress.split('')" :key="si">
              <div
                v-if="s === '.'"
                class="w-2 h-2 rounded-full transition-all duration-150"
                :class="si === currentSymbolIndex ? 'bg-green-500 scale-125' : si < currentSymbolIndex ? 'bg-green-300' : 'bg-gray-300'"
              ></div>
              <div
                v-else-if="s === '-'"
                class="w-5 h-2 rounded-full transition-all duration-150"
                :class="si === currentSymbolIndex ? 'bg-green-500 scale-110' : si < currentSymbolIndex ? 'bg-green-300' : 'bg-gray-300'"
              ></div>
            </template>
          </div>
        </div>

        <!-- 摩斯码逐字高亮 -->
        <div class="flex flex-wrap gap-1 font-mono text-sm leading-relaxed max-h-24 overflow-y-auto">
          <span
            v-for="(char, idx) in morseChars"
            :key="idx"
            class="px-1 py-0.5 rounded transition-all duration-200"
            :class="{
              'bg-green-500 text-white font-bold scale-110': idx === currentCharIndex,
              'bg-green-100 text-green-700': idx < currentCharIndex,
              'text-gray-400': idx > currentCharIndex,
            }"
          >{{ char || '/' }}</span>
        </div>
      </div>

      <div class="mt-3 min-h-md bg-gray-100 p-3 mb-3">
        <el-input type="textarea" :rows="8" v-model="info.tranRes"></el-input>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        摩尔斯电码（或摩斯电码，Morse code）是一种编码系统，通过不同顺序的信号表示英文字母、数字和标点符号。由美国人艾尔菲德·维尔在协助Samuel Morse发明摩尔斯电报机（1835年）时创造。今天，国际摩尔斯电码仍在使用。
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>

</style>