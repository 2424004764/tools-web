<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import JSZip from 'jszip'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '九宫格切图'

const imageUrl = ref('')
const imageName = ref('')
const gridCount = ref<3 | 4>(3)
const cutMode = ref<'square' | 'origin'>('square')
const gap = ref(8)
const pieces = ref<{ url: string; row: number; col: number; blob: Blob }[]>([])
const isCutting = ref(false)

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
    imageName.value = file.name.replace(/\.[^.]+$/, '')
    pieces.value = []
  }
  reader.readAsDataURL(file)
}

const doCut = async () => {
  if (!imageUrl.value) {
    ElMessage.warning('请先上传图片')
    return
  }
  isCutting.value = true
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('图片加载失败'))
      i.src = imageUrl.value
    })

    const n = gridCount.value
    let sx0 = 0
    let sy0 = 0
    let side = 0
    let cellW = 0
    let cellH = 0

    if (cutMode.value === 'square') {
      side = Math.min(img.width, img.height)
      sx0 = (img.width - side) / 2
      sy0 = (img.height - side) / 2
      cellW = side / n
      cellH = cellW
    } else {
      cellW = img.width / n
      cellH = img.height / n
    }

    const out: { url: string; row: number; col: number; blob: Blob }[] = []
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(cellW)
        canvas.height = Math.round(cellH)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas unavailable')
        ctx.drawImage(
          img,
          sx0 + col * cellW,
          sy0 + row * cellH,
          cellW,
          cellH,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) out.push({ url: URL.createObjectURL(blob), row, col, blob })
      }
    }
    pieces.value.forEach((p) => URL.revokeObjectURL(p.url))
    pieces.value = out
    ElMessage.success(`已切出 ${out.length} 块`)
  } catch (e) {
    console.error('九宫格切图失败:', e)
    ElMessage.error('切图失败，请重试')
  } finally {
    isCutting.value = false
  }
}

const downloadOne = (piece: { url: string; row: number; col: number }) => {
  const a = document.createElement('a')
  a.href = piece.url
  a.download = `${imageName.value || 'grid'}_${piece.row + 1}-${piece.col + 1}.png`
  a.click()
}

const downloadAll = async () => {
  if (!pieces.value.length) return
  const zip = new JSZip()
  const folder = zip.folder(`${imageName.value || 'grid'}-${gridCount.value}x${gridCount.value}`) || zip
  for (const p of pieces.value) {
    folder.file(`${p.row + 1}-${p.col + 1}.png`, p.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${imageName.value || 'grid'}_九宫格.zip`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('打包完成')
}

const pieceStyle = (piece: { url: string }) => ({
  backgroundImage: `url(${piece.url})`,
  backgroundSize: 'cover',
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">九宫格切图</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          把一张图切成 3×3 或 4×4 九宫格，支持正方形裁剪预览，逐块或打包下载，适合朋友圈配图。
        </p>
      </header>

      <div class="grid-layout">
        <div class="grid-left">
          <div v-if="!imageUrl" class="grid-dropzone" @click="pickFile" @dragover.prevent>
            <p class="grid-dropzone-title">点击选择图片</p>
            <p class="text-body-sm text-slate-500">正方形图片效果最佳</p>
          </div>
          <div v-else class="grid-source">
            <img :src="imageUrl" alt="原图" />
            <el-button size="small" class="mt-3" @click="pickFile">换一张</el-button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />

          <div class="grid-options">
            <div class="grid-option">
              <span class="text-body-sm text-slate-500">切分</span>
              <el-radio-group v-model="gridCount">
                <el-radio-button :value="3">3 × 3</el-radio-button>
                <el-radio-button :value="4">4 × 4</el-radio-button>
              </el-radio-group>
            </div>
            <div class="grid-option">
              <span class="text-body-sm text-slate-500">裁剪</span>
              <el-radio-group v-model="cutMode">
                <el-radio-button value="square">居中正方形</el-radio-button>
                <el-radio-button value="origin">保持原比例</el-radio-button>
              </el-radio-group>
            </div>
            <el-button type="primary" :loading="isCutting" :disabled="!imageUrl" @click="doCut">开始切图</el-button>
          </div>
        </div>

        <div class="grid-right">
          <template v-if="pieces.length">
            <div
              class="grid-preview"
              :style="{
                gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
                gap: gap + 'px',
                aspectRatio: cutMode === 'square' ? '1' : undefined,
              }"
            >
              <div v-for="p in pieces" :key="`${p.row}-${p.col}`" class="grid-piece" :style="pieceStyle(p)" />
            </div>

            <div class="grid-actions">
              <div class="flex items-center gap-2">
                <span class="text-body-sm text-slate-500">预览间距 {{ gap }}px</span>
                <el-slider v-model="gap" :min="0" :max="24" :step="1" class="w-40" />
              </div>
              <el-button type="primary" @click="downloadAll">打包下载全部（ZIP）</el-button>
            </div>

            <div class="grid-pieces">
              <div v-for="p in pieces" :key="`dl-${p.row}-${p.col}`" class="grid-piece-card">
                <img :src="p.url" :alt="`第${p.row + 1}行第${p.col + 1}列`" />
                <span class="text-body-sm text-slate-500">{{ p.row + 1 }}-{{ p.col + 1 }}</span>
                <el-button size="small" text type="primary" @click="downloadOne(p)">下载</el-button>
              </div>
            </div>
          </template>
          <div v-else class="grid-empty">
            <p>上传图片并点击「开始切图」后，在此预览拼接效果</p>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        上传图片后选择 3×3 或 4×4 切分：「居中正方形」会先按短边裁出正方形（朋友圈九宫格推荐），「保持原比例」则直接均分原图。切图后上方按行序号显示拼接预览（可调间距模拟朋友圈效果），每块均可单独下载或一键打包 ZIP。全部处理通过 Canvas 在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.grid-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}

.grid-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grid-dropzone {
  display: flex;
  min-height: 200px;
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

.grid-dropzone:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.grid-dropzone-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.grid-source {
  display: flex;
  flex-direction: column;
}

.grid-source img {
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.grid-options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grid-option {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid-preview {
  display: grid;
  width: 100%;
  max-width: 420px;
  border-radius: 8px;
  overflow: hidden;
}

.grid-piece {
  aspect-ratio: 1;
  background-color: var(--el-fill-color-light);
}

.grid-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}

.grid-pieces {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.grid-piece-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.grid-piece-card img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}

.grid-empty {
  display: flex;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--el-border-color-lighter);
  border-radius: 10px;
  color: var(--el-text-color-placeholder);
}

.grid-empty p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 1023px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}
</style>
