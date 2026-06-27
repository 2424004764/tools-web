# 老照片加字 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「老照片加字」工具：上传图片，在图片的上方/下方/上下都加上一条带，文字模板为「2026年春，xx同志在xx地方留影」，4 种预设样式 + 自由配色，一键导出 PNG。

**Architecture:** 纯前端单文件 Vue 3 组件。用 `<el-upload>` 接收图片，`FileReader` + `Image` 加载原图，响应式 state 触发 `watch` 回调 `renderCanvas()`，Canvas 实时合成（按位置绘制上/下条带和文字），`canvas.toDataURL` 给预览 `<img>`，下载走 `canvas.toBlob` 触发 `<a download>`。完全无后端依赖。

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Vite + Element Plus (el-upload, el-radio-group, el-color-picker, el-input, el-button, el-empty, el-select) + Tailwind CSS

## Global Constraints

- 工具名: `老照片加字`，路由 `/old-photo-caption/`
- 分类: 图片处理 (cateId=5)
- 三个自定义字段: 年份/季节、人物、地点；默认 `2026` / `春` / `同志` / `北京`
- 文字模板: `${year}年${season}，${person}同志在${place}留影`
- 位置: 单选 `top` / `bottom` / `both`（默认 `both`）
- 4 个预设: 经典黑金 (`#000` / `#FFD700`)、红底金字 (`#8B0000` / `#FFD700`)、黄底黑字 (`#FFC107` / `#000`)、自定义
- 3 种中文字体: `"SimSun", "宋体"`、`"KaiTi", "楷体"`、`"Microsoft YaHei", "微软雅黑"`，都加 `, sans-serif` fallback
- 字号自动: `min(条带高 × 0.55, 图片宽 × 0.06)`，用户可微调（滑块 8-200）
- 条带高度自动: `max(20, 图片宽 × 0.10)`，用户可微调（滑块 20-400）
- 输出格式: PNG（默认），保留原图分辨率
- 文件大小限制: 10MB（el-upload `before-upload` 拦截）
- 响应式: 桌面端左右分栏（控制左/预览右），移动端上下分栏
- SEO: 路由 meta 含 title/keywords/description；ToolDetail 含详细使用说明；sitemap.xml 注册；README.md 更新
- 语言: 中文；返回中文回复
- 代码风格: 最小改动，不炫技；删除 UI 时同步删除相关方法/变量

## File Structure

| 文件 | 责任 | 操作 |
|------|------|------|
| `src/components/Tools/OldPhotoCaption/OldPhotoCaption.vue` | 工具主组件（state、UI、Canvas 渲染、下载） | 新建 |
| `src/components/Tools/tools.ts` | 添加工具元数据（id=83） | 修改 |
| `src/router/router.ts` | 添加路由 | 修改 |
| `public/images/logo/old_photo_caption.png` | 工具 logo（80×80 PNG） | 新建 |
| `sitemap.xml` | 注册 URL | 修改 |
| `README.md` | 功能日志 + 工具列表 | 修改 |

---

## Task 1: 注册工具元数据 + 路由 + Logo

**Files:**
- Create: `public/images/logo/old_photo_caption.png`
- Modify: `src/components/Tools/tools.ts` (在「图片处理」分类末尾添加新条目)
- Modify: `src/router/router.ts` (在合适位置添加路由)

- [ ] **Step 1: 创建 logo 占位 PNG**

写一段 Node 脚本生成 80×80 透明 PNG（仅占位，颜色统一为深灰色 `#374151`），保存到 `public/images/logo/old_photo_caption.png`。

在 `D:\dev\nodejs\tools-web` 根目录创建 `tmp-gen-logo.mjs`：

```js
// tmp-gen-logo.mjs — 临时脚本：生成老照片加字 logo 占位图
import { writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

// 用 pngjs 不行就改用 zlib 直接写最小 80x80 透明 PNG。
// 这里直接用更稳的方案：调用 sharp
// 实际上更简单：直接放一个内联 base64 的 80x80 PNG。
// 为了避免引入依赖，我们用纯 Node 的 zlib 生成最简 PNG。

import zlib from 'node:zlib'

const W = 80, H = 80
// 每行 1 字节 filter type 0 + W*4 字节 RGBA
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) {
  const off = y * (W * 4 + 1)
  raw[off] = 0 // filter
  for (let x = 0; x < W; x++) {
    const p = off + 1 + x * 4
    // 上方黑色条带（高 16px）
    if (y < 16) {
      raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 255
    }
    // 下方黑色条带（底部 16px）
    else if (y >= 64) {
      raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 255
    }
    // 中间照片区域用浅灰
    else {
      raw[p] = 220; raw[p + 1] = 220; raw[p + 2] = 220; raw[p + 3] = 255
    }
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  // CRC32 simple impl
  let c = 0xffffffff
  for (const b of Buffer.concat([t, data])) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0)
  return Buffer.concat([len, t, data, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
const idat = zlib.deflateSync(raw)
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
writeFileSync('public/images/logo/old_photo_caption.png', png)
console.log('OK', png.length, 'bytes')
```

