<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import html2canvas from "html2canvas"

// 模板类型定义
interface Template {
  id: number
  name: string
  background: string
  textColor: string
  accentColor: string
  style: string
}

// 预设模板
const templates: Template[] = [
  {
    id: 1,
    name: '简约白底',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: '#ffffff',
    accentColor: '#ffd700',
    style: 'gradient-purple'
  },
  {
    id: 3,
    name: '温暖橙黄',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    textColor: '#ffffff',
    accentColor: '#ffcc00',
    style: 'gradient-warm'
  },
  {
    id: 4,
    name: '商务灰蓝',
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    textColor: '#ffffff',
    accentColor: '#ffffff',
    style: 'gradient-business'
  },
  {
    id: 5,
    name: '活力绿意',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    textColor: '#ffffff',
    accentColor: '#ffff00',
    style: 'gradient-green'
  },
  {
    id: 6,
    name: '优雅粉红',
    background: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
    textColor: '#ffffff',
    accentColor: '#ff6b6b',
    style: 'gradient-pink'
  },
  {
    id: 7,
    name: '深空午夜',
    background: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)',
    textColor: '#ffffff',
    accentColor: '#ffd700',
    style: 'gradient-midnight'
  },
  {
    id: 8,
    name: '日落黄昏',
    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    textColor: '#ffffff',
    accentColor: '#ffffff',
    style: 'gradient-sunset'
  },
  {
    id: 9,
    name: '极简黑白',
    background: '#1a1a1a',
    textColor: '#ffffff',
    accentColor: '#00ff88',
    style: 'minimal-black'
  },
  {
    id: 10,
    name: '纯净白',
    background: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#667eea',
    style: 'minimal-white'
  },
  {
    id: 999,
    name: '🎲 随机',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: '#ffffff',
    accentColor: '#ffd700',
    style: 'random'
  }
]

// 图片比例选项
const aspectRatios = [
  { label: '3:4 (750×1000)', value: 750 / 1000, width: 750, height: 1000 },
  { label: '1:1 (1000×1000)', value: 1, width: 1000, height: 1000 },
  { label: '16:9 (750×422)', value: 16 / 9, width: 750, height: 422 },
  { label: '4:3 (750×562)', value: 4 / 3, width: 750, height: 562 },
  { label: '9:16 (422×750)', value: 9 / 16, width: 422, height: 750 },
  { label: '自定义', value: 'custom', width: 750, height: 1000 }
]

