<script setup lang="ts">
/**
 * 高亮代码生成图片
 * --------------------------------------------------------
 * - 输入代码 → 实时生成带语法高亮的预览
 * - 8 套 highlight.js 主题（GitHub / Atom One Light / Atom One Dark /
 *   Monokai / Nord / Night Owl / Tokyo Night Light / Tokyo Night Dark）
 * - 自由调节：字体 / 字号 / 行高 / padding / 圆角 / 阴影 / 行号 / 语言标签 / 窗口控件 / 水印
 * - html2canvas 把预览节点转 PNG，支持下载 / 复制到剪贴板 / 复制高亮 HTML
 * - 全部纯前端：theme CSS 通过 import.meta.glob 预打包，运行时注入到 head；
 *   html2canvas 在本地完成截图，不上传任何代码
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import html2canvas from 'html2canvas'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import shell from 'highlight.js/lib/languages/shell'
import plaintext from 'highlight.js/lib/languages/plaintext'

// 注册常用语言（含 common.js 已注册的，此处补 TypeScript / SQL / YAML 等）
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('go', go)
hljs.registerLanguage('golang', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('shell', shell)
hljs.registerLanguage('bash', shell)
hljs.registerLanguage('sh', shell)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)

// 自动从 highlight.js/common 拉取完整列表（含 xml/css/json/c/cpp/csharp/kotlin/lua/perl/php/ruby/markdown 等）
// 用 side-effect import 让 common.js 完成 registerLanguage
import 'highlight.js/lib/common'

// ============================================================
// 主题 CSS — 构建时把 node_modules/highlight.js/styles 下 css 拉成字符串
// （Vite 不支持 import.meta.glob 跨 node_modules，故改用显式 ?raw 导入）
// ============================================================
import githubCss        from 'highlight.js/styles/github.css?raw'
import atomOneLightCss  from 'highlight.js/styles/atom-one-light.css?raw'
import githubDarkCss    from 'highlight.js/styles/github-dark.css?raw'
import atomOneDarkCss   from 'highlight.js/styles/atom-one-dark.css?raw'
import monokaiCss       from 'highlight.js/styles/monokai.css?raw'
import nordCss          from 'highlight.js/styles/nord.css?raw'
import nightOwlCss      from 'highlight.js/styles/night-owl.css?raw'
import tokyoNightDarkCss from 'highlight.js/styles/tokyo-night-dark.css?raw'

const themeCssMap: Record<string, string> = {
  'github':           githubCss,
  'atom-one-light':   atomOneLightCss,
  'github-dark':      githubDarkCss,
  'atom-one-dark':    atomOneDarkCss,
  'monokai':          monokaiCss,
  'nord':             nordCss,
  'night-owl':        nightOwlCss,
  'tokyo-night-dark': tokyoNightDarkCss,
}

// 我们精选的 8 套主题
const THEME_OPTIONS = [
  { value: 'github',          label: 'GitHub (浅色)' },
  { value: 'atom-one-light',  label: 'Atom One Light' },
  { value: 'github-dark',     label: 'GitHub Dark' },
  { value: 'atom-one-dark',   label: 'Atom One Dark' },
  { value: 'monokai',         label: 'Monokai' },
  { value: 'nord',            label: 'Nord' },
  { value: 'night-owl',       label: 'Night Owl' },
  { value: 'tokyo-night-dark', label: 'Tokyo Night Dark' },
]

const DEFAULT_CODE = `// 示例：高亮代码生成图片
function fib(n) {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}

console.log(fib(10))   // 55
`

// ============================================================
// 状态
// ============================================================
const code = ref<string>(DEFAULT_CODE)
const language = ref<string>('javascript')

// highlight.js 已注册的所有语言 → dropdown 选项
const languageOptions = computed(() => {
  const list = (hljs as any).listLanguages() as string[]
  // 排序，去重显示
  return Array.from(new Set(list)).sort()
})

const theme = ref<string>('github')
const fontFamily = ref<string>('"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace')
const fontSize = ref<number>(14)
const lineHeight = ref<number>(1.6)
const paddingX = ref<number>(24)
const paddingY = ref<number>(20)
const borderRadius = ref<number>(12)
const showLineNumbers = ref<boolean>(true)
const showLangBadge = ref<boolean>(true)
const showWindowDots = ref<boolean>(true)
const shadowStrength = ref<number>(2) // 0~4
const watermark = ref<string>('')
const bgColor = ref<string>('') // 自定义背景（空则用主题色）

// 注入主题 CSS：监听 theme 变化，把对应 CSS 文本写入 document.head 的 <style id="ci-hljs-theme">
const themeStyleEl = ref<HTMLStyleElement | null>(null)

function applyThemeCss(name: string) {
  const css = themeCssMap[name] || ''
  if (themeStyleEl.value) {
    themeStyleEl.value.textContent = css
  }
}

watch(theme, (v) => applyThemeCss(v), { immediate: false })

onMounted(() => {
  const el = document.createElement('style')
  el.id = 'ci-hljs-theme'
  document.head.appendChild(el)
  themeStyleEl.value = el
  applyThemeCss(theme.value) // 首次挂载时注入
})

onBeforeUnmount(() => {
  if (themeStyleEl.value) {
    themeStyleEl.value.remove()
    themeStyleEl.value = null
  }
})

// ============================================================
// 高亮：返回 HTML 字符串
// ============================================================
const highlightedHtml = computed<string>(() => {
  const codeStr = code.value
  const lang = language.value
  if (!codeStr) return ''
  try {
    // 关键：忽略不识别的语言抛出的错误，回退到 plaintext
    if (lang && (hljs as any).getLanguage?.(lang)) {
      return hljs.highlight(codeStr, { language: lang, ignoreIllegals: true }).value
    }
    return hljs.highlight(codeStr, { language: 'plaintext' }).value
  } catch (_e) {
    return codeStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
})

const lineNumberHtml = computed<string>(() => {
  const lines = code.value.split('\n').length
  if (!showLineNumbers.value || lines <= 0) return ''
  // 用 <span class="ci-ln">{i}</span> 配合 css 显示
  let html = ''
  for (let i = 1; i <= lines; i++) {
    html += `<span class="ci-ln">${i}</span>`
  }
  return html
})

// 行数（用于展示）
const lineCount = computed(() => code.value.split('\n').length)

// 徽章 SVG 宽度：根据语言名长度动态算（Arial 11px 约 6.5px/字符，左右各 10px padding）
const langBadgeWidth = computed(() => {
  const len = (language.value || '').length
  return Math.max(48, Math.round(len * 6.5 + 20))
})

// 阴影样式（0~4 档）
const shadowStyle = computed(() => {
  const map: Record<number, string> = {
    0: 'none',
    1: '0 2px 8px rgba(15, 23, 42, 0.08)',
    2: '0 8px 24px rgba(15, 23, 42, 0.14)',
    3: '0 16px 40px rgba(15, 23, 42, 0.20)',
    4: '0 24px 56px rgba(15, 23, 42, 0.28)',
  }
  return map[shadowStrength.value] || map[2]
})

// ============================================================
// DOM 引用
// ============================================================
const previewRef = ref<HTMLElement | null>(null) // 整张卡片（含 window dots / 水印）
const codeRef = ref<HTMLElement | null>(null)    // 仅高亮区域（用于截图区域控制）

// ============================================================
// 截图 / 复制
// ============================================================
const downloading = ref(false)
const copyingImg = ref(false)

async function toCanvas(scale = 2) {
  if (!previewRef.value) {
    ElMessage.warning('预览元素未挂载')
    return null
  }
  // html2canvas 会读取 :root 的 computed style，但我们的主题 CSS 是动态注入 <style id="ci-hljs-theme">，
  // 这里额外把它的 cssText 写到 head 上的 style 内联确保可读取
  const themeCss = themeStyleEl.value?.textContent || ''

  // 决定截图底色：优先用 .ci-preview 自身的 background（含自定义 bgColor）；
  // 若用户没填自定义色且主题未覆盖外壳，previewRef 的 computed background-color 是 transparent，
  // 这时退回到 hljs code 元素的背景（主题 CSS 一定设置），保证 PNG 永远有底色。
  const previewComputed = window.getComputedStyle(previewRef.value)
  let bgForCanvas: string = previewComputed.backgroundColor
  const isTransparent =
    !bgForCanvas ||
    bgForCanvas === 'rgba(0, 0, 0, 0)' ||
    bgForCanvas === 'transparent'
  if (isTransparent && codeRef.value) {
    const codeComputed = window.getComputedStyle(codeRef.value)
    bgForCanvas = codeComputed.backgroundColor || '#ffffff'
  }
  // 兜底：如果主题 CSS 也没设置（极少见），用纯白
  if (
    !bgForCanvas ||
    bgForCanvas === 'rgba(0, 0, 0, 0)' ||
    bgForCanvas === 'transparent'
  ) {
    bgForCanvas = '#ffffff'
  }

  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(previewRef.value, {
      backgroundColor: bgForCanvas,
      scale,
      useCORS: true,
      logging: false,
      // 让行号 & 高亮的颜色都能正确读取
      onclone: (doc) => {
        if (themeCss) {
          const styleEl = doc.createElement('style')
          styleEl.textContent = `
            #ci-hljs-theme-clone {}
            pre code.hljs, .hljs { background: transparent; }
          ` + themeCss
          doc.head.appendChild(styleEl)
        }
      },
    })
  } catch (e: any) {
    ElMessage.error('生成图片失败：' + (e?.message || e))
    return null
  }
  return canvas
}

async function downloadPng() {
  if (downloading.value) return
  downloading.value = true
  try {
    const canvas = await toCanvas(2)
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `code-${language.value}-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    ElMessage.success('已下载 PNG')
  } finally {
    downloading.value = false
  }
}

async function copyImageToClipboard() {
  if (copyingImg.value) return
  copyingImg.value = true
  try {
    const canvas = await toCanvas(2)
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) {
        ElMessage.error('生成图片失败')
        return
      }
      try {
        // @ts-ignore
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
          ElMessage.warning('当前浏览器不支持剪贴板图片，请改用下载')
          return
        }
        // @ts-ignore
        const item = new ClipboardItem({ 'image/png': blob })
        // @ts-ignore
        await navigator.clipboard.write([item])
        ElMessage.success('已复制图片到剪贴板')
      } catch (e: any) {
        ElMessage.error('复制到剪贴板失败：' + (e?.message || e))
      }
    }, 'image/png')
  } finally {
    copyingImg.value = false
  }
}

async function copyHighlightedHtml() {
  try {
    if (!codeRef.value) return
    const html = codeRef.value.outerHTML
    await navigator.clipboard.writeText(html)
    ElMessage.success('已复制高亮 HTML')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    ElMessage.success('已复制代码')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 全屏放大预览（弹出层），用 element-plus 的 el-dialog 或简易自实现。这里用 dialog。
const previewDialogVisible = ref(false)
const openPreviewDialog = () => {
  previewDialogVisible.value = true
}

function clearAll() {
  code.value = ''
}

// ============================================================
// 切换示例代码（让用户快速看到不同主题效果）
// ============================================================
const sampleSnippets: { lang: string; label: string; code: string }[] = [
  {
    lang: 'javascript',
    label: 'JS · 斐波那契',
    code: `// 斐波那契数列：递归 + 记忆化
const fib = (n, memo = {}) => {
  if (n < 2) return n
  memo[n] = (memo[n - 1] ?? fib(n - 1, memo)) +
            (memo[n - 2] ?? fib(n - 2, memo))
  return memo[n]
}

console.log(fib(40)) // 102334155`,
  },
  {
    lang: 'python',
    label: 'Python · 快排',
    code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left   = [x for x in arr if x < pivot]
    mid    = [x for x in arr if x == pivot]
    right  = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))`,
  },
  {
    lang: 'go',
    label: 'Go · HTTP',
    code: `package main

import (
    "encoding/json"
    "net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "hello, world",
    })
}

func main() {
    http.HandleFunc("/api/hello", hello)
    http.ListenAndServe(":8080", nil)
}`,
  },
  {
    lang: 'rust',
    label: 'Rust · 二分查找',
    code: `fn binary_search(nums: &[i32], target: i32) -> Option<usize> {
    let mut lo = 0;
    let mut hi = nums.len();
    while lo < hi {
        let mid = (lo + hi) / 2;
        match nums[mid].cmp(&target) {
            std::cmp::Ordering::Equal   => return Some(mid),
            std::cmp::Ordering::Less    => lo = mid + 1,
            std::cmp::Ordering::Greater => hi = mid,
        }
    }
    None
}`,
  },
  {
    lang: 'sql',
    label: 'SQL · 联表',
    code: `SELECT u.id, u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 3
ORDER BY orders DESC
LIMIT 20;`,
  },
]

const loadSample = (idx: number) => {
  const s = sampleSnippets[idx]
  code.value = s.code
  language.value = s.lang
  ElMessage.success(`已加载示例：${s.label}`)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="高亮代码生成图片" />

    <div class="grid gap-4 lg:grid-cols-[400px_1fr] ci-root">
      <!-- =================================== -->
      <!-- 左侧：控件 + 代码编辑 -->
      <!-- =================================== -->
      <div class="space-y-4">
        <!-- 代码输入 -->
        <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-2">
            <span class="text-body font-semibold text-slate-700">代码</span>
            <div class="flex gap-2">
              <el-button size="small" @click="copyCode" plain>复制代码</el-button>
              <el-button size="small" type="danger" plain @click="clearAll">清空</el-button>
            </div>
          </div>
          <el-select v-model="language" filterable class="w-full mb-2" size="default">
            <el-option
              v-for="lang in languageOptions"
              :key="lang"
              :value="lang"
              :label="lang"
            />
          </el-select>
          <el-input
            v-model="code"
            type="textarea"
            :rows="14"
            resize="none"
            spellcheck="false"
            autocapitalize="off"
            autocorrect="off"
            class="ci-code-input"
            placeholder="在此输入要生成图片的代码…"
          />
          <div class="mt-1 text-caption text-slate-400 flex justify-between">
            <span>{{ lineCount }} 行 · {{ language }}</span>
            <span>实时预览 →</span>
          </div>
        </div>

        <!-- 示例代码 -->
        <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
          <div class="text-body font-semibold text-slate-700 mb-2">示例</div>
          <div class="flex flex-wrap gap-2">
            <el-button
              v-for="(s, i) in sampleSnippets"
              :key="s.label"
              size="small"
              plain
              @click="loadSample(i)"
            >{{ s.label }}</el-button>
          </div>
        </div>

        <!-- 样式控件 -->
        <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200 space-y-3">
          <div class="text-body font-semibold text-slate-700">主题</div>
          <el-select v-model="theme" class="w-full">
            <el-option
              v-for="opt in THEME_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>

          <div class="text-body font-semibold text-slate-700 mt-3">外观</div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="text-caption text-slate-500">字号 {{ fontSize }}px</span>
              <el-slider v-model="fontSize" :min="10" :max="24" :step="1" />
            </div>
            <div>
              <span class="text-caption text-slate-500">行高 {{ lineHeight }}</span>
              <el-slider v-model="lineHeight" :min="1.2" :max="2.4" :step="0.1" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="text-caption text-slate-500">X 内边距 {{ paddingX }}px</span>
              <el-slider v-model="paddingX" :min="0" :max="64" :step="2" />
            </div>
            <div>
              <span class="text-caption text-slate-500">Y 内边距 {{ paddingY }}px</span>
              <el-slider v-model="paddingY" :min="0" :max="64" :step="2" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="text-caption text-slate-500">圆角 {{ borderRadius }}px</span>
              <el-slider v-model="borderRadius" :min="0" :max="32" :step="1" />
            </div>
            <div>
              <span class="text-caption text-slate-500">阴影强度</span>
              <el-slider v-model="shadowStrength" :min="0" :max="4" :step="1" />
            </div>
          </div>

          <div>
            <span class="text-caption text-slate-500">字体</span>
            <el-input v-model="fontFamily" size="small" class="mt-1" />
          </div>

          <div>
            <span class="text-caption text-slate-500">自定义背景（留空用主题色）</span>
            <div class="flex items-center gap-2 mt-1">
              <input v-model="bgColor" type="color" class="ci-color-input" />
              <el-input v-model="bgColor" size="small" placeholder="例 #0d1117 或留空" class="flex-1" />
              <el-button size="small" plain @click="bgColor = ''">重置</el-button>
            </div>
          </div>

          <div>
            <span class="text-caption text-slate-500">水印（可选）</span>
            <el-input
              v-model="watermark"
              size="small"
              class="mt-1"
              placeholder="如 © myblog 或 @yourname"
            />
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <el-checkbox v-model="showLineNumbers">显示行号</el-checkbox>
            <el-checkbox v-model="showLangBadge">显示语言标签</el-checkbox>
            <el-checkbox v-model="showWindowDots">显示窗口控件</el-checkbox>
          </div>
        </div>
      </div>

      <!-- =================================== -->
      <!-- 右侧：预览 + 操作 -->
      <!-- =================================== -->
      <div class="space-y-4">
        <!-- 操作栏 -->
        <div class="p-3 rounded-2xl bg-white shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
          <el-button type="primary" :loading="downloading" @click="downloadPng">下载 PNG</el-button>
          <el-button :loading="copyingImg" @click="copyImageToClipboard">复制图片</el-button>
          <el-button @click="copyHighlightedHtml">复制 HTML</el-button>
          <el-button @click="openPreviewDialog">放大预览</el-button>
        </div>

        <!-- 预览区：背景用 slate-50 让透明卡片更立体 -->
        <div class="p-6 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center min-h-[400px] ci-preview-wrap">
          <div
            ref="previewRef"
            class="ci-preview"
            :style="{
              fontFamily,
              fontSize: fontSize + 'px',
              lineHeight,
              padding: `${paddingY}px ${paddingX}px`,
              borderRadius: borderRadius + 'px',
              boxShadow: shadowStyle,
              background: bgColor || undefined,
              '--ci-pad-t': paddingY + 'px',
              '--ci-pad-l': paddingX + 'px',
            }"
          >
            <!-- 顶部窗口控件 -->
            <div v-if="showWindowDots" class="ci-window-bar">
              <span class="ci-dot ci-dot-r"></span>
              <span class="ci-dot ci-dot-y"></span>
              <span class="ci-dot ci-dot-g"></span>
              <span v-if="showLangBadge" class="ci-lang-badge"><svg class="ci-lang-badge-svg" :width="langBadgeWidth" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="20" rx="10" fill="rgba(127, 127, 127, 0.18)" /><text x="50%" y="14" text-anchor="middle" font-size="11" font-family="Arial, Helvetica, sans-serif" font-weight="500" fill="currentColor" style="text-transform: lowercase; letter-spacing: 0.04em;">{{ language }}</text></svg></span>
            </div>

            <!-- 代码主体
                 用 <div> 而不是 <pre>：Vue 3.5 对 <pre> 的 raw-text 解析更严格，
                 自闭合 <span v-html> 会让它误判为字面字符串，下游 patch 报
                 "Failed to execute 'appendChild' on 'Node': Unexpected token '<'"。
                 <code> 保留以维持语义与现有 CSS 选择器（.ci-pre code.hljs 等）。
                 white-space: pre 由 .ci-pre 提供，仍保留原文格式。 -->
            <div
              ref="codeRef"
              class="ci-pre ci-code-block"
              :class="[language, { 'ci-pre-with-ln': showLineNumbers }]"
            ><code class="hljs"><span v-if="showLineNumbers && lineNumberHtml" class="ci-ln-wrap" v-html="lineNumberHtml"></span><span class="ci-code-content" v-html="highlightedHtml"></span></code></div>

            <!-- 底部水印 -->
            <div v-if="watermark" class="ci-watermark">{{ watermark }}</div>
          </div>
        </div>

        <!-- 提示 -->
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="!rounded-2xl"
        >
          <template #title>
            <span class="text-caption">点击「下载 PNG」即可保存为高清图片（2x 倍率 ≈ Retina）；所有渲染均在浏览器本地完成，代码不会上传到服务器。</span>
          </template>
        </el-alert>
      </div>
    </div>

    <!-- 全屏放大预览 -->
    <el-dialog
      v-model="previewDialogVisible"
      title="预览放大"
      width="80%"
      destroy-on-close
    >
      <div class="flex justify-center bg-slate-100 p-4 rounded-lg overflow-auto">
        <div
          class="ci-preview"
          :style="{
            fontFamily,
            fontSize: fontSize + 'px',
            lineHeight,
            padding: `${paddingY}px ${paddingX}px`,
            borderRadius: borderRadius + 'px',
            boxShadow: shadowStyle,
            background: bgColor || undefined,
            maxWidth: '100%',
            '--ci-pad-t': paddingY + 'px',
            '--ci-pad-l': paddingX + 'px',
          }"
        >
          <div v-if="showWindowDots" class="ci-window-bar">
            <span class="ci-dot ci-dot-r"></span>
            <span class="ci-dot ci-dot-y"></span>
            <span class="ci-dot ci-dot-g"></span>
            <span v-if="showLangBadge" class="ci-lang-badge"><svg class="ci-lang-badge-svg" :width="langBadgeWidth" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="20" rx="10" fill="rgba(127, 127, 127, 0.18)" /><text x="50%" y="14" text-anchor="middle" font-size="11" font-family="Arial, Helvetica, sans-serif" font-weight="500" fill="currentColor" style="text-transform: lowercase; letter-spacing: 0.04em;">{{ language }}</text></svg></span>
          </div>
          <!-- 同主预览：避开 <pre> raw-text 解析问题 -->
          <div class="ci-pre ci-code-block" :class="[language, { 'ci-pre-with-ln': showLineNumbers }]"><code class="hljs"><span v-if="showLineNumbers && lineNumberHtml" class="ci-ln-wrap" v-html="lineNumberHtml"></span><span class="ci-code-content" v-html="highlightedHtml"></span></code></div>
          <div v-if="watermark" class="ci-watermark">{{ watermark }}</div>
        </div>
      </div>
    </el-dialog>

    <ToolDetail title="使用说明">
      <el-text>
        <b>高亮代码生成图片</b> 是一款纯浏览器的代码截图工具：左侧编辑代码、调节样式，右侧实时预览，一键生成可分享的代码长图。
        <br /><br />
        <b>功能要点：</b>
        <ul style="margin: 0.5em 0 0.5em 1.5em; padding: 0;">
          <li>支持 highlight.js 已注册的常用语言（JavaScript / TypeScript / Python / Go / Rust / Java / C / C++ / C# / SQL / YAML / Bash / JSON / HTML / CSS 等），下拉框可筛选输入</li>
          <li>8 套精选主题：GitHub / Atom One Light / GitHub Dark / Atom One Dark / Monokai / Nord / Night Owl / Tokyo Night Dark</li>
          <li>可调字号、行高、内边距、圆角、阴影强度、字体、自定义背景与底部水印</li>
          <li>显示行号 / 显示语言标签 / 显示窗口红黄绿圆点 → 三组独立开关，可自由组合</li>
          <li>点击「下载 PNG」即可保存 2x 倍率（Retina）高清图片；也可直接复制图片到剪贴板，或复制完整高亮 HTML 用于嵌入博客/笔记</li>
        </ul>
        <b>如何使用：</b>
        <ol style="margin: 0.5em 0 0.5em 1.5em; padding: 0;">
          <li>在「代码」框输入或粘贴代码（也可点示例按钮快速体验）</li>
          <li>选择语言，调节主题与样式参数，预览实时更新</li>
          <li>满意后点击「下载 PNG」得到带高亮的代码截图</li>
        </ol>
        <b>隐私说明：</b>全部渲染与截图均在浏览器本地完成，代码不会上传到任何服务器，适合在分享代码片段时保护隐私。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 主题 CSS 由 document.head 中的 <style id="ci-hljs-theme"> 注入，
   这里仅负责卡片外壳 / 行号 / 水印等本地样式 */

