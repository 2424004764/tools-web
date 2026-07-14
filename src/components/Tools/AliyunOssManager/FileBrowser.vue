<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Folder from '~icons/ep/folder'
import Document from '~icons/ep/document'
import Refresh from '~icons/ep/refresh'
import Upload from '~icons/ep/upload'
import Download from '~icons/ep/download'
import Delete from '~icons/ep/delete'
import ArrowUp from '~icons/ep/arrowUp'
import Search from '~icons/ep/search'
import Link from '~icons/ep/link'
import EditPen from '~icons/ep/editPen'
import Picture from '~icons/ep/picture'
import type { OssConfig } from '@/api/oss'
import { ossStsProvider } from '@/api/oss'
import { OssClient, callWithOss, formatSize, guessContentType, isTextFile, isImageFile, type OssObject } from '@/utils/oss'

const props = defineProps<{ config: OssConfig }>()
const emit = defineEmits<{
  (e: 'open-editor', key: string): void
}>()

// STS 凭证完全由 Provider 管理（缓存 + 过期前 5 分钟自动刷新 + 403 时强制重签）
const currentPrefix = ref('')
const objects = ref<OssObject[]>([])
const prefixes = ref<string[]>([])
const loading = ref(false)
const uploading = ref(false)
const dragOver = ref(false)
const searchKey = ref('')
const stsHint = ref('')

// 目录列表缓存：prefix -> { objects, prefixes }
//   命中缓存：返回上一页/面包屑导航瞬时显示
//   失效：上传/删除当前目录后、或强制刷新（点刷新按钮）
//   清空：切换配置时
const listCache = new Map<string, { objects: OssObject[]; prefixes: string[] }>()

// 面包屑
const breadcrumbs = computed(() => {
  const parts = currentPrefix.value.split('/').filter(Boolean)
  const items: { label: string; path: string }[] = [{ label: props.config.bucket, path: '' }]
  let p = ''
  for (const part of parts) {
    p += part + '/'
    items.push({ label: part, path: p })
  }
  return items
})

const filteredObjects = computed(() => {
  if (!searchKey.value.trim()) return objects.value
  const k = searchKey.value.trim().toLowerCase()
  return objects.value.filter(o => o.key.toLowerCase().includes(k))
})

// 包装 OSS 调用：403 时 Provider 会自动 invalidate 并重试一次
const ossCall = <T>(fn: (c: OssClient) => Promise<T>) =>
  callWithOss(props.config.id, ossStsProvider, fn)

// 列出对象（命中缓存则不重新请求）
const loadList = async (prefix: string = currentPrefix.value, force = false) => {
  // 命中缓存且非强制刷新
  if (!force) {
    const cached = listCache.get(prefix)
    if (cached) {
      objects.value = cached.objects
      prefixes.value = cached.prefixes
      currentPrefix.value = prefix
      stsHint.value = ''
      return
    }
  }
  loading.value = true
  try {
    const result = await ossCall(c => c.listObjects(prefix, '/'))
    objects.value = result.objects
    prefixes.value = result.prefixes
    currentPrefix.value = prefix
    stsHint.value = '' // 成功时清空提示
    // 写入缓存（深拷贝一份防止外部修改影响缓存）
    listCache.set(prefix, {
      objects: result.objects.slice(),
      prefixes: result.prefixes.slice()
    })
  } catch (e: any) {
    ElMessage.error(e.message || '列举失败')
  } finally {
    loading.value = false
  }
}

// 让当前目录的缓存失效（写入操作后调用）
const invalidateCurrent = () => {
  listCache.delete(currentPrefix.value)
}

const enterFolder = (prefix: string) => {
  searchKey.value = ''
  loadList(prefix)
}

const goUp = () => {
  const parts = currentPrefix.value.split('/').filter(Boolean)
  parts.pop()
  loadList(parts.length ? parts.join('/') + '/' : '')
}

const jumpTo = (path: string) => {
  loadList(path)
}

// 上传文件（input）
const fileInput = ref<HTMLInputElement | null>(null)
const triggerUpload = () => fileInput.value?.click()

