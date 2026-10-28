<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Download from '~icons/ep/download'
import UploadFilled from '~icons/ep/upload-filled'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "SVG转JPG/PNG",
})

type TargetFormat = 'png' | 'jpeg'

// SVG 源
const activeTab = ref<'file' | 'code'>('file')
const svgText = ref('')
const svgCodeInput = ref('')

// 尺寸信息
const sourceWidth = ref(0)
const sourceHeight = ref(0)
const sizeSource = ref('') // 尺寸来源说明

// 输出选项
const targetFormat = ref<TargetFormat>('png')
const scale = ref(1)
const customWidth = ref<number | null>(null)
const useCustomWidth = ref(false)
const jpegQuality = ref(0.92)
const transparentBg = ref(true)
const bgColor = ref('#ffffff')

// 结果
const resultSrc = ref('')
const resultSize = ref(0)
const resultBlob = ref<Blob | null>(null)
const converting = ref(false)
const fileName = ref('')

// 浏览器 canvas 单边最大安全尺寸，超过后各浏览器行为不一（Safari 面积限制更小）
const MAX_SIDE = 8192

const formatLabel = (fmt: TargetFormat) => fmt === 'jpeg' ? 'JPG' : 'PNG'

const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const outputWidth = computed(() => {
  if (!sourceWidth.value) return 0
  if (useCustomWidth.value && customWidth.value && customWidth.value > 0) {
    return Math.round(customWidth.value)
  }
  return Math.round(sourceWidth.value * scale.value)
})

const outputHeight = computed(() => {
  if (!sourceHeight.value || !outputWidth.value) return 0
  return Math.round(sourceHeight.value * (outputWidth.value / sourceWidth.value))
})

// 解析 SVG 长度属性（px / 无单位数值），百分比等不可用值返回 null
const parseLength = (value: string | null): number | null => {
  if (!value) return null
  const m = value.trim().match(/^(-?[\d.]+)\s*(px)?$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

// 解析 SVG 文本：校验合法性并提取原始尺寸
const parseSvg = (text: string) => {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('不是有效的 SVG 文件')
  }
  // XML 文档的 documentElement 在 DOM 类型里只标成 HTMLElement，
  // 通过了上面的 svg 节点校验后实际必为 SVGSVGElement
  const svgEl = root as unknown as SVGSVGElement

  let w = parseLength(svgEl.getAttribute('width'))
  let h = parseLength(svgEl.getAttribute('height'))
  let source = 'width/height 属性'

  if (w === null || h === null) {
    const vb = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
    if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
      w = vb[2]
      h = vb[3]
      source = 'viewBox'
    }
  }

  if (w === null || h === null) {
    w = 512
    h = 512
    source = '默认值（SVG 未声明尺寸）'
  }

  return { svgEl, width: w, height: h, sizeSource: source }
}

// 载入 SVG：统一入口，文件与粘贴代码都走这里
const loadSvg = (text: string, name: string) => {
  try {
    const parsed = parseSvg(text)
    svgText.value = text
    fileName.value = name
    sourceWidth.value = Math.round(parsed.width)
    sourceHeight.value = Math.round(parsed.height)
    sizeSource.value = parsed.sizeSource

    // 无尺寸时重置缩放选项，避免误导
    if (parsed.sizeSource.startsWith('默认值')) {
      scale.value = 1
    }

    // 自动切换：粘贴代码后跳回预览语义清晰的文件页签无意义，保持当前页签即可
    convert(parsed.svgEl)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'SVG 解析失败，请检查内容')
  }
}