/* 高亮区域基础 */
.ci-pre {
  margin: 0;
  font-family: inherit;
  white-space: pre;
  overflow: visible;
  background: transparent !important;
  padding: 0;
}
.ci-pre code.hljs {
  display: block;
  overflow: visible;
  padding: 0;
  background: transparent;
}

/* 行号：flex 并排布局，与代码同 line-height 自动对齐（不再用 absolute 定位，
   避免 unitless 1.6 × 不同 font-size 时的 sub-pixel 误差导致最后一行被截） */
.ci-pre-with-ln code.hljs {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 !important;
}
.ci-ln-wrap {
  flex-shrink: 0;
  width: 44px;
  text-align: right;
  user-select: none;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.45;
  font-family: inherit;
  line-height: inherit;
}
.ci-ln {
  display: block;
  font-family: inherit;
  line-height: inherit;
}
.ci-code-content {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: pre;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

/* v-html 注入的行号 span / hljs 高亮 span 没有 data-v-xxx 属性，
   需要 :deep() 选到他们；<style scoped> 改写后 .ci-ln 才不会匹配失败回退到 inline */
:deep(.ci-ln) {
  display: block;
  font-family: inherit;
  line-height: inherit;
}

/* 顶部窗口控件（mac 红黄绿）—— flex + align-items: center 简单稳定 */
.ci-window-bar {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.18);
  margin: calc(var(--ci-pad-t, 0) * -1) calc(var(--ci-pad-l, 0) * -1) 12px;
  border-radius: inherit inherit 0 0;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.ci-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}
