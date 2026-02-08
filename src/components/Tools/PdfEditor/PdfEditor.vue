<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'
import { GlobalWorkerOptions } from "pdfjs-dist"
import worker from "pdfjs-dist/build/pdf.worker?url"

GlobalWorkerOptions.workerSrc = worker

let pdfjsLib: any = null
let pdfDocument: any = null

const info = reactive({
  title: "PDF页眉页脚编辑器",
})

const pdfLoaded = ref(false) // 用 ref 来追踪 PDF 是否加载
const currentPage = ref(1)
const totalPages = ref(0)
const zoom = ref(0.8) // 默认缩放到 80%
const editMode = ref(false)
const isLoading = ref(false)
const isExporting = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const pageSettings = ref<Record<number, any>>({})

const headerSettings = reactive({
  text: '',
  font: 'sans-serif',
  size: 14,
  align: 'left'
})

const footerSettings = reactive({
  text: '',
  font: 'sans-serif',
  size: 12,
  align: 'center'
})

const applyRange = ref('current')

const loadPDFJS = async () => {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjsLib = pdfjs
  } catch (error) {
    ElMessage.error('PDF.js 库加载失败')
  }
}

onMounted(() => {
  loadPDFJS()
})

const handleFileChange = async (uploadFile: any) => {
  if (!uploadFile?.raw) return

  const file = uploadFile.raw as File
  if (file.type !== 'application/pdf') {
    ElMessage.error('请选择PDF文件')
    return
  }

  await loadPDF(file)
}

const loadPDF = async (file: File) => {
  if (!pdfjsLib) {
    ElMessage.error('PDF.js 库未加载完成')
    return
  }

  isLoading.value = true
  pdfLoaded.value = false

  try {
    const arrayBuffer = await file.arrayBuffer()

    // 使用正确的方式调用 getDocument
    pdfDocument = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise

    totalPages.value = pdfDocument.numPages
    currentPage.value = 1
    pdfLoaded.value = true

    // 等待 DOM 更新
    await nextTick()
    await renderPage(1)

    ElMessage.success('PDF加载成功')
  } catch (error) {
    console.error('PDF加载失败:', error)
    ElMessage.error('PDF加载失败')
  } finally {
    isLoading.value = false
  }
}

const renderPage = async (pageNum: number) => {
  if (!pdfDocument) {
    console.log('pdfDocument 不存在')
    return
  }

  // 等待 canvas 元素渲染
  await nextTick()

  if (!canvasRef.value) {
    console.error('canvasRef 不存在')
    return
  }

  try {
    currentPage.value = pageNum
    console.log('开始获取第', pageNum, '页')

    const page = await pdfDocument.getPage(pageNum)
    console.log('页面获取成功')

    const viewport = page.getViewport({ scale: zoom.value * 1.5 })
    console.log('视窗尺寸:', viewport.width, 'x', viewport.height)

    const canvas = canvasRef.value
    const context = canvas.getContext('2d')
    if (!context) {
      console.error('无法获取 canvas context')
      return
    }

    canvas.height = viewport.height
    canvas.width = viewport.width

    console.log('开始渲染到canvas')

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise

    console.log('页面渲染完成')

    // 应用页眉页脚
    applyHeaderFooter(context, canvas.width, canvas.height, pageNum)
  } catch (error) {
    console.error('渲染页面失败:', error)
    ElMessage.error('渲染页面失败')
  }
}

const applyHeaderFooter = (ctx: CanvasRenderingContext2D, width: number, height: number, pageNum: number) => {
  const settings = pageSettings.value[pageNum]
  if (!settings) return

  // 绘制页眉
  if (settings.header?.text) {
    ctx.font = `${settings.header.size}px ${settings.header.font}`
    ctx.fillStyle = '#000000'
    ctx.textBaseline = 'top'

    let x = 20
    if (settings.header.align === 'center') x = width / 2
    if (settings.header.align === 'right') x = width - 20

    ctx.textAlign = settings.header.align
    const headerText = settings.header.text.replace('{page}', pageNum.toString())
    ctx.fillText(headerText, x, 20)
  }

  // 绘制页脚
  if (settings.footer?.text) {
    ctx.font = `${settings.footer.size}px ${settings.footer.font}`
    ctx.fillStyle = '#000000'
    ctx.textBaseline = 'bottom'

    let x = 20
    if (settings.footer.align === 'center') x = width / 2
    if (settings.footer.align === 'right') x = width - 20

    ctx.textAlign = settings.footer.align
    const footerText = settings.footer.text.replace('{page}', pageNum.toString())
    ctx.fillText(footerText, x, height - 20)
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    renderPage(currentPage.value - 1)
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    renderPage(currentPage.value + 1)
  }
}