const handleUpload = async (params: any) => {
  const file = params.file as File
  if (file.type && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
    ElMessage.error('请选择 SVG 文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('SVG 文件超过 10 MB 上限')
    return
  }
  const reader = new FileReader()
  reader.onload = () => loadSvg(reader.result as string, file.name)
  reader.onerror = () => ElMessage.error('文件读取失败，请重试')
  reader.readAsText(file)
}

const applyCode = () => {
  const text = svgCodeInput.value.trim()
  if (!text) {
    ElMessage.warning('请先粘贴 SVG 代码')
    return
  }
  if (text.length > 10 * 1024 * 1024) {
    ElMessage.error('SVG 代码超过 10 MB 上限')
    return
  }
  loadSvg(text, 'pasted.svg')
}

// 核心转换：SVG → Canvas → PNG/JPG
const convert = (svgElIn?: SVGSVGElement) => {
  if (!svgText.value) return

  let svgEl: SVGSVGElement
  try {
    svgEl = svgElIn ?? parseSvg(svgText.value).svgEl
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'SVG 解析失败，请检查内容')
    return
  }

  const outW = outputWidth.value
  const outH = outputHeight.value
  if (!outW || !outH) return
  if (outW > MAX_SIDE || outH > MAX_SIDE) {
    ElMessage.warning(`输出尺寸 ${outW}×${outH} 超过 ${MAX_SIDE}px 上限，请降低倍数或宽度`)
    return
  }

  converting.value = true

  try {
    // 显式写入输出尺寸与命名空间：Firefox 对无 width/height 的 SVG 会渲染为 0 尺寸
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }
    svgEl.setAttribute('width', String(outW))
    svgEl.setAttribute('height', String(outH))

    const serialized = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')!

        // JPG 不支持透明，必须铺底；PNG 可选透明
        if (targetFormat.value === 'jpeg' || !transparentBg.value) {
          ctx.fillStyle = bgColor.value
          ctx.fillRect(0, 0, outW, outH)
        }

        ctx.drawImage(img, 0, 0, outW, outH)
        URL.revokeObjectURL(url)

        const mimeType = targetFormat.value === 'png' ? 'image/png' : 'image/jpeg'
        canvas.toBlob(
          (outBlob) => {
            converting.value = false
            if (!outBlob) {
              ElMessage.error('转换失败，请重试')
              return
            }
            resultBlob.value = outBlob
            resultSize.value = outBlob.size
            if (resultSrc.value) URL.revokeObjectURL(resultSrc.value)
            resultSrc.value = URL.createObjectURL(outBlob)
          },
          mimeType,
          targetFormat.value === 'jpeg' ? jpegQuality.value : undefined,
        )
      } catch (e) {
        converting.value = false
        ElMessage.error('转换失败：该 SVG 可能包含外链资源或 foreignObject，浏览器出于安全限制无法导出')
      }
    }
    img.onerror = () => {
      converting.value = false
      URL.revokeObjectURL(url)
      ElMessage.error('SVG 渲染失败，请检查代码是否包含外链图片、字体等资源')
    }
    img.src = url
  } catch (e) {
    converting.value = false
    ElMessage.error('转换失败，请重试')
  }
}

// 选项变化时重新转换
const reconvert = () => {
  if (svgText.value) convert()
}

const download = () => {
  if (!resultBlob.value) return
  const a = document.createElement('a')
  a.href = resultSrc.value
  const base = fileName.value.replace(/\.svg$/i, '') || 'svg-image'
  a.download = `${base}.${targetFormat.value === 'jpeg' ? 'jpg' : 'png'}`
  a.click()
  ElMessage.success('下载成功')
}

const reset = () => {
  svgText.value = ''
  svgCodeInput.value = ''
  fileName.value = ''
  resultSrc.value = ''
  resultBlob.value = null
  resultSize.value = 0
  sourceWidth.value = 0
  sourceHeight.value = 0
  sizeSource.value = ''
  useCustomWidth.value = false
  customWidth.value = null
  scale.value = 1
}
</script>

