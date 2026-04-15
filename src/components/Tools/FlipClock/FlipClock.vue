<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import FlipCard from './FlipCard.vue'
import { FullScreen, Refresh } from '@element-plus/icons-vue'

const title = '翻页时钟'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

const hours = computed(() => String(now.value.getHours()).padStart(2, '0'))
const minutes = computed(() => String(now.value.getMinutes()).padStart(2, '0'))
const seconds = computed(() => String(now.value.getSeconds()).padStart(2, '0'))

const h1 = computed(() => hours.value[0])
const h2 = computed(() => hours.value[1])
const m1 = computed(() => minutes.value[0])
const m2 = computed(() => minutes.value[1])
const s1 = computed(() => seconds.value[0])
const s2 = computed(() => seconds.value[1])

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const dateString = computed(() => {
  const d = now.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

// 全屏控制
const clockContainerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

const toggleFullscreen = () => {
  if (!clockContainerRef.value) return
  
  if (!document.fullscreenElement) {
    clockContainerRef.value.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`)
    })
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

// 主题设置
const themes = [
  {
    name: '琥珀',
    id: 'amber',
    container: 'linear-gradient(135deg, rgba(255, 251, 235, 0.8), rgba(254, 243, 199, 0.6))',
    cardTop: 'linear-gradient(to bottom, #2d2d3f, #252538)',
    cardBottom: 'linear-gradient(to bottom, #1e1e2f, #1a1a2d)',
    digit: '#f0f0f0',
    label: '#92400e',
    dot: '#f97316'
  },
  {
    name: '暗夜',
    id: 'dark',
    container: 'linear-gradient(135deg, #111827, #1f2937)',
    cardTop: 'linear-gradient(to bottom, #374151, #1f2937)',
    cardBottom: 'linear-gradient(to bottom, #111827, #0f172a)',
    digit: '#3b82f6',
    label: '#94a3b8',
    dot: '#3b82f6'
  },
  {
    name: '清新',
    id: 'fresh',
    container: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    cardTop: 'linear-gradient(to bottom, #059669, #047857)',
    cardBottom: 'linear-gradient(to bottom, #065f46, #064e3b)',
    digit: '#ecfdf5',
    label: '#065f46',
    dot: '#10b981'
  },
  {
    name: '梦幻',
    id: 'dream',
    container: 'linear-gradient(135deg, #faf5ff, #f3e8ff)',
    cardTop: 'linear-gradient(to bottom, #9333ea, #7e22ce)',
    cardBottom: 'linear-gradient(to bottom, #6b21a8, #581c87)',
    digit: '#fdf4ff',
    label: '#6b21a8',
    dot: '#a855f7'
  },
  {
    name: '极简',
    id: 'minimal',
    container: '#ffffff',
    cardTop: '#f3f4f6',
    cardBottom: '#e5e7eb',
    digit: '#1f2937',
    label: '#4b5563',
    dot: '#1f2937'
  }
]

const currentTheme = ref(themes[0])

const changeTheme = () => {
  const currentIndex = themes.findIndex(t => t.id === currentTheme.value.id)
  const nextIndex = (currentIndex + 1) % themes.length
  currentTheme.value = themes[nextIndex]
}

onMounted(() => {
  now.value = new Date()
  const ms = 1000 - now.value.getMilliseconds()
  setTimeout(() => {
    now.value = new Date()
    timer = setInterval(() => { now.value = new Date() }, 1000)
  }, ms)

  const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
  })
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1 items-center">
    <div class="w-full">
      <DetailHeader :title="title" />

      <div class="p-4 rounded-2xl bg-white shadow-sm mb-4">
        <div class="flex justify-end gap-3 mb-4">
          <el-button :icon="Refresh" circle @click="changeTheme" title="切换主题" />
          <el-button :icon="FullScreen" circle @click="toggleFullscreen" title="全屏显示" />
        </div>

        <div ref="clockContainerRef" class="flip-clock-container" :style="{ background: currentTheme.container, border: isFullscreen ? 'none' : '' }">
          <!-- 时钟卡片区域 -->
          <div class="flip-clock-display">
            <!-- 小时 -->
            <div class="flip-group">
              <div class="flip-pair">
                <FlipCard :digit="h1" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
                <FlipCard :digit="h2" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
              </div>
              <span class="flip-label" :style="{ color: currentTheme.label }">时</span>
            </div>

            <!-- 冒号 -->
            <div class="flip-colon">
              <span class="colon-dot" :style="{ background: currentTheme.dot }"></span>
              <span class="colon-dot" :style="{ background: currentTheme.dot }"></span>
            </div>

            <!-- 分钟 -->
            <div class="flip-group">
              <div class="flip-pair">
                <FlipCard :digit="m1" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
                <FlipCard :digit="m2" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
              </div>
              <span class="flip-label" :style="{ color: currentTheme.label }">分</span>
            </div>

            <!-- 冒号 -->
            <div class="flip-colon">
              <span class="colon-dot" :style="{ background: currentTheme.dot }"></span>
              <span class="colon-dot" :style="{ background: currentTheme.dot }"></span>
            </div>

            <!-- 秒 -->
            <div class="flip-group">
              <div class="flip-pair">
                <FlipCard :digit="s1" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
                <FlipCard :digit="s2" :cardTopBg="currentTheme.cardTop" :cardBottomBg="currentTheme.cardBottom" :digitColor="currentTheme.digit" />
              </div>
              <span class="flip-label" :style="{ color: currentTheme.label }">秒</span>
            </div>
          </div>

          <!-- 日期 -->
          <div class="flip-date" :style="{ color: currentTheme.label }">{{ dateString }}</div>
        </div>
      </div>

      <ToolDetail title="使用说明">
        <el-text>
          翻页时钟（Flip Clock）是一款经典的时间显示工具，模拟了机械翻页钟的翻页动画效果。
          每一秒数字变化时，上方卡片会以 3D 翻转动画过渡到新数字，呈现出优雅流畅的视觉效果。
          页面会自动与系统时间同步，实时显示当前时间与日期。支持全屏模式和多种配色主题。
        </el-text>
      </ToolDetail>
    </div>
  </div>
</template>

<style scoped>
.flip-clock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  padding: 60px 32px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(251, 191, 36, 0.2);
  animation: fade-in-up 0.6s ease-out;
  min-height: 400px;
  transition: all 0.3s ease;
}

.flip-clock-container:fullscreen {
  border-radius: 0;
  width: 100vw;
  height: 100vh;
  padding: 0;
  margin: 0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: v-bind('currentTheme.container') !important;
}

.flip-clock-container:fullscreen .flip-clock-display {
  transform: scale(1.5);
}

.flip-clock-container:fullscreen .flip-date {
  transform: scale(1.2);
  margin-top: 60px;
}

.flip-clock-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.flip-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.flip-pair {
  display: flex;
  gap: 8px;
}

.flip-label {
  font-size: 13px;
  color: #92400e;
  font-weight: 500;
  letter-spacing: 2px;
}

.flip-colon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}

.colon-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f97316;
  animation: colon-pulse 1s ease-in-out infinite;
}

.flip-date {
  text-align: center;
  margin-top: 24px;
  font-size: 16px;
  color: #92400e;
  font-weight: 500;
  letter-spacing: 2px;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes colon-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 768px) {
  .flip-clock-container {
    padding: 24px 12px;
    border-radius: 16px;
    min-height: 300px;
  }

  .flip-clock-display {
    gap: 8px;
  }

  .flip-pair {
    gap: 4px;
  }

  .flip-label {
    font-size: 11px;
    letter-spacing: 1px;
  }

  .colon-dot {
    width: 6px;
    height: 6px;
  }

  .flip-colon {
    gap: 8px;
    padding: 0 2px;
  }

  .flip-date {
    margin-top: 16px;
    font-size: 13px;
    letter-spacing: 1px;
  }
}
</style>
