# 老照片加字 工具设计

**日期**：2026-06-27
**目标**：新增"老照片加字"工具，用户上传一张图片，在图片的上方/下方/上下都加上一条带，文字模板为「2026年春，xx同志在xx地方留影」，提供 4 种预设样式 + 自由配色，一键导出 PNG。

## 已确认决策

| 项 | 决定 |
|----|------|
| 工具名 | 老照片加字 |
| 路由 | `/old-photo-caption/` |
| 分类 | 图片处理（cateId=5） |
| 渲染方案 | 纯前端 Canvas 合成（实时预览 + 矢量文字） |
| 字段 | 三个自定义：年份、人物称呼、地点 |
| 默认示例 | 年份=2026，季节=春，人物=同志，地点=北京（拼出「2026年春，同志在北京留影」） |
| 位置选项 | 单选：`top` / `bottom` / `both`（仅上方/仅下方/上下都加） |
| 上下文字 | 上下两条带使用相同模板（来自三个输入字段），但未来可独立编辑（v2） |
| 样式预设 | 4 个：经典黑金、红底金字、黄底黑字、自定义 |
| 字体 | 内置 3 种中文：宋体（SimSun）、楷体（KaiTi）、微软雅黑（Microsoft YaHei），均带英中 fallback |
| 字号 | 自动 = `min(条带高 × 0.55, 图片宽 × 0.06)`，用户可手动微调（滑块） |
| 条带高度 | 默认 = 图片宽 × 0.10（10% 比例），可手动微调（滑块） |
| 输出格式 | PNG（默认）、JPG（可选） |
| 输出尺寸 | 与原图同分辨率 |
| 后端 | 无（纯前端） |

## 架构

### 新增/修改文件

| 文件 | 操作 |
|------|------|
| `src/components/Tools/OldPhotoCaption/OldPhotoCaption.vue` | 新增（工具主组件） |
| `src/components/Tools/tools.ts` | 修改（在「图片处理」分类下添加元数据） |
| `src/router/router.ts` | 修改（添加路由） |
| `public/images/logo/old_photo_caption.png` | 新增（工具 logo 80×80，参考同目录其他 PNG 风格） |
| `sitemap.xml` | 修改（注册新页面 URL） |
| `README.md` | 修改（功能日志 + 工具列表） |

### 组件结构

```
OldPhotoCaption.vue
├─ DetailHeader          (页面标题)
├─ 主面板 (flex-col lg:flex-row)
│   ├─ 控制面板 (左/上)
│   │   ├─ 三个输入：年份、人物、地点
│   │   ├─ 位置单选 (top/bottom/both)
│   │   ├─ 4 个预设样式按钮（点击切换）
│   │   └─ 高级折叠面板 (color-picker、字体下拉、字号滑块、条带高度滑块)
│   ├─ 实时预览 (右/下)
│   │   ├─ <img :src="previewSrc" /> (canvas.toDataURL)
│   │   └─ 「下载」按钮
│   └─ el-upload (拖拽上传，仅 1 张)
└─ ToolDetail            (使用说明 + SEO 描述)
```

### 数据流

1. 用户上传图片 → `FileReader.readAsDataURL` → 加载到 `Image` → `originalImage.value`
2. 任何 form 字段变化 → 响应式 state 触发 `watch` 回调
3. `watch` 触发 `renderCanvas()`：
   - 计算总尺寸 `totalW = imgW`, `totalH = imgH + (top? bandH : 0) + (bottom? bandH : 0)`
   - 创建临时 `<canvas>`，按顺序 drawImage / fillRect / fillText
   - `canvas.toDataURL` → 赋给 `previewSrc.value`
4. 用户点「下载」→ `canvas.toBlob` → 创建 `<a download>` 触发

### 状态 (ref / reactive)

```ts
// 上传
const fileList = ref()
const dataFileRef = ref()
const originalImage = ref<HTMLImageElement | null>(null)
const originalImageSrc = ref('')

// 文字
const year = ref('2026')     // 自由输入
const season = ref('春')     // 自由输入
const person = ref('同志')   // 自由输入
const place = ref('北京')    // 自由输入

// 位置
const position = ref<'top' | 'bottom' | 'both'>('both')

// 样式预设
const presetKey = ref<'blackGold' | 'redGold' | 'yellowBlack' | 'custom'>('blackGold')

// 高级（自定义时生效）
const bgColor = ref('#000000')
const textColor = ref('#FFD700')
const fontFamily = ref<'SimSun' | 'KaiTi' | 'Microsoft YaHei'>('SimSun')
const fontSize = ref(40)        // 实际渲染时再覆盖
const bandHeight = ref(80)      // 实际渲染时再覆盖

// 预览
const previewSrc = ref('')
```