<template>
  <div class="svg-to-image-page flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <el-tabs v-model="activeTab" class="mb-4">
        <el-tab-pane label="上传 SVG 文件" name="file">
          <el-upload
            drag
            accept=".svg,image/svg+xml"
            :show-file-list="false"
            :http-request="handleUpload"
            class="w-full"
          >
            <el-icon :size="40" class="text-gray-400"><UploadFilled /></el-icon>
            <div class="el-upload__text mt-2">
              拖拽 SVG 到此处，或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip text-gray-400 mt-1">
                支持 .svg 文件，最大 10 MB，纯浏览器本地转换
              </div>
            </template>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="粘贴 SVG 代码" name="code">
          <div class="space-y-2">
            <el-input
              v-model="svgCodeInput"
              type="textarea"
              :rows="6"
              placeholder='粘贴 SVG 代码，例如：<svg viewBox="0 0 100 100">...</svg>'
              spellcheck="false"
            />
            <el-button type="primary" @click="applyCode">解析并转换</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 转换选项与预览 -->
      <div v-if="svgText" class="flex flex-col gap-4">
        <!-- 选项栏 -->
        <div class="bg-gray-50 rounded-lg p-3 space-y-3">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-body-sm text-gray-500">输出格式：</span>
            <el-radio-group v-model="targetFormat" @change="reconvert">
              <el-radio-button value="png">PNG</el-radio-button>
              <el-radio-button value="jpeg">JPG</el-radio-button>
            </el-radio-group>

            <span class="text-body-sm text-gray-500 ml-2">尺寸：</span>
            <el-select
              v-model="scale"
              :disabled="useCustomWidth"
              class="!w-28"
              @change="reconvert"
            >
              <el-option label="0.5x" :value="0.5" />
              <el-option label="1x" :value="1" />
              <el-option label="1.5x" :value="1.5" />
              <el-option label="2x" :value="2" />
              <el-option label="3x" :value="3" />
              <el-option label="4x" :value="4" />
            </el-select>

            <el-checkbox v-model="useCustomWidth" @change="reconvert">自定义宽度</el-checkbox>
            <el-input-number
              v-if="useCustomWidth"
              v-model="customWidth"
              :min="16"
              :max="8192"
              :step="16"
              controls-position="right"
              class="!w-32"
              @change="reconvert"
            />
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <template v-if="targetFormat === 'jpeg'">
              <span class="text-body-sm text-gray-500">质量：</span>
              <el-slider
                v-model="jpegQuality"
                :min="0.1"
                :max="1"
                :step="0.01"
                :format-tooltip="(v: number) => Math.round(v * 100) + '%'"
                class="!w-40"
                @change="reconvert"
              />
              <span class="text-body-sm text-gray-600 w-10">{{ Math.round(jpegQuality * 100) }}%</span>
              <span class="text-body-sm text-gray-500 ml-2">背景色：</span>
            </template>
            <template v-else>
              <el-checkbox v-model="transparentBg" @change="reconvert">透明背景</el-checkbox>
              <span v-if="!transparentBg" class="text-body-sm text-gray-500 ml-2">背景色：</span>
            </template>
            <el-color-picker
              v-if="targetFormat === 'jpeg' || !transparentBg"
              v-model="bgColor"
              @change="reconvert"
            />
          </div>

          <div class="flex items-center gap-4 flex-wrap text-body-sm">
            <el-tag type="info" size="small">原始 {{ sourceWidth }}×{{ sourceHeight }}（{{ sizeSource }}）</el-tag>
            <el-tag type="success" size="small">输出 {{ outputWidth }}×{{ outputHeight }}</el-tag>
            <el-tag v-if="resultSize" type="success" size="small">
              {{ formatLabel(targetFormat) }} {{ formatSize(resultSize) }}
            </el-tag>

            <div class="ml-auto flex gap-2">
              <el-button size="small" @click="reset">清空</el-button>
              <el-button
                type="primary"
                size="small"
                :disabled="!resultSrc || converting"
                @click="download"
              >
                <el-icon class="mr-1"><Download /></el-icon>
                下载 {{ formatLabel(targetFormat) }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 预览 -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-gray-100 px-3 py-2 text-body-sm font-medium flex justify-between items-center">
            <span>转换结果（{{ formatLabel(targetFormat) }}）</span>
            <span class="text-gray-400">{{ outputWidth }}×{{ outputHeight }}</span>
          </div>
          <div
            class="flex items-center justify-center p-2 min-h-[200px]"
            :class="{ 'bg-[repeating-conic-gradient(#eee_0%_25%,transparent_0%_50%)_50%/20px_20px]': targetFormat === 'png' && transparentBg }"
          >
            <img v-if="resultSrc" :src="resultSrc" class="max-w-full max-h-[400px] object-contain" alt="转换结果" />
            <span v-else class="text-gray-400">转换中...</span>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="flex items-center justify-center min-h-[200px]">
        <el-empty description="上传 SVG 文件或粘贴 SVG 代码即可开始转换" :image-size="80" />
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>SVG 转位图：</strong>将矢量 SVG 文件或代码转换为 JPG、PNG 位图，支持 0.5x ~ 4x 缩放与自定义输出宽度，导出高清图标、插画与设计稿。
        </el-text>
        <el-divider />
        <el-text>
          <strong>格式说明：</strong>PNG 支持透明背景，适合图标与透明插画；JPG 不支持透明，可调节 10% ~ 100% 质量并自定义底色，适合照片类内容。
        </el-text>
        <el-divider />
        <el-text>
          <strong>尺寸识别：</strong>自动读取 SVG 的 width/height 属性，缺失时回退到 viewBox 尺寸，两者都没有时默认按 512×512 处理。
        </el-text>
        <el-divider />
        <el-text>
          <strong>隐私安全：</strong>全部转换在浏览器本地完成，文件不会上传服务器。
          注意：包含外链图片、外部字体或 foreignObject 的 SVG 受浏览器安全限制，可能无法导出。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload) {
  width: 100%;
}
:deep(.el-upload-dragger) {
  width: 100%;
}
</style>

<style>
/* Element Plus 的空状态插画默认使用白色阶梯，深色背景下会显得过亮。 */
html.dark .svg-to-image-page .el-empty {
  --el-empty-fill-color-0: #30323a;
  --el-empty-fill-color-1: #2c2e35;
  --el-empty-fill-color-2: #34363f;
  --el-empty-fill-color-3: #33353e;
  --el-empty-fill-color-4: #3d3f49;
  --el-empty-fill-color-5: #3c3e48;
  --el-empty-fill-color-6: #42444e;
  --el-empty-fill-color-7: #464852;
  --el-empty-fill-color-8: #4a4c56;
  --el-empty-fill-color-9: #525461;
}
</style>