const handleFileSelect = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  await uploadFiles(Array.from(files))
  ;(e.target as HTMLInputElement).value = ''
}

const uploadFiles = async (files: File[]) => {
  uploading.value = true
  let success = 0
  let failed = 0
  for (const f of files) {
    const key = currentPrefix.value + f.name
    try {
      // eslint-disable-next-line no-await-in-loop
      await ossCall(c => c.putObject(key, f, guessContentType(f.name)))
      success++
    } catch (e: any) {
      console.error(e)
      failed++
    }
  }
  uploading.value = false
  if (success > 0) {
    ElMessage.success(`上传成功 ${success} 个${failed ? `，失败 ${failed}` : ''}`)
    invalidateCurrent() // 上传后让当前目录缓存失效
    await loadList()
  } else if (failed > 0) {
    ElMessage.error(`上传失败 ${failed} 个`)
  }
}

// 拖拽上传
const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  await uploadFiles(Array.from(files))
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  dragOver.value = true
}

const handleDragLeave = () => {
  dragOver.value = false
}

// 下载文件
const handleDownload = async (obj: OssObject) => {
  try {
    const blob = await ossCall(c => c.getObjectBlob(obj.key))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = obj.name
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('下载已开始')
  } catch (e: any) {
    ElMessage.error(e.message || '下载失败')
  }
}

// 复制公共 URL
const copyPublicUrl = async (obj: OssObject) => {
  try {
    const url = await ossCall(c => Promise.resolve(c.publicUrl(obj.key)))
    navigator.clipboard.writeText(url).then(() => {
      ElMessage.success('已复制 URL')
    }).catch(() => {
      ElMessage.error('复制失败')
    })
  } catch (e: any) {
    ElMessage.error(e.message || '复制失败')
  }
}

// 图片预览
const previewVisible = ref(false)
const previewObj = ref<OssObject | null>(null)
const previewUrl = ref<string>('')
const previewLoading = ref(false)
const previewDims = ref<{ w: number; h: number } | null>(null)

const openPreview = async (obj: OssObject) => {
  previewObj.value = obj
  previewVisible.value = true
  previewUrl.value = ''
  previewDims.value = null
  previewLoading.value = true
  try {
    const blob = await ossCall(c => c.getObjectBlob(obj.key))
    previewUrl.value = URL.createObjectURL(blob)
  } catch (e: any) {
    ElMessage.error(e.message || '加载图片失败')
    previewVisible.value = false
    previewObj.value = null
  } finally {
    previewLoading.value = false
  }
}

const closePreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewVisible.value = false
  previewObj.value = null
  previewUrl.value = ''
  previewDims.value = null
}

// 文件名点击：根据类型打开编辑器或预览
const handleFileNameClick = (obj: OssObject) => {
  if (isImageFile(obj.name)) {
    openPreview(obj)
  } else if (isTextFile(obj.name)) {
    emit('open-editor', obj.key)
  } else {
    ElMessage.warning('暂不支持此类型文件的预览/编辑')
  }
}

const onPreviewImgLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  previewDims.value = { w: img.naturalWidth, h: img.naturalHeight }
}