const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 2.0)
  renderPage(currentPage.value)
}

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.5)
  renderPage(currentPage.value)
}

const applySettings = () => {
  const range = applyRange.value

  const settings = {
    header: { ...headerSettings },
    footer: { ...footerSettings }
  }

  if (range === 'current') {
    pageSettings.value[currentPage.value] = settings
  } else {
    for (let i = 1; i <= totalPages.value; i++) {
      pageSettings.value[i] = settings
    }
  }

  renderPage(currentPage.value)
  ElMessage.success('设置已应用')
}

const exportPDF = async () => {
  if (!pdfDocument || !canvasRef.value) return

  isExporting.value = true

  try {
    // 动态导入 jsPDF
    const { jsPDF } = await import('jspdf')

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    })

    // 渲染所有页面
    for (let i = 1; i <= totalPages.value; i++) {
      if (i > 1) {
        pdf.addPage()
      }

      const page = await pdfDocument.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })

      // 创建临时 canvas
      const tempCanvas = document.createElement('canvas')
      const context = tempCanvas.getContext('2d')!
      tempCanvas.height = viewport.height
      tempCanvas.width = viewport.width

      // 渲染 PDF 页面
      await page.render({ canvasContext: context, viewport: viewport }).promise

      // 应用页眉页脚
      applyHeaderFooter(context, tempCanvas.width, tempCanvas.height, i)

      // 添加到 PDF
      const imgData = tempCanvas.toDataURL('image/jpeg', 0.95)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
    }

    // 下载 PDF
    pdf.save('edited-document.pdf')
    ElMessage.success('PDF导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('PDF导出失败')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div>
    <DetailHeader :info="info" />
    <div class="pdf-editor">
      <div class="toolbar">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".pdf"
          :on-change="handleFileChange"
        >
          <el-button type="primary">上传PDF</el-button>
        </el-upload>

        <el-button @click="exportPDF" :disabled="!pdfLoaded" v-loading="isExporting">导出PDF</el-button>

        <el-divider direction="vertical" />

        <el-switch v-model="editMode" active-text="编辑模式" />

        <el-divider direction="vertical" />

        <el-button-group>
          <el-button @click="zoomOut" :disabled="!pdfLoaded">缩小</el-button>
          <el-button disabled>{{ Math.round(zoom * 100) }}%</el-button>
          <el-button @click="zoomIn" :disabled="!pdfLoaded">放大</el-button>
        </el-button-group>
      </div>

      <div class="main-content">
        <!-- 编辑面板 - 移到上面 -->
        <div v-if="editMode && pdfLoaded" class="edit-panel-top">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-card header="页眉设置">
                <el-form label-width="80px" size="small">
                  <el-form-item label="文本内容">
                    <el-input v-model="headerSettings.text" placeholder="输入页眉文本，使用 {page} 表示页码" />
                  </el-form-item>
                  <el-form-item label="字体">
                    <el-select v-model="headerSettings.font">
                      <el-option label="无衬线" value="sans-serif" />
                      <el-option label="衬线" value="serif" />
                      <el-option label="等宽" value="monospace" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="字号">
                    <el-input-number v-model="headerSettings.size" :min="8" :max="32" />
                  </el-form-item>
                  <el-form-item label="对齐">
                    <el-select v-model="headerSettings.align">
                      <el-option label="左对齐" value="left" />
                      <el-option label="居中" value="center" />
                      <el-option label="右对齐" value="right" />
                    </el-select>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>

            <el-col :span="8">
              <el-card header="页脚设置">
                <el-form label-width="80px" size="small">
                  <el-form-item label="文本内容">
                    <el-input v-model="footerSettings.text" placeholder="输入页脚文本，使用 {page} 表示页码" />
                  </el-form-item>
                  <el-form-item label="字体">
                    <el-select v-model="footerSettings.font">
                      <el-option label="无衬线" value="sans-serif" />
                      <el-option label="衬线" value="serif" />
                      <el-option label="等宽" value="monospace" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="字号">
                    <el-input-number v-model="footerSettings.size" :min="8" :max="32" />
                  </el-form-item>
                  <el-form-item label="对齐">
                    <el-select v-model="footerSettings.align">
                      <el-option label="左对齐" value="left" />
                      <el-option label="居中" value="center" />
                      <el-option label="右对齐" value="right" />
                    </el-select>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>

            <el-col :span="8">
              <el-card header="应用设置">
                <el-form label-width="80px" size="small">
                  <el-form-item label="应用范围">
                    <el-select v-model="applyRange">
                      <el-option label="当前页" value="current" />
                      <el-option label="所有页" value="all" />
                    </el-select>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="applySettings" style="width: 100%">应用设置</el-button>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <div class="canvas-area">
          <div v-if="!pdfLoaded" class="upload-prompt">
            <el-empty description="请上传PDF文件开始编辑" />
          </div>

          <div v-else class="pdf-container">
            <canvas ref="canvasRef" class="pdf-canvas"></canvas>

            <div class="page-nav">
              <el-button @click="prevPage" :disabled="currentPage <= 1">上一页</el-button>
              <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
              <el-button @click="nextPage" :disabled="currentPage >= totalPages">下一页</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>功能介绍：</strong>在线PDF页眉页脚编辑工具，支持为PDF文档添加自定义页眉和页脚，可设置文本内容、字体样式、字号大小和对齐方式。
        </el-text>
        <el-divider />
        <el-text>
          <strong>主要特性：</strong>
          <ul class="list-disc list-inside mt-2 ml-4">
            <li>支持自定义页眉和页脚文本内容</li>
            <li>使用 {page} 占位符自动显示当前页码</li>
            <li>提供无衬线、衬线、等宽三种字体选择</li>
            <li>支持 8-32px 字号范围调整</li>
            <li>支持左对齐、居中、右对齐三种对齐方式</li>
            <li>可选择应用到当前页或所有页面</li>
            <li>实时预览编辑效果</li>
            <li>导出包含页眉页脚的完整PDF文档</li>
          </ul>
        </el-text>
        <el-divider />
        <el-text>
          <strong>使用说明：</strong>
          <ol class="list-decimal list-inside mt-2 ml-4">
            <li>点击"上传PDF"按钮选择需要编辑的PDF文件</li>
            <li>打开"编辑模式"开关，显示编辑面板</li>
            <li>在页眉设置区域输入文本，选择字体、字号和对齐方式</li>
            <li>在页脚设置区域输入文本，选择字体、字号和对齐方式</li>
            <li>在文本中输入 {page} 可自动显示当前页码</li>
            <li>选择应用范围（当前页/所有页），点击"应用设置"</li>
            <li>使用上一页/下一页按钮查看各页效果</li>
            <li>确认无误后点击"导出PDF"下载编辑后的文档</li>
          </ol>
        </el-text>
        <el-divider />
        <el-text>
          <strong>使用技巧：</strong>
          <ul class="list-disc list-inside mt-2 ml-4">
            <li>在页脚输入"第 {page} 页"可显示为"第 1 页"、"第 2 页"等</li>
            <li>在页眉输入公司名称或文档标题，统一文档风格</li>
            <li>使用缩放按钮调整预览大小，方便查看细节</li>
            <li>选择"所有页"可一次性为整个文档添加页眉页脚</li>
          </ul>
        </el-text>
        <el-divider />
        <el-text>
          <strong>注意事项：</strong>
          <ul class="list-disc list-inside mt-2 ml-4">
            <li>支持的PDF文件大小建议不超过50MB</li>
            <li>页眉页脚会覆盖在PDF原有内容之上</li>
            <li>导出的PDF文件为图片格式，文件大小可能增加</li>
            <li>建议在应用前先预览效果，确保位置和样式符合需求</li>
          </ul>
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.pdf-editor {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-panel-top {
  width: 100%;
}

.canvas-area {
  flex: 1;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  min-height: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.pdf-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.pdf-canvas {
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-radius: 4px;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
