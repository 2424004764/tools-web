<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'CSS 渐变生成器'

type GradType = 'linear' | 'radial' | 'conic'

const gradType = ref<GradType>('linear')
const angle = ref(90)
const radialShape = ref<'circle' | 'ellipse'>('ellipse')
const radialPos = ref('center')
const conicPos = ref('center')

interface Stop {
  color: string
  position: number
}

const stops = ref<Stop[]>([
  { color: '#4F46E5', position: 0 },
  { color: '#EC4899', position: 100 },
])

const posOptions = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']

const addStop = () => {
  const sorted = [...stops.value].sort((a, b) => a.position - b.position)
  const last = sorted[sorted.length - 1]
  stops.value.push({ color: '#FBBF24', position: Math.min(100, last.position + 20) })
}

const removeStop = (index: number) => {
  if (stops.value.length <= 2) {
    ElMessage.warning('渐变至少需要两个颜色')
    return
  }
  stops.value.splice(index, 1)
}

const sortedStops = computed(() => [...stops.value].sort((a, b) => a.position - b.position))

const cssValue = computed(() => {
  const s = sortedStops.value.map((st) => `${st.color} ${st.position}%`).join(', ')
  if (gradType.value === 'linear') return `linear-gradient(${angle.value}deg, ${s})`
  if (gradType.value === 'radial') return `radial-gradient(${radialShape.value} at ${radialPos.value}, ${s})`
  return `conic-gradient(from ${angle.value}deg at ${conicPos.value}, ${s})`
})

const cssCode = computed(() => `background: ${cssValue.value};`)

const randomize = () => {
  const palette = ['#4F46E5', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444', '#84CC16']
  const a = Math.floor(Math.random() * palette.length)
  let b = Math.floor(Math.random() * palette.length)
  if (b === a) b = (b + 3) % palette.length
  stops.value = [
    { color: palette[a], position: 0 },
    { color: palette[b], position: 100 },
  ]
  angle.value = Math.floor(Math.random() * 360)
}

const copyCss = async () => {
  try {
    await navigator.clipboard.writeText(cssCode.value)
    ElMessage.success('CSS 已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">CSS 渐变生成器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          可视化调节线性、径向、锥形渐变，实时预览并生成可直接粘贴的 CSS 代码。
        </p>
      </header>

      <div class="grad-layout">
        <div class="grad-controls">
          <div class="grad-field">
            <label>渐变类型</label>
            <el-radio-group v-model="gradType">
              <el-radio-button value="linear">线性</el-radio-button>
              <el-radio-button value="radial">径向</el-radio-button>
              <el-radio-button value="conic">锥形</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="gradType === 'linear' || gradType === 'conic'" class="grad-field">
            <label>角度 {{ angle }}°</label>
            <el-slider v-model="angle" :min="0" :max="360" :step="1" />
          </div>

          <div v-if="gradType === 'radial'" class="grad-field">
            <label>形状与位置</label>
            <div class="flex gap-2">
              <el-select v-model="radialShape" class="w-32">
                <el-option label="椭圆 ellipse" value="ellipse" />
                <el-option label="圆形 circle" value="circle" />
              </el-select>
              <el-select v-model="radialPos" class="flex-1">
                <el-option v-for="p in posOptions" :key="p" :label="p" :value="p" />
              </el-select>
            </div>
          </div>

          <div v-if="gradType === 'conic'" class="grad-field">
            <label>圆心位置</label>
            <el-select v-model="conicPos">
              <el-option v-for="p in posOptions" :key="p" :label="p" :value="p" />
            </el-select>
          </div>

          <div class="grad-field">
            <label>颜色节点</label>
            <div class="grad-stops">
              <div v-for="(stop, i) in stops" :key="i" class="grad-stop">
                <el-color-picker v-model="stop.color" show-alpha />
                <el-slider v-model="stop.position" :min="0" :max="100" :step="1" class="flex-1" />
                <span class="grad-stop-pos">{{ stop.position }}%</span>
                <el-button size="small" text type="danger" @click="removeStop(i)">✕</el-button>
              </div>
            </div>
            <el-button size="small" @click="addStop">+ 添加颜色节点</el-button>
          </div>

          <div class="flex gap-2">
            <el-button @click="randomize">🎲 随机搭配</el-button>
          </div>

          <div class="grad-code">
            <div class="grad-code-head">
              <span>CSS</span>
              <el-button size="small" text type="primary" @click="copyCss">复制</el-button>
            </div>
            <pre class="grad-code-body">{{ cssCode }}</pre>
          </div>
        </div>

        <div class="grad-preview-wrap">
          <div class="grad-preview" :style="{ background: cssValue }" />
          <p class="text-body-sm text-slate-500 mt-2 text-center">实时预览</p>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        支持三种渐变：线性（linear-gradient，按角度铺开）、径向（radial-gradient，从中心向外扩散）与锥形（conic-gradient，围绕圆心旋转）。添加多个颜色节点并拖动位置滑块可制作多彩渐变；「随机搭配」快速获得配色灵感。预览区域实时反映效果，点击「复制」即可把 background 一行 CSS 粘贴到项目中。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.grad-layout {
  display: grid;
  grid-template-columns: minmax(300px, 1.1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.grad-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grad-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grad-field > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.grad-stops {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grad-stop {
  display: flex;
  align-items: center;
  gap: 10px;
}

.grad-stop-pos {
  width: 42px;
  text-align: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.grad-code {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.grad-code-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--el-fill-color-light);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.grad-code-body {
  margin: 0;
  padding: 12px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #1e1e2e;
  color: #cdd6f4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.grad-preview-wrap {
  position: sticky;
  top: 16px;
}

.grad-preview {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  box-shadow: 0 2px 12px rgb(15 23 42 / 10%);
}

@media (max-width: 1023px) {
  .grad-layout {
    grid-template-columns: 1fr;
  }

  .grad-preview-wrap {
    position: static;
    order: -1;
  }
}
</style>