// 删除文件
const handleDelete = async (obj: OssObject) => {
  await ElMessageBox.confirm(
    `确认删除 ${obj.name}？删除后无法恢复。`,
    '删除文件',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
  try {
    await ossCall(c => c.deleteObject(obj.key))
    ElMessage.success('已删除')
    invalidateCurrent() // 删除后让当前目录缓存失效
    await loadList()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

// 跳到编辑器由 handleFileNameClick / 模板内 emit('open-editor', ...) 处理

const refresh = () => loadList(undefined, true)

const formatDate = (iso?: string) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

// 切换配置时清空本地视图（Provider 缓存可继续复用）
watch(() => props.config.id, () => {
  currentPrefix.value = ''
  objects.value = []
  prefixes.value = []
  searchKey.value = ''
  stsHint.value = ''
  listCache.clear() // 不同 bucket 的目录结构不一样，缓存作废
  loadList('')
})

onMounted(async () => {
  // 首次进入会触发 Provider 内部的 STS 签发
  await loadList('')
})

onBeforeUnmount(() => {
  // Provider 缓存在其他组件继续可用
})
</script>

<template>
  <div class="file-browser">
    <!-- 工具栏 -->
    <div class="fb-toolbar">
      <div class="toolbar-left">
        <el-button :icon="Refresh" circle plain @click="refresh" :loading="loading" />
        <el-button :icon="ArrowUp" circle plain :disabled="!currentPrefix" @click="goUp" title="返回上一级" />
        <el-button :icon="Upload" type="primary" @click="triggerUpload" :loading="uploading">上传文件</el-button>
        <input
          ref="fileInput"
          type="file"
          multiple
          hidden
          @change="handleFileSelect"
        />
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchKey"
          placeholder="搜索当前目录..."
          :prefix-icon="Search"
          size="default"
          clearable
          style="width:240px"
        />
      </div>
    </div>

    <!-- 面包屑 -->
    <div class="breadcrumb">
      <template v-for="(b, i) in breadcrumbs" :key="b.path">
        <span v-if="i > 0" class="bc-sep">/</span>
        <span
          class="bc-item"
          :class="{ last: i === breadcrumbs.length - 1 }"
          @click="jumpTo(b.path)"
        >
          {{ b.label }}
        </span>
      </template>
    </div>

    <!-- 拖拽上传区 -->
    <div
      class="dropzone"
      :class="{ active: dragOver }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <!-- 文件列表 -->
      <div v-loading="loading || uploading" class="file-table">
        <div v-if="filteredObjects.length === 0 && prefixes.length === 0" class="empty-tip">
          <el-empty :description="currentPrefix ? '该目录下为空' : 'Bucket 为空，拖拽文件到此处上传'" />
        </div>
        <div v-else class="list">
          <!-- 子目录 -->
          <div
            v-for="p in prefixes"
            :key="p"
            class="list-row row-folder"
            @click="enterFolder(p)"
          >
            <el-icon class="row-icon folder"><Folder /></el-icon>
            <span class="row-name">{{ p.replace(currentPrefix, '').replace(/\/$/, '') }}</span>
            <span class="row-meta"></span>
            <span class="row-meta time"></span>
            <span class="row-actions"></span>
          </div>
          <!-- 文件 -->
          <div
            v-for="obj in filteredObjects"
            :key="obj.key"
            class="list-row row-file"
          >
            <el-icon class="row-icon file"><Document /></el-icon>
            <span class="row-name" :title="obj.key" @click="handleFileNameClick(obj)">{{ obj.name }}</span>
            <span class="row-meta">{{ formatSize(obj.size || 0) }}</span>
            <span class="row-meta time">{{ formatDate(obj.lastModified) }}</span>
            <span class="row-actions">
              <el-button v-if="isTextFile(obj.name)" :icon="EditPen" size="small" plain circle @click.stop="emit('open-editor', obj.key)" title="在编辑器中打开" />
              <el-button v-if="isImageFile(obj.name)" :icon="Picture" size="small" plain circle @click.stop="openPreview(obj)" title="预览" />
              <el-button :icon="Link" size="small" plain circle @click.stop="copyPublicUrl(obj)" title="复制公共链接" />
              <el-button :icon="Download" size="small" plain circle @click.stop="handleDownload(obj)" title="下载" />
              <el-button :icon="Delete" size="small" type="danger" plain circle @click.stop="handleDelete(obj)" title="删除" />
            </span>
          </div>
        </div>
      </div>
      <div v-if="dragOver" class="drop-overlay">
        <div class="drop-message">
          <el-icon :size="48"><Upload /></el-icon>
          <p>松开以上传到 {{ currentPrefix || '根目录' }}</p>
        </div>
      </div>
    </div>

    <!-- 图片预览 -->
    <el-dialog
      v-model="previewVisible"
      :show-close="true"
      width="fit-content"
      align-center
      :before-close="closePreview"
      class="image-preview-dialog"
    >
      <template #header>
        <div class="preview-header">
          <el-icon><Picture /></el-icon>
          <span class="preview-title">{{ previewObj?.name }}</span>
        </div>
      </template>
      <div v-loading="previewLoading" class="preview-body">
        <img
          v-if="previewUrl"
          :src="previewUrl"
          class="preview-img"
          @load="onPreviewImgLoad"
          alt="图片预览"
        />
      </div>
      <template #footer>
        <div class="preview-meta" v-if="previewObj">
          <span>{{ formatSize(previewObj.size || 0) }}</span>
          <span v-if="previewDims" class="meta-sep">·</span>
          <span v-if="previewDims">{{ previewDims.w }} × {{ previewDims.h }}</span>
          <span class="meta-sep">·</span>
          <span>{{ formatDate(previewObj.lastModified) }}</span>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.file-browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-left {
  display: flex;
  gap: 6px;
}

.breadcrumb {
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fdead5;
  border-radius: 8px;
  font-size: 13px;
  color: #7c2d12;
}

.bc-item {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.bc-item:hover {
  background: #fed7aa;
}

.bc-item.last {
  cursor: default;
  color: #1f2937;
  font-weight: 600;
}

.bc-item.last:hover {
  background: transparent;
}

.bc-sep {
  color: #fdba74;
  margin: 0 2px;
}

.dropzone {
  position: relative;
  border: 1.5px dashed #fdead5;
  border-radius: 10px;
  background: #fff;
  min-height: 360px;
  transition: all 0.15s ease;
}

.dropzone.active {
  border-color: #f97316;
  background: #fff7ed;
}

.file-table {
  min-height: 360px;
}

.list {
  display: flex;
  flex-direction: column;
}

.list-row {
  display: grid;
  grid-template-columns: 28px 1fr 100px 180px auto;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  transition: background 0.1s;
}

.list-row:hover {
  background: #fffbeb;
}

.row-icon {
  font-size: 18px;
}

.row-icon.folder {
  color: #f59e0b;
}

.row-icon.file {
  color: #3b82f6;
}

.row-name {
  color: #1f2937;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.row-name:hover {
  color: #ea580c;
}

.row-meta {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  /* 固定宽度：图片等非文本文件没有"编辑"按钮，
     否则列宽变化会让 size/time 列在不同行错位 */
  min-width: 130px;
  justify-content: flex-end;
}

.list-row:hover .row-actions {
  opacity: 1;
}

.row-folder {
  cursor: pointer;
  background: #fffaf0;
}

.row-folder .row-name {
  cursor: pointer;
  font-weight: 600;
  color: #92400e;
}

.empty-tip {
  padding: 40px 0;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 247, 237, 0.9);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* 图片预览对话框 */
.image-preview-dialog :deep(.el-dialog__header) {
  padding: 12px 18px;
  margin: 0;
  background: #fffbeb;
  border-bottom: 1px solid #fdead5;
}
.image-preview-dialog :deep(.el-dialog__body) {
  padding: 0;
  background: #0f172a;
}
.image-preview-dialog :deep(.el-dialog__footer) {
  padding: 10px 18px;
  background: #fffbeb;
  border-top: 1px solid #fdead5;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7c2d12;
  font-size: 14px;
  font-weight: 600;
}
.preview-header .el-icon {
  color: #ea580c;
}
.preview-title {
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 320px;
  min-height: 320px;
  max-width: 90vw;
  max-height: 80vh;
  padding: 16px;
  overflow: auto;
}
.preview-img {
  display: block;
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}
.preview-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9a3412;
  font-size: 12px;
}
.preview-meta .meta-sep {
  color: #fdba74;
}

.drop-message {
  text-align: center;
  color: #ea580c;
  font-weight: 600;
}

.drop-message p {
  margin-top: 8px;
  font-size: 14px;
}

@media (max-width: 768px) {
  .list-row {
    grid-template-columns: 24px 1fr 80px auto;
    gap: 6px;
    padding: 8px 10px;
  }
  .row-meta.time {
    display: none;
  }
  .row-actions {
    opacity: 1;
  }
}
</style>