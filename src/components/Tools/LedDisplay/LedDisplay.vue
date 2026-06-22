<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'LED 显示屏'
const showPanel = ref(true)

interface LedParams {
  text: string
  color: string
  bg: string
  size: number
  bold: boolean
  speed: number
  border: boolean
  glow: boolean
  dot: boolean
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const DEFAULT_PARAMS: LedParams = {
  text: '欢迎使用 LED 显示屏',
  color: '#ff0000',
  bg: '#000000',
  size: 120,
  bold: true,
  speed: 20,
  border: true,
  glow: true,
  dot: false,
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const parseParams = (): LedParams => {
  const sp = new URLSearchParams(window.location.search)
  const get = (k: string) => sp.get(k) ?? ''
  const num = (k: string, def: number) => {
    const v = parseInt(get(k), 10)
    return Number.isFinite(v) ? v : def
  }
  // 布尔：参数缺失 → 默认值；参数为空串 → true；其他按 '1' 判断
  const parseBool = (k: string, defaultVal: boolean): boolean => {
    const v = sp.get(k)
    if (v === null) return defaultVal
    if (v === '') return true
    return v === '1'
  }

  const color = HEX_RE.test(get('color')) ? get('color') : DEFAULT_PARAMS.color
  const bg = HEX_RE.test(get('bg')) ? get('bg') : DEFAULT_PARAMS.bg

  return {
    text: get('text') || DEFAULT_PARAMS.text,
    color,
    bg,
    size: clamp(num('size', DEFAULT_PARAMS.size), 20, 300),
    bold: parseBool('bold', DEFAULT_PARAMS.bold),
    speed: clamp(num('speed', DEFAULT_PARAMS.speed), 5, 60),
    border: parseBool('border', DEFAULT_PARAMS.border),
    glow: parseBool('glow', DEFAULT_PARAMS.glow),
    dot: parseBool('dot', DEFAULT_PARAMS.dot),
  }
}

const params = ref(parseParams())

const syncUrl = () => {
  const sp = new URLSearchParams()
  sp.set('text', params.value.text)
  sp.set('color', params.value.color)
  sp.set('bg', params.value.bg)
  sp.set('size', String(params.value.size))
  sp.set('speed', String(params.value.speed))
  if (params.value.bold) sp.set('bold', '1')
  if (params.value.border) sp.set('border', '1')
  if (params.value.glow) sp.set('glow', '1')
  if (params.value.dot) sp.set('dot', '1')
  const newUrl = `${window.location.pathname}?${sp.toString()}`
  window.history.replaceState({}, '', newUrl)
}

watch(params, syncUrl, { deep: true })

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('URL 已复制')
  } catch {
    // 兜底：老浏览器或非安全上下文
    const ta = document.createElement('textarea')
    ta.value = window.location.href
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('URL 已复制')
  }
}

const cssVars = computed(() => ({
  '--color': params.value.color,
  '--bg': params.value.bg,
  '--size': params.value.size + 'px',
  '--speed': params.value.speed + 's',
  '--font-weight': params.value.bold ? 'bold' : 'normal',
}))
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="led-screen mb-4" :style="cssVars" :class="{
        'no-border': !params.border,
        'dot': params.dot,
      }">
        <div class="led-text" :class="{ 'no-glow': !params.glow }">
          {{ params.text }}
        </div>
      </div>
    </div>

    <div class="p-4 mt-3 rounded-2xl bg-white">
      <el-button @click="showPanel = !showPanel">
        {{ showPanel ? '隐藏' : '显示' }}配置面板
      </el-button>
      <div v-if="showPanel" class="space-y-4 mt-3">
        <el-form label-position="top" :inline="false">
          <el-form-item label="显示文字">
            <el-input v-model="params.text" placeholder="输入要播放的文字" clearable />
          </el-form-item>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <el-form-item label="文字颜色">
              <el-color-picker v-model="params.color" />
              <el-input v-model="params.color" class="ml-2" style="width: 140px" />
            </el-form-item>

            <el-form-item label="背景颜色">
              <el-color-picker v-model="params.bg" />
              <el-input v-model="params.bg" class="ml-2" style="width: 140px" />
            </el-form-item>

            <el-form-item label="字号 ({{ params.size }}px)">
              <el-slider v-model="params.size" :min="20" :max="300" :step="1" show-input />
            </el-form-item>

            <el-form-item label="滚动速度 ({{ params.speed }}s/周期)">
              <el-slider v-model="params.speed" :min="5" :max="60" :step="1" show-input />
            </el-form-item>
          </div>

          <el-form-item label="样式选项">
            <el-checkbox v-model="params.bold">粗体</el-checkbox>
            <el-checkbox v-model="params.border">边框</el-checkbox>
            <el-checkbox v-model="params.glow">发光</el-checkbox>
            <el-checkbox v-model="params.dot">点阵背景</el-checkbox>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="copyUrl">复制分享 URL</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>LED 显示屏工具，支持自定义文字、颜色、滚动效果。</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
@keyframes led-scroll {
  0%   { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
}

.led-screen {
  position: relative;
  height: 35vh;
  min-height: 200px;
  display: flex;
  align-items: center;
  overflow: hidden;
  background-color: var(--bg);
  border: 4px solid #333;
  border-radius: 8px;
  box-shadow:
    0 0 30px var(--color),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.led-text {
  color: var(--color);
  font-size: var(--size);
  font-weight: var(--font-weight);
  white-space: nowrap;
  display: inline-block;
  animation: led-scroll var(--speed) linear infinite;
  will-change: transform;
}

.led-screen.no-border {
  border: none;
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.led-text.no-glow {
  text-shadow: none;
}

.led-text:not(.no-glow) {
  text-shadow: 0 0 10px var(--color), 0 0 20px var(--color);
}

.led-screen.dot::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 8px 8px;
  pointer-events: none;
  border-radius: 6px;
}
</style>