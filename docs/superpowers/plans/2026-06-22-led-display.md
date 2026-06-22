# LED 显示屏工具实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 tools-web 中新增 `/led-display/` 路由，提供 LED 走马灯文字循环播放工具，URL 参数控制文字和样式，页面内配置面板所见即所得。

**Architecture:** 单文件 Vue 3 组件（Composition API + `<script setup lang="ts">`），纯 CSS `@keyframes` 动画实现横向滚动。所有样式由 URL 参数派生，本地状态仅管理配置面板的折叠状态。修改配置后通过 `history.replaceState` 同步 URL。

**Tech Stack:** Vue 3、TypeScript、Tailwind CSS、Element Plus（颜色选择器）、Vue Router。**无第三方动画库、无新增 utils、无单元测试**（项目无测试约定）。

## Global Constraints

- Vue 3 Composition API + `<script setup lang="ts">`
- 工具组件路径：`src/components/Tools/<ToolName>/<ToolName>.vue`
- 路由路径：`/tool-route/`（小写，连字符）
- 必须更新 5 处：`tools.ts`、`router.ts`、新建组件、`sitemap.xml`、`README.md`
- 响应式：PC + H5 同时可用
- 颜色参数需 URL 编码（`#` → `%23`），UI 提示用户
- 提交规范：`feat:` / `docs:` 前缀，每次任务完成后单独提交
- 不写单元测试，每个任务用「手动验证步骤」替代

---

## 文件结构

| 文件 | 状态 | 职责 |
|---|---|---|
| `src/components/Tools/LedDisplay/LedDisplay.vue` | 新建 | 工具组件（解析 URL + 渲染 LED 屏 + 配置面板） |
| `src/components/Tools/tools.ts` | 修改 | 在 `getToolsCate()` 中添加元数据（cateId=11） |
| `src/router/router.ts` | 修改 | 添加路由 |
| `sitemap.xml` | 修改 | 添加新 URL |
| `README.md` | 修改 | 功能日志和工具列表 |

无新增 utils 文件、无第三方依赖、无新增公共组件。

---

### Task 1: 添加工具元数据、路由和组件骨架

**Files:**
- Modify: `src/components/Tools/tools.ts`
- Modify: `src/router/router.ts`
- Create: `src/components/Tools/LedDisplay/LedDisplay.vue`

**Interfaces:**
- 路由 name: `ledDisplay`
- 工具 url: `/led-display/`
- 工具分类：趣味互动（cateId=11，cate: '趣味互动'）
- 工具 title: `LED 显示屏`
- 工具 desc: `LED 走马灯文字工具，支持自定义文字、颜色、字号、滚动速度、发光和点阵效果`

- [ ] **Step 1: 在 `tools.ts` 添加工具元数据**

定位 `getToolsCate()` 中 `cateId: 11`（趣味互动）的分类数组。在其 `list` 末尾追加：

```ts
{
  id: 1,
  title: 'LED 显示屏',
  logo: '/images/logo/keywords.png',
  desc: 'LED 走马灯文字工具，支持自定义文字、颜色、字号、滚动速度、发光和点阵效果',
  url: '/led-display/',
  cateId: 11,
  cate: '趣味互动',
},
```

如果该分类下没有合适的 logo 占位图（项目 `public/images/logo/` 下），可以先用 `/images/logo/keywords.png`，等正式 logo 准备好再替换。

- [ ] **Step 2: 在 `router.ts` 添加路由**

定位到文件中路由数组的合适位置（按字母顺序或分类顺序），添加：

```ts
{
  path: '/led-display/',
  component: () => import('@/components/Tools/LedDisplay/LedDisplay.vue'),
  name: 'ledDisplay',
  meta: {
    title: 'LED 显示屏 - 在线 LED 走马灯文字工具',
    keywords: 'LED显示屏,LED走马灯,滚动文字,在线LED,文字滚动',
    description: '在线 LED 显示屏工具，支持自定义文字内容、颜色、字号、滚动速度、发光效果和点阵背景，一键生成可分享的 LED 走马灯 URL。',
  }
},
```

- [ ] **Step 3: 创建组件骨架**

