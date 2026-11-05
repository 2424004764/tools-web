<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface TextLayout {
  canvas: HTMLCanvasElement
  lines: string[]
  rowsPerPage: number
  pageCount: number
  marginPx: number
  lineHeight: number
}

type DownloadMode = 'all' | 'range' | 'split'

class PageRangeError extends Error {}

const title = '文本转 PDF'
const text = ref('')
const filename = ref('文本')
const fontSize = ref(12)
const margin = ref(20)
const isExporting = ref(false)
const exportProgress = ref('')
const exportProgressPercent = ref(0)
const previewImage = ref('')
const previewPageCount = ref(0)
const previewPageIndex = ref(1)
const downloadMode = ref<DownloadMode>('all')
const pageRangeText = ref('')
const splitSize = ref(4)
const splitAsZip = ref(false)
const characterCount = computed(() => text.value.length)

let previewLayout: TextLayout | null = null

const settings = reactive({
  pageWidth: 210,
  pageHeight: 297,
  dpi: 144,
  fontFamily: 'Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif'
})

let previewTimer = 0
let previewVersion = 0
const nextPaint = () => new Promise<void>(resolve => window.setTimeout(resolve, 24))

const createTextLayout = async (): Promise<TextLayout> => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法初始化画布')

  const pageWidthPx = Math.round(settings.pageWidth / 25.4 * settings.dpi)
  const pageHeightPx = Math.round(settings.pageHeight / 25.4 * settings.dpi)
  const marginPx = Math.round(margin.value / 25.4 * settings.dpi)
  const fontSizePx = Math.round(fontSize.value / 72 * settings.dpi)
  const lineHeight = Math.ceil(fontSizePx * 1.65)
  const contentWidth = pageWidthPx - marginPx * 2
  const contentHeight = pageHeightPx - marginPx * 2
  const rowsPerPage = Math.max(1, Math.floor(contentHeight / lineHeight))

  canvas.width = pageWidthPx
  canvas.height = pageHeightPx
  context.font = `${fontSizePx}px ${settings.fontFamily}`

  const lines: string[] = []
  const paragraphs = text.value.replace(/\r\n?/g, '\n').split('\n')
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const paragraph = paragraphs[paragraphIndex]
    if (!paragraph) {
      lines.push('')
    } else {
      let remaining = paragraph
      let measuredCharacters = 0
      while (remaining) {
        let low = 1
        let high = remaining.length
        let fitLength = 0
        while (low <= high) {
          const middle = Math.floor((low + high) / 2)
          if (context.measureText(remaining.slice(0, middle)).width <= contentWidth) {
            fitLength = middle
            low = middle + 1
          } else {
            high = middle - 1
          }
        }
        const lineLength = Math.max(1, fitLength)
        lines.push(remaining.slice(0, lineLength))
        remaining = remaining.slice(lineLength)
        measuredCharacters += lineLength
        if (measuredCharacters >= 2000) {
          measuredCharacters = 0
          await nextPaint()
        }
      }
    }

    if (paragraphIndex > 0 && paragraphIndex % 100 === 0) await nextPaint()
  }

  return {
    canvas,
    lines,
    rowsPerPage,
    pageCount: Math.max(1, Math.ceil(lines.length / rowsPerPage)),
    marginPx,
    lineHeight
  }
}

const renderPage = (layout: TextLayout, pageIndex: number) => {
  const context = layout.canvas.getContext('2d')
  if (!context) throw new Error('无法初始化画布')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, layout.canvas.width, layout.canvas.height)
  context.textBaseline = 'top'
  context.font = `${Math.round(fontSize.value / 72 * settings.dpi)}px ${settings.fontFamily}`
  context.fillStyle = '#111827'

  const pageLines = layout.lines.slice(pageIndex * layout.rowsPerPage, (pageIndex + 1) * layout.rowsPerPage)
  pageLines.forEach((line, lineIndex) => {
    context.fillText(line, layout.marginPx, layout.marginPx + lineIndex * layout.lineHeight)
  })

  return layout.canvas.toDataURL('image/png')
}

