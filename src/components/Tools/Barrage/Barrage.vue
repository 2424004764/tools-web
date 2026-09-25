<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const defaultContent = import.meta.env.VITE_APP_TITLE || '一方工具箱'
const configuredInterval = Number(import.meta.env.VITE_BARRAGE_INTERVAL_MS)
const loopInterval = Number.isFinite(configuredInterval) && configuredInterval >= 0
  ? configuredInterval
  : 300

const info = reactive({
  title: "手持弹幕",
  content: defaultContent,
  speed: 25,
  textSize: 100,
  textColor: '#FFFFFF',
  bgColor: '#000000',
  isPlay: false,
  loopInterval,
})

const barrageTextStyle = computed(() => ({
  color: info.textColor,
  fontSize: `${info.textSize}px`,
}))

const trackRef = ref<HTMLDivElement | null>(null)
let animationFrameId: number | undefined

const stopBarrage = () => {
  if (animationFrameId !== undefined) {
    window.cancelAnimationFrame(animationFrameId)
    animationFrameId = undefined
  }
}

const startBarrage = async () => {
  stopBarrage()
  await nextTick()

  const track = trackRef.value
  if (!info.isPlay || !track) return

  const stageWidth = window.innerWidth
  const travelDistance = stageWidth + track.offsetWidth
  const pixelsPerSecond = Math.max(120, info.speed * 10)
  const travelDuration = travelDistance / pixelsPerSecond * 1000
  let cycleStart = performance.now()

  const renderFrame = (now: number) => {
    if (!info.isPlay || !trackRef.value) return

    const elapsed = now - cycleStart
    if (elapsed < travelDuration) {
      const progress = elapsed / travelDuration
      const x = stageWidth - travelDistance * progress
      track.style.transform = `translate3d(${x}px, -50%, 0)`
    } else if (elapsed < travelDuration + info.loopInterval) {
      track.style.transform = `translate3d(${-track.offsetWidth}px, -50%, 0)`
    } else {
      cycleStart = now
      track.style.transform = `translate3d(${stageWidth}px, -50%, 0)`
    }

    animationFrameId = window.requestAnimationFrame(renderFrame)
  }

  track.style.transform = `translate3d(${stageWidth}px, -50%, 0)`
  animationFrameId = window.requestAnimationFrame(renderFrame)
}

watch(() => info.isPlay, (playing) => {
  if (playing) {
    void startBarrage()
  } else {
    stopBarrage()
  }
})

watch([() => info.content, () => info.speed, () => info.textSize, () => info.textColor], () => {
  if (info.isPlay) void startBarrage()
})

onBeforeUnmount(stopBarrage)

const fullScreenPlay = () => {
  info.isPlay = !info.isPlay
}
</script>

<template>
  <div class="barrage-page flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 全屏弹幕 -->
    <div
      v-if="info.isPlay"
      class="barrage-stage"
      :style="{ backgroundColor: info.bgColor }"
      @dblclick="fullScreenPlay"
    >
      <div ref="trackRef" class="barrage-track" :style="barrageTextStyle">{{ info.content }}</div>
    </div>

    <button
      v-if="info.isPlay"
      type="button"
      class="barrage-exit-button"
      @click.stop="fullScreenPlay"
    >
      退出弹幕
    </button>

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex mb-2">
        <el-text class="w-20">弹幕内容:</el-text>
        <div class="w-72"><el-input v-model="info.content" type="textarea" :rows="3"></el-input></div>
      </div>

      <div class="flex mb-2">
        <el-text class="w-20">播放速度:</el-text>
        <div class="w-72 ml-2"><el-slider v-model="info.speed" :min="1" :max="100"/></div>
      </div>

      <div class="flex mb-2 items-center">
        <el-text class="w-20">循环间隔:</el-text>
        <div class="w-72 ml-2 flex items-center gap-2">
          <el-input-number v-model="info.loopInterval" :min="0" :max="10000" :step="100" controls-position="right" />
          <el-text>毫秒</el-text>
        </div>
      </div>

      <div class="flex mb-2">
        <el-text class="w-20">文字大小:</el-text>
        <div class="w-72 ml-2"><el-slider v-model="info.textSize" :min="12" :max="1000"/></div>
      </div>

      <div class="flex mb-2">
        <el-text class="w-20">文字颜色:</el-text>
        <div><el-color-picker v-model="info.textColor" size="large" /></div>
      </div>

      <div class="flex mb-2">
        <el-text class="w-20">背景颜色:</el-text>
        <div><el-color-picker v-model="info.bgColor" size="large" show-alpha /></div>
      </div>

      <div>
        <el-button @click="fullScreenPlay" type="primary" class="mr-3">{{ info.isPlay == false ? '播放' : '暂停'}}</el-button>
        <el-text>双击可退出弹幕</el-text>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        手持弹幕是一种新型的互动沟通工具，可以方便地为各种户外活动、演出嘉年华等活动增加趣味性和互动性。手持弹幕具有轻便、易携带、易操作等优点，可以让每个参与者都变成活动的一部分。同时，手持弹幕还可以通过预先编写的文本、表情等形式，表达参与者的情感和想法，实现沟通互动。在社交媒体时代，手持弹幕的使用也带来了更广泛的社交效应，增加了活动的互动性和传播度。无论是举办方还是参与者，手持弹幕都是一个非常有价值的互动工具。
      </el-text> 
    </ToolDetail>

  </div>
</template>

<style scoped>
  .barrage-stage {
  position: fixed;
  inset: 0;
  z-index: 99;
  overflow: hidden;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.barrage-track {
  position: absolute;
  top: 50%;
  left: 0;
  width: max-content;
  white-space: nowrap;
  line-height: 1;
  transform: translate3d(100vw, -50%, 0);
  user-select: none;
  -webkit-user-select: none;
  will-change: transform;
}

.barrage-exit-button {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 100;
  padding: 0.5rem 0.875rem;
  border: 1px solid rgb(255 255 255 / 0.35);
  border-radius: 0.5rem;
  color: #fff;
  background: rgb(15 23 42 / 0.78);
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.22);
  backdrop-filter: blur(8px);
  cursor: pointer;
  font-size: 0.875rem;
}

.barrage-exit-button:hover {
  background: rgb(30 41 59 / 0.92);
}
</style>