### 核心函数

```ts
// 拼装文字
const caption = computed(() =>
  `${year.value}年${season.value}，${person.value}同志在${place.value}留影`
)

// 字号/条带高度自动计算
const calcBandHeight = () => Math.max(20, originalImage.value.naturalWidth * 0.10)
const calcFontSize = (bandH: number) =>
  Math.min(bandH * 0.55, originalImage.value.naturalWidth * 0.06)

// 切换预设
const applyPreset = (key) => {
  presetKey.value = key
  if (key === 'blackGold') { bgColor.value = '#000000'; textColor.value = '#FFD700' }
  if (key === 'redGold')   { bgColor.value = '#8B0000'; textColor.value = '#FFD700' }
  if (key === 'yellowBlack') { bgColor.value = '#FFC107'; textColor.value = '#000000' }
}

// 渲染
const renderCanvas = () => { /* 见下 */ }

// 下载
const downloadImage = () => { /* canvas.toBlob → a.click() */ }
```

### renderCanvas 实现要点

```ts
const renderCanvas = () => {
  if (!originalImage.value) return
  const img = originalImage.value
  const bandH = Math.round(calcBandHeight())
  const topH = position.value === 'bottom' ? 0 : bandH
  const botH = position.value === 'top' ? 0 : bandH
  const totalW = img.naturalWidth
  const totalH = img.naturalHeight + topH + botH

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')!

  let y = 0
  if (topH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, totalW, topH)
    drawCaption(ctx, caption.value, 0, 0, totalW, topH)
    y = topH
  }
  ctx.drawImage(img, 0, y)
  y += img.naturalHeight
  if (botH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, y, totalW, botH)
    drawCaption(ctx, caption.value, 0, y, totalW, botH)
  }

  previewSrc.value = canvas.toDataURL('image/png')
}

const drawCaption = (ctx, text, x, y, w, h) => {
  const fontSize = Math.round(calcFontSize(h))
  ctx.fillStyle = textColor.value
  ctx.font = `bold ${fontSize}px "${fontFamily.value}", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}
```

### watch

```ts
watch(
  [originalImage, year, season, person, place, position, bgColor, textColor, fontFamily],
  () => originalImage.value && renderCanvas()
)
```

## SEO

### 路由 meta
```ts
{
  path: '/old-photo-caption/',
  name: 'oldPhotoCaption',
  meta: {
    title: '老照片加字',
    keywords: '老照片加字,伟人题词,老照片,留影题字,经典老照片,图片加字',
    description: '上传图片，在图片上下方添加「2026年春，xx同志在xx地方留影」风格的题字条带，提供经典黑金/红底金字/黄底黑字等多种预设样式，实时预览，一键下载。'
  }
}
```

### ToolDetail 内容
- 工具简介
- 4 步使用流程：上传 → 改文字 → 选样式 → 下载
- 典型用例：怀旧老照片、纪念合影、社交媒体搞笑图

## 错误处理

| 场景 | 处理 |
|------|------|
| 未上传图片 | 预览区显示 el-empty，下载按钮 disabled |
| 文件 > 10MB | el-upload `before-upload` 拦截 + `ElMessage.warning` |
| 非图片文件 | el-upload `accept="image/*"` 浏览器拦截 |
| 输入字段为空 | 渲染时用占位符（避免空字符串渲染空条带） |
| 文字过长溢出 | 字号自动按条带高度计算；若仍超宽，`measureText` 缩小（V1 可不做，留 v2） |

## 边界 / 非目标

- 不做滤镜 / 复古做旧效果
- 不做竖排文字
- 不支持多语言模板切换
- 不保存用户上次输入（无后端）
- 上下条带使用相同文字（不做上下分别编辑，V2 再做）

## 风险

| 风险 | 缓解 |
|------|------|
| 中文字体在不同 OS 不一致 | 使用 `SimSun, KaiTi, Microsoft YaHei` 浏览器 fallback；不在导出后强制字体（Canvas 拿到啥渲啥） |
| 大图渲染慢 | Canvas 同步绘制一般 < 100ms；超 4000×4000 警告 |
| 浏览器拦截下载 | `<a download>` 属性 + 模拟 click |