新建文件 `src/components/Tools/LedDisplay/LedDisplay.vue`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'LED 显示屏'
const showPanel = ref(true)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="led-screen">
        <div class="led-text">Hello LED</div>
      </div>
    </div>

    <div class="p-4 mt-3 rounded-2xl bg-white">
      <el-button @click="showPanel = !showPanel">
        {{ showPanel ? '隐藏' : '显示' }}配置面板
      </el-button>
      <div v-if="showPanel">配置面板占位</div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>LED 显示屏工具，支持自定义文字、颜色、滚动效果。</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.led-screen {
  background: #000;
  height: 200px;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.led-text {
  color: #ff0000;
  font-size: 120px;
  font-weight: bold;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 4: 手动验证**

```bash
cd D:/dev/nodejs/tools-web
npm run dev
```

预期：
- 浏览器打开 `http://localhost:5173/led-display/`
- 页面显示黑色 LED 屏幕，红色「Hello LED」文字
- 标题为「LED 显示屏」
- 点击「隐藏/显示配置面板」按钮可切换

- [ ] **Step 5: 提交**

```bash
git add src/components/Tools/tools.ts src/router/router.ts src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "feat(led-display): 添加工具骨架、路由和元数据"
```

---

### Task 2: 实现 URL 参数解析和 CSS 变量绑定

**Files:**
- Modify: `src/components/Tools/LedDisplay/LedDisplay.vue`

**Interfaces:**
- 函数 `parseParams()` 返回强类型对象
- 函数 `buildCssVars(params)` 返回 CSS 变量对象（用于 `:style` 绑定）

- [ ] **Step 1: 添加参数解析逻辑和类型**

在 `<script setup>` 内、import 之后添加：

```ts
interface LedParams {
  text: string
  color: string
  bg: string
  size: number
  bold: boolean
  speed: number
  border: boolean
  glow: boolean
  dot: boolean
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const DEFAULT_PARAMS: LedParams = {
  text: '欢迎使用 LED 显示屏',
  color: '#ff0000',
  bg: '#000000',
  size: 120,
  bold: true,
  speed: 20,
  border: true,
  glow: true,
  dot: false,
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const parseParams = (): LedParams => {
  const sp = new URLSearchParams(window.location.search)
  const get = (k: string) => sp.get(k) ?? ''
  const num = (k: string, def: number) => {
    const v = parseInt(get(k), 10)
    return Number.isFinite(v) ? v : def
  }
  const flag = (k: string) => get(k) === '1'

  const color = HEX_RE.test(get('color')) ? get('color') : DEFAULT_PARAMS.color
  const bg = HEX_RE.test(get('bg')) ? get('bg') : DEFAULT_PARAMS.bg

  return {
    text: get('text') || DEFAULT_PARAMS.text,
    color,
    bg,
    size: clamp(num('size', DEFAULT_PARAMS.size), 20, 300),
    bold: flag('bold') || get('bold') === '' ? true : DEFAULT_PARAMS.bold,
    speed: clamp(num('speed', DEFAULT_PARAMS.speed), 5, 60),
    border: get('border') === '' ? true : flag('border'),
    glow: get('glow') === '' ? true : flag('glow'),
    dot: flag('dot'),
  }
}

const params = ref(parseParams())
```

**说明：** `bold`/`border`/`glow` 在 URL 中省略参数时默认开启（`get('border') === ''` 表示参数存在但无值）。若想严格用默认值，把 `=== ''` 那段删除即可。

- [ ] **Step 2: 添加 CSS 变量计算和动画 keyframe**

在 `<script setup>` 末尾追加：

```ts
import { computed } from 'vue'

const cssVars = computed(() => ({
  '--color': params.value.color,
  '--bg': params.value.bg,
  '--size': params.value.size + 'px',
  '--speed': params.value.speed + 's',
  '--font-weight': params.value.bold ? 'bold' : 'normal',
}))
```

将 `<style scoped>` 替换为：

```css
@keyframes led-scroll {
  0%   { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
}

.led-screen {
  position: relative;
  height: 35vh;
  min-height: 200px;
  display: flex;
  align-items: center;
  overflow: hidden;
  background-color: var(--bg);
  border: 4px solid #333;
  border-radius: 8px;
  box-shadow:
    0 0 30px var(--color),
    inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.led-text {
  color: var(--color);
  font-size: var(--size);
  font-weight: var(--font-weight);
  white-space: nowrap;
  display: inline-block;
  animation: led-scroll var(--speed) linear infinite;
  will-change: transform;
}

.led-screen.no-border {
  border: none;
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.led-text.no-glow {
  text-shadow: none;
}

.led-text:not(.no-glow) {
  text-shadow: 0 0 10px var(--color), 0 0 20px var(--color);
}

.led-screen.dot::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 8px 8px;
  pointer-events: none;
  border-radius: 6px;
}
```

- [ ] **Step 3: 替换模板，应用变量和样式**

将模板中的 LED 屏幕 div 替换为：

```vue
<div class="led-screen mb-4" :style="cssVars" :class="{
  'no-border': !params.border,
  'dot': params.dot,
}">
  <div class="led-text" :class="{ 'no-glow': !params.glow }">
    {{ params.text }}
  </div>
</div>
```

- [ ] **Step 4: 手动验证**

打开 `http://localhost:5173/led-display/`：
- 默认文字「欢迎使用 LED 显示屏」从右向左滚动
- 红色文字，黑色背景，发光效果

依次访问以下 URL 验证参数解析：
- `http://localhost:5173/led-display/?text=HELLO&color=%2300ff00`
  - 绿色 HELLO 滚动
- `http://localhost:5173/led-display/?size=300&speed=5`
  - 字号 300px，5 秒一个周期
- `http://localhost:5173/led-display/?color=invalid`
  - 退回默认红色
- `http://localhost:5173/led-display/?size=9999`
  - 夹到 300px
- `http://localhost:5173/led-display/?text=`
  - 显示默认文字（因为 `|| DEFAULT_PARAMS.text` 兜底）

- [ ] **Step 5: 提交**

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "feat(led-display): 实现 URL 参数解析和 CSS 动画"
```

---

### Task 3: 实现配置面板 UI

**Files:**
- Modify: `src/components/Tools/LedDisplay/LedDisplay.vue`

**Interfaces:**
- `params` ref 已经是响应式，模板里直接双向绑定即可（用 `v-model`）
- 配置变更自动通过 `cssVars` computed 反映到 LED 屏

- [ ] **Step 1: 添加配置面板模板**

在「隐藏/显示」按钮下方、`<div v-if="showPanel">` 内替换为：

```vue
<div v-if="showPanel" class="space-y-4 mt-3">
  <el-form label-position="top" :inline="false">
    <el-form-item label="显示文字">
      <el-input v-model="params.text" placeholder="输入要播放的文字" clearable />
    </el-form-item>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <el-form-item label="文字颜色">
        <el-color-picker v-model="params.color" />
        <el-input v-model="params.color" class="ml-2" style="width: 140px" />
      </el-form-item>

      <el-form-item label="背景颜色">
        <el-color-picker v-model="params.bg" />
        <el-input v-model="params.bg" class="ml-2" style="width: 140px" />
      </el-form-item>

      <el-form-item label="字号 ({{ params.size }}px)">
        <el-slider v-model="params.size" :min="20" :max="300" :step="1" show-input />
      </el-form-item>

      <el-form-item label="滚动速度 ({{ params.speed }}s/周期)">
        <el-slider v-model="params.speed" :min="5" :max="60" :step="1" show-input />
      </el-form-item>
    </div>

    <el-form-item label="样式选项">
      <el-checkbox v-model="params.bold">粗体</el-checkbox>
      <el-checkbox v-model="params.border">边框</el-checkbox>
      <el-checkbox v-model="params.glow">发光</el-checkbox>
      <el-checkbox v-model="params.dot">点阵背景</el-checkbox>
    </el-form-item>
  </el-form>
</div>
```

- [ ] **Step 2: 手动验证**

打开 `http://localhost:5173/led-display/`：
- 配置面板默认展开
- 修改文字输入框 → LED 屏文字实时变化
- 点颜色选择器或修改 hex 输入 → 颜色实时变化
- 拖字号/速度滑块 → 实时变化
- 切换粗体/边框/发光/点阵复选框 → 实时变化

- [ ] **Step 3: 提交**

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "feat(led-display): 实现配置面板 UI"
```

---

### Task 4: 实现 URL 同步和复制 URL 按钮

**Files:**
- Modify: `src/components/Tools/LedDisplay/LedDisplay.vue`

**Interfaces:**
- `syncUrl()` 函数：在 `params` 变化后调用，更新 `history.replaceState`
- 监听器：`watch(params, syncUrl, { deep: true })`
- 复制按钮：调用 `navigator.clipboard.writeText(window.location.href)`

- [ ] **Step 1: 添加 `syncUrl` 和复制逻辑**

在 `<script setup>` 末尾追加：

```ts
import { watch } from 'vue'
import { ElMessage } from 'element-plus'

const syncUrl = () => {
  const sp = new URLSearchParams()
  sp.set('text', params.value.text)
  sp.set('color', params.value.color)
  sp.set('bg', params.value.bg)
  sp.set('size', String(params.value.size))
  sp.set('speed', String(params.value.speed))
  if (params.value.bold) sp.set('bold', '1')
  if (params.value.border) sp.set('border', '1')
  if (params.value.glow) sp.set('glow', '1')
  if (params.value.dot) sp.set('dot', '1')
  const newUrl = `${window.location.pathname}?${sp.toString()}`
  window.history.replaceState({}, '', newUrl)
}

watch(params, syncUrl, { deep: true })

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('URL 已复制')
  } catch {
    // 兜底：老浏览器或非安全上下文
    const ta = document.createElement('textarea')
    ta.value = window.location.href
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('URL 已复制')
  }
}
```

**注意：** 这里采用了「非默认值才写入 URL」的策略，让 URL 更精简。如果用户希望完整 URL（即使等于默认值也写入），把所有 `if` 改为 `sp.set(...)` 即可。

- [ ] **Step 2: 添加复制 URL 按钮到配置面板**

在「样式选项」表单之后追加：

```vue
<el-form-item>
  <el-button type="primary" @click="copyUrl">复制分享 URL</el-button>