// 随机生成模板
const generateRandomTemplate = (): Template => {
  // 随机生成背景色
  const randomColor = () => {
    const hue = Math.floor(Math.random() * 360)
    const saturation = Math.floor(Math.random() * 30) + 70 // 70-100%
    const lightness = Math.floor(Math.random() * 40) + 30 // 30-70%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  // 随机决定使用纯色还是渐变 (50%概率)
  const useGradient = Math.random() > 0.5

  let background: string
  if (useGradient) {
    const color1 = randomColor()
    const color2 = randomColor()
    background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`
  } else {
    background = randomColor()
  }

  // 随机生成文字颜色（根据背景亮度决定）
  const bgLightness = 50
  const textColor = bgLightness > 50 ? '#1a1a1a' : '#ffffff'

  // 随机生成强调色
  const accentHue = Math.floor(Math.random() * 360)
  const accentColor = `hsl(${accentHue}, 80%, 60%)`

  return {
    id: 999,
    name: '🎲 随机',
    background: background,
    textColor: textColor,
    accentColor: accentColor,
    style: 'random'
  }
}

const info = reactive({
  title: "闲鱼技能海报生成器",
  selectedTemplate: generateRandomTemplate(), // 默认使用随机模板
  posterWidth: 750,
  posterHeight: 1000,
  selectedAspectRatio: 0, // 默认选择第一个比例
  isCustomSize: false, // 是否使用自定义尺寸
  mainTitle: 'Python脚本开发',
  subTitle: '3年项目经验 | 性价比高',
  showSubTitle: true,
  description: '提供Python脚本开发、数据分析、爬虫等服务，快速响应，质量保证',
  showDescription: true,
  contact: '微信：example123',
  showContact: false,
  footerText: '闲鱼技能服务 · 专业可靠',
  showFooter: true,
  tags: ['Python', '数据分析', '爬虫'],
  textAlign: 'left', // 对齐方式：left | center | right
  fontSize: {
    mainTitle: 80,
    subTitle: 48,
    description: 48,
    contact: 24
  },
  previewScale: 0.42, // 预览缩放比例
  watermark: {
    enabled: false,
    text: '闲鱼技能服务',
    size: 24,
    opacity: 30,
    density: 5,
    angle: -30,
    color: 'rgba(255, 255, 255, 0.3)'
  }
})

const poster = ref()
const isGenerating = ref(false)

// 切换模板
const selectTemplate = (template: Template, event?: MouseEvent) => {
  if (template.id === 999) {
    // 如果是随机模板，每次都生成新的
    info.selectedTemplate = generateRandomTemplate()
  } else {
    info.selectedTemplate = template
  }

  // 触发点击动画
  if (event) {
    animateClick(event)
  }
}

// 添加标签
const addTag = () => {
  const newTag = prompt('请输入新标签：')
  if (newTag && newTag.trim()) {
    info.tags.push(newTag.trim())
  }
}

// 删除标签
const removeTag = (index: number) => {
  info.tags.splice(index, 1)
}

// 监听比例变化，自动更新尺寸
watch(() => info.selectedAspectRatio, (newIndex) => {
  if (newIndex !== aspectRatios.length - 1) { // 不是自定义选项
    const ratio = aspectRatios[newIndex]
    info.posterWidth = ratio.width
    info.posterHeight = ratio.height
    info.isCustomSize = false
  } else {
    info.isCustomSize = true
  }
})

// 点击动画效果
const animateClick = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement

  // 创建波纹元素
  const ripple = document.createElement('span')
  ripple.classList.add('ripple')

  // 计算位置
  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 设置波纹位置
  ripple.style.left = x + 'px'
  ripple.style.top = y + 'px'
  ripple.style.background = 'rgba(255, 255, 255, 0.6)'

  // 添加到DOM
  target.appendChild(ripple)

  // 移除波纹
  setTimeout(() => {
    ripple.remove()
  }, 600)
}

// 水印样式计算
const watermarkStyle = computed(() => {
  if (!info.watermark.enabled) return {}
  return {
    position: 'absolute' as const,
    left: '0' as const,
    top: '0' as const,
    right: '0' as const,
    bottom: '0' as const,
    pointerEvents: 'none' as const,
    display: 'grid' as const,
    gridTemplateColumns: `repeat(${info.watermark.density}, 1fr)`,
    gridTemplateRows: `repeat(${info.watermark.density}, 1fr)`,
    alignContent: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    zIndex: 1
  }
})

const watermarkItemStyle = computed(() => {
  if (!info.watermark.enabled) return {}
  const isLightBg = info.selectedTemplate.style === 'minimal-white'
  const baseColor = isLightBg ? '0, 0, 0' : '255, 255, 255'

  return {
    fontSize: info.watermark.size + 'px',
    color: `rgba(${baseColor}, ${info.watermark.opacity / 100})`,
    fontWeight: 'normal' as const,
    padding: '20px' as const,
    transform: `rotate(${info.watermark.angle}deg)`,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    lineHeight: '1.5' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  }
})

// 生成水印内容数组
const watermarkItems = computed(() => {
  if (!info.watermark.enabled) return []
  const totalCount = info.watermark.density * info.watermark.density
  return Array(totalCount).fill(info.watermark.text || '')
})

// 生成图片
const generatePoster = async () => {
  if (!poster.value || isGenerating.value) return

  isGenerating.value = true

  try {
    // 创建一个克隆的元素用于生成图片（不带transform）
    const cloneNode = poster.value.cloneNode(true) as HTMLElement
    cloneNode.style.transform = 'none'
    cloneNode.style.position = 'absolute'
    cloneNode.style.left = '-9999px'
    cloneNode.style.top = '0'

    document.body.appendChild(cloneNode)

    const canvas = await html2canvas(cloneNode, {
      backgroundColor: null,
      useCORS: true,
      scale: 1,
      width: info.posterWidth,
      height: info.posterHeight,
      windowWidth: info.posterWidth,
      windowHeight: info.posterHeight
    })

    // 移除克隆节点
    document.body.removeChild(cloneNode)

    const baseImg = canvas.toDataURL("image/png")

    // 创建下载链接
    const link = document.createElement('a')
    link.href = baseImg
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    link.download = `闲鱼技能海报_${date}_${info.posterWidth}x${info.posterHeight}.png`
    link.click()
  } catch (error) {
    console.error('生成图片失败:', error)
    console.log(error)
    alert('生成图片失败，请重试')
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <!-- 左侧：编辑区 -->
      <div class="w-full lg:w-1/2 flex flex-col gap-4">
        <!-- 模板选择 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
          <h3 class="text-lg font-bold mb-3 text-gray-800">选择模板</h3>
          <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <div
              v-for="template in templates"
              :key="template.id"
              @click="selectTemplate(template, $event)"
              class="template-btn"
              :class="[
                'h-16 rounded-lg cursor-pointer transition-all duration-200 border flex items-center justify-center text-xs font-medium relative overflow-hidden',
                template.style === 'minimal-white'
                  ? 'border-gray-300 hover:border-gray-400 hover:scale-102 hover:shadow-lg'
                  : '',
                info.selectedTemplate.id === template.id && template.id !== 999
                  ? 'border-blue-600 border-4 scale-110 shadow-xl shadow-blue-500/60 ring-4 ring-blue-400/30 z-10'
                  : template.id === 999
                  ? 'border-purple-500 border-2 hover:border-purple-400 hover:scale-105 shadow-lg shadow-purple-500/50'
                  : template.style !== 'minimal-white'
                  ? 'border-transparent border-2 hover:scale-102 hover:shadow-lg'
                  : '',
                template.id === 999 ? 'animate-pulse' : ''
              ]"
              :style="{ background: template.background, color: template.textColor, userSelect: 'none' }"
            >
              <span class="relative z-10">{{ template.name }}</span>
              <!-- 选中标记 -->
              <div v-if="info.selectedTemplate.id === template.id" class="absolute top-0 right-0 w-5 h-5 flex items-center justify-center" :class="template.id === 999 ? 'bg-purple-600' : 'bg-blue-600'">
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 图片比例 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
          <h3 class="text-lg font-bold mb-3 text-gray-800">图片比例</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div
              v-for="(ratio, index) in aspectRatios"
              :key="index"
              @click="info.selectedAspectRatio = index"
              :class="[
                'h-12 rounded-lg cursor-pointer transition-all duration-200 border-2 flex items-center justify-center text-xs font-medium',
                info.selectedAspectRatio === index
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-300'
              ]"
            >
              {{ ratio.label }}
            </div>
          </div>

          <!-- 自定义尺寸输入 -->
          <div v-if="info.isCustomSize" class="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div class="flex items-center gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">宽度 (px)</label>
                <el-input-number
                  v-model="info.posterWidth"
                  :min="100"
                  :max="2000"
                  :step="10"
                  controls-position="right"
                  class="w-full"
                />
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">高度 (px)</label>
                <el-input-number
                  v-model="info.posterHeight"
                  :min="100"
                  :max="2000"
                  :step="10"
                  controls-position="right"
                  class="w-full"
                />
              </div>
            </div>
            <div class="text-xs text-gray-500">
              当前尺寸：{{ info.posterWidth }}×{{ info.posterHeight }}px
            </div>
          </div>

          <div v-else class="mt-2 text-xs text-gray-500">
            当前尺寸：{{ info.posterWidth }}×{{ info.posterHeight }}px
          </div>
        </div>

        <!-- 文字内容编辑 -->
        <div class="bg-white rounded-2xl p-4 shadow-sm">
          <h3 class="text-lg font-bold mb-3 text-gray-800">编辑内容</h3>

          <!-- 对齐方式 -->
          <div class="mb-4 p-3 bg-gray-50 rounded-lg">
            <label class="block text-sm font-medium text-gray-700 mb-2">内容对齐方式</label>
            <div class="flex gap-2">
              <button
                v-for="align in ['left', 'center', 'right']"
                :key="align"
                @click="info.textAlign = align"
                :class="[
                  'flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200',
                  info.textAlign === align
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                ]"
              >
                <svg v-if="align === 'left'" class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h7"></path>
                </svg>
                <svg v-else-if="align === 'center'" class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M7 12h10M5 18h14"></path>
                </svg>
                <svg v-else class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M10 12h10M6 18h14"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <!-- 主标题 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                主标题 <span class="text-gray-400">（如：Python脚本开发）</span>
              </label>
              <el-input
                v-model="info.mainTitle"
                placeholder="请输入主标题"
                maxlength="60"
                show-word-limit
              />
              <div class="mt-2">
                <el-text class="text-xs text-gray-500">字体大小：{{ info.fontSize.mainTitle }}px</el-text>
                <el-slider v-model="info.fontSize.mainTitle" :min="20" :max="200" show-input size="small" />
              </div>
            </div>

            <!-- 副标题 -->
            <div>
              <el-checkbox v-model="info.showSubTitle" class="mb-2">显示副标题</el-checkbox>
              <div v-if="info.showSubTitle">
                <el-input
                  v-model="info.subTitle"
                  placeholder="请输入副标题"
                  maxlength="40"
                  show-word-limit
                />
                <div class="mt-2">
                  <el-text class="text-xs text-gray-500">字体大小：{{ info.fontSize.subTitle }}px</el-text>
                  <el-slider v-model="info.fontSize.subTitle" :min="20" :max="120" show-input size="small" />
                </div>
              </div>
            </div>

            <!-- 描述 -->
            <div>
              <el-checkbox v-model="info.showDescription" class="mb-2">显示详细描述</el-checkbox>
              <div v-if="info.showDescription">
                <el-input
                  v-model="info.description"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入详细描述"
                  maxlength="200"
                  show-word-limit
                />
                <div class="mt-2">
                  <el-text class="text-xs text-gray-500">字体大小：{{ info.fontSize.description }}px</el-text>
                  <el-slider v-model="info.fontSize.description" :min="1" :max="70" show-input size="small" />
                </div>
              </div>
            </div>

            <!-- 标签 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                技能标签 <span class="text-gray-400">（突出你的核心技能）</span>
              </label>
              <div class="flex flex-wrap gap-2 mb-2">
                <el-tag
                  v-for="(tag, index) in info.tags"
                  :key="index"
                  closable
                  @close="removeTag(index)"
                  class="!text-base"
                >
                  {{ tag }}
                </el-tag>
                <el-button size="small" @click="addTag">+ 添加标签</el-button>
              </div>
            </div>

            <!-- 联系方式 -->
            <div class="mb-4">
              <el-checkbox v-model="info.showContact">显示联系方式</el-checkbox>
              <el-input
                v-if="info.showContact"
                v-model="info.contact"
                placeholder="请输入联系方式（如：微信：xxx）"
                class="mt-2"
                maxlength="30"
              />
            </div>

            <!-- 底部标识 -->
            <div>
              <el-checkbox v-model="info.showFooter">显示底部标识</el-checkbox>
              <el-input
                v-if="info.showFooter"
                v-model="info.footerText"
                placeholder="请输入底部标识文字（如：闲鱼技能服务 · 专业可靠）"
                class="mt-2"
                maxlength="30"
              />
            </div>

            <!-- 水印设置 -->
            <div class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  <span class="text-base font-bold text-gray-800">水印设置</span>
                </div>
                <el-switch v-model="info.watermark.enabled" />
              </div>

              <div v-if="info.watermark.enabled" class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">水印文字</label>
                  <el-input v-model="info.watermark.text" placeholder="请输入水印文字" maxlength="30" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">字体大小 ({{ info.watermark.size }}px)</label>
                    <el-slider v-model="info.watermark.size" :min="12" :max="72" show-input size="small" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">旋转角度 ({{ info.watermark.angle }}°)</label>
                    <el-slider v-model="info.watermark.angle" :min="-90" :max="90" show-input size="small" />
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">透明度 ({{ info.watermark.opacity }}%)</label>
                    <el-slider v-model="info.watermark.opacity" :min="5" :max="100" show-input size="small" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">疏密度 ({{ info.watermark.density }}x{{ info.watermark.density }})</label>
                    <el-slider v-model="info.watermark.density" :min="2" :max="10" show-input size="small" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 下载按钮 -->
            <el-button
              type="primary"
              size="large"
              :loading="isGenerating"
              @click="generatePoster"
              class="w-full !text-lg"
            >
              {{ isGenerating ? '生成中...' : '生成并下载海报' }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 右侧：预览区 -->
      <div class="w-full lg:w-1/2 flex flex-col">
        <div class="bg-white rounded-2xl p-4 shadow-sm flex-1">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-bold text-gray-800">实时预览</h3>
            <el-text class="text-xs text-gray-500">缩放：{{ (info.previewScale * 100).toFixed(0) }}%</el-text>
          </div>

          <!-- 缩放控制 -->
          <div class="mb-3">
            <el-slider v-model="info.previewScale" :min="0.1" :max="1" :step="0.01" show-input size="small" />
          </div>

          <!-- 海报预览 -->
          <div class="flex justify-center items-start overflow-hidden" style="max-height: calc(100vh - 200px);">
            <div class="pt-4" style="width: fit-content;">
              <div
                ref="poster"
                class="relative overflow-hidden shadow-2xl transition-all duration-300"
                :style="{
                  width: info.posterWidth + 'px',
                  height: info.posterHeight + 'px',
                  background: info.selectedTemplate.background,
                  color: info.selectedTemplate.textColor,
                  transformOrigin: 'top center',
                  transform: `scale(${info.previewScale})`,
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }"
              >
              <!-- 内容容器 -->
              <div class="h-full flex flex-col justify-between p-12" :style="{ textAlign: info.textAlign as 'left' | 'center' | 'right' }">
                <!-- 顶部区域 -->
                <div class="flex-1 flex flex-col justify-center">
                  <!-- 主标题 -->
                  <h1
                    class="font-bold mb-6 leading-tight"
                    :style="{
                      fontSize: info.fontSize.mainTitle + 'px',
                      color: info.selectedTemplate.textColor
                    }"
                  >
                    {{ info.mainTitle }}
                  </h1>

                  <!-- 副标题 -->
                  <div
                    v-if="info.showSubTitle"
                    class="font-medium mb-8 opacity-90"
                    :style="{
                      fontSize: info.fontSize.subTitle + 'px',
                      color: info.selectedTemplate.textColor
                    }"
                  >
                    {{ info.subTitle }}
                  </div>

                  <!-- 分隔线 -->
                  <div
                    v-if="info.showSubTitle"
                    class="h-1.5 rounded-full"
                    :style="{
                      background: info.selectedTemplate.accentColor,
                      width: '96px',
                      marginBottom: '2rem',
                      margin: info.textAlign === 'center' ? '0 auto 2rem auto' : info.textAlign === 'right' ? '0 0 0 auto' : '0 0 2rem 0'
                    }"
                  ></div>

                  <!-- 描述 -->
                  <div
                    v-if="info.showDescription"
                    class="leading-relaxed opacity-95"
                    :style="{
                      fontSize: info.fontSize.description + 'px',
                      color: info.selectedTemplate.textColor
                    }"
                  >
                    {{ info.description }}
                  </div>
                </div>

                <!-- 底部区域 -->
                <div class="mt-auto">
                  <!-- 标签 -->
                  <div class="flex flex-wrap gap-x-6 gap-y-3 mb-6 items-center" :style="{ justifyContent: info.textAlign === 'center' ? 'center' : info.textAlign === 'right' ? 'flex-end' : 'flex-start' }">
                    <div
                      v-for="(tag, index) in info.tags"
                      :key="index"
                      class="tag-item"
                      :style="{
                        color: info.selectedTemplate.textColor,
                        fontSize: '24px',
                        display: 'inline-block',
                        lineHeight: '1.5'
                      }"
                    >
                      # {{ tag }}
                    </div>
                  </div>

                  <!-- 联系方式 -->
                  <div
                    v-if="info.showContact && info.contact"
                    class="text-center pt-6 border-t border-white border-opacity-30"
                    :style="{
                      fontSize: info.fontSize.contact + 'px',
                      color: info.selectedTemplate.textColor
                    }"
                  >
                    {{ info.contact }}
                  </div>

                  <!-- 底部标识 -->
                  <div
                    v-if="info.showFooter && info.footerText"
                    class="text-center mt-6 opacity-60 text-sm"
                    :style="{
                      color: info.selectedTemplate.textColor
                    }"
                  >
                    {{ info.footerText }}
                  </div>
                </div>
              </div>

              <!-- 水印层 -->
              <div v-if="info.watermark.enabled" :style="watermarkStyle">
                <div v-for="(item, index) in watermarkItems" :key="index" :style="watermarkItemStyle">
                  {{ item }}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-2">
        <el-text>1. 选择喜欢的模板风格</el-text>
        <el-text>2. 填写你的技能信息（主标题、副标题、详细描述）</el-text>
        <el-text>3. 添加技能标签，突出你的核心能力</el-text>
        <el-text>4. 可选添加联系方式，方便买家联系</el-text>
        <el-text>5. 点击"生成并下载海报"按钮，保存图片到本地</el-text>
        <el-text>6. 将图片上传到闲鱼，吸引更多买家</el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 模板按钮点击波纹效果 */
.template-btn {
  position: relative;
  user-select: none;
}

.template-btn .ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  transform: scale(0);
  animation: ripple-animation 0.6s linear;
  pointer-events: none;
}

@keyframes ripple-animation {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* 模板按钮点击闪光效果 */
.template-btn:active {
  transform: scale(0.95);
}

.template-btn:hover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
}

.template-btn:hover::before {
  opacity: 1;
}

/* 选中模板的光晕效果 */
.template-btn.border-blue-600 {
  animation: none;
}

@keyframes glow {
  from {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
  }
  to {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}

/* 随机模板的特殊效果 */
.template-btn.border-purple-500 {
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
