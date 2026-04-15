<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  digit: string
  cardTopBg?: string
  cardBottomBg?: string
  digitColor?: string
}>()

const currentDigit = ref(props.digit)
const previousDigit = ref(props.digit)
const isFlipping = ref(false)
const flipKey = ref(0)

watch(() => props.digit, (newVal, oldVal) => {
  if (newVal === oldVal) return
  previousDigit.value = oldVal ?? newVal
  currentDigit.value = newVal
  flipKey.value++
  isFlipping.value = true
  setTimeout(() => {
    isFlipping.value = false
  }, 600)
})
</script>

<template>
  <div class="flip-card">
    <!-- 静止上半：始终显示新数字 -->
    <div class="card-face top" :style="{ background: cardTopBg, color: digitColor }">
      <span class="digit">{{ currentDigit }}</span>
    </div>
    <!-- 静止下半：动画结束后更新为新数字 -->
    <div class="card-face bottom" :style="{ background: cardBottomBg, color: digitColor }">
      <span class="digit">{{ isFlipping ? previousDigit : currentDigit }}</span>
    </div>
    <!-- 翻转上半：显示旧数字，向下翻 -->
    <div v-if="isFlipping" :key="'ft' + flipKey" class="card-face flip-top" :style="{ background: cardTopBg, color: digitColor }">
      <span class="digit">{{ previousDigit }}</span>
    </div>
    <!-- 翻转下半：显示新数字，向上翻 -->
    <div v-if="isFlipping" :key="'fb' + flipKey" class="card-face flip-bottom" :style="{ background: cardBottomBg, color: digitColor }">
      <span class="digit">{{ currentDigit }}</span>
    </div>
  </div>
</template>

<style scoped>
.flip-card {
  position: relative;
  width: 80px;
  height: 120px;
  perspective: 300px;
}

.card-face {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0f0f0;
}

.card-face .digit {
  font-size: 64px;
  font-weight: 700;
  line-height: 120px;
  font-family: 'DIN Alternate', 'Helvetica Neue', Arial, sans-serif;
  color: inherit;
  text-align: center;
}

.card-face.top {
  top: 0;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(to bottom, #2d2d3f, #252538);
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
}

.card-face.top .digit {
  position: absolute;
  top: 0;
  width: 100%;
  height: 200%;
}

.card-face.bottom {
  bottom: 0;
  border-radius: 0 0 8px 8px;
  background: linear-gradient(to bottom, #1e1e2f, #1a1a2d);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-face.bottom .digit {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 200%;
}

/* 翻转上半 */
.card-face.flip-top {
  top: 0;
  z-index: 2;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(to bottom, #2d2d3f, #252538);
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
  transform-origin: bottom center;
  backface-visibility: hidden;
  animation: flip-top-down 0.3s ease-in forwards;
}

.card-face.flip-top .digit {
  position: absolute;
  top: 0;
  width: 100%;
  height: 200%;
}

/* 翻转下半 */
.card-face.flip-bottom {
  bottom: 0;
  z-index: 1;
  border-radius: 0 0 8px 8px;
  background: linear-gradient(to bottom, #1e1e2f, #1a1a2d);
  transform-origin: top center;
  transform: rotateX(90deg);
  backface-visibility: hidden;
  animation: flip-bottom-up 0.3s 0.3s ease-out forwards;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-face.flip-bottom .digit {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 200%;
}

/* 翻转阴影 */
.card-face.flip-top::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  animation: shadow-top 0.3s ease-in forwards;
}

.card-face.flip-bottom::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.06);
  animation: shadow-bottom 0.3s 0.3s ease-out forwards;
}

@keyframes flip-top-down {
  0% { transform: rotateX(0deg); }
  100% { transform: rotateX(-90deg); }
}

@keyframes flip-bottom-up {
  0% { transform: rotateX(90deg); }
  100% { transform: rotateX(0deg); }
}

@keyframes shadow-top {
  0% { background: rgba(0, 0, 0, 0); }
  100% { background: rgba(0, 0, 0, 0.06); }
}

@keyframes shadow-bottom {
  0% { background: rgba(0, 0, 0, 0.06); }
  100% { background: rgba(0, 0, 0, 0); }
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .flip-card {
    width: 50px;
    height: 72px;
  }

  .card-face .digit {
    font-size: 40px;
    line-height: 72px;
  }

  .card-face.top,
  .card-face.flip-top {
    border-radius: 6px 6px 0 0;
  }

  .card-face.bottom,
  .card-face.flip-bottom {
    border-radius: 0 0 6px 6px;
  }
}
</style>