const renderPreview = async (version: number) => {
  if (!text.value.trim()) {
    previewImage.value = ''
    previewPageCount.value = 0
    previewPageIndex.value = 1
    previewLayout = null
    return
  }

  try {
    const layout = await createTextLayout()
    if (version !== previewVersion) return
    previewLayout = layout
    previewPageCount.value = layout.pageCount
    previewPageIndex.value = Math.min(previewPageIndex.value || 1, layout.pageCount)
    previewImage.value = renderPage(layout, previewPageIndex.value - 1)
  } catch (error) {
    console.error('PDF 预览生成失败:', error)
    if (version === previewVersion) previewImage.value = ''
  }
}

const gotoPreviewPage = (page: number) => {
  if (!previewLayout || !previewPageCount.value) return
  if (!Number.isFinite(page)) return
  const target = Math.min(Math.max(1, Math.round(page)), previewPageCount.value)
  previewPageIndex.value = target
  try {
    previewImage.value = renderPage(previewLayout, target - 1)
  } catch (error) {
    console.error('PDF 预览翻页失败:', error)
  }
}

watch([text, fontSize, margin], () => {
  const version = ++previewVersion
  window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(() => renderPreview(version), 180)
}, { flush: 'post' })

onBeforeUnmount(() => window.clearTimeout(previewTimer))

const formatTimestamp = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

const splitFileCount = computed(() => {
  if (!previewPageCount.value) return 0
  return Math.max(1, Math.ceil(previewPageCount.value / Math.max(1, splitSize.value)))
})

const exportButtonLabel = computed(() => {
  if (downloadMode.value === 'split') {
    return splitAsZip.value ? `下载 ZIP（${splitFileCount.value || '…'} 个 PDF）` : `下载 ${splitFileCount.value || '…'} 个 PDF`
  }
  if (downloadMode.value === 'range') return '下载所选页 PDF'
  return '下载 PDF'
})

/** 解析页码范围文本（支持 1-4、7、9-12、5- 到末页，兼容中英文逗号和顿号），返回去重升序页码 */
const parsePageSelection = (input: string, totalPages: number): number[] => {
  const normalized = input.replace(/，/g, ',').replace(/、/g, ',').replace(/\s+/g, '')
  if (!normalized) throw new PageRangeError('请填写页码范围，如 1-4, 7, 9-12')

  const selected = new Set<number>()
  for (const part of normalized.split(',')) {
    const match = part.match(/^(\d+)(?:-(\d*))?$/)
    if (!match) throw new PageRangeError(`页码格式不正确：“${part}”，示例 1-4, 7, 9-12`)
    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : part.includes('-') ? totalPages : start
    const low = Math.min(start, end)
    const high = Math.max(start, end)
    if (low < 1 || high > totalPages) throw new PageRangeError(`页码需在 1-${totalPages} 之间`)
    for (let page = low; page <= high; page++) selected.add(page)
  }

  const pages = [...selected].sort((a, b) => a - b)
  if (!pages.length) throw new PageRangeError('未选择任何页码')
  return pages
}

