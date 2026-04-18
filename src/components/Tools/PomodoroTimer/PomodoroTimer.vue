<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '番茄工作法'
const workMinutes = ref(25)
const shortBreakMinutes = ref(5)
const longBreakMinutes = ref(15)
const cyclesBeforeLongBreak = ref(4)
const currentSessionType = ref<'work' | 'shortBreak' | 'longBreak'>('work')
const remainingSeconds = ref(workMinutes.value * 60)
const isRunning = ref(false)
const completedCycles = ref(0)
const autoStartNext = ref(true)
const timer = ref<ReturnType<typeof setInterval> | null>(null)

const sessionLabel = computed(() => {
  if (currentSessionType.value === 'work') return '工作番茄'
  if (currentSessionType.value === 'shortBreak') return '短休息'
  return '长休息'
})

const currentDuration = computed(() => {
  switch (currentSessionType.value) {
    case 'work':
      return workMinutes.value * 60
    case 'shortBreak':
      return shortBreakMinutes.value * 60
    case 'longBreak':
      return longBreakMinutes.value * 60
  }
})

const displayTime = computed(() => {
  const mm = Math.floor(remainingSeconds.value / 60)
  const ss = remainingSeconds.value % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
})

const progress = computed(() => {
  const total = currentDuration.value || 1
  return Math.min(100, Math.max(0, ((total - remainingSeconds.value) / total) * 100))
})

const nextSession = () => {
  if (currentSessionType.value === 'work') {
    completedCycles.value += 1
    if (completedCycles.value % cyclesBeforeLongBreak.value === 0) {
      currentSessionType.value = 'longBreak'
    } else {
      currentSessionType.value = 'shortBreak'
    }
  } else {
    currentSessionType.value = 'work'
  }
  remainingSeconds.value = currentDuration.value
}

const startTimer = () => {
  if (remainingSeconds.value <= 0) {
    remainingSeconds.value = currentDuration.value
  }
  if (remainingSeconds.value <= 0) return
  if (timer.value) return

  isRunning.value = true
  timer.value = setInterval(() => {
    if (remainingSeconds.value <= 1) {
      remainingSeconds.value = 0
      stopTimer()
      if (autoStartNext.value) {
        nextSession()
        startTimer()
      }
      return
    }
    remainingSeconds.value -= 1
  }, 1000)
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  isRunning.value = false
}

const pauseTimer = () => {
  stopTimer()
}

const resetTimer = () => {
  stopTimer()
  remainingSeconds.value = currentDuration.value
}

const resetAll = () => {
  stopTimer()
  currentSessionType.value = 'work'
  completedCycles.value = 0
  remainingSeconds.value = workMinutes.value * 60
}

watch(currentDuration, (value) => {
  if (!isRunning.value) {
    remainingSeconds.value = value
  }
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div class="space-y-4">
          <div>
            <div class="text-2xl font-semibold">番茄工作法</div>
            <div class="mt-1 text-sm text-slate-500">设置工作时长与休息周期，自动在短休息和长休息之间切换，提高专注与恢复效率。</div>
          </div>

          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="工作时长（分钟）">
                <el-input-number v-model="workMinutes" :min="1" :max="120" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="短休息（分钟）">
                <el-input-number v-model="shortBreakMinutes" :min="1" :max="30" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :xs="24" :sm="12">
              <el-form-item label="长休息（分钟）">
                <el-input-number v-model="longBreakMinutes" :min="5" :max="60" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="完成几个番茄后长休息">
                <el-input-number v-model="cyclesBeforeLongBreak" :min="2" :max="8" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>

          <div class="flex items-center gap-3 flex-wrap">
            <el-checkbox v-model="autoStartNext">自动开始下一阶段</el-checkbox>
            <el-button type="primary" plain size="small" @click="resetAll">重置所有</el-button>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">当前阶段</div>
              <div class="text-xl font-semibold text-slate-800">{{ sessionLabel }}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">已完成番茄</div>
              <div class="text-xl font-semibold text-slate-800">{{ completedCycles }}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div class="text-xs text-slate-500">当前进度</div>
              <div class="text-xl font-semibold text-slate-800">{{ progress.toFixed(0) }}%</div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="p-6 rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 text-white shadow-lg">
            <div class="text-sm opacity-90">{{ sessionLabel }}</div>
            <div class="mt-4 text-6xl font-semibold tracking-widest">{{ displayTime }}</div>
            <div class="mt-6 h-3 rounded-full bg-white/20 overflow-hidden">
              <div class="h-full bg-white transition-all" :style="{ width: progress + '%' }" />
            </div>
            <div class="mt-3 text-xs text-white/80">当前阶段进度 {{ progress.toFixed(0) }}%</div>
          </div>

          <div class="flex flex-wrap gap-3">
            <el-button type="primary" :disabled="isRunning" @click="startTimer">开始</el-button>
            <el-button type="warning" :disabled="!isRunning" @click="pauseTimer">暂停</el-button>
            <el-button type="danger" @click="resetTimer">重置阶段</el-button>
          </div>

          <div class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            提示：工作阶段结束后会自动切换到休息阶段，休息阶段结束后切换回工作阶段。开启“自动开始下一阶段”可无缝连续专注。          
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        番茄工作法工具可以帮助你按固定工作/休息周期专注执行任务。设置工作时长、短休息和长休息时长，以及完成几个番茄后进入长休息。支持自动切换并显示当前阶段进度。
      </el-text>
    </ToolDetail>
  </div>
</template>