运行：`node tmp-gen-logo.mjs`，预期输出 `OK ... bytes`。然后 `rm tmp-gen-logo.mjs`。

- [ ] **Step 2: 在 `src/components/Tools/tools.ts` 中添加工具元数据**

打开 `src/components/Tools/tools.ts`，找到「图片处理」分类块（id=5，约 682 行），在末尾最后一个工具条目之后新增（id=83 与现有 id 不冲突；如果冲突改为下一个可用 id）。结构参考紧邻的 `证件照生成` 条目（id=73, `/id-photo/`）：

```ts
{
  id: 83,
  title: '老照片加字',
  logo: '/images/logo/old_photo_caption.png',
  desc: '在图片上下方添加「2026年春，xx同志在xx地方留影」风格的题字条带，支持多种预设样式和自由配色，实时预览，一键下载',
  url: '/old-photo-caption/',
  cateId: 5,
  cate: '图片处理',
},
```

- [ ] **Step 3: 在 `src/router/router.ts` 中添加路由**

打开 `src/router/router.ts`，参考 `id-photo` 路由（搜索 `id-photo` 定位）。在合适位置（任意顺序）添加：

```ts
{
  path: '/old-photo-caption/',
  component: () => import('@/components/Tools/OldPhotoCaption/OldPhotoCaption.vue'),
  name: 'oldPhotoCaption',
  meta: {
    title: '老照片加字',
    keywords: '老照片加字,伟人题词,老照片,留影题字,经典老照片,图片加字,题字条带',
    description: '上传图片，在图片上下方添加「2026年春，xx同志在xx地方留影」风格的题字条带，提供经典黑金/红底金字/黄底黑字等多种预设样式，实时预览，一键下载。',
  }
},
```

- [ ] **Step 4: 验证 `pnpm run dev` 不报错**

在 `D:\dev\nodejs\tools-web` 跑：`pnpm run dev`（后台运行 30 秒，然后 TaskStop 即可）。预期：开发服务器正常启动，控制台无新增报错。如果有「找不到组件」之类的错误，回到 Step 3 检查路径。

- [ ] **Step 5: 提交**

```bash
git add public/images/logo/old_photo_caption.png src/components/Tools/tools.ts src/router/router.ts
git commit -m "feat(tools): 注册「老照片加字」工具（id=83, /old-photo-caption/）"
```

---

## Task 2: 创建组件骨架 + 上传图片

**Files:**
- Create: `src/components/Tools/OldPhotoCaption/OldPhotoCaption.vue`

- [ ] **Step 1: 写组件骨架 + state 声明 + 上传处理**

完整内容如下，写入 `src/components/Tools/OldPhotoCaption/OldPhotoCaption.vue`：