</el-form-item>
```

- [ ] **Step 3: 手动验证**

打开 `http://localhost:5173/led-display/`：
- 修改任意配置 → 浏览器地址栏 URL 同步变化（不刷新页面、不增加历史记录）
- 复制 URL 按钮 → 看到「URL 已复制」提示，粘贴到新窗口打开 → 配置完全一致
- 关闭页面再打开（输入带参数的 URL）→ 配置从 URL 恢复

- [ ] **Step 4: 提交**

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "feat(led-display): 实现 URL 同步和复制按钮"
```

---

### Task 5: 实现全屏播放和移动端适配

**Files:**
- Modify: `src/components/Tools/LedDisplay/LedDisplay.vue`

**Interfaces:**
- `toggleFullscreen()` 函数：切换全屏状态
- 监听 `fullscreenchange` 事件：同步 `isFullscreen` 状态

- [ ] **Step 1: 添加全屏状态和方法**

在 `<script setup>` 末尾追加：

```ts
import { onMounted, onBeforeUnmount } from 'vue'

const isFullscreen = ref(false)
const ledScreenRef = ref<HTMLElement | null>(null)

const toggleFullscreen = async () => {
  const el = ledScreenRef.value
  if (!el) return
  try {
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (e) {
    ElMessage.warning('当前浏览器不支持全屏')
  }
}

const onFsChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => document.addEventListener('fullscreenchange', onFsChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFsChange))
```

- [ ] **Step 2: 修改模板和样式**

LED 屏幕 div 加 `ref="ledScreenRef"`，并在屏幕右上角加全屏按钮：

```vue
<div
  ref="ledScreenRef"
  class="led-screen mb-4 relative"
  :style="cssVars"
  :class="{ 'no-border': !params.border, 'dot': params.dot }"