/** 将页码列表压缩为区间文本，如 [1,2,3,7] -> "1-3,7" */
const formatPageRanges = (pages: number[]) => {
  const parts: string[] = []
  let index = 0
  while (index < pages.length) {
    let end = index
    while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1) end++
    parts.push(index === end ? `${pages[index]}` : `${pages[index]}-${pages[end]}`)
    index = end + 1
  }
  return parts.join(',')
}

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const exportPdf = async () => {
  if (!text.value.trim()) {
    ElMessage.warning('请输入要转换的文本')
    return
  }
  if (downloadMode.value === 'range' && !pageRangeText.value.trim()) {
    ElMessage.warning('请填写要下载的页码范围，如 1-4, 7, 9-12')
    return
  }

  const exportStartedAt = performance.now()
  isExporting.value = true
  exportProgress.value = '正在准备 PDF…'
  exportProgressPercent.value = 0
  await nextTick()
  await nextPaint()

  try {
    await document.fonts.ready
    exportProgress.value = '正在排版文本…'
    exportProgressPercent.value = 0
    await nextTick()
    await nextPaint()

    const layout = await createTextLayout()
    const totalPages = layout.pageCount

    let fileGroups: number[][] = []
    if (downloadMode.value === 'range') {
      fileGroups = [parsePageSelection(pageRangeText.value, totalPages)]
    } else if (downloadMode.value === 'split') {
      const size = Math.max(1, Math.round(splitSize.value) || 1)
      for (let start = 1; start <= totalPages; start += size) {
        const end = Math.min(start + size - 1, totalPages)
        const pages: number[] = []
        for (let page = start; page <= end; page++) pages.push(page)
        fileGroups.push(pages)
      }
    } else {
      fileGroups = [Array.from({ length: totalPages }, (_, index) => index + 1)]
    }

    const safeFilename = filename.value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '') || '文本'
    const domain = window.location.hostname.replace(/^www\./, '').replace(/[\\/:*?"<>|]/g, '-') || 'localhost'
    const timestamp = formatTimestamp(new Date())

    const useZip = downloadMode.value === 'split' && splitAsZip.value
    const zip = useZip ? new JSZip() : null
    const totalPagesToRender = fileGroups.reduce((sum, pages) => sum + pages.length, 0)
    let renderedPages = 0

    for (let groupIndex = 0; groupIndex < fileGroups.length; groupIndex++) {
      const pages = fileGroups[groupIndex]
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      for (let index = 0; index < pages.length; index++) {
        if (index > 0) pdf.addPage()
        pdf.addImage(renderPage(layout, pages[index] - 1), 'PNG', 0, 0, settings.pageWidth, settings.pageHeight)
        renderedPages++
        const prefix = fileGroups.length > 1 ? `第 ${groupIndex + 1}/${fileGroups.length} 个文件，` : ''
        exportProgress.value = `${prefix}正在生成第 ${index + 1}/${pages.length} 页…`
        exportProgressPercent.value = Math.min(100, Math.round(renderedPages / totalPagesToRender * 100))
        await nextTick()
        await nextPaint()
      }

      if (zip) {
        const rangeLabel = `${pages[0]}-${pages[pages.length - 1]}`
        zip.file(`${safeFilename}_第${rangeLabel}页.pdf`, pdf.output('blob'))
      } else if (fileGroups.length > 1) {
        const rangeLabel = `${pages[0]}-${pages[pages.length - 1]}`
        pdf.save(`${safeFilename}_第${rangeLabel}页_${domain}_${timestamp}.pdf`)
        if (groupIndex < fileGroups.length - 1) await new Promise<void>(resolve => window.setTimeout(resolve, 400))
      } else {
        let suffix = ''
        if (downloadMode.value === 'range' && pages.length < totalPages) {
          const ranges = formatPageRanges(pages)
          suffix = `_第${ranges.length > 20 ? `选取${pages.length}页` : ranges}页`
        }
        pdf.save(`${safeFilename}${suffix}_${domain}_${timestamp}.pdf`)
      }
    }

    if (zip) {
      exportProgress.value = '正在打包 ZIP…'
      exportProgressPercent.value = 100
      await nextTick()
      await nextPaint()
      saveBlob(await zip.generateAsync({ type: 'blob' }), `${safeFilename}_拆分_${domain}_${timestamp}.zip`)
      ElMessage.success(`已打包 ${fileGroups.length} 个 PDF 文件为 ZIP`)
    } else if (fileGroups.length > 1) {
      ElMessage.success(`已生成 ${fileGroups.length} 个 PDF 文件，如浏览器询问请允许下载多个文件`)
    } else {
      ElMessage.success(`PDF 已生成，共 ${fileGroups[0].length} 页`)
    }
  } catch (error) {
    console.error('文本转 PDF 失败:', error)
    if (error instanceof PageRangeError) {
      ElMessage.warning(error.message)
    } else {
      ElMessage.error('PDF 生成失败，请稍后重试')
    }
  } finally {
    const remainingFeedbackTime = Math.max(0, 450 - (performance.now() - exportStartedAt))
    if (remainingFeedbackTime) await new Promise<void>(resolve => window.setTimeout(resolve, remainingFeedbackTime))
    isExporting.value = false
    exportProgress.value = ''
    exportProgressPercent.value = 0
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">文本转 PDF</h1>
        <p class="mt-1 text-body-sm text-slate-500">将文本排版为 A4 PDF，支持中文、自动换行和长文分页。内容仅在浏览器本地处理。</p>
      </header>

      <div class="text-pdf-layout">
        <section class="text-pdf-editor">
          <div class="text-pdf-field-head">
            <label for="text-pdf-input">文本内容</label>
          </div>
          <el-input
            id="text-pdf-input"
            v-model="text"
            class="text-pdf-textarea"
            type="textarea"
            :rows="18"
            maxlength="100000"
            show-word-limit
            placeholder="在此粘贴或输入文本内容，保留换行格式..."
          />
        </section>

        <aside class="text-pdf-preview" aria-label="PDF 实时预览">
          <div class="text-pdf-field-head">
            <h2>PDF 预览</h2>
            <span v-if="previewPageCount <= 1">{{ previewPageCount ? '共 1 页' : '' }}</span>
            <div v-else class="text-pdf-preview-nav">
              <el-button size="small" text bg :disabled="previewPageIndex <= 1" @click="gotoPreviewPage(previewPageIndex - 1)">上一页</el-button>
              <el-input-number
                v-model="previewPageIndex"
                class="text-pdf-preview-page-input"
                size="small"
                :min="1"
                :max="previewPageCount"
                :step="1"
                :controls="false"
                aria-label="预览页码"
                @change="gotoPreviewPage(previewPageIndex)"
              />
              <span>/ {{ previewPageCount }} 页</span>
              <el-button size="small" text bg :disabled="previewPageIndex >= previewPageCount" @click="gotoPreviewPage(previewPageIndex + 1)">下一页</el-button>
            </div>
          </div>
          <div class="text-pdf-preview-stage">
            <img
              v-if="previewImage"
              :src="previewImage"
              alt="PDF 页面预览"
              class="text-pdf-preview-page"
            />
            <div v-else class="text-pdf-preview-empty">
              输入文本后显示 A4 页面预览
            </div>
          </div>
        </aside>

        <div class="text-pdf-settings">
          <div class="text-pdf-setting text-pdf-setting-filename">
            <label for="text-pdf-filename">PDF 文件名</label>
            <el-input id="text-pdf-filename" v-model="filename" maxlength="80" placeholder="文本" />
          </div>
          <div class="text-pdf-setting">
            <label for="text-pdf-font-size">字号（pt）</label>
            <el-input-number id="text-pdf-font-size" v-model="fontSize" :min="8" :max="24" :step="1" />
          </div>
          <div class="text-pdf-setting">
            <label for="text-pdf-margin">页边距（mm）</label>
            <el-input-number id="text-pdf-margin" v-model="margin" :min="8" :max="40" :step="1" />
          </div>
        </div>

        <div class="text-pdf-download">
          <div class="text-pdf-setting text-pdf-download-mode">
            <label>下载范围</label>
            <el-radio-group v-model="downloadMode">
              <el-radio-button value="all">全部页面</el-radio-button>
              <el-radio-button value="range">指定页码</el-radio-button>
              <el-radio-button value="split">按页拆分</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="downloadMode === 'range'" class="text-pdf-setting text-pdf-download-range">
            <label for="text-pdf-page-range">页码范围</label>
            <el-input
              id="text-pdf-page-range"
              v-model="pageRangeText"
              maxlength="120"
              clearable
              placeholder="如 1-4, 7, 9-12；填 5- 表示第 5 页到末页"
            />
            <span v-if="previewPageCount" class="text-pdf-download-hint">全文共 {{ previewPageCount }} 页，仅导出所选页</span>
          </div>

          <template v-if="downloadMode === 'split'">
            <div class="text-pdf-setting text-pdf-download-split">
              <label for="text-pdf-split-size">每份最多页数</label>
              <el-input-number id="text-pdf-split-size" v-model="splitSize" :min="1" :max="200" :step="1" />
              <span v-if="previewPageCount" class="text-pdf-download-hint">共 {{ previewPageCount }} 页 → 拆分为 {{ splitFileCount }} 个文件</span>
            </div>
            <div class="text-pdf-setting text-pdf-download-pack">
              <label>打包方式</label>
              <el-checkbox v-model="splitAsZip">打包成 1 个 ZIP</el-checkbox>
              <span class="text-pdf-download-hint">{{ splitAsZip ? '所有 PDF 压缩为一个 ZIP 文件下载' : '逐个下载 PDF，浏览器可能提示允许下载多个文件' }}</span>
            </div>
          </template>
        </div>

        <div class="text-pdf-actions">
          <div class="text-pdf-action-row">
            <el-button type="primary" :loading="isExporting" :disabled="isExporting" @click="exportPdf">
              {{ isExporting ? '正在生成 PDF' : exportButtonLabel }}
            </el-button>
            <span class="text-body-sm text-slate-500">{{ characterCount.toLocaleString() }} 个字符</span>
            <span v-if="exportProgress" class="text-body-sm text-slate-500" aria-live="polite">{{ exportProgress }}</span>
          </div>
          <el-progress
            v-if="isExporting"
            :percentage="exportProgressPercent"
            :status="exportProgressPercent === 100 ? 'success' : undefined"
            :stroke-width="8"
            class="text-pdf-progress"
          />
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        输入或粘贴文本，按需设置 PDF 文件名、字号和页边距。右侧实时预览 A4 排版效果，可翻页查看任意页；长文自动换行分页。下载范围支持三种方式：全部页面（默认，生成 1 个 PDF）、指定页码（如 1-4, 7, 9-12，仅导出所选页，填 5- 表示第 5 页到末页）、按页拆分（每份最多 N 页生成多个 PDF，可逐个下载或打包成 ZIP）。下载文件名会包含当前域名和生成时间。导出的 PDF 采用页面图像以保证中文显示，但不能在 PDF 阅读器中搜索或复制文字。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.text-pdf-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  grid-template-areas:
    "editor preview"
    "settings settings"
    "download download"
    "actions actions";
  align-items: start;
  column-gap: 24px;
  row-gap: 20px;
}

.text-pdf-editor,
.text-pdf-preview {
  min-width: 0;
}

.text-pdf-editor {
  grid-area: editor;
}

.text-pdf-preview {
  grid-area: preview;
}

.text-pdf-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 28px;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 20px;
}

.text-pdf-field-head h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}