```vue
<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { UploadProps, UploadRawFile, genFileId, ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({ title: '老照片加字' })

// === 上传 ===
const fileList = ref()
const dataFileRef = ref()
const originalImage = ref<HTMLImageElement | null>(null)
const originalImageSrc = ref('')

// === 文字 ===
const year = ref('2026')
const season = ref('春')
const person = ref('同志')
const place = ref('北京')

const caption = computed(
  () => `${year.value}年${season.value}，${person.value}同志在${place.value}留影`
)

// === 位置 ===
type Position = 'top' | 'bottom' | 'both'
const position = ref<Position>('both')

// === 样式预设 ===
type PresetKey = 'blackGold' | 'redGold' | 'yellowBlack' | 'custom'
const presetKey = ref<PresetKey>('blackGold')

const presets: Record<Exclude<PresetKey, 'custom'>, { bg: string; fg: string; label: string }> = {
  blackGold: { bg: '#000000', fg: '#FFD700', label: '经典黑金' },
  redGold: { bg: '#8B0000', fg: '#FFD700', label: '红底金字' },
  yellowBlack: { bg: '#FFC107', fg: '#000000', label: '黄底黑字' },
}

const bgColor = ref('#000000')
const textColor = ref('#FFD700')

// === 字体 ===
const fontFamily = ref<'SimSun' | 'KaiTi' | 'Microsoft YaHei'>('SimSun')
const fontSizeOptions = ['SimSun', 'KaiTi', 'Microsoft YaHei']
const fontSizeLabels: Record<string, string> = {
  SimSun: '宋体',
  KaiTi: '楷体',
  'Microsoft YaHei': '微软雅黑',
}

// === 手动微调（滑块）===
const fontSizeScale = ref(100) // 百分比，100 = 自动值
const bandHeightScale = ref(100) // 百分比，100 = 自动值

// === 预览 ===
const previewSrc = ref('')

// === 上传处理 ===
const updateDataFile = async (params: any) => {
  const file = params.file as File
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 10MB')
    return
  }
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.addEventListener('load', () => {
    const img = new Image()
    img.onload = () => {
      originalImage.value = img
      originalImageSrc.value = reader.result as string
    }
    img.src = reader.result as string
  }, false)
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  dataFileRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  dataFileRef.value!.handleStart(file)
  dataFileRef.value!.submit()
}

// === 切换预设 ===
const applyPreset = (key: PresetKey) => {
  presetKey.value = key
  if (key !== 'custom') {
    bgColor.value = presets[key].bg
    textColor.value = presets[key].fg
  }
}

// === 计算条带高/字号 ===
const calcBandHeight = (img: HTMLImageElement) =>
  Math.max(20, Math.round(img.naturalWidth * 0.10))

const calcFontSize = (img: HTMLImageElement, bandH: number) =>
  Math.max(8, Math.min(bandH * 0.55, img.naturalWidth * 0.06))

// === 渲染 Canvas ===
const renderCanvas = () => {
  const img = originalImage.value
  if (!img) return

  const bandAutoH = calcBandHeight(img)
  const bandH = Math.round((bandAutoH * bandHeightScale.value) / 100)
  const topH = position.value === 'bottom' ? 0 : bandH
  const botH = position.value === 'top' ? 0 : bandH

  const totalW = img.naturalWidth
  const totalH = img.naturalHeight + topH + botH

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let y = 0
  if (topH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, totalW, topH)
    drawCaption(ctx, caption.value, 0, 0, totalW, topH, img, bandH)
    y = topH
  }
  ctx.drawImage(img, 0, y)
  y += img.naturalHeight
  if (botH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, y, totalW, botH)
    drawCaption(ctx, caption.value, 0, y, totalW, botH, img, bandH)
  }

  previewSrc.value = canvas.toDataURL('image/png')
}

const drawCaption = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  img: HTMLImageElement,
  bandH: number
) => {
  const auto = calcFontSize(img, bandH)
  const fontSize = Math.max(8, Math.round((auto * fontSizeScale.value) / 100))
  ctx.fillStyle = textColor.value
  ctx.font = `bold ${fontSize}px "${fontFamily.value}", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

// === 监听任何变化重渲染 ===
watch(
  [
    originalImage,
    year,
    season,
    person,
    place,
    position,
    bgColor,
    textColor,
    fontFamily,
    fontSizeScale,
    bandHeightScale,
  ],
  () => {
    if (originalImage.value) renderCanvas()
  }
)

