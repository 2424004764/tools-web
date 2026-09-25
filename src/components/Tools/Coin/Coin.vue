<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "抛硬币",
})

const SPIN_MS = 2200
const genStatus = ref(false)
const isHeads = ref(true)
const hasResult = ref(false)
const spinTurns = ref(0)
const lift = ref(0)
const liftScale = ref(1)
const shadowScale = ref(1)
const shadowOpacity = ref(0.28)

let throwTimer: ReturnType<typeof setTimeout> | null = null
let rafId = 0
let spinStart = 0
let fromTurns = 0
let toTurns = 0

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

const coinStyle = computed(() => ({
  transform: `rotateY(${spinTurns.value * 360}deg)`,
}))

const flightStyle = computed(() => ({
  transform: `translate3d(0, ${-lift.value}px, ${lift.value * 0.35}px) scale(${liftScale.value})`,
}))

const shadowStyle = computed(() => ({
  transform: `scaleX(${shadowScale.value})`,
  opacity: String(shadowOpacity.value),
}))

const stopSpin = () => {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

const clearThrowTimer = () => {
  if (throwTimer) {
    clearTimeout(throwTimer)
    throwTimer = null
  }
}

const tick = (now: number) => {
  const t = Math.min(1, (now - spinStart) / SPIN_MS)
  const spinT = easeOutCubic(t)
  const bounceT = easeInOut(t)
  const air = Math.sin(Math.min(1, bounceT) * Math.PI)

  spinTurns.value = fromTurns + (toTurns - fromTurns) * spinT
  lift.value = air * 128
  liftScale.value = 1 + air * 0.08
  shadowScale.value = 1 - air * 0.48
  shadowOpacity.value = 0.28 - air * 0.18

  if (t < 1) {
    rafId = requestAnimationFrame(tick)
    return
  }

  spinTurns.value = toTurns
  lift.value = 0
  liftScale.value = 1
  shadowScale.value = 1
  shadowOpacity.value = 0.28
  genStatus.value = false
  rafId = 0
}

const throwCoin = () => {
  if (genStatus.value) return
  clearThrowTimer()
  stopSpin()

  const nextHeads = Math.random() < 0.5
  const extraTurns = 8 + Math.floor(Math.random() * 3)
  const startTurns = spinTurns.value
  const startParity = Math.round(startTurns * 2) % 2
  const wantParity = nextHeads ? 0 : 1
  const nextTurns = startTurns + extraTurns + ((wantParity - startParity + 2) % 2) * 0.5

  fromTurns = startTurns
  toTurns = nextTurns
  isHeads.value = nextHeads
  hasResult.value = true
  genStatus.value = true
  spinStart = performance.now()
  rafId = requestAnimationFrame(tick)

  throwTimer = setTimeout(() => {
    if (genStatus.value) {
      stopSpin()
      spinTurns.value = toTurns
      lift.value = 0
      liftScale.value = 1
      shadowScale.value = 1
      shadowOpacity.value = 0.28
      genStatus.value = false
    }
    throwTimer = null
  }, SPIN_MS + 80)
}

onBeforeUnmount(() => {
  clearThrowTimer()
  stopSpin()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="coin-board">
        <div class="coin-stage">
          <div class="coin-shadow" :style="shadowStyle" />
          <div class="coin-flight" :style="flightStyle">
            <div class="coin" :style="coinStyle">
              <div class="coin-rim"></div>
              <div class="coin-face front"></div>
              <div class="coin-face reverse"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="coin-result" :class="{ 'is-spinning': genStatus }">
        <template v-if="genStatus">抛硬币中...</template>
        <template v-else-if="hasResult">
          {{ isHeads ? '正面 · 数字 1' : '反面 · 星星' }}
        </template>
        <template v-else>点击下方按钮开始抛硬币</template>
      </div>
      <div class="coin-actions">
        <el-button type="primary" class="w-48" size="large" @click="throwCoin" v-if="!genStatus">抛硬币</el-button>
        <el-button type="primary" class="w-48" size="large" disabled v-else>抛硬币中...</el-button>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        面临艰难的选择？我们邀请您在线掷硬币！正面是数字 1，反面是星星。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.coin-board {
  display: flex;
  justify-content: center;
}

.coin-stage {
  --coin-size: 128px;
  --coin-thickness: 8px;
  width: 240px;
  height: 280px;
  margin: 28px auto 12px;
  display: grid;
  place-items: center;
  perspective: 1100px;
  perspective-origin: 50% 42%;
  position: relative;
  overflow: hidden;
}

.coin-result {
  min-height: 28px;
  margin: 0 0 16px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--el-text-color-primary);
}

.coin-result.is-spinning {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.coin-actions {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
}

.coin-flight {
  position: relative;
  z-index: 1;
  width: var(--coin-size);
  height: var(--coin-size);
  transform-style: preserve-3d;
  will-change: transform;
}

.coin {
  width: var(--coin-size);
  height: var(--coin-size);
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
}

.coin-face,
.coin-rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.coin-face {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.coin-face.front {
  background-image: url('/images/coin/dollar.png');
  transform: translateZ(calc(var(--coin-thickness) / 2));
}

.coin-face.reverse {
  background-image: url('/images/coin/xingxing.png');
  transform: rotateY(180deg) translateZ(calc(var(--coin-thickness) / 2));
}

.coin-rim {
  pointer-events: none;
  background: linear-gradient(180deg, #fbbf24, #b45309 45%, #f59e0b 70%, #92400e);
  transform: rotateY(90deg) scaleX(0.055);
}

.coin-shadow {
  position: absolute;
  bottom: 34px;
  width: 96px;
  height: 18px;
  border-radius: 50%;
  background: rgb(15 23 42 / 0.28);
  filter: blur(8px);
}

@media (prefers-reduced-motion: reduce) {
  .coin,
  .coin-flight,
  .coin-shadow {
    animation: none !important;
    transition: none !important;
  }
}
</style>
