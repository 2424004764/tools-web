<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '倒计时计时器'
const minutes = ref(5)
const seconds = ref(0)
const remainingSeconds = ref(300)
const isRunning = ref(false)
const timer = ref<ReturnType<typeof setInterval> | null>(null)

const selectedSeconds = computed(() => Math.max(0, minutes.value * 60 + seconds.value))
const displaySeconds = computed(() => remainingSeconds.value)
const displayTime = computed(() => {
  const total = displaySeconds.value
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
})

const progress = computed(() => {
  const total = selectedSeconds.value || 1
  const current = selectedSeconds.value > 0 ? selectedSeconds.value - displaySeconds.value : 0
  return Math.min(100, Math.max(0, (current / total) * 100))
})

const isComplete = computed(() => !isRunning.value && remainingSeconds.value === 0 && selectedSeconds.value > 0)

const clearTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  isRunning.value = false
}

const startTimer = () => {
  if (remainingSeconds.value <= 0) {
    remainingSeconds.value = selectedSeconds.value
  }

  if (remainingSeconds.value <= 0) {
    return
  }

  if (timer.value) {
    return
  }

  isRunning.value = true
  timer.value = setInterval(() => {
    if (remainingSeconds.value <= 1) {
      clearTimer()
      remainingSeconds.value = 0
      return
    }
    remainingSeconds.value -= 1
  }, 1000)
}

const pauseTimer = () => {
  clearTimer()
}

const resetTimer = () => {
  clearTimer()
  remainingSeconds.value = selectedSeconds.value
}

const applyPreset = (value: number) => {
  minutes.value = Math.floor(value / 60)
  seconds.value = value % 60
}

watch(selectedSeconds, (newSeconds) => {
  if (!isRunning.value) {
    remainingSeconds.value = newSeconds
  }
})

onBeforeUnmount(() => {
  clearTimer()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="grid gap-6 sm:grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <div class="space-y-4">
          <div>
            <div class="text-2xl font-semibold">倒计时设置</div>
            <div class="mt-1 text-sm text-slate-500">输入倒计时时长，点击开始即可实时倒数，支持暂停和重置。</div>
          </div>

          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="分钟">
                <el-input-number v-model="minutes" :min="0" :max="999" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="秒钟">
                <el-input-number v-model="seconds" :min="0" :max="59" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>

          <div class="space-y-3">
            <div class="text-sm font-medium text-slate-700">常用时长</div>
            <div class="flex flex-wrap gap-2">
              <el-button v-for="item in [60, 180, 300, 600, 900, 1800]" :key="item" type="info" size="small" @click="applyPreset(item)">
                {{ item >= 60 ? item / 60 + '分钟' : item + '秒' }}
              </el-button>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">当前时长</div>
              <div class="text-xl font-semibold text-slate-800">{{ selectedSeconds > 0 ? displayTime : '00:00' }}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">剩余时间</div>
              <div class="text-xl font-semibold text-slate-800">{{ displayTime }}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">状态</div>
              <div class="text-xl font-semibold text-slate-800">{{ isRunning ? '运行中' : isComplete ? '已结束' : '就绪' }}</div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="p-6 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-sky-600 text-white shadow-lg">
            <div class="text-sm opacity-90">倒计时显示</div>
            <div class="mt-4 text-5xl font-semibold tracking-widest">{{ displayTime }}</div>
            <div class="mt-6 h-3 rounded-full bg-white/20 overflow-hidden">
              <div class="h-full bg-white transition-all" :style="{ width: progress + '%' }" />
            </div>
            <div class="mt-3 text-xs text-white/80">已完成 {{ progress.toFixed(0) }}%</div>
          </div>

          <div class="flex flex-wrap gap-3">
            <el-button type="primary" :disabled="selectedSeconds === 0" @click="startTimer">{{ isRunning ? '运行中' : '开始' }}</el-button>
            <el-button type="warning" :disabled="!isRunning" @click="pauseTimer">暂停</el-button>
            <el-button type="danger" :disabled="selectedSeconds === 0" @click="resetTimer">重置</el-button>
          </div>

          <div v-if="isComplete" class="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            时间到！倒计时已结束，可重置或修改时长重新开始。
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        倒计时计时器适合学习、办公、运动等场景。支持自定义分钟和秒钟输入，快速选择常用时长，并提供开始、暂停和重置操作。倒计时结束后会自动停止，并提示已结束。
      </el-text>
    </ToolDetail>
  </div>
</template>