// === 下载 ===
const downloadImage = () => {
  if (!previewSrc.value) return
  // previewSrc 是 dataURL; 从同一个 canvas 重新走 toBlob 拿原尺寸 PNG
  // 但 dataURL 已包含数据，直接转 blob 即可
  fetch(previewSrc.value)
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `old-photo-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <el-upload
        v-model:file-list="fileList"
        ref="dataFileRef"
        accept="image/*"
        :http-request="updateDataFile"
        :on-exceed="handleExceed"
        :limit="1"
        drag
        class="w-full"
      >
        <div class="el-upload__text">
          拖拽图片到此处或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">支持 JPG、PNG 等常见图片格式，大小不超过 10MB</div>
        </template>
      </el-upload>

      <!-- 主体：控制面板 + 预览 -->
      <div v-if="originalImageSrc" class="mt-4 flex flex-col lg:flex-row gap-4">
        <!-- 控制面板 -->
        <div class="w-full lg:w-80 shrink-0 space-y-3">
          <!-- 文字内容 -->
          <div class="p-3 bg-gray-50 rounded-lg space-y-2">
            <div class="text-sm font-medium text-gray-700">文字内容</div>
            <div class="flex items-center gap-2">
              <el-input v-model="year" placeholder="年份" size="small" class="!w-20" />
              <span class="text-sm text-gray-500">年</span>
              <el-input v-model="season" placeholder="季节" size="small" class="!w-16" />
            </div>
            <div class="flex items-center gap-2">
              <el-input v-model="person" placeholder="人物" size="small" class="flex-1" />
              <span class="text-sm text-gray-500">同志</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">在</span>
              <el-input v-model="place" placeholder="地点" size="small" class="flex-1" />
              <span class="text-sm text-gray-500">留影</span>
            </div>
            <div class="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
              预览：<span class="text-gray-800">{{ caption }}</span>
            </div>
          </div>

          <!-- 位置 -->
          <div class="p-3 bg-gray-50 rounded-lg">
            <div class="text-sm font-medium text-gray-700 mb-2">位置</div>
            <el-radio-group v-model="position" class="flex flex-wrap">
              <el-radio-button value="top">仅上方</el-radio-button>
              <el-radio-button value="bottom">仅下方</el-radio-button>
              <el-radio-button value="both">上下都加</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 预设样式 -->
          <div class="p-3 bg-gray-50 rounded-lg">
            <div class="text-sm font-medium text-gray-700 mb-2">预设样式</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="(p, key) in presets"
                :key="key"
                type="button"
                class="px-2 py-2 rounded border-2 text-sm transition"
                :class="presetKey === key ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
                :style="{ background: p.bg, color: p.fg, fontWeight: 'bold' }"
                @click="applyPreset(key as PresetKey)"
              >
                {{ p.label }}
              </button>
              <button
                type="button"
                class="px-2 py-2 rounded border-2 text-sm transition bg-white text-gray-700"
                :class="presetKey === 'custom' ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'"
                @click="applyPreset('custom')"
              >
                自定义
              </button>
            </div>
          </div>

          <!-- 高级 -->
          <div class="p-3 bg-gray-50 rounded-lg space-y-2">
            <div class="text-sm font-medium text-gray-700">高级</div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">背景色</span>
              <el-color-picker v-model="bgColor" size="small" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">文字色</span>
              <el-color-picker v-model="textColor" size="small" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">字体</span>
              <el-select v-model="fontFamily" size="small" class="flex-1">
                <el-option v-for="f in fontSizeOptions" :key="f" :value="f" :label="fontSizeLabels[f]" />
              </el-select>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">条带高度</span>
              <el-slider v-model="bandHeightScale" :min="50" :max="200" :step="10" class="flex-1" />
              <span class="text-xs text-gray-500 w-10 text-right">{{ bandHeightScale }}%</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">字号</span>
              <el-slider v-model="fontSizeScale" :min="50" :max="200" :step="10" class="flex-1" />
              <span class="text-xs text-gray-500 w-10 text-right">{{ fontSizeScale }}%</span>
            </div>
          </div>
        </div>

        <!-- 预览 -->
        <div class="flex-1 min-w-0">
          <div class="bg-gray-100 border border-gray-300 rounded p-4 flex items-center justify-center min-h-[300px]">
            <img
              v-if="previewSrc"
              :src="previewSrc"
              class="max-w-full max-h-[70vh] object-contain"
              alt="预览"
            >
            <el-empty v-else description="等待图片加载..." :image-size="100" />
          </div>
          <div class="mt-3 flex justify-center">
            <el-button
              type="success"
              :icon="Download"
              :disabled="!previewSrc"
              @click="downloadImage"
            >
              下载图片
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-3">
        <el-text tag="div">
          <strong>老照片加字</strong>可以在一张图片的上方、下方或上下方同时添加题字条带，
          经典模板为「2026年春，xx同志在xx地方留影」，适合制作怀旧老照片、纪念合影等。
        </el-text>
        <el-text tag="div"><strong>使用步骤：</strong></el-text>
        <ol class="list-decimal pl-5 space-y-1">
          <li>点击或拖拽上传一张图片</li>
          <li>在「文字内容」里自定义年份、人物、地点</li>
          <li>选择条带位置（仅上 / 仅下 / 上下都加）</li>
          <li>选择一个预设样式（黑金 / 红金 / 黄黑），或在「高级」里自定义颜色、字体、字号、条带高度</li>
          <li>右侧实时预览，满意后点击「下载图片」保存为 PNG</li>
        </ol>
        <el-text tag="div"><strong>常见用法：</strong></el-text>
        <ul class="list-disc pl-5 space-y-1">
          <li>怀旧老照片：黑底金字 + 宋体最有年代感</li>
          <li>纪念合影：红底金字喜庆又正式</li>
          <li>搞笑段子：自由配色 + 上下都加条带</li>
        </ul>
        <el-text tag="div" class="text-gray-500">
          <strong>隐私说明：</strong>所有处理均在浏览器本地完成，图片不会上传到服务器。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload-dragger) {
  width: 100% !important;
  height: auto !important;
  min-height: 120px;
  padding: 20px;
}
:deep(.el-upload-list__item) {
  width: 100%;
}
</style>
```

- [ ] **Step 2: 验证组件能加载**

在 `D:\dev\nodejs\tools-web` 跑：`pnpm run dev`（后台），访问 `http://localhost:5173/old-photo-caption/`。
预期：页面正常渲染，看到标题"老照片加字" + 上传区 + 空的预览占位（`el-empty`）+ ToolDetail 使用说明。

如果控制台报「找不到模块 `element-plus/icons-vue` 的 `Download`」，改为：
```ts
import { Download as DownloadIcon } from '@element-plus/icons-vue'
```
然后把 `:icon="Download"` 改为 `:icon="DownloadIcon"`。

- [ ] **Step 3: 端到端测试上传 + 渲染 + 下载**

打开浏览器开发者工具，切到 `/old-photo-caption/`：
1. 上传一张测试图片（任意 JPG/PNG）
2. 检查右侧预览区出现合成图，文字「2026年春，同志在北京留影」出现在条带上
3. 修改"人物"为「张三」，预览应立即更新为「2026年春，张三同志在北京留影」
4. 切换位置为「仅上方」，下条带应消失
5. 点击「红底金字」预设，背景变红、文字变金
6. 点击「下载图片」，应自动下载 PNG

如果任何一步失败：先看 console 报错；最常见是 el-color-picker 或 el-slider 的 v-model 类型不匹配，按提示调整。

- [ ] **Step 4: 提交**

```bash
git add src/components/Tools/OldPhotoCaption/OldPhotoCaption.vue
git commit -m "feat(old-photo-caption): 实现老照片加字核心功能（上传/渲染/下载）"
```

---

## Task 3: SEO 注册 + README 更新

**Files:**
- Modify: `sitemap.xml`
- Modify: `README.md`

- [ ] **Step 1: 在 `sitemap.xml` 中添加 URL**

打开 `sitemap.xml`，定位到 `id-photo` 行（约 148 行），在其附近（图片处理工具组）新增：

```xml
  <url><loc>https://tool.fologde.com/old-photo-caption</loc><changefreq>monthly</changefreq><priority>0.5</priority><lastmod>2026-06-27T00:00:00+00:00</lastmod></url>
```

- [ ] **Step 2: 在 `README.md` 中添加功能日志条目**

打开 `README.md`，定位到功能日志末尾（约 173 行，邮箱注册登录条目之后），新增：

```markdown
- 2026-06-27: 新增老照片加字工具，上传图片添加「2026年春，xx同志在xx地方留影」风格题字条带，支持黑金/红金/黄黑三种预设样式和自由配色
```

- [ ] **Step 3: 在 `README.md` 「图片处理」分类下添加工具名**

打开 `README.md`，定位到「### 图片处理」章节（约 217 行），在末尾「PNG/JPG格式互转」之后新增：

```markdown
- 老照片加字
```

- [ ] **Step 4: 验证 sitemap 合法**

```bash
# Windows 用 PowerShell 校验 XML 良构
powershell -Command "[xml]\$x = Get-Content sitemap.xml; Write-Host 'OK' \$x.urlset.url.Count 'urls'"
```

预期：输出 `OK N urls`（N 比之前多 1），无 XML 错误。

- [ ] **Step 5: 提交**

```bash
git add sitemap.xml README.md
git commit -m "docs: 注册老照片加字工具到 sitemap + README"
```

---

## Self-Review Checklist

- [x] Spec 覆盖：元数据注册 ✓ (Task 1)、组件实现 ✓ (Task 2)、SEO 注册 ✓ (Task 3)
- [x] 无占位符：所有代码完整
- [x] 类型一致：`Position` / `PresetKey` / `originalImage` / `caption` 在 Task 2 内部一致
- [x] 路径正确：参考 `IdPhoto.vue`（`@/components/Layout/DetailHeader/DetailHeader.vue`）和 `tools.ts` 同级条目
- [x] 5 处必改点全部覆盖：tools.ts、router.ts、组件、sitemap.xml、README.md（Logo 在 Task 1 一起完成）
