<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '图片 EXIF 查看/清除'

interface ExifRow {
  key: string
  label: string
  value: string
}

const imageUrl = ref('')
const imageName = ref('')
const rows = ref<ExifRow[]>([])
const hasGps = ref(false)
const isCleanProcessing = ref(false)
const cleanQuality = ref(92)

const LABELS: Record<string, string> = {
  Make: '相机制造商',
  Model: '相机型号',
  LensModel: '镜头型号',
  DateTimeOriginal: '拍摄时间',
  CreateDate: '创建时间',
  ModifyDate: '修改时间',
  ExposureTime: '曝光时间',
  FNumber: '光圈值',
  ISO: '感光度 ISO',
  FocalLength: '焦距',
  ExposureCompensation: '曝光补偿',
  MeteringMode: '测光模式',
  Flash: '闪光灯',
  WhiteBalance: '白平衡',
  Orientation: '方向',
  ColorSpace: '色彩空间',
  Software: '处理软件',
  Artist: '作者',
  Copyright: '版权',
  ImageWidth: '图片宽度',
  ImageHeight: '图片高度',
  latitude: 'GPS 纬度',
  longitude: 'GPS 经度',
}

const fileInput = ref<HTMLInputElement>()

const pickFile = () => fileInput.value?.click()

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadFile(file)
  input.value = ''
}

const loadFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  imageName.value = file.name
  imageUrl.value = URL.createObjectURL(file)
  rows.value = []
  hasGps.value = false

  try {
    const exifr = await import('exifr')
    const [tags, gps] = await Promise.all([
      exifr.parse(file).catch(() => null),
      exifr.gps(file).catch(() => null),
    ])
    const all: Record<string, unknown> = { ...(tags || {}) }
    if (gps && (gps.latitude !== undefined || gps.longitude !== undefined)) {
      all.latitude = gps.latitude
      all.longitude = gps.longitude
      hasGps.value = true
    }
    const entries = Object.entries(all).filter(
      ([, v]) =>
        v !== undefined &&
        v !== null &&
        v !== '' &&
        (typeof v === 'string' || typeof v === 'number'),
    )
    if (!entries.length) {
      ElMessage.info('该图片未包含 EXIF 信息')
      return
    }
    // 常用字段排前，其余按原顺序
    const priority = ['Make', 'Model', 'LensModel', 'DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength']
    entries.sort((a, b) => {
      const ia = priority.indexOf(a[0])
      const ib = priority.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    rows.value = entries.map(([key, value]) => {
      let v = String(value)
      if (typeof value === 'number') v = Number.isInteger(value) ? String(value) : value.toFixed(4)
      if (key === 'ExposureTime' && typeof value === 'number' && value < 1) v = `1/${Math.round(1 / value)}s`
      if (key === 'FNumber' && typeof value === 'number') v = `f/${value}`
      if (key === 'FocalLength' && typeof value === 'number') v = `${value}mm`
      return { key, label: LABELS[key] || key, value: v }
    })
  } catch (e) {
    console.error('EXIF 解析失败:', e)
    ElMessage.error('EXIF 解析失败')
  }
}

// 通过 Canvas 重新编码即可剥离全部 EXIF/GPS 元数据
const cleanAndDownload = () => {
  if (!imageUrl.value) return
  isCleanProcessing.value = true
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      isCleanProcessing.value = false
      return
    }
    ctx.drawImage(img, 0, 0)
    canvas.toBlob(
      (blob) => {
        isCleanProcessing.value = false
        if (!blob) return ElMessage.error('处理失败，请重试')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${imageName.value.replace(/\.[^.]+$/, '')}_clean.jpg`
        a.click()
        URL.revokeObjectURL(a.href)
        ElMessage.success('已生成不含 EXIF 的图片')
      },
      'image/jpeg',
      cleanQuality.value / 100,
    )
  }
  img.onerror = () => {
    isCleanProcessing.value = false
    ElMessage.error('图片加载失败')
  }
  img.src = imageUrl.value
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">图片 EXIF 查看/清除</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          查看照片的拍摄参数与 GPS 位置信息，一键剥离全部 EXIF 元数据后下载，防止隐私泄露。
        </p>
      </header>

      <div class="exif-layout">
        <div class="exif-left">
          <div
            v-if="!imageUrl"
            class="exif-dropzone"
            @click="pickFile"
            @dragover.prevent
          >
            <p class="exif-dropzone-title">点击选择照片</p>
            <p class="text-body-sm text-slate-500">支持 JPG / PNG / WebP / HEIC 等格式</p>
          </div>
          <div v-else class="exif-preview">
            <img :src="imageUrl" alt="图片预览" />
            <div class="exif-preview-actions">
              <el-button size="small" @click="pickFile">换一张</el-button>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />

          <div v-if="imageUrl" class="exif-clean-panel">
            <el-alert
              v-if="hasGps"
              type="warning"
              :closable="false"
              show-icon
              title="此照片包含 GPS 位置信息，分享前建议清除"
              class="mb-3"
            />
            <div class="exif-quality">
              <span class="text-body-sm text-slate-500">输出质量 {{ cleanQuality }}%</span>
              <el-slider v-model="cleanQuality" :min="40" :max="100" :step="1" />
            </div>
            <el-button type="primary" class="w-full" :loading="isCleanProcessing" @click="cleanAndDownload">
              去除 EXIF 并下载（JPG）
            </el-button>
            <p class="text-body-sm text-slate-500 mt-2">
              通过 Canvas 重新编码剥离全部元数据，画质几乎无损
            </p>
          </div>
        </div>

        <div class="exif-right">
          <el-table v-if="rows.length" :data="rows" size="small" max-height="560">
            <el-table-column label="项目" width="150">
              <template #default="{ row }">
                {{ row.label }}
                <el-tag v-if="row.key === 'latitude' || row.key === 'longitude'" size="small" type="warning" class="ml-1">GPS</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="值">
              <template #default="{ row }">
                <span class="exif-value">{{ row.value }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="exif-empty">
            <p>上传照片后在此显示 EXIF 拍摄参数</p>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        左侧上传照片后，右侧会列出相机型号、拍摄时间、光圈快门感光度等 EXIF 参数；若照片带 GPS 定位会醒目提示。点击「去除 EXIF 并下载」会用 Canvas 重新编码生成一张全新的 JPG——元数据全部清除、画面不变，适合发朋友圈或公开分享前处理。解析与处理均在浏览器本地完成，照片不会上传。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.exif-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 1.3fr);
  gap: 24px;
  align-items: start;
}

.exif-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.exif-dropzone {
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

.exif-dropzone:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.exif-dropzone-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.exif-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exif-preview img {
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.exif-preview-actions {
  display: flex;
  justify-content: center;
}

.exif-clean-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.exif-quality {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exif-value {
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

.exif-empty {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--el-border-color-lighter);
  border-radius: 10px;
  color: var(--el-text-color-placeholder);
}

.exif-empty p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 1023px) {
  .exif-layout {
    grid-template-columns: 1fr;
  }
}
</style>
