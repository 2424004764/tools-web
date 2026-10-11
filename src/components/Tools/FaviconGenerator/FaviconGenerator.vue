<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import JSZip from 'jszip'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'Favicon 生成器'

const sourceImage = ref('')
const sourceName = ref('')
const bgTransparent = ref(true)
const isGenerating = ref(false)

const SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 512]
const ICO_SIZES = [16, 32, 48]

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
    ElMessage.warning('请选择图片文件（PNG/JPG/SVG 等）')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    sourceImage.value = String(reader.result)
    sourceName.value = file.name.replace(/\.[^.]+$/, '')
  }
  reader.readAsDataURL(file)
}

const onDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files?.[0]
  if (file) loadImage(file)
}

const renderSize = (size: number): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)
      if (!bgTransparent.value) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
      }
      // 短边居中裁剪成正方形再缩放
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    }
    img.onerror = () => resolve(null)
    img.src = sourceImage.value
  })
}

// 将多张 PNG 打包成 ICO 容器（PNG-in-ICO，Vista+ 全支持）
async function packIco(pngs: { size: number; blob: Blob }[]): Promise<Blob> {
  const buffers = await Promise.all(pngs.map(async (p) => new Uint8Array(await p.blob.arrayBuffer())))
  const count = pngs.length
  const headerSize = 6 + count * 16
  const totalSize = headerSize + buffers.reduce((s, b) => s + b.length, 0)
  const out = new Uint8Array(totalSize)
  const view = new DataView(out.buffer)

  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, count, true) // image count

  let offset = headerSize
  buffers.forEach((buf, i) => {
    const entry = 6 + i * 16
    const size = pngs[i].size
    out[entry] = size >= 256 ? 0 : size // 0 表示 256
    out[entry + 1] = size >= 256 ? 0 : size
    out[entry + 2] = 0 // palette
    out[entry + 3] = 0 // reserved
    view.setUint16(entry + 4, 1, true) // planes
    view.setUint16(entry + 6, 32, true) // bpp
    view.setUint32(entry + 8, buf.length, true)
    view.setUint32(entry + 12, offset, true)
    out.set(buf, offset)
    offset += buf.length
  })
  return new Blob([out], { type: 'image/x-icon' })
}

