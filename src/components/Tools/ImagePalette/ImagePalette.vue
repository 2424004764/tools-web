<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '图片取色板'

interface PaletteColor {
  hex: string
  rgb: [number, number, number]
  ratio: number
}

const imageUrl = ref('')
const palette = ref<PaletteColor[]>([])
const colorCount = ref(8)
const isExtracting = ref(false)
const copied = ref('')

const fileInput = ref<HTMLInputElement>()

const pickFile = () => fileInput.value?.click()

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadImage(file)
  input.value = ''
}

const loadImage = (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    imageUrl.value = String(reader.result)
    extract()
  }
  reader.readAsDataURL(file)
}

const toHex = (n: number) => n.toString(16).padStart(2, '0')

function medianCut(pixels: [number, number, number][], target: number): PaletteColor[] {
  type Box = { pixels: [number, number, number][] }
  const rangeOf = (box: Box, ch: number) => {
    let min = 255
    let max = 0
    for (const p of box.pixels) {
      if (p[ch] < min) min = p[ch]
      if (p[ch] > max) max = p[ch]
    }
    return max - min
  }
  const score = (box: Box) => {
    if (box.pixels.length < 2) return -1
    return Math.max(rangeOf(box, 0), rangeOf(box, 1), rangeOf(box, 2)) * Math.log2(box.pixels.length + 1)
  }

  let boxes: Box[] = [{ pixels }]
  while (boxes.length < target) {
    boxes.sort((a, b) => score(b) - score(a))
    const box = boxes.shift()
    if (!box || box.pixels.length < 2) {
      if (box) boxes.push(box)
      break
    }
    let splitCh = 0
    let maxRange = -1
    for (const ch of [0, 1, 2]) {
      const r = rangeOf(box, ch)
      if (r > maxRange) {
        maxRange = r
        splitCh = ch
      }
    }
    box.pixels.sort((a, b) => a[splitCh] - b[splitCh])
    const mid = Math.floor(box.pixels.length / 2)
    boxes.push({ pixels: box.pixels.slice(0, mid) }, { pixels: box.pixels.slice(mid) })
  }

  const total = pixels.length
  return boxes
    .filter((b) => b.pixels.length > 0)
    .map((b) => {
      let r = 0
      let g = 0
      let bl = 0
      for (const p of b.pixels) {
        r += p[0]
        g += p[1]
        bl += p[2]
      }
      const n = b.pixels.length
      return {
        rgb: [Math.round(r / n), Math.round(g / n), Math.round(bl / n)] as [number, number, number],
        hex: toHex(Math.round(r / n)) + toHex(Math.round(g / n)) + toHex(Math.round(bl / n)),
        ratio: n / total,
      }
    })
    .sort((a, b) => b.ratio - a.ratio)
}

const extract = () => {
  if (!imageUrl.value) return
  isExtracting.value = true
  const img = new Image()
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 200 / Math.max(img.width, img.height))
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('canvas unavailable')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels: [number, number, number][] = []
      for (let i = 0; i < data.length; i += 4) {
        // 跳过完全透明与接近白色的背景像素权重由中位切分自然处理
        if (data[i + 3] < 125) continue
        pixels.push([data[i], data[i + 1], data[i + 2]])
      }
      if (!pixels.length) throw new Error('empty')
      palette.value = medianCut(pixels, colorCount.value)
    } catch (e) {
      console.error('取色失败:', e)
      ElMessage.error('取色失败，请重试')
    } finally {
      isExtracting.value = false
    }
  }
  img.onerror = () => {
    isExtracting.value = false
    ElMessage.error('图片加载失败')
  }
  img.src = imageUrl.value
}

const copyColor = async (c: PaletteColor) => {
  try {
    await navigator.clipboard.writeText('#' + c.hex)
    copied.value = c.hex
    ElMessage.success(`已复制 #${c.hex}`)
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
        <h1 class="text-h2 font-semibold">图片取色板</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          上传图片自动提取主色调色板（中位切分算法），点击色块复制 HEX 值，做设计配色的好帮手。
        </p>
      </header>

      <div class="palette-layout">
        <div class="palette-left">
          <div v-if="!imageUrl" class="palette-dropzone" @click="pickFile" @dragover.prevent>
            <p class="palette-dropzone-title">点击选择图片</p>
            <p class="text-body-sm text-slate-500">支持 PNG / JPG / WebP 等格式</p>
          </div>
          <div v-else class="palette-preview">
            <img :src="imageUrl" alt="图片预览" />
            <el-button size="small" class="mt-3" @click="pickFile">换一张</el-button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />

          <div class="palette-option">
            <span class="text-body-sm text-slate-500">颜色数量</span>
            <el-radio-group v-model="colorCount" @change="extract">
              <el-radio-button :value="4">4</el-radio-button>
              <el-radio-button :value="6">6</el-radio-button>
              <el-radio-button :value="8">8</el-radio-button>
              <el-radio-button :value="12">12</el-radio-button>
              <el-radio-button :value="16">16</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="palette-right">
          <template v-if="palette.length">
            <div class="palette-grid">
              <button
                v-for="c in palette"
                :key="c.hex"
                type="button"
                class="palette-swatch"
                :class="{ 'palette-swatch-copied': copied === c.hex }"
                :style="{ background: '#' + c.hex }"
                @click="copyColor(c)"
              >
                <span class="palette-swatch-hex" :class="{ 'palette-swatch-hex-light': c.ratio > 0.12 }">
                  #{{ c.hex.toUpperCase() }}
                </span>
                <span class="palette-swatch-ratio">{{ (c.ratio * 100).toFixed(1) }}%</span>
              </button>
            </div>
            <div class="palette-strip" :style="{ background: `linear-gradient(to right, ${palette.map((c) => '#' + c.hex).join(', ')})` }" />
            <p class="text-body-sm text-slate-500 mt-3">
              共提取 {{ palette.length }} 种主色，点击色块复制 HEX；色带可用于快速预览整体配色。
            </p>
          </template>
          <div v-else class="palette-empty">
            <p>{{ isExtracting ? '正在提取颜色…' : '上传图片后在此显示调色板' }}</p>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        图片会先等比缩小采样，再用中位切分（Median Cut）算法把像素按色彩分布聚类，提取出占比最高的若干主色，附每色的面积占比。点击任意色块即可复制 HEX 值粘贴到设计工具；切换颜色数量会自动重新提取。全部计算在浏览器本地完成，图片不会上传。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.palette-layout {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}

.palette-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.palette-dropzone {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1.5px dashed var(--el-border-color);
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
}

.palette-dropzone:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.palette-dropzone-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.palette-preview {
  display: flex;
  flex-direction: column;
}

.palette-preview img {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.palette-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

.palette-swatch {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 96px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  padding: 8px;
}

.palette-swatch:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgb(15 23 42 / 18%);
}

.palette-swatch-hex {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
  font-family: Consolas, Monaco, monospace;
}

.palette-swatch-hex-light {
  color: rgba(30, 30, 30, 0.9);
  text-shadow: none;
}

.palette-swatch-ratio {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
}

.palette-swatch-copied::after {
  content: '✓ 已复制';
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
}

.palette-strip {
  margin-top: 14px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color-lighter);
}

.palette-empty {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--el-border-color-lighter);
  border-radius: 10px;
  color: var(--el-text-color-placeholder);
}

.palette-empty p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 1023px) {
  .palette-layout {
    grid-template-columns: 1fr;
  }
}
</style>