>
  <div class="led-text" :class="{ 'no-glow': !params.glow }">
    {{ params.text }}
  </div>
  <el-button
    class="absolute top-2 right-2"
    size="small"
    type="primary"
    @click="toggleFullscreen"
  >
    {{ isFullscreen ? '退出全屏' : '全屏播放' }}
  </el-button>
</div>
```

- [ ] **Step 3: 全屏样式覆盖**

在 `<style scoped>` 末尾追加（确保全屏时屏幕填满）：

```css
.led-screen:fullscreen {
  width: 100vw;
  height: 100vh;
  border: none;
  border-radius: 0;
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 4: 移动端响应式（H5）**

在配置面板最外层 `<div>` 上加 class：

```vue
<div v-if="showPanel" class="space-y-4 mt-3 md:block hidden">
```

并在 H5 下显示一个独立的「配置」按钮（放在 LED 屏幕下方）：

```vue
<div class="md:hidden mb-3">
  <el-button @click="showPanel = !showPanel" type="primary" plain>
    {{ showPanel ? '收起配置' : '展开配置' }}
  </el-button>
</div>
<div v-if="showPanel" class="space-y-4 mt-3">
  <!-- 原有配置表单 -->
</div>
```

- [ ] **Step 5: 手动验证**

PC：
- 点击「全屏播放」→ 进入全屏，LED 屏填满屏幕
- 按 ESC 或再次点按钮 → 退出全屏

H5（用浏览器开发者工具切到手机模式）：
- 访问 `http://localhost:5173/led-display/`
- 配置面板默认隐藏，只显示「展开配置」按钮
- 点击按钮 → 配置面板展开
- 在 H5 下全屏按钮仍可用

- [ ] **Step 6: 提交**

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "feat(led-display): 实现全屏播放和移动端适配"
```

---

### Task 6: 完善 SEO 和文档

**Files:**
- Modify: `src/components/Tools/LedDisplay/LedDisplay.vue`（ToolDetail 内容）
- Modify: `sitemap.xml`
- Modify: `README.md`

- [ ] **Step 1: 完善 ToolDetail 内容**

将 `<ToolDetail title="使用说明">` 内容替换为：

```vue
<ToolDetail title="使用说明">
  <el-text>
    <p>LED 显示屏工具，在线模拟 LED 走马灯文字效果，支持自定义文字内容、颜色、字号、滚动速度和 LED 风格。</p>
    <h4 class="mt-3 font-bold">URL 参数</h4>
    <ul class="list-disc pl-6 space-y-1">
      <li><code>text</code>：显示文字（默认：欢迎使用 LED 显示屏）</li>
      <li><code>color</code>：文字颜色 hex（默认：#ff0000）</li>
      <li><code>bg</code>：背景颜色 hex（默认：#000000）</li>
      <li><code>size</code>：字号 px，范围 20-300（默认：120）</li>
      <li><code>speed</code>：滚动周期秒，范围 5-60（默认：20）</li>
      <li><code>bold</code>=<code>1</code>：粗体（默认开）</li>
      <li><code>border</code>=<code>1</code>：显示边框（默认开）</li>
      <li><code>glow</code>=<code>1</code>：文字发光（默认开）</li>
      <li><code>dot</code>=<code>1</code>：点阵背景（默认关）</li>
    </ul>
    <h4 class="mt-3 font-bold">使用场景</h4>
    <ul class="list-disc pl-6 space-y-1">
      <li>活动现场 LED 走马灯模拟演示</li>
      <li>店铺招牌效果预览</li>
      <li>社交媒体 GIF 录制</li>
      <li>礼物特效文字</li>
    </ul>
    <h4 class="mt-3 font-bold">示例 URL</h4>
    <p class="text-xs break-all bg-gray-100 p-2 rounded">
      /led-display/?text=欢迎光临&color=%23ff0000&bg=%23000000&size=120&speed=15&glow=1
    </p>
    <p class="text-gray-500 text-xs mt-2">提示：URL 中的 # 字符需编码为 %23</p>
  </el-text>
</ToolDetail>
```

- [ ] **Step 2: 在 `sitemap.xml` 注册新页面**

定位到 `sitemap.xml` 中合适位置（按字母/时间顺序），添加：

```xml
<url>
  <loc>https://你的域名/led-display/</loc>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>
```

**注意：** 把 `你的域名` 替换为项目实际域名（参考 sitemap.xml 中其他 URL 的域名）。

- [ ] **Step 3: 更新 `README.md`**

定位到 README.md 的「功能日志」或「工具列表」段落：
- 在工具列表中添加一行：`LED 显示屏`
- 在功能日志（如有「新增 XX」段落）中追加：`新增 LED 显示屏工具`

具体格式参考 README.md 现有约定，保持一致。

- [ ] **Step 4: 手动验证**

- 打开 `http://localhost:5173/led-display/`，滚动到底部查看 ToolDetail 内容是否完整、格式正确
- 检查 `view-source:http://localhost:5173/led-display/`，HTML head 中 title/keywords/description 正确
- 用文本搜索工具查看 `sitemap.xml` 和 `README.md` 中已包含新条目

- [ ] **Step 5: 提交**

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue sitemap.xml README.md
git commit -m "docs(led-display): 完善 SEO、sitemap 和 README"
```

---

### Task 7: 端到端验收测试

**Files:** 无（仅验证）

- [ ] **Step 1: PC 默认场景验证**

打开 `http://localhost:5173/led-display/`：
- [ ] 红色「欢迎使用 LED 显示屏」从右向左匀速滚动
- [ ] 黑色背景，有边框，文字带发光
- [ ] 配置面板可见，含所有控件
- [ ] 修改任一控件 → LED 实时变化 + 浏览器 URL 同步
- [ ] 复制 URL 按钮 → 提示「URL 已复制」
- [ ] 新窗口打开复制的 URL → 配置完全一致
- [ ] 全屏播放 → 填满屏幕，ESC 退出

- [ ] **Step 2: 参数边界验证**

依次访问：
- [ ] `?color=invalid` → 退回 #ff0000
- [ ] `?size=9999` → 夹到 300
- [ ] `?size=-100` → 夹到 20
- [ ] `?speed=999` → 夹到 60
- [ ] `?text=` → 显示默认文字
- [ ] `?dot=1` → 显示点阵背景
- [ ] `?glow=0` → 关闭发光

- [ ] **Step 3: H5 验证**

浏览器开发者工具切到 iPhone/Android 模拟：
- [ ] 配置面板默认隐藏，有「展开配置」按钮
- [ ] 字号过大时仍清晰可读
- [ ] 全屏按钮在 H5 下也工作
- [ ] 滚动动画在 H5 流畅（60fps）

- [ ] **Step 4: SEO 验证**

- [ ] 页面 HTML head 中 `<title>` 为「LED 显示屏 - 在线 LED 走马灯文字工具」
- [ ] meta keywords 和 description 正确
- [ ] 页面底部 ToolDetail 内容完整
- [ ] `sitemap.xml` 中包含 `/led-display/` 条目
- [ ] `README.md` 中已添加新工具

- [ ] **Step 5: 类型检查**

```bash
cd D:/dev/nodejs/tools-web
npm run build
```

预期：构建成功，无 TS 错误。

- [ ] **Step 6: 提交（如有微调）**

如果验收中发现小问题，修复后：

```bash
git add src/components/Tools/LedDisplay/LedDisplay.vue
git commit -m "fix(led-display): 验收修复 <具体问题>"
```

---

## Self-Review Checklist

实施前自审通过：

- ✅ Spec 中所有 URL 参数（text/color/bg/size/bold/speed/border/glow/dot）都有对应实现（Task 2、3、4）
- ✅ LED 风格（边框/发光/点阵）已实现（Task 2、3）
- ✅ 配置面板 UI（Task 3）
- ✅ URL 同步 + 复制（Task 4）
- ✅ 全屏播放（Task 5）
- ✅ 移动端响应式（Task 5）
- ✅ SEO、sitemap、README（Task 6）
- ✅ 错误处理边界值（Task 2、Task 7）
- ✅ 无第三方依赖、无新增 utils（符合「无第三方依赖」约束）
- ✅ 类型一致（`params`、`cssVars`、`syncUrl`、`copyUrl`、`toggleFullscreen` 命名一致）