const downloadBlob = (blob: Blob, filename: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const downloadOne = async (size: number) => {
  const blob = await renderSize(size)
  if (!blob) return ElMessage.error('生成失败，请重试')
  downloadBlob(blob, `favicon-${size}x${size}.png`)
}

const downloadIco = async () => {
  const pngs: { size: number; blob: Blob }[] = []
  for (const size of ICO_SIZES) {
    const blob = await renderSize(size)
    if (blob) pngs.push({ size, blob })
  }
  if (!pngs.length) return ElMessage.error('生成失败，请重试')
  const ico = await packIco(pngs)
  downloadBlob(ico, 'favicon.ico')
}

const downloadAll = async () => {
  if (!sourceImage.value) {
    ElMessage.warning('请先上传图片')
    return
  }
  isGenerating.value = true
  try {
    const zip = new JSZip()
    const folder = zip.folder('favicon') || zip
    for (const size of SIZES) {
      const blob = await renderSize(size)
      if (blob) folder.file(`favicon-${size}x${size}.png`, blob)
    }
    const pngs: { size: number; blob: Blob }[] = []
    for (const size of ICO_SIZES) {
      const blob = await renderSize(size)
      if (blob) pngs.push({ size, blob })
    }
    if (pngs.length) folder.file('favicon.ico', await packIco(pngs))
    folder.file(
      'README.txt',
      [
        '使用方法：',
        '1. 将 favicon.ico 放到网站根目录',
        '2. 在 <head> 中添加：',
        '   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        '   <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180x180.png">',
        '   <link rel="manifest" href="/site.webmanifest">',
        '3. PWA 需要 192x192 与 512x512 两个尺寸',
      ].join('\n'),
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, `${sourceName.value || 'favicon'}-icons.zip`)
    ElMessage.success('打包完成')
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">Favicon 生成器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          上传图片一键生成全尺寸网站图标：16~512px PNG、苹果触屏图标与多尺寸合一的 favicon.ico。
        </p>
      </header>

      <div class="fav-layout">
        <div class="fav-upload-col">
          <div
            class="fav-dropzone"
            :class="{ 'fav-dropzone-active': !!sourceImage }"
            @click="pickFile"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <img v-if="sourceImage" :src="sourceImage" alt="源图片预览" class="fav-source-preview" />
            <template v-else>
              <p class="fav-dropzone-title">点击或拖拽图片到此处</p>
              <p class="text-body-sm text-slate-500">支持 PNG / JPG / SVG，建议使用正方形图片</p>
            </template>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />

          <div class="fav-options">
            <el-checkbox v-model="bgTransparent">非正方形图片保持透明背景</el-checkbox>
          </div>

          <el-button type="primary" class="w-full" :loading="isGenerating" :disabled="!sourceImage" @click="downloadAll">
            打包下载全部尺寸（ZIP）
          </el-button>
        </div>

        <div class="fav-output-col">
          <div v-if="sourceImage" class="fav-grid">
            <div v-for="size in SIZES" :key="size" class="fav-cell">
              <div class="fav-cell-preview">
                <img :src="sourceImage" :style="{ width: Math.min(size, 64) + 'px', height: Math.min(size, 64) + 'px' }" alt="" />
              </div>
              <span class="fav-cell-size">{{ size }}×{{ size }}{{ size === 180 ? ' 苹果' : size >= 192 ? ' PWA' : '' }}</span>
              <el-button size="small" text type="primary" @click="downloadOne(size)">下载</el-button>
            </div>
            <div class="fav-cell">
              <div class="fav-cell-preview">
                <span class="fav-ico-badge">.ico</span>
              </div>
              <span class="fav-cell-size">favicon.ico（16+32+48）</span>
              <el-button size="small" text type="primary" @click="downloadIco">下载</el-button>
            </div>
          </div>
          <div v-else class="fav-empty">
            <p>上传图片后在此预览各尺寸效果</p>
            <div class="fav-empty-demo">
              <span v-for="s in [16, 32, 48, 64]" :key="s" class="fav-empty-demo-box" :style="{ width: s + 'px', height: s + 'px' }" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        上传任意图片（建议正方形），工具自动居中裁剪并缩放出 16、32、48、64、96、128、180（苹果触屏图标）、192 与 512（PWA 图标）九种尺寸的 PNG，以及把 16+32+48 三种尺寸打包进单个 favicon.ico 文件。可单独下载某个尺寸，或一键打包全部并附 HTML 引用说明。所有转换通过 Canvas 在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.fav-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}

.fav-upload-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fav-dropzone {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border: 1.5px dashed var(--el-border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  text-align: center;
}

.fav-dropzone:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.fav-dropzone-active {
  border-style: solid;
}

.fav-dropzone-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.fav-source-preview {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  border-radius: 6px;
}

.fav-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.fav-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.fav-cell-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
  /* 棋盘格背景衬托透明部分 */
  background-image:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%),
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%);
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
  border-radius: 6px;
  width: 100%;
}

.fav-cell-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fav-ico-badge {
  font-family: Consolas, Monaco, monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-color-primary);
  border: 1.5px solid var(--el-color-primary);
  border-radius: 6px;
  padding: 4px 10px;
  background: #fff;
}

.fav-empty {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border: 1.5px dashed var(--el-border-color-lighter);
  border-radius: 10px;
  color: var(--el-text-color-placeholder);
}

.fav-empty p {
  margin: 0;
  font-size: 14px;
}

.fav-empty-demo {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.fav-empty-demo-box {
  border-radius: 4px;
  background: var(--el-fill-color-dark);
}

@media (max-width: 1023px) {
  .fav-layout {
    grid-template-columns: 1fr;
  }
}
</style>