.ci-dot-r { background: #ff5f57; }
.ci-dot-y { background: #febc2e; }
.ci-dot-g { background: #28c840; margin-right: 0; }

.ci-lang-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
}
.ci-lang-badge-svg {
  display: block;
  /* SVG 自动宽度按文字 + 两侧 padding 撑开；html2canvas 直接渲染 SVG 元素，
     文字位置由 y="14" 绝对控制（baseline y=14），不受 line-height / flex 对齐影响 */
}

/* 水印 */
.ci-watermark {
  text-align: right;
  padding-top: 8px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  opacity: 0.6;
  color: inherit;
}

/* 预览卡片 */
.ci-preview {
  position: relative;
  display: inline-block;
  min-width: 240px;
  max-width: 100%;
  /* 关键：让行号/window-bar 的负 margin 用真实 padding 计算 */
  --ci-pad-t: 0;
  --ci-pad-l: 0;
}

.ci-preview-wrap {
  background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                    linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                    linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

/* 行号：保证和正文行高一致 */
.ci-code-input :deep(.el-textarea__inner) {
  font-family: "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.55;
  background: #f8fafc !important;
}

.ci-color-input {
  width: 36px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
}

/* 移动端：左右两栏堆叠时给卡片一个最小宽度 */
@media (max-width: 1023px) {
  .ci-preview {
    max-width: 100%;
  }
}
</style>