.text-pdf-field-head span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.text-pdf-textarea,
.text-pdf-preview-stage {
  height: 520px;
}

.text-pdf-textarea :deep(.el-textarea),
.text-pdf-textarea :deep(.el-textarea__inner) {
  height: 100%;
}

.text-pdf-textarea :deep(.el-textarea__inner) {
  box-sizing: border-box;
  min-height: 100% !important;
  padding-bottom: 28px;
}

.text-pdf-preview-stage {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.text-pdf-preview-page,
.text-pdf-preview-empty {
  width: auto;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: 210 / 297;
  border: 1px solid var(--el-border-color);
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
}

.text-pdf-preview-page {
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

.text-pdf-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  text-align: center;
}

.text-pdf-settings {
  grid-area: settings;
  display: grid;
  grid-template-columns: minmax(240px, 1.5fr) repeat(2, minmax(160px, 0.7fr));
  gap: 16px;
  align-items: end;
}

.text-pdf-setting {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.text-pdf-setting label {
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 20px;
}

.text-pdf-setting :deep(.el-input-number),
.text-pdf-setting :deep(.el-input) {
  width: 100%;
}

.text-pdf-preview-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-pdf-preview-nav :deep(.el-input-number) {
  width: 56px;
}

.text-pdf-preview-nav .el-button + .el-button {
  margin-left: 0;
}

.text-pdf-download {
  grid-area: download;
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: start;
  gap: 16px 28px;
}

.text-pdf-download-mode,
.text-pdf-download-split,
.text-pdf-download-pack {
  flex: 0 0 auto;
}

.text-pdf-download-range {
  flex: 1 1 280px;
  min-width: 240px;
  max-width: 520px;
}

.text-pdf-download-mode :deep(.el-radio-group) {
  flex-wrap: wrap;
}

.text-pdf-download-pack :deep(.el-checkbox) {
  height: 32px;
}

.text-pdf-download-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.text-pdf-actions {
  grid-area: actions;
  min-width: 0;
}

.text-pdf-action-row {
  display: flex;
  min-height: 36px;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.text-pdf-progress {
  max-width: 520px;
  margin-top: 10px;
}

@media (max-width: 1023px) {
  .text-pdf-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "editor"
      "preview"
      "settings"
      "download"
      "actions";
  }

  .text-pdf-settings {
    grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(130px, 0.75fr));
  }
}

@media (max-width: 639px) {
  .text-pdf-layout {
    row-gap: 16px;
  }

  .text-pdf-textarea,
  .text-pdf-preview-stage {
    height: 420px;
  }

  .text-pdf-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 12px;
  }

  .text-pdf-setting-filename {
    grid-column: 1 / -1;
  }
}
</style>
