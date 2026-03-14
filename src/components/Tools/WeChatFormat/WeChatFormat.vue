<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import php from 'highlight.js/lib/languages/php'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/github.css'

// 注册常用语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('php', php)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c++', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)
hljs.registerLanguage('xml', html)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)

// ============ 类型定义 ============
interface ThemeStyles {
  id: string
  containerBg: string
  textColor: string
  headingColor: string
  linkColor: string
  quoteBg: string
  quoteBorder: string
  codeBg: string
  borderColor: string
  fontFamily: string
  headingWeight: string
  containerShadow: string
  containerRadius: string
  headingBorder: string
  quoteStyle: string
  headingDecoration: string
  containerBorder: string
  headingSpacing: string
  paragraphSpacing: string
  listIndent: string
}

interface Theme {
  id: string
  name: string
  styles: ThemeStyles
}


const info = reactive({
  title: "公众号排版",
  content: '',
  mode: 'markdown', // markdown | rich
  currentTheme: 'literary',
  showToc: true,
})

// Markdown 内容
const markdownContent = ref(`

# 欢迎使用公众号排版工具

这是一款支持多种主题的 Markdown 排版工具，专为微信公众号设计。

## 文本样式演示

**粗体文本** 用于强调重要内容

*斜体文本* 用于表示引用或次要信息

\`行内代码\` 可以嵌入到段落中，如 \`const name = "value"\`

## 列表示例

### 无序列表

- 第一项内容
- 第二项内容
- 第三项内容

### 有序列表

1. 首先打开编辑器
2. 输入 Markdown 内容
3. 选择主题并复制

## 表格示例

| 功能 | 支持情况 | 说明 |
|------|---------|------|
| 标题 | ✅ | 支持 H1-H3 |
| 列表 | ✅ | 支持有序/无序 |
| 代码 | ✅ | 支持语法高亮 |
| 表格 | ✅ | 完整支持 |

## 引用块

> 这是一个引用块，常用于引用名言或突出显示重要信息。

## 链接示例

访问 [官网](https://example.com) 了解更多信息，或查看 [GitHub](https://github.com) 项目。

## 图片示例

![简笔猫头鹰](https://pub-3f8970eda51e4fc595eaf2c37979f683.r2.dev/b86138b1-0de8-4282-b740-e1ee06bf1cec.jpg)

---

## 代码块示例

### PHP 密码加盐

\`\`\`php
// php代码
function genSalt($saltRaw)
{
    $hex = hex2bin($saltRaw);
    return substr(base64_encode($hex), 0, 4);
}
\`\`\`

### JavaScript 示例

\`\`\`javascript
function greet(name) {
    console.log(\`Hello, \${name}!\`);
    return true;
}

greet('World');
\`\`\`

`)

// 主题配置
const themes: Theme[] = [
  {
    id: 'simple',
    name: '简约风格',
    styles: {
      id: 'simple',
      // 颜色
      containerBg: '#ffffff',
      textColor: '#3f3f3f',
      headingColor: '#000000',
      linkColor: '#576b95',
      quoteBg: '#f7f7f7',
      quoteBorder: '#d1d1d1',
      codeBg: '#f0f0f0',
      borderColor: '#e0e0e0',
      // 字体
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      headingWeight: '600',
      // 样式
      containerShadow: 'none',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'left', // left, solid, bg
      // 装饰
      headingDecoration: 'none', // none, underline, bg, side-line
      containerBorder: 'none',
      // 间距
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '20px',
    }
  },
  {
    id: 'business',
    name: '商务风格',
    styles: {
      id: 'business',
      containerBg: '#ffffff',
      textColor: '#333333',
      headingColor: '#1a1a1a',
      linkColor: '#1890ff',
      quoteBg: '#f0f7ff',
      quoteBorder: '#1890ff',
      codeBg: '#f6f8fa',
      borderColor: '#d9d9d9',
      fontFamily: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
      headingWeight: '700',
      containerShadow: '0 2px 8px rgba(0,0,0,0.08)',
      containerRadius: '4px',
      headingBorder: 'bottom',
      quoteStyle: 'solid',
      headingDecoration: 'underline',
      containerBorder: 'none',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '24px',
    }
  },
  {
    id: 'literary',
    name: '文艺风格',
    styles: {
      id: 'literary',
      containerBg: '#fffbf0',
      textColor: '#4a4a4a',
      headingColor: '#8b4513',
      linkColor: '#cd853f',
      quoteBg: '#fff8dc',
      quoteBorder: '#daa520',
      codeBg: '#ffefd5',
      borderColor: '#deb887',
      fontFamily: '"Kaiti SC", "STKaiti", "KaiTi", "楷体", serif',
      headingWeight: '600',
      containerShadow: 'none',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'side-line',
      containerBorder: 'none',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '22px',
    }
  },
  {
    id: 'night',
    name: '深色模式',
    styles: {
      id: 'night',
      containerBg: '#f5f5f5',
      textColor: '#2c3e50',
      headingColor: '#1a1a1a',
      linkColor: '#2980b9',
      quoteBg: '#ecf0f1',
      quoteBorder: '#2980b9',
      codeBg: '#f8f9fa',
      borderColor: '#bdc3c7',
      fontFamily: '"SF Mono", "Monaco", "Consolas", "Liberation Mono", monospace',
      headingWeight: '600',
      containerShadow: 'none',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'bg',
      containerBorder: 'none',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.7em',
      listIndent: '24px',
    }
  },
  {
    id: 'elegant',
    name: '优雅风格',
    styles: {
      id: 'elegant',
      containerBg: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
      textColor: '#2c3e50',
      headingColor: '#34495e',
      linkColor: '#9b59b6',
      quoteBg: '#f0f3f7',
      quoteBorder: '#9b59b6',
      codeBg: '#eef2f7',
      borderColor: '#d5dbdf',
      fontFamily: '"Georgia", "Times New Roman", serif',
      headingWeight: '600',
      containerShadow: '0 8px 32px rgba(0,0,0,0.06)',
      containerRadius: '16px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'none',
      containerBorder: 'none',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '26px',
    }
  },
  {
    id: 'vibrant',
    name: '活力风格',
    styles: {
      id: 'vibrant',
      containerBg: '#ffffff',
      textColor: '#2d3748',
      headingColor: '#1a202c',
      linkColor: '#ed8936',
      quoteBg: '#fffaf0',
      quoteBorder: '#ed8936',
      codeBg: '#fff5eb',
      borderColor: '#fed7aa',
      fontFamily: '"Segoe UI", "Roboto", "Oxygen", "Ubuntu", sans-serif',
      headingWeight: '700',
      containerShadow: '0 4px 20px rgba(237, 137, 54, 0.15)',
      containerRadius: '12px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'bg',
      containerBorder: '2px solid #fed7aa',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '22px',
    }
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    styles: {
      id: 'cyberpunk',
      containerBg: '#0a0a0a',
      textColor: '#e0e0e0',
      headingColor: '#ff00ff',
      linkColor: '#00ffff',
      quoteBg: 'linear-gradient(135deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 255, 255, 0.1) 100%)',
      quoteBorder: '#ff00ff',
      codeBg: '#1a1a2e',
      borderColor: '#ff00ff',
      fontFamily: '"Orbitron", "Rajdhani", "Segoe UI", sans-serif',
      headingWeight: '900',
      containerShadow: '0 0 40px rgba(255, 0, 255, 0.5), 0 0 80px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(255, 0, 255, 0.1)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '3px solid transparent',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '28px',
    }
  },
  {
    id: 'neon',
    name: '霓虹之夜',
    styles: {
      id: 'neon',
      containerBg: '#0d0d0d',
      textColor: '#ffffff',
      headingColor: '#ffff00',
      linkColor: '#ff0066',
      quoteBg: 'rgba(255, 0, 102, 0.15)',
      quoteBorder: '#ff0066',
      codeBg: '#1a1a1a',
      borderColor: '#00ff00',
      fontFamily: '"Arial Black", "Impact", sans-serif',
      headingWeight: '900',
      containerShadow: '0 0 30px rgba(255, 0, 102, 0.6), 0 0 60px rgba(0, 255, 0, 0.4)',
      containerRadius: '8px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '4px solid #ff0066',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '24px',
    }
  },
  {
    id: 'aurora',
    name: '极光幻境',
    styles: {
      id: 'aurora',
      containerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
      textColor: '#ffffff',
      headingColor: '#ffffff',
      linkColor: '#ffff00',
      quoteBg: 'rgba(255, 255, 255, 0.2)',
      quoteBorder: '#ffffff',
      codeBg: 'rgba(0, 0, 0, 0.3)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
      fontFamily: '"Poppins", "Montserrat", sans-serif',
      headingWeight: '800',
      containerShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      containerRadius: '20px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'none',
      containerBorder: 'none',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '26px',
    }
  },
  {
    id: 'metal',
    name: '金属机甲',
    styles: {
      id: 'metal',
      containerBg: '#2c2c2c',
      textColor: '#e8e8e8',
      headingColor: '#c9c9c9',
      linkColor: '#4a9eff',
      quoteBg: 'linear-gradient(90deg, rgba(74, 158, 255, 0.1) 0%, rgba(192, 192, 192, 0.05) 100%)',
      quoteBorder: '#808080',
      codeBg: '#1a1a1a',
      borderColor: '#606060',
      fontFamily: '"Rajdhani", "Orbitron", "Segoe UI", sans-serif',
      headingWeight: '700',
      containerShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
      containerRadius: '4px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'side-line',
      containerBorder: '2px solid #404040',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.8em',
      listIndent: '24px',
    }
  },
  {
    id: 'candy',
    name: '糖果梦境',
    styles: {
      id: 'candy',
      containerBg: '#fff5f8',
      textColor: '#6b4c6a',
      headingColor: '#ff69b4',
      linkColor: '#ff1493',
      quoteBg: '#ffe4ec',
      quoteBorder: '#ff69b4',
      codeBg: '#fff0f5',
      borderColor: '#ffb6d9',
      fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
      headingWeight: '800',
      containerShadow: '0 8px 30px rgba(255, 105, 180, 0.25)',
      containerRadius: '24px',
      headingBorder: 'none',
      quoteStyle: 'bg',
      headingDecoration: 'bg',
      containerBorder: '4px dashed #ffb6d9',
      headingSpacing: '1.5em',
      paragraphSpacing: '1.9em',
      listIndent: '26px',
    }
  },
  {
    id: 'synthwave',
    name: '合成波',
    styles: {
      id: 'synthwave',
      containerBg: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      textColor: '#ff6ec7',
      headingColor: '#ff6ec7',
      linkColor: '#00ffff',
      quoteBg: 'linear-gradient(90deg, rgba(255, 110, 199, 0.2) 0%, rgba(0, 255, 255, 0.1) 100%)',
      quoteBorder: '#ff6ec7',
      codeBg: 'rgba(15, 12, 41, 0.8)',
      borderColor: '#ff6ec7',
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      headingWeight: '900',
      containerShadow: '0 0 50px rgba(255, 110, 199, 0.6), inset 0 0 30px rgba(0, 255, 255, 0.1)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '4px solid #00ffff',
      headingSpacing: '1.6em',
      paragraphSpacing: '2em',
      listIndent: '30px',
    }
  },
  {
    id: 'glitch',
    name: '故障艺术',
    styles: {
      id: 'glitch',
      containerBg: '#000000',
      textColor: '#00ff00',
      headingColor: '#ff0000',
      linkColor: '#00ffff',
      quoteBg: 'rgba(255, 0, 0, 0.1)',
      quoteBorder: '#ff0000',
      codeBg: '#0a0a0a',
      borderColor: '#00ff00',
      fontFamily: '"Courier New", "Consolas", monospace',
      headingWeight: '900',
      containerShadow: '0 0 20px rgba(0, 255, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.4)',
      containerRadius: '0px',
      headingBorder: 'none',
      quoteStyle: 'solid',
      headingDecoration: 'none',
      containerBorder: '2px solid #00ff00',
      headingSpacing: '1.4em',
      paragraphSpacing: '1.8em',
      listIndent: '22px',
    }
  },
]

// 字体样式配置
const fontStyles = reactive({
  fontSize: 16, // px
  lineHeight: 1.8,
  letterSpacing: 0,
})

// 本地存储的key
const STORAGE_KEY = 'wechat_format_config'

// 保存提示状态
const saveTipVisible = ref(false)
let saveTipTimer: number | null = null

// 显示保存提示
const showSaveTip = () => {
  saveTipVisible.value = true
  if (saveTipTimer) {
    clearTimeout(saveTipTimer)
  }
  saveTipTimer = window.setTimeout(() => {
    saveTipVisible.value = false
    saveTipTimer = null
  }, 2000)
}

// 从本地存储加载配置
const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      if (data.currentTheme) info.currentTheme = data.currentTheme
      if (data.fontSize) fontStyles.fontSize = data.fontSize
      if (data.lineHeight) fontStyles.lineHeight = data.lineHeight
      if (data.letterSpacing !== undefined) fontStyles.letterSpacing = data.letterSpacing
      if (data.content) markdownContent.value = data.content
    }
  } catch (e) {
    console.error('加载配置失败:', e)
  }
}

// 保存配置到本地存储
const saveToStorage = () => {
  try {
    const data = {
      currentTheme: info.currentTheme,
      fontSize: fontStyles.fontSize,
      lineHeight: fontStyles.lineHeight,
      letterSpacing: fontStyles.letterSpacing,
      content: markdownContent.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    showSaveTip()
  } catch (e) {
    console.error('保存配置失败:', e)
  }
}

// 监听配置变化并自动保存（防抖）
let saveTimer: number | null = null
watch(
  () => [info.currentTheme, fontStyles.fontSize, fontStyles.lineHeight, fontStyles.letterSpacing, markdownContent.value],
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveToStorage()
    }, 500)
  },
  { deep: true }
)

// 组件挂载时加载配置
onMounted(() => {
  loadFromStorage()
})

// 预览内容 (HTML)
const previewContent = computed(() => {
  const theme = themes.find(t => t.id === info.currentTheme)?.styles || themes[0].styles
  return formatMarkdown(markdownContent.value, theme)
})

// 完整的预览 HTML（包含容器）
const previewHTML = computed(() => {
  const theme = themes.find(t => t.id === info.currentTheme)?.styles || themes[0].styles
  return wrapWithStyles(previewContent.value, theme)
})

// ============ MarkdownIt 实例缓存 ============
let cachedMdIt: MarkdownIt | null = null
let cachedThemeId: string | null = null

/** 获取或创建 MarkdownIt 实例 */
const getMarkdownIt = (theme: ThemeStyles): MarkdownIt => {
  // 如果主题变化，重新创建实例
  if (cachedMdIt && cachedThemeId === theme.id) {
    return cachedMdIt
  }

  const safeFontFamily = theme.fontFamily.replace(/"/g, "'")

  const mdIt = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          const highlighted = hljs.highlight(str, { language: lang }).value
          const withInlineStyles = convertHljsToInlineStyles(highlighted)
          const codeFontFamily = "'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Victor Mono', 'Consolas', 'Monaco', monospace"
          return `<table style="width:100%;border-collapse:collapse;margin:15px 0;background:${theme.codeBg};border-radius:${theme.containerRadius};overflow:hidden;"><tr><td style="padding:15px;"><pre style="font-family:${codeFontFamily};font-size:14px;line-height:1.6;color:${theme.textColor};margin:0;white-space:pre-wrap;word-wrap:break-word;">${withInlineStyles}</pre></td></tr></table>`
        } catch (__) {}
      }
      const codeFontFamily = "'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Victor Mono', 'Consolas', 'Monaco', monospace"
      const escaped = mdIt.utils.escapeHtml(str).replace(/ /g, '\u00a0')
      return `<table style="width:100%;border-collapse:collapse;margin:15px 0;background:${theme.codeBg};border-radius:${theme.containerRadius};overflow:hidden;"><tr><td style="padding:15px;"><pre style="font-family:${codeFontFamily};font-size:14px;line-height:1.6;color:${theme.textColor};margin:0;white-space:pre-wrap;word-wrap:break-word;">${escaped}</pre></td></tr></table>`
    }
  })

  // 自定义渲染规则
  mdIt.renderer.rules.heading_open = (tokens, idx) => {
    const token = tokens[idx]
    const level = parseInt(token.tag.slice(1))
    return renderHeadingOpen(level, theme, safeFontFamily)
  }

  mdIt.renderer.rules.paragraph_open = () => {
    return `<p style="margin:10px 0;line-height:${fontStyles.lineHeight};font-size:${fontStyles.fontSize}px;color:${theme.textColor};text-align:left;letter-spacing:${fontStyles.letterSpacing}px;font-family:${safeFontFamily};">`
  }

  mdIt.renderer.rules.bullet_list_open = () => renderUlOpen(theme, safeFontFamily)
  mdIt.renderer.rules.ordered_list_open = () => renderOlOpen(theme, safeFontFamily)
  mdIt.renderer.rules.list_item_open = () => renderLiOpen(theme)
  mdIt.renderer.rules.blockquote_open = () => renderBlockquoteOpen(theme, safeFontFamily)
  mdIt.renderer.rules.table_open = () => renderTableOpen(theme)
  mdIt.renderer.rules.thead_open = () => renderTheadOpen(theme)
  mdIt.renderer.rules.tbody_open = () => '<tbody>'
  mdIt.renderer.rules.tr_open = () => '<tr>'
  mdIt.renderer.rules.th_open = (tokens, idx) => renderThOpen(theme, tokens[idx].attrGet('style'))
  mdIt.renderer.rules.td_open = (tokens, idx) => renderTdOpen(theme, tokens[idx].attrGet('style'))

  mdIt.renderer.rules.code_inline = (tokens, idx) => {
    const codeFontFamily = "'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Victor Mono', 'Consolas', 'Monaco', monospace"
    let style = `font-family: ${codeFontFamily};font-size: 0.9em;background: ${theme.codeBg};padding: 2px 6px;border-radius: 4px;color: ${theme.textColor};`
    if (theme.id === 'vibrant') style += ` background: linear-gradient(135deg, ${theme.linkColor}15 0%, ${theme.linkColor}05 100%);color: ${theme.headingColor};`
    else if (theme.id === 'night') style += ` background: ${theme.linkColor}20;color: ${theme.linkColor};`
    return `<code style="${style}">${tokens[idx].content}</code>`
  }

  mdIt.renderer.rules.strong_open = () => {
    let style = `font-weight: bold;color: ${theme.headingColor};`
    if (theme.id === 'vibrant') style += ` background: linear-gradient(90deg, ${theme.linkColor}20 0%, transparent 100%);padding: 2px 6px;border-radius: 3px;`
    else if (theme.id === 'night') style += ` color: ${theme.linkColor};`
    else if (theme.id === 'cyberpunk') style += ` color: #ff00ff;text-shadow: 0 0 8px #ff00ff, 0 0 16px #ff00ff;`
    else if (theme.id === 'neon') style += ` color: #ffff00;text-shadow: 0 0 10px #ffff00;`
    else if (theme.id === 'aurora') style += ` color: #ffffff;text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);background: rgba(255, 255, 0, 0.2);padding: 2px 6px;border-radius: 4px;`
    else if (theme.id === 'metal') style += ` color: #4a9eff;text-shadow: 1px 1px 2px rgba(0,0,0,0.3);`
    else if (theme.id === 'candy') style += ` color: #ff1493;background: #ffe4ec;padding: 2px 8px;border-radius: 12px;`
    else if (theme.id === 'synthwave') style += ` color: #00ffff;text-shadow: 0 0 8px #00ffff;`
    else if (theme.id === 'glitch') style += ` color: #00ff00;text-shadow: 2px 0 #ff0000;`
    return `<strong style="${style}">`
  }

  mdIt.renderer.rules.em_open = () => {
    let style = `font-style: italic;color: ${theme.textColor};`
    if (theme.id === 'literary' || theme.id === 'elegant') style += ` font-family: Georgia, serif;`
    else if (theme.id === 'cyberpunk') style += ` color: #00ffff;text-shadow: 0 0 6px #00ffff;`
    else if (theme.id === 'neon') style += ` color: #ff0066;text-shadow: 0 0 8px #ff0066;`
    else if (theme.id === 'aurora') style += ` color: #ffff00;opacity: 0.9;`
    else if (theme.id === 'metal') style += ` color: #c9c9c9;`
    else if (theme.id === 'candy') style += ` color: #ff69b4;`
    else if (theme.id === 'synthwave') style += ` color: #ff6ec7;text-shadow: 0 0 6px #ff6ec7;`
    else if (theme.id === 'glitch') style += ` color: #00ff00;text-shadow: 0 0 6px #00ff00;`
    return `<em style="${style}">`
  }

  mdIt.renderer.rules.link_open = (tokens, idx) => {
    let linkStyle = `color: ${theme.linkColor};text-decoration: none;transition: all 0.2s;`
    if (theme.id === 'simple') linkStyle += `border-bottom: 1px solid ${theme.linkColor}40;`
    else if (theme.id === 'business') linkStyle += `border-bottom: 2px solid ${theme.linkColor};font-weight: 500;`
    else if (theme.id === 'literary') linkStyle += `border-bottom: 1px dashed ${theme.linkColor};font-style: italic;`
    else if (theme.id === 'night') linkStyle += `border-bottom: 1px solid ${theme.linkColor};`
    else if (theme.id === 'elegant') linkStyle += `border-bottom: 1px solid ${theme.linkColor}60;`
    else if (theme.id === 'vibrant') linkStyle += `border-bottom: 2px solid ${theme.linkColor};font-weight: 600;`
    else if (theme.id === 'cyberpunk') linkStyle += `text-shadow: 0 0 8px #00ffff;transition: all 0.3s;`
    else if (theme.id === 'neon') linkStyle += `text-shadow: 0 0 10px #ff0066;transition: all 0.3s;`
    else if (theme.id === 'aurora') linkStyle += `text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);`
    else if (theme.id === 'metal') linkStyle += `text-shadow: 0 0 6px #4a9eff;`
    else if (theme.id === 'candy') linkStyle += `border-bottom: 2px dotted #ff69b4;`
    else if (theme.id === 'synthwave') linkStyle += `text-shadow: 0 0 8px #00ffff;transition: all 0.3s;`
    else if (theme.id === 'glitch') linkStyle += `text-shadow: 0 0 8px #00ff00;`
    return `<a href="${tokens[idx].attrGet('href')}" style="${linkStyle}">`
  }

  mdIt.renderer.rules.hr = () => renderHr(theme)
  mdIt.renderer.rules.image = (tokens, idx) => {
    const src = tokens[idx].attrGet('src')
    const alt = tokens[idx].content || ''
    return renderImage(src, alt, theme, safeFontFamily)
  }

  cachedMdIt = mdIt
  cachedThemeId = theme.id
  return mdIt
}

// 格式化 Markdown 为 HTML（所有样式内联）
const formatMarkdown = (md: string, theme: ThemeStyles): string => {
  try {
    const mdIt = getMarkdownIt(theme)
    return mdIt.render(md)
  } catch (error) {
    console.error('Markdown 解析失败:', error)
    return '<p style="color: red;">内容解析失败，请检查 Markdown 语法</p>'
  }
}

const renderHeadingOpen = (level: number, theme: ThemeStyles, safeFontFamily: string) => {
  if (level === 1) {
    let style = `font-size: 28px;font-weight: ${theme.headingWeight};color: ${theme.headingColor};font-family: ${safeFontFamily};margin: 30px 0 20px;line-height: ${theme.headingSpacing};text-align: center;`
    if (theme.id === 'simple') style += ` letter-spacing: 2px;`
    else if (theme.id === 'business') style += ` background: ${theme.linkColor}10;padding: 16px 24px;border-radius: 8px;border-left: 5px solid ${theme.linkColor};`
    else if (theme.id === 'literary') style += ` font-size: 30px;`
    else if (theme.id === 'night') style += ` background: linear-gradient(135deg, ${theme.linkColor}30 0%, transparent 100%);padding: 18px 28px;border-radius: 8px;border-left: 4px solid ${theme.linkColor};`
    else if (theme.id === 'elegant') style += ` font-style: italic;letter-spacing: 1px;`
    else if (theme.id === 'vibrant') style += ` color: ${theme.linkColor};font-size: 32px;font-weight: 800;`
    // 赛博朋克主题 - 霓虹发光效果
    else if (theme.id === 'cyberpunk') style += ` text-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff, 0 0 40px #ff00ff;letter-spacing: 4px;text-transform: uppercase;`
    // 霓虹主题 - 强烈的霓虹光效
    else if (theme.id === 'neon') style += ` text-shadow: 0 0 10px #ffff00, 0 0 20px #ffff00, 0 0 30px #ffff00, 0 0 40px #ffff00;letter-spacing: 3px;`
    // 极光主题 - 渐变文字
    else if (theme.id === 'aurora') style += ` background: linear-gradient(90deg, #ffffff 0%, #ffff00 50%, #ffffff 100%);-webkit-background-clip: text;-webkit-text-fill-color: transparent;background-clip: text;text-shadow: 0 0 30px rgba(255, 255, 255, 0.5);`
    // 金属主题 - 金属质感
    else if (theme.id === 'metal') style += ` text-shadow: 2px 2px 4px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.3);background: linear-gradient(180deg, #e8e8e8 0%, #c9c9c9 50%, #a0a0a0 100%);-webkit-background-clip: text;-webkit-text-fill-color: transparent;`
    // 糖果主题 - 柔和阴影
    else if (theme.id === 'candy') style += ` text-shadow: 3px 3px 0 #ffb6d9, 6px 6px 0 #ff69b4;letter-spacing: 2px;`
    // 合成波主题 - 复古未来风格
    else if (theme.id === 'synthwave') style += ` text-shadow: 0 0 10px #ff6ec7, 0 0 20px #ff6ec7, 3px 3px 0 #00ffff;letter-spacing: 3px;text-transform: uppercase;`
    // 故障主题 - 故障效果
    else if (theme.id === 'glitch') style += ` text-shadow: 2px 0 #00ffff, -2px 0 #ff0000;animation: glitch 1s infinite;letter-spacing: 2px;`
    return `<h1 style="${style}">`
  }

  if (level === 2) {
    let style = `font-size: 22px;font-weight: ${theme.headingWeight};color: ${theme.headingColor};font-family: ${safeFontFamily};margin: 25px 0 15px;line-height: ${theme.headingSpacing};display: block;`
    if (theme.id === 'simple') style += ` border-bottom: 2px solid ${theme.linkColor};padding-bottom: 6px;`
    else if (theme.id === 'business') style += ` border-left: 6px solid ${theme.linkColor};padding-left: 14px;background: linear-gradient(90deg, ${theme.linkColor}08 0%, transparent 100%);padding: 8px 14px;`
    else if (theme.id === 'literary') style += ` border-left: 4px double ${theme.quoteBorder};padding-left: 16px;color: ${theme.headingColor};`
    else if (theme.id === 'night') style += ` background: ${theme.linkColor}15;padding: 8px 16px;border-radius: 4px;border-left: 4px solid ${theme.linkColor};`
    else if (theme.id === 'elegant') style += ` text-align: center;width: 100%;letter-spacing: 1px;`
    else if (theme.id === 'vibrant') style += ` background: linear-gradient(90deg, ${theme.linkColor}20 0%, ${theme.linkColor}05 100%);padding: 10px 18px;border-radius: 6px;border-left: 5px solid ${theme.linkColor};`
    // 赛博朋克主题 H2
    else if (theme.id === 'cyberpunk') style += ` border-left: 6px solid #00ffff;border-right: 6px solid #ff00ff;padding: 12px 20px;background: linear-gradient(90deg, rgba(0, 255, 255, 0.1) 0%, rgba(255, 0, 255, 0.1) 100%);text-shadow: 0 0 8px #ff00ff, 0 0 16px #00ffff;`
    // 霓虹主题 H2
    else if (theme.id === 'neon') style += ` border-bottom: 4px solid #ff0066;box-shadow: 0 0 10px #ff0066, inset 0 0 10px rgba(255, 0, 102, 0.3);text-shadow: 0 0 10px #ffff00;`
    // 极光主题 H2
    else if (theme.id === 'aurora') style += ` background: linear-gradient(90deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 0, 0.3) 100%);padding: 12px 24px;border-radius: 20px;`
    // 金属主题 H2
    else if (theme.id === 'metal') style += ` border-left: 8px solid #4a9eff;background: linear-gradient(90deg, rgba(74, 158, 255, 0.2) 0%, transparent 100%);padding: 10px 18px;box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);`
    // 糖果主题 H2
    else if (theme.id === 'candy') style += ` border-bottom: 4px dashed #ff69b4;padding: 10px;background: linear-gradient(90deg, #ffe4ec 0%, #fff5f8 50%, #ffe4ec 100%);border-radius: 12px;`
    // 合成波主题 H2
    else if (theme.id === 'synthwave') style += ` border-top: 3px solid #00ffff;border-bottom: 3px solid #ff6ec7;padding: 12px;background: linear-gradient(90deg, rgba(0, 255, 255, 0.15) 0%, rgba(255, 110, 199, 0.15) 100%);text-shadow: 0 0 8px #ff6ec7;`
    // 故障主题 H2
    else if (theme.id === 'glitch') style += ` border: 2px solid #00ff00;box-shadow: 0 0 10px #00ff00, inset 0 0 10px rgba(0, 255, 0, 0.3);text-shadow: 2px 0 #ff0000;`
    return `<h2 style="${style}">`
  }

  // h3
  let style = `font-size: 18px;font-weight: ${theme.headingWeight};color: ${theme.headingColor};font-family: ${safeFontFamily};margin: 20px 0 12px;line-height: ${theme.headingSpacing};`
  if (theme.id === 'business') style += ` border-left: 4px solid ${theme.linkColor};padding-left: 12px;background: ${theme.linkColor}05;padding: 6px 12px;display: inline-block;`
  else if (theme.id === 'literary') style += ` border-left: 3px solid ${theme.quoteBorder};padding-left: 12px;font-style: italic;`
  else if (theme.id === 'night') style += ` border-left: 3px solid ${theme.linkColor};padding-left: 12px;color: ${theme.headingColor};`
  else if (theme.id === 'vibrant') style += ` border-left: 3px solid ${theme.linkColor};padding-left: 12px;background: linear-gradient(90deg, ${theme.linkColor}10 0%, transparent 100%);padding: 6px 12px;border-radius: 0 4px 4px 0;`
  // 赛博朋克主题 H3
  else if (theme.id === 'cyberpunk') style += ` color: #00ffff;border-left: 4px solid #00ffff;padding-left: 12px;text-shadow: 0 0 6px #00ffff;`
  // 霓虹主题 H3
  else if (theme.id === 'neon') style += ` color: #ff0066;border-bottom: 3px solid #ff0066;text-shadow: 0 0 8px #ff0066;`
  // 极光主题 H3
  else if (theme.id === 'aurora') style += ` color: #ffff00;opacity: 0.9;`
  // 金属主题 H3
  else if (theme.id === 'metal') style += ` border-left: 6px solid #808080;padding-left: 12px;`
  // 糖果主题 H3
  else if (theme.id === 'candy') style += ` color: #ff1493;border-radius: 8px;padding: 8px 12px;background: #ffe4ec;`
  // 合成波主题 H3
  else if (theme.id === 'synthwave') style += ` color: #00ffff;border-left: 4px solid #00ffff;padding-left: 12px;text-shadow: 0 0 6px #00ffff;`
  // 故障主题 H3
  else if (theme.id === 'glitch') style += ` color: #00ff00;border-left: 3px solid #00ff00;padding-left: 10px;text-shadow: 0 0 6px #00ff00;`
  return `<h3 style="${style}">`
}

const renderUlOpen = (theme: ThemeStyles, safeFontFamily: string) => {
  let style = `margin: 16px 0;padding-left: ${theme.listIndent};font-family: ${safeFontFamily};list-style-type: disc;`
  if (theme.id === 'literary') style += ` list-style-type: '✦ ';`
  else if (theme.id === 'night') style += ` list-style-type: '● ';color: ${theme.linkColor};`
  else if (theme.id === 'elegant') style += ` list-style-type: circle;`
  else if (theme.id === 'vibrant') style += ` list-style-type: square;`
  // 赛博朋克主题列表
  else if (theme.id === 'cyberpunk') style += ` list-style-type: '►';color: #00ffff;text-shadow: 0 0 6px #00ffff;`
  // 霓虹主题列表
  else if (theme.id === 'neon') style += ` list-style-type: '★';color: #ffff00;text-shadow: 0 0 8px #ffff00;`
  // 极光主题列表
  else if (theme.id === 'aurora') style += ` list-style-type: '➤';color: #ffffff;`
  // 金属主题列表
  else if (theme.id === 'metal') style += ` list-style-type: '◆';color: #4a9eff;`
  // 糖果主题列表
  else if (theme.id === 'candy') style += ` list-style-type: '♥';color: #ff69b4;`
  // 合成波主题列表
  else if (theme.id === 'synthwave') style += ` list-style-type: '▶';color: #00ffff;text-shadow: 0 0 6px #00ffff;`
  // 故障主题列表
  else if (theme.id === 'glitch') style += ` list-style-type: '▸';color: #00ff00;text-shadow: 0 0 6px #00ff00;`
  return `<ul style="${style}">`
}

const renderOlOpen = (theme: ThemeStyles, safeFontFamily: string) => {
  let style = `margin: 16px 0;padding-left: ${theme.listIndent};list-style-type: decimal;font-family: ${safeFontFamily};`
  if (theme.id === 'literary') style += ` color: ${theme.quoteBorder};`
  else if (theme.id === 'night') style += ` color: ${theme.linkColor};padding-left: ${theme.listIndent};`
  // 赛博朋克主题有序列表
  else if (theme.id === 'cyberpunk') style += ` color: #ff00ff;text-shadow: 0 0 6px #ff00ff;`
  // 霓虹主题有序列表
  else if (theme.id === 'neon') style += ` color: #ff0066;text-shadow: 0 0 8px #ff0066;`
  // 极光主题有序列表
  else if (theme.id === 'aurora') style += ` color: #ffff00;`
  // 金属主题有序列表
  else if (theme.id === 'metal') style += ` color: #4a9eff;`
  // 糖果主题有序列表
  else if (theme.id === 'candy') style += ` color: #ff1493;`
  // 合成波主题有序列表
  else if (theme.id === 'synthwave') style += ` color: #00ffff;text-shadow: 0 0 6px #00ffff;`
  // 故障主题有序列表
  else if (theme.id === 'glitch') style += ` color: #00ff00;text-shadow: 0 0 6px #00ff00;`
  return `<ol style="${style}">`
}

const renderLiOpen = (theme: ThemeStyles) => {
  let style = `margin: 8px 0;line-height: ${fontStyles.lineHeight};color: ${theme.textColor};`
  if (theme.id === 'literary') style += ` padding-left: 8px;`
  else if (theme.id === 'elegant') style += ` padding-left: 0;`
  else if (theme.id === 'vibrant') style += ` padding-left: 0;`
  // 赛博朋克主题列表项
  else if (theme.id === 'cyberpunk') style += ` padding-left: 8px;text-shadow: 0 0 4px rgba(0, 255, 255, 0.5);`
  // 霓虹主题列表项
  else if (theme.id === 'neon') style += ` padding-left: 8px;text-shadow: 0 0 4px rgba(255, 0, 102, 0.5);`
  // 极光主题列表项
  else if (theme.id === 'aurora') style += ` padding-left: 8px;`
  // 金属主题列表项
  else if (theme.id === 'metal') style += ` padding-left: 8px;`
  // 糖果主题列表项
  else if (theme.id === 'candy') style += ` padding-left: 8px;`
  // 合成波主题列表项
  else if (theme.id === 'synthwave') style += ` padding-left: 8px;text-shadow: 0 0 4px rgba(255, 110, 199, 0.5);`
  // 故障主题列表项
  else if (theme.id === 'glitch') style += ` padding-left: 8px;text-shadow: 0 0 4px rgba(0, 255, 0, 0.5);`
  return `<li style="${style}">`
}

const renderBlockquoteOpen = (theme: ThemeStyles, safeFontFamily: string) => {
  let style = `font-family: ${safeFontFamily};color: ${theme.textColor};line-height: ${fontStyles.lineHeight};margin: 16px 0;`
  if (theme.id === 'simple') style += ` border-left: 4px solid ${theme.quoteBorder};padding-left: 16px;opacity: 0.9;`
  else if (theme.id === 'business') style += ` background: ${theme.quoteBg};border-left: 5px solid ${theme.quoteBorder};padding: 16px 20px;border-radius: 4px;box-shadow: 0 2px 4px rgba(0,0,0,0.05);`
  else if (theme.id === 'literary') style += ` background: ${theme.quoteBg};border: 2px solid ${theme.quoteBorder};border-radius: ${theme.containerRadius};padding: 20px 24px;font-style: italic;text-align: center;`
  else if (theme.id === 'night') style += ` background: ${theme.quoteBg};border-left: 4px solid ${theme.quoteBorder};padding: 16px 20px;border-radius: 8px;box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);`
  else if (theme.id === 'elegant') style += ` background: ${theme.quoteBg};border-left: 4px solid ${theme.quoteBorder};padding: 18px 24px;border-radius: 0 ${theme.containerRadius} ${theme.containerRadius} 0;font-style: italic;box-shadow: ${theme.containerShadow};`
  else if (theme.id === 'vibrant') style += ` background: linear-gradient(135deg, ${theme.quoteBg} 0%, ${theme.linkColor}08 100%);border-left: 5px solid ${theme.quoteBorder};padding: 16px 22px;border-radius: 8px;border: 1px solid ${theme.quoteBorder};border-left-width: 5px;`
  // 赛博朋克主题引用
  else if (theme.id === 'cyberpunk') style += ` border-left: 6px solid #ff00ff;border-right: 2px solid #00ffff;padding: 20px;background: linear-gradient(135deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 255, 255, 0.1) 100%);box-shadow: 0 0 20px rgba(255, 0, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.1);`
  // 霓虹主题引用
  else if (theme.id === 'neon') style += ` border: 3px solid #ff0066;box-shadow: 0 0 20px rgba(255, 0, 102, 0.6), inset 0 0 20px rgba(255, 0, 102, 0.3);padding: 20px;background: rgba(255, 0, 102, 0.05);`
  // 极光主题引用
  else if (theme.id === 'aurora') style += ` border-radius: 16px;padding: 20px;background: rgba(255, 255, 255, 0.15);border: 2px solid rgba(255, 255, 255, 0.3);box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);`
  // 金属主题引用
  else if (theme.id === 'metal') style += ` border-left: 6px solid #4a9eff;padding: 16px;background: linear-gradient(90deg, rgba(74, 158, 255, 0.15) 0%, transparent 100%);box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);`
  // 糖果主题引用
  else if (theme.id === 'candy') style += ` border-radius: 16px;padding: 20px;background: #ffe4ec;border: 3px dashed #ff69b4;box-shadow: 0 4px 20px rgba(255, 105, 180, 0.25);`
  // 合成波主题引用
  else if (theme.id === 'synthwave') style += ` border: 3px solid transparent;padding: 20px;background: linear-gradient(135deg, rgba(255, 110, 199, 0.2) 0%, rgba(0, 255, 255, 0.1) 100%);box-shadow: 0 0 30px rgba(255, 110, 199, 0.4), inset 0 0 30px rgba(0, 255, 255, 0.1);`
  // 故障主题引用
  else if (theme.id === 'glitch') style += ` border: 2px solid #00ff00;box-shadow: 0 0 15px rgba(0, 255, 0, 0.8), inset 0 0 15px rgba(0, 255, 0, 0.3);padding: 18px;background: rgba(0, 255, 0, 0.05);`
  else {
    if (theme.quoteStyle === 'solid') style += ` background: ${theme.quoteBg};border-left: 4px solid ${theme.quoteBorder};padding: 12px 16px;`
    else if (theme.quoteStyle === 'bg') style += ` background: ${theme.quoteBg};border-left: 4px solid ${theme.quoteBorder};border-radius: ${theme.containerRadius};padding: 12px 20px;font-style: italic;`
    else style += ` border-left: 4px solid ${theme.quoteBorder};padding-left: 16px;opacity: 0.85;`
  }
  return `<blockquote style="${style}">`
}

const renderHr = (theme: ThemeStyles) => {
  if (theme.id === 'simple') return `<hr style="border: none;border-top: 1px solid ${theme.borderColor};margin: 20px 0;opacity: 0.5;"/>`
  if (theme.id === 'business') return `<hr style="border: none;border-top: 2px solid ${theme.linkColor};margin: 24px 0;opacity: 0.8;"/>`
  if (theme.id === 'literary') return `<hr style="border: none;border-top: 2px dashed ${theme.quoteBorder};margin: 24px 0;opacity: 0.6;"/>`
  if (theme.id === 'night') return `<hr style="border: none;border-top: 1px solid ${theme.borderColor};margin: 20px 0;background: linear-gradient(90deg, transparent 0%, ${theme.linkColor} 50%, transparent 100%);height: 2px;"/>`
  if (theme.id === 'elegant') return `<hr style="border: none;border-top: 1px solid ${theme.borderColor};margin: 24px 0;background: linear-gradient(90deg, transparent 0%, ${theme.borderColor} 50%, transparent 100%);height: 1px;"/>`
  if (theme.id === 'vibrant') return `<hr style="border: none;border-top: 3px solid ${theme.linkColor};margin: 24px 0;opacity: 0.7;border-radius: 2px;"/>`
  // 赛博朋克主题分割线
  if (theme.id === 'cyberpunk') return `<hr style="border: none;margin: 30px 0;background: linear-gradient(90deg, transparent 0%, #ff00ff 50%, #00ffff 100%);height: 3px;box-shadow: 0 0 10px #ff00ff, 0 0 20px #00ffff;"/>`
  // 霓虹主题分割线
  if (theme.id === 'neon') return `<hr style="border: none;margin: 30px 0;background: linear-gradient(90deg, #ffff00 0%, #ff0066 50%, #00ff00 100%);height: 4px;box-shadow: 0 0 15px rgba(255, 0, 102, 0.8);"/>`
  // 极光主题分割线
  if (theme.id === 'aurora') return `<hr style="border: none;margin: 30px 0;background: linear-gradient(90deg, #667eea 0%, #f093fb 50%, #00f2fe 100%);height: 3px;box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);"/>`
  // 金属主题分割线
  if (theme.id === 'metal') return `<hr style="border: none;margin: 24px 0;background: linear-gradient(90deg, #606060 0%, #c9c9c9 50%, #606060 100%);height: 2px;box-shadow: inset 0 1px 0 rgba(0,0,0,0.5);"/>`
  // 糖果主题分割线
  if (theme.id === 'candy') return `<hr style="border: none;margin: 28px 0;background: linear-gradient(90deg, #ffb6d9 0%, #ff69b4 50%, #ffb6d9 100%);height: 4px;border-radius: 2px;"/>`
  // 合成波主题分割线
  if (theme.id === 'synthwave') return `<hr style="border: none;margin: 30px 0;background: linear-gradient(90deg, #00ffff 0%, #ff6ec7 50%, #00ffff 100%);height: 3px;box-shadow: 0 0 20px #ff6ec7, 0 0 40px #00ffff;"/>`
  // 故障主题分割线
  if (theme.id === 'glitch') return `<hr style="border: none;margin: 24px 0;background: #00ff00;height: 2px;box-shadow: 0 0 15px #00ff00, 0 0 30px #00ff00;"/>`
  return `<hr style="border: none;border-top: 2px solid ${theme.borderColor};margin: 24px 0;opacity: 0.6;"/>`
}

const renderImage = (src: string, alt: string, theme: ThemeStyles, _safeFontFamily: string) => {
  let style = `max-width: 100%;height: auto;border-radius: ${theme.containerRadius};margin: 20px 0;display: block;box-shadow: ${theme.containerShadow};`
  if (theme.id === 'business' || theme.id === 'vibrant') style += ` border: 1px solid ${theme.borderColor};`
  else if (theme.id === 'literary') style += ` border: 3px double ${theme.quoteBorder};padding: 8px;background: ${theme.quoteBg};`
  else if (theme.id === 'night') style += ` border: 1px solid ${theme.borderColor};box-shadow: 0 4px 12px rgba(0,0,0,0.4);`
  else if (theme.id === 'elegant') style += ` box-shadow: ${theme.containerShadow};`

  const imgTag = `<img src="${src}" alt="${alt}" style="${style}"/>`

  if (alt && alt !== 'img' && alt !== 'image') {
    return `<section style="text-align: center; margin: 20px 0;">${imgTag}<p style="font-size: 14px; color: ${theme.textColor}; margin-top: 8px; line-height: 1.6;">${alt}</p></section>`
  }

  return imgTag
}

// 表格渲染函数
const renderTableOpen = (theme: ThemeStyles) => {
  let style = `width: 100%;border-collapse: collapse;margin: 20px 0;font-size: ${fontStyles.fontSize}px;color: ${theme.textColor};`
  if (theme.id === 'simple') style += ` border: 1px solid ${theme.borderColor};`
  else if (theme.id === 'business') style += ` border: 1px solid ${theme.linkColor};box-shadow: 0 2px 8px rgba(0,0,0,0.05);`
  else if (theme.id === 'literary') style += ` border: 2px solid ${theme.quoteBorder};`
  else if (theme.id === 'night') style += ` border: 1px solid ${theme.linkColor};background: ${theme.linkColor}05;`
  else if (theme.id === 'elegant') style += ` border: 1px solid ${theme.linkColor};`
  else if (theme.id === 'vibrant') style += ` border: 2px solid ${theme.linkColor};`
  // 赛博朋克主题表格
  else if (theme.id === 'cyberpunk') style += ` border: 2px solid #00ffff;box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);`
  // 霓虹主题表格
  else if (theme.id === 'neon') style += ` border: 2px solid #ffff00;box-shadow: 0 0 15px rgba(255, 255, 0, 0.3);`
  // 极光主题表格
  else if (theme.id === 'aurora') style += ` border: 1px solid rgba(255, 255, 255, 0.3);background: rgba(255, 255, 255, 0.05);`
  // 金属主题表格
  else if (theme.id === 'metal') style += ` border: 1px solid #4a9eff;box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);`
  // 糖果主题表格
  else if (theme.id === 'candy') style += ` border: 2px solid #ff69b4;`
  // 合成波主题表格
  else if (theme.id === 'synthwave') style += ` border: 2px solid #00ffff;box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);`
  // 故障主题表格
  else if (theme.id === 'glitch') style += ` border: 2px solid #00ff00;box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);`
  else style += ` border: 1px solid ${theme.borderColor};`
  return `<table style="${style}">`
}

const renderTheadOpen = (theme: ThemeStyles) => {
  let style = ``
  if (theme.id === 'simple') style += `background: ${theme.codeBg};border-bottom: 2px solid ${theme.borderColor};`
  else if (theme.id === 'business') style += `background: ${theme.linkColor};color: #fff;border-bottom: 2px solid ${theme.linkColor};`
  else if (theme.id === 'literary') style += `background: ${theme.quoteBg};border-bottom: 2px solid ${theme.quoteBorder};`
  else if (theme.id === 'night') style += `background: ${theme.linkColor};color: #fff;border-bottom: 2px solid ${theme.linkColor};`
  else if (theme.id === 'elegant') style += `background: linear-gradient(135deg, ${theme.linkColor}15 0%, ${theme.linkColor}05 100%);border-bottom: 2px solid ${theme.linkColor};`
  else if (theme.id === 'vibrant') style += `background: ${theme.linkColor};color: #fff;border-bottom: 2px solid ${theme.linkColor};`
  // 赛博朋克主题表头
  else if (theme.id === 'cyberpunk') style += `background: linear-gradient(90deg, rgba(0, 255, 255, 0.3) 0%, rgba(255, 0, 255, 0.3) 100%);border-bottom: 2px solid #00ffff;color: #00ffff;`
  // 霓虹主题表头
  else if (theme.id === 'neon') style += `background: rgba(255, 0, 102, 0.3);border-bottom: 2px solid #ffff00;color: #ffff00;`
  // 极光主题表头
  else if (theme.id === 'aurora') style += `background: linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 0, 0.2) 100%);border-bottom: 1px solid rgba(255, 255, 255, 0.3);`
  // 金属主题表头
  else if (theme.id === 'metal') style += `background: rgba(74, 158, 255, 0.2);border-bottom: 2px solid #4a9eff;`
  // 糖果主题表头
  else if (theme.id === 'candy') style += `background: #ffe4ec;border-bottom: 2px solid #ff69b4;color: #ff1493;`
  // 合成波主题表头
  else if (theme.id === 'synthwave') style += `background: linear-gradient(90deg, rgba(0, 255, 255, 0.3) 0%, rgba(255, 110, 199, 0.3) 100%);border-bottom: 2px solid #00ffff;color: #00ffff;`
  // 故障主题表头
  else if (theme.id === 'glitch') style += `background: rgba(0, 255, 0, 0.2);border-bottom: 2px solid #00ff00;color: #00ff00;`
  else style += `background: ${theme.codeBg};border-bottom: 2px solid ${theme.borderColor};`
  return `<thead style="${style}">`
}

const renderThOpen = (theme: ThemeStyles, align: string | null) => {
  let style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: ${theme.headingColor};border-right: 1px solid ${theme.borderColor};`
  if (theme.id === 'business' || theme.id === 'night' || theme.id === 'vibrant') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #fff;border-right: 1px solid ${theme.linkColor};`
  } else if (theme.id === 'literary') {
    style += `font-family: Georgia, serif;border-right: 1px solid ${theme.quoteBorder};`
  } else if (theme.id === 'elegant') {
    style += `font-family: Georgia, serif;border-right: 1px solid ${theme.linkColor};`
  } else if (theme.id === 'cyberpunk') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #00ffff;border-right: 1px solid rgba(0, 255, 255, 0.3);`
  } else if (theme.id === 'neon') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #ffff00;border-right: 1px solid rgba(255, 255, 0, 0.3);`
  } else if (theme.id === 'aurora') {
    style += `border-right: 1px solid rgba(255, 255, 255, 0.2);`
  } else if (theme.id === 'metal') {
    style += `border-right: 1px solid rgba(74, 158, 255, 0.3);`
  } else if (theme.id === 'candy') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #ff1493;border-right: 1px solid rgba(255, 105, 180, 0.3);`
  } else if (theme.id === 'synthwave') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #00ffff;border-right: 1px solid rgba(0, 255, 255, 0.3);`
  } else if (theme.id === 'glitch') {
    style = `padding: 12px 16px;text-align: ${align || 'left'};font-weight: 600;color: #00ff00;border-right: 1px solid rgba(0, 255, 0, 0.3);`
  }
  return `<th style="${style}">`
}

const renderTdOpen = (theme: ThemeStyles, align: string | null) => {
  let style = `padding: 12px 16px;text-align: ${align || 'left'};border-bottom: 1px solid ${theme.borderColor};border-right: 1px solid ${theme.borderColor};line-height: ${fontStyles.lineHeight};`
  if (theme.id === 'business') style += `border-bottom: 1px solid ${theme.linkColor};border-right: 1px solid ${theme.linkColor};`
  else if (theme.id === 'literary') style += `border-bottom: 1px solid ${theme.quoteBorder};border-right: 1px solid ${theme.quoteBorder};`
  else if (theme.id === 'night') style += `border-bottom: 1px solid ${theme.linkColor};border-right: 1px solid ${theme.linkColor};`
  else if (theme.id === 'vibrant') style += `border-bottom: 1px solid ${theme.linkColor};border-right: 1px solid ${theme.linkColor};`
  else if (theme.id === 'elegant') style += `border-bottom: 1px solid ${theme.linkColor};border-right: 1px solid ${theme.linkColor};`
  // 赛博朋克主题单元格
  else if (theme.id === 'cyberpunk') style += `border-bottom: 1px solid rgba(0, 255, 255, 0.2);border-right: 1px solid rgba(0, 255, 255, 0.2);`
  // 霓虹主题单元格
  else if (theme.id === 'neon') style += `border-bottom: 1px solid rgba(255, 255, 0, 0.2);border-right: 1px solid rgba(255, 255, 0, 0.2);`
  // 极光主题单元格
  else if (theme.id === 'aurora') style += `border-bottom: 1px solid rgba(255, 255, 255, 0.1);border-right: 1px solid rgba(255, 255, 255, 0.1);`
  // 金属主题单元格
  else if (theme.id === 'metal') style += `border-bottom: 1px solid rgba(74, 158, 255, 0.2);border-right: 1px solid rgba(74, 158, 255, 0.2);`
  // 糖果主题单元格
  else if (theme.id === 'candy') style += `border-bottom: 1px solid rgba(255, 105, 180, 0.2);border-right: 1px solid rgba(255, 105, 180, 0.2);`
  // 合成波主题单元格
  else if (theme.id === 'synthwave') style += `border-bottom: 1px solid rgba(0, 255, 255, 0.2);border-right: 1px solid rgba(0, 255, 255, 0.2);`
  // 故障主题单元格
  else if (theme.id === 'glitch') style += `border-bottom: 1px solid rgba(0, 255, 0, 0.2);border-right: 1px solid rgba(0, 255, 0, 0.2);`
  return `<td style="${style}">`
}

// 转换 highlight.js 类名为内联样式，并保留空格格式
const convertHljsToInlineStyles = (html: string) => {
  const colorMap: Record<string, string> = {
    'hljs-comment': 'color: #6a737d; font-style: italic',
    'hljs-quote': 'color: #6a737d; font-style: italic',
    'hljs-keyword': 'color: #d73a49',
    'hljs-selector-tag': 'color: #d73a49',
    'hljs-selector-attr': 'color: #d73a49',
    'hljs-selector-pseudo': 'color: #d73a49',
    'hljs-selector-id': 'color: #d73a49',
    'hljs-selector-class': 'color: #d73a49',
    'hljs-type': 'color: #22863a',
    'hljs-class': 'color: #22863a',
    'hljs-built_in': 'color: #e36209',
    'hljs-title': 'color: #6f42c1',
    'hljs-title.function_': 'color: #6f42c1',
    'hljs-title.class_': 'color: #22863a',
    'hljs-function': 'color: #6f42c1',
    'hljs-name': 'color: #6f42c1',
    'hljs-attr': 'color: #d73a49',
    'hljs-property': 'color: #005cc5',
    'hljs-symbol': 'color: #e36209',
    'hljs-bullet': 'color: #005cc5',
    'hljs-string': 'color: #032f62',
    'hljs-meta-string': 'color: #032f62',
    'hljs-number': 'color: #005cc5',
    'hljs-variable': 'color: #e36209',
    'hljs-literal': 'color: #005cc5',
    'hljs-boolean': 'color: #005cc5',
    'hljs-regex': 'color: #032f62',
    'hljs-meta': 'color: #6a737d',
    'hljs-operator': 'color: #005cc5',
    'hljs-deletion': 'color: #22863a; background: #f0fff4',
    'hljs-addition': 'color: #032f62; background: #f0f8ff',
    'hljs-link': 'color: #6f42c1; text-decoration: underline',
    'hljs-subst': 'color: #24292e',
    'hljs-params': 'color: #24292e',
  }

  // 第一步：替换 span 标签的类名为内联样式，同时替换内容中的空格
  let result = html.replace(/<span class="(hljs-[^"]+)">([^<]*)<\/span>/g, (match, className, content) => {
    const style = colorMap[className]
    if (style) {
      const contentWithNbsp = content.replace(/ /g, '\u00a0')
      return `<span style="${style}">${contentWithNbsp}</span>`
    }
    return match
  })

  // 第二步：处理不在 span 标签内的文本中的空格
  // 将文本分成标签和文本两部分，只替换文本中的空格
  const parts = result.split(/(<[^>]+>)/g)
  result = parts.map(part => {
    // 如果不是标签（不以 < 开头或 > 结尾），则替换空格
    if (!part.startsWith('<')) {
      return part.replace(/ /g, '\u00a0')
    }
    return part
  }).join('')

  return result
}

// 复制 HTML (带内联样式)
const copyHTML = () => {
  copy(previewHTML.value)
  ElMessage.success('HTML 源码已复制！')
}

// 复制富文本（可粘贴到公众号）
const copyRichText = async () => {
  const styledHTML = previewHTML.value

  try {
    // 使用现代 Clipboard API
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = new Blob([styledHTML], { type: 'text/html' })
      const textBlob = new Blob([styledHTML.replace(/<[^>]+>/g, '')], { type: 'text/plain' })
      const item = new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      })
      await navigator.clipboard.write([item])
      ElMessage.success('富文本已复制！现在可以直接粘贴到微信公众号编辑器')
    } else {
      // 降级方案：使用传统方法
      const container = document.createElement('div')
      container.innerHTML = styledHTML
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '677px'
      document.body.appendChild(container)

      // 选中文本
      const selection = window.getSelection()
      if (!selection) {
        throw new Error('无法获取选区')
      }

      const range = document.createRange()
      range.selectNodeContents(container)
      selection.removeAllRanges()
      selection.addRange(range)

      // 复制
      const successful = document.execCommand('copy')
      if (!successful) {
        throw new Error('复制失败')
      }

      // 清除选中
      selection.removeAllRanges()
      document.body.removeChild(container)

      ElMessage.success('富文本已复制！现在可以直接粘贴到微信公众号编辑器')
    }
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动复制右侧预览内容')
  }
}

// 包装样式
const wrapWithStyles = (html: string, theme: ThemeStyles) => {
  // 转义字体名称中的引号
  const safeFontFamily = theme.fontFamily.replace(/"/g, '&quot;')

  // 检查是否需要边框
  const hasBorder = theme.containerBorder && theme.containerBorder !== 'none'

  // 检查背景色类型
  const isGradient = theme.containerBg && theme.containerBg.includes('gradient')
  // 对于非白色的纯色背景，使用表格包裹以确保微信公众号兼容
  const isSpecialBg = theme.containerBg &&
                      !isGradient &&
                      !theme.containerBg.includes('rgb') &&
                      theme.containerBg !== '#ffffff' &&
                      theme.containerBg !== '#fff' &&
                      theme.containerBg !== 'white'

  // 对于有边框的主题，统一使用表格来实现（兼容性更好）
  if (hasBorder) {
    // 解析边框样式
    const borderMatch = theme.containerBorder.match(/(\d+)px\s+(\w+)\s+(.+)/)
    const borderWidth = borderMatch ? borderMatch[1] : '2'
    const borderColor = borderMatch ? borderMatch[3] : '#1890ff'

    // 使用表格实现边框和背景色效果（微信公众号兼容性最好）
    // 外层表格边框颜色，内层单元格背景色
    return `<table style="width: 100%; max-width: 677px; margin: 0 auto; border-collapse: separate; border-spacing: 0; background: ${borderColor}; border: ${borderWidth}px solid ${borderColor};"><tr><td style="padding: 20px; background: ${theme.containerBg}; color: ${theme.textColor}; font-family: ${safeFontFamily}; font-size: ${fontStyles.fontSize}px; line-height: ${fontStyles.lineHeight}; letter-spacing: ${fontStyles.letterSpacing}px; text-align: left;">${html}</td></tr></table>`
  } else if (isSpecialBg) {
    // 使用表格来实现背景色（微信公众号更兼容）
    return `<table style="width: 100%; max-width: 677px; margin: 0 auto; border-collapse: collapse; background: ${theme.containerBg};"><tr><td style="padding: 20px; color: ${theme.textColor}; font-family: ${safeFontFamily}; font-size: ${fontStyles.fontSize}px; line-height: ${fontStyles.lineHeight}; letter-spacing: ${fontStyles.letterSpacing}px; text-align: left;">${html}</td></tr></table>`
  } else if (isGradient) {
    // 渐变背景使用第一帧颜色（微信公众号不支持渐变）
    const gradientMatch = theme.containerBg.match(/#[a-fA-F0-9]{6}/)
    const fallbackColor = gradientMatch ? gradientMatch[0] : '#f5f7fa'
    return `<table style="width: 100%; max-width: 677px; margin: 0 auto; border-collapse: collapse; background: ${fallbackColor};"><tr><td style="padding: 20px; color: ${theme.textColor}; font-family: ${safeFontFamily}; font-size: ${fontStyles.fontSize}px; line-height: ${fontStyles.lineHeight}; letter-spacing: ${fontStyles.letterSpacing}px; text-align: left;">${html}</td></tr></table>`
  } else {
    // 无边框白色背景
    const containerStyle = `max-width: 677px;margin: 0 auto;padding: 20px;background: ${theme.containerBg};color: ${theme.textColor};font-family: ${safeFontFamily};font-size: ${fontStyles.fontSize}px;line-height: ${fontStyles.lineHeight};letter-spacing: ${fontStyles.letterSpacing}px;text-align: left;`
    return `<div style="${containerStyle}">${html}</div>`
  }
}

// 生成目录
const tocList = computed(() => {
  const matches = markdownContent.value.match(/^#+\s+(.+)$/gm) || []
  return matches.map((match, index) => {
    const level = (match.match(/^#+/) || [''])[0].length
    const title = match.replace(/^#+\s+/, '')
    const id = `heading-${index}`
    return { level, title, id }
  })
})

// 字数统计
const wordCount = computed(() => {
  const text = markdownContent.value
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  const numbers = (text.match(/\d+/g) || []).length
  return chineseChars + englishWords + numbers
})

// 当前激活的目录项
const activeHeadingId = ref('')

// 滚动到标题
const scrollToHeading = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
    activeHeadingId.value = id
  }
}

// 清空内容
const clearContent = () => {
  markdownContent.value = ''
  ElMessage.success('内容已清空')
}

// 导出 Markdown 文件
const exportMarkdown = () => {
  const blob = new Blob([markdownContent.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `article_${Date.now()}.md`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出 Markdown 文件')
}

// 导入 Markdown 文件
const importMarkdown = (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    markdownContent.value = e.target?.result as string
    ElMessage.success('已导入 Markdown 文件')
  }
  reader.readAsText(file)
}

// 快速插入 Markdown 语法
const insertSyntax = (syntax: string) => {
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = markdownContent.value
    const selectedText = text.substring(start, end)

    // 检查前面和后面是否有换行
    const beforeText = text.substring(0, start)
    const afterText = text.substring(end)

    let insertText: string
    let cursorOffset: number
    let needNewLineBefore = false
    let needNewLineAfter = false

    // 判断后面是否是标题、代码块等块级元素
    const afterTextTrimmed = afterText.trim()
    const isAfterBlockElement = afterTextTrimmed.startsWith('#') ||
                                afterTextTrimmed.startsWith('>') ||
                                afterTextTrimmed.startsWith('```') ||
                                afterTextTrimmed.startsWith('-')

    // 如果有选中文本，根据按钮类型处理
    if (selectedText) {
      // 判断语法类型
      if (syntax === '**粗体文本**') {
        insertText = `**${selectedText}**`
        cursorOffset = insertText.length
        // 如果前面有内容，确保前面有换行
        needNewLineBefore = beforeText.trim().length > 0 && !beforeText.endsWith('\n\n')
        // 如果后面是块级元素，需要确保后面有换行
        needNewLineAfter = isAfterBlockElement
      } else if (syntax === '*斜体文本*') {
        insertText = `*${selectedText}*`
        cursorOffset = insertText.length
        // 如果前面有内容，确保前面有换行
        needNewLineBefore = beforeText.trim().length > 0 && !beforeText.endsWith('\n\n')
        // 如果后面是块级元素，需要确保后面有换行
        needNewLineAfter = isAfterBlockElement
      } else if (syntax === '## 标题') {
        insertText = `## ${selectedText}`
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '> 引用内容') {
        insertText = `> ${selectedText}`
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '```\ncode here\n```') {
        insertText = `\`\`\`\n${selectedText}\n\`\`\``
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '[链接文字](https://example.com)') {
        insertText = `[${selectedText}](https://example.com)`
        cursorOffset = insertText.length
      } else if (syntax === '![描述](图片地址)') {
        insertText = `![${selectedText}](图片地址)`
        cursorOffset = insertText.length
      } else if (syntax === '- 列表项\n- 列表项\n- 列表项') {
        insertText = `- ${selectedText}\n- ${selectedText}\n- ${selectedText}`
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n\n')
      } else if (syntax === '1. 列表项\n2. 列表项\n3. 列表项') {
        insertText = `1. ${selectedText}\n2. ${selectedText}\n3. ${selectedText}`
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n\n')
      } else if (syntax === '---') {
        insertText = `${selectedText}\n\n---\n`
        cursorOffset = insertText.length
        needNewLineBefore = !beforeText.endsWith('\n')
      } else {
        insertText = syntax
        cursorOffset = insertText.length
      }
    } else {
      // 没有选中文本，插入示例文本并选中可编辑部分
      if (syntax === '**粗体文本**') {
        insertText = '**粗体文本**'
        cursorOffset = start + 2 // 光标定位到"粗体文本"开始
        // 如果前面有内容，确保前面有换行
        needNewLineBefore = beforeText.trim().length > 0 && !beforeText.endsWith('\n\n')
        needNewLineAfter = isAfterBlockElement && !afterText.startsWith('\n')
      } else if (syntax === '*斜体文本*') {
        insertText = '*斜体文本*'
        cursorOffset = start + 1 // 光标定位到"斜体文本"开始
        // 如果前面有内容，确保前面有换行
        needNewLineBefore = beforeText.trim().length > 0 && !beforeText.endsWith('\n\n')
        needNewLineAfter = isAfterBlockElement
      } else if (syntax === '## 标题') {
        insertText = '## 标题'
        cursorOffset = start + 3 // 光标定位到"标题"开始
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '> 引用内容') {
        insertText = '> 引用内容'
        cursorOffset = start + 2 // 光标定位到"引用内容"开始
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '```\ncode here\n```') {
        insertText = '```\ncode here\n```'
        cursorOffset = start + 5 // 光标定位到"code here"开始
        needNewLineBefore = !beforeText.endsWith('\n\n')
        needNewLineAfter = !afterText.startsWith('\n')
      } else if (syntax === '[链接文字](https://example.com)') {
        insertText = '[链接文字](https://example.com)'
        cursorOffset = start + 1 // 光标定位到"链接文字"开始
      } else if (syntax === '![描述](图片地址)') {
        insertText = '![描述](图片地址)'
        cursorOffset = start + 2 // 光标定位到"描述"开始
      } else if (syntax === '- 列表项\n- 列表项\n- 列表项') {
        insertText = '- 列表项\n- 列表项\n- 列表项'
        cursorOffset = start + 2 // 光标定位到第一个"列表项"开始
        needNewLineBefore = !beforeText.endsWith('\n\n')
      } else if (syntax === '1. 列表项\n2. 列表项\n3. 列表项') {
        insertText = '1. 列表项\n2. 列表项\n3. 列表项'
        cursorOffset = start + 3 // 光标定位到第一个"列表项"开始
        needNewLineBefore = !beforeText.endsWith('\n\n')
      } else {
        insertText = syntax
        cursorOffset = start + insertText.length
      }
    }

    // 添加必要的换行符
    let finalInsert = insertText

    if (needNewLineBefore) {
      // 前面需要换行
      if (!beforeText.endsWith('\n')) {
        finalInsert = '\n\n' + finalInsert
      } else if (!beforeText.endsWith('\n\n')) {
        finalInsert = '\n' + finalInsert
      }
    }

    if (needNewLineAfter) {
      // 直接添加两个换行，不管后面有什么
      finalInsert = finalInsert + '\n\n'
    }

    const before = text.substring(0, start)
    const after = text.substring(end)

    markdownContent.value = before + finalInsert + after

    setTimeout(() => {
      textarea.focus()
      // 如果有选中文本，选中整个插入的文本；如果没有，光标定位到合适位置
      if (selectedText) {
        textarea.setSelectionRange(start, start + finalInsert.length)
      } else {
        textarea.setSelectionRange(cursorOffset + (needNewLineBefore ? 2 : 0), cursorOffset + (needNewLineBefore ? 2 : 0))
      }
    }, 0)
  }
}

// 滚动同步相关
const editorScrolling = ref(false)
const previewScrolling = ref(false)

// 编辑器滚动事件
const handleEditorScroll = (e: Event) => {
  if (previewScrolling.value) return
  editorScrolling.value = true

  const textarea = e.target as HTMLTextAreaElement
  const previewContainer = document.querySelector('.preview-scroll-container') as HTMLElement

  if (previewContainer) {
    const scrollPercentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight)
    previewContainer.scrollTop = scrollPercentage * (previewContainer.scrollHeight - previewContainer.clientHeight)
  }

  setTimeout(() => {
    editorScrolling.value = false
  }, 100)
}

// 预览区滚动事件
const handlePreviewScroll = (e: Event) => {
  if (editorScrolling.value) return
  previewScrolling.value = true

  const previewContainer = e.target as HTMLElement
  const textarea = document.querySelector('.markdown-editor-textarea') as HTMLTextAreaElement

  if (textarea) {
    const scrollPercentage = previewContainer.scrollTop / (previewContainer.scrollHeight - previewContainer.clientHeight)
    textarea.scrollTop = scrollPercentage * (textarea.scrollHeight - textarea.clientHeight)
  }

  // 更新当前激活的目录项
  const headings = previewContainer.querySelectorAll('h1, h2, h3')
  for (const heading of headings) {
    const rect = (heading as HTMLElement).getBoundingClientRect()
    const containerRect = previewContainer.getBoundingClientRect()
    if (rect.top - containerRect.top >= 0 && rect.top - containerRect.top <= 200) {
      activeHeadingId.value = (heading as HTMLElement).id
      break
    }
  }

  setTimeout(() => {
    previewScrolling.value = false
  }, 100)
}

// 快捷语法按钮
const quickSyntaxButtons = [
  { icon: '𝗕', label: '加粗', syntax: '**粗体文本**' },
  { icon: '𝑖', label: '斜体', syntax: '*斜体文本*' },
  { icon: 'H', label: '标题', syntax: '## 标题' },
  { icon: '❝', label: '引用', syntax: '> 引用内容' },
  { icon: '< >', label: '代码', syntax: '```\ncode here\n```' },
  { icon: '☰', label: '无序列表', syntax: '- 列表项\n- 列表项\n- 列表项' },
  { icon: '1.', label: '有序列表', syntax: '1. 列表项\n2. 列表项\n3. 列表项' },
  { icon: '🔗', label: '链接', syntax: '[链接文字](https://example.com)' },
  { icon: '🖼', label: '图片', syntax: '![描述](图片地址)' },
  { icon: '―', label: '分割线', syntax: '---' },
]
</script>

<template>
  <div class="flex flex-col">
    <div class="mt-3">
      <DetailHeader :title="info.title"></DetailHeader>
    </div>

    <!-- 顶部操作栏 -->
    <div class="p-3 sm:p-4 rounded-2xl bg-white mb-3 sticky top-0 z-50 shadow-sm">
      <div class="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 sm:gap-4">
        <!-- 主题选择 -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium shrink-0">主题:</span>
          <el-select v-model="info.currentTheme" placeholder="选择主题" style="width: 140px" class="flex-1">
            <el-option
              v-for="theme in themes"
              :key="theme.id"
              :label="theme.name"
              :value="theme.id"
            />
          </el-select>
        </div>

        <!-- 字体设置 -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium shrink-0">字号:</span>
          <el-input-number v-model="fontStyles.fontSize" :min="12" :max="24" :step="1" size="small" />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm font-medium shrink-0">行高:</span>
          <el-input-number v-model="fontStyles.lineHeight" :min="1" :max="3" :step="0.1" size="small" />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm font-medium shrink-0">字间距:</span>
          <el-input-number v-model="fontStyles.letterSpacing" :min="-2" :max="10" :step="0.5" size="small" />
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto ml-auto">
          <a href="https://mjj.today/" target="_blank" rel="noopener noreferrer">
            <el-button class="w-full sm:w-auto">🖼️ 图床</el-button>
          </a>
          <el-upload :auto-upload="false" :on-change="importMarkdown" :show-file-list="false">
            <el-button class="w-full sm:w-auto">导入</el-button>
          </el-upload>
          <el-button class="w-full sm:w-auto" @click="exportMarkdown">导出</el-button>
          <el-button type="danger" plain class="w-full sm:w-auto" @click="clearContent">清空</el-button>
          <el-button class="w-full sm:w-auto" @click="copyHTML">复制 HTML</el-button>
          <el-button type="primary" class="w-full sm:w-auto" @click="copyRichText">复制富文本</el-button>
        </div>
      </div>

      <!-- 字数统计 -->
      <div class="mt-2 text-xs text-gray-400 flex justify-between">
        <span>{{ markdownContent.length }} 字符 | {{ wordCount }} 词</span>
        <span v-if="saveTipVisible" class="text-green-500">草稿已保存到本地</span>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="flex flex-col lg:flex-row gap-3 min-h-[500px] lg:h-[650px]">
      <!-- 左侧编辑区 -->
      <div class="w-full lg:flex-1 rounded-2xl bg-white overflow-hidden flex flex-col">
        <!-- 快捷语法按钮 -->
        <div class="p-2 border-b flex flex-wrap gap-1.5 flex-shrink-0 bg-white">
          <el-button
            v-for="btn in quickSyntaxButtons"
            :key="btn.label"
            size="small"
            @click="insertSyntax(btn.syntax)"
            :title="btn.label"
            class="text-xs !w-9 !h-9 !p-0 !flex !items-center !justify-center"
          >
            {{ btn.icon }}
          </el-button>
        </div>

        <!-- Markdown 编辑器滚动容器 -->
        <div class="flex-1 overflow-y-auto flex flex-col">
          <textarea
            v-model="markdownContent"
            placeholder="在这里输入 Markdown 内容..."
            class="markdown-editor-textarea w-full flex-1 min-h-[300px] resize-none box-border"
            @scroll="handleEditorScroll"
          ></textarea>
        </div>
      </div>

      <!-- 右侧预览区 -->
      <div class="w-full lg:flex-1 flex flex-col rounded-2xl bg-white overflow-hidden">
        <!-- 预览头部 -->
        <div class="p-3 border-b flex items-center justify-between flex-shrink-0">
          <span class="font-medium">预览</span>
          <el-switch v-model="info.showToc" active-text="显示目录" size="small" />
        </div>

        <!-- 目录 -->
        <div v-if="info.showToc && tocList.length > 0" class="p-3 border-b bg-gray-50 max-h-48 overflow-y-auto flex-shrink-0">
          <div class="text-sm font-medium mb-2">目录</div>
          <div
            v-for="(item, index) in tocList"
            :key="index"
            :id="item.id"
            class="toc-item cursor-pointer py-1 px-2 rounded hover:bg-blue-50 transition-colors"
            :class="{ 'bg-blue-100 text-blue-600 font-medium': activeHeadingId === item.id }"
            :style="{ paddingLeft: `${12 + (item.level - 1) * 12}px` }"
            @click="scrollToHeading(item.id)"
          >
            {{ item.title }}
          </div>
        </div>

        <!-- 预览内容 -->
        <div class="preview-scroll-container flex-1 overflow-y-auto p-2 sm:p-4 min-h-0" @scroll="handlePreviewScroll">
          <div class="preview-container" v-html="previewHTML"></div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-2 text-sm text-gray-600">
        <p><strong>编辑方式：</strong>使用 Markdown 语法在左侧编辑器中输入内容，右侧实时预览效果。</p>
        <p><strong>主题切换：</strong>选择不同的主题风格，一键应用完整的视觉方案（包含字体、颜色、阴影、圆角、装饰等）。</p>
        <p><strong>主题说明：</strong></p>
        <ul class="list-disc list-inside ml-4 space-y-1">
          <li><strong>简约风格</strong> - 干净清爽，适合日常文章</li>
          <li><strong>商务风格</strong> - 专业严谨，适合商业文档</li>
          <li><strong>文艺风格</strong> - 楷体古韵，适合文化内容</li>
          <li><strong>深色模式</strong> - 护眼舒适，适合技术文章</li>
          <li><strong>优雅风格</strong> - 渐变背景，适合时尚内容</li>
          <li><strong>活力风格</strong> - 橙色系配色，适合活力主题</li>
        </ul>
        <p><strong>字体设置：</strong>可调整字号、行高、对齐方式、字间距等。</p>
        <p><strong>边框样式：</strong>开启边框后可设置边框颜色、圆角和内边距。</p>
        <p class="text-blue-600 font-medium"><strong>复制到公众号：</strong></p>
        <ol class="list-decimal list-inside space-y-1 ml-4">
          <li>点击<strong>"复制富文本"</strong>按钮</li>
          <li>打开微信公众号文章编辑页面</li>
          <li>直接按 Ctrl+V 粘贴即可</li>
        </ol>
        <p class="text-gray-500 text-xs mt-2">注意：请使用"复制富文本"功能，不要使用"复制HTML源码"</p>
        <p class="text-orange-600 font-medium mt-3"><strong>⚠️ 图片提示：</strong></p>
        <p class="text-xs text-gray-600 ml-4">微信公众号不支持外部图片链接。如需使用图片，建议先在公众号素材库上传，然后使用微信CDN链接。复制后图片可能需要重新上传。</p>
      </div>
    </ToolDetail>

    <ToolDetail title="Markdown 语法参考">
      <div class="text-sm text-gray-600 space-y-3">
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">标题</p>
          <p class="text-xs text-gray-500"># 一级标题    ## 二级标题    ### 三级标题</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded"># 这是主标题</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">文本样式</p>
          <p class="text-xs text-gray-500">**粗体**    *斜体*    `行内代码`</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">**重要内容**</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">引用</p>
          <p class="text-xs text-gray-500">&gt; 引用内容</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">&gt; 这是一段引用</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">列表</p>
          <p class="text-xs text-gray-500">- 无序列表    1. 有序列表</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">- 第一项</code> 或 <code class="bg-gray-100 px-1 rounded">1. 第一项</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">表格</p>
          <p class="text-xs text-gray-500">\| 列1 \| 列2 \| 列3 \|</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">\| 标题1 \| 标题2 \|\|&#10;\| --- \| --- \|\|&#10;\| 内容 \| 内容 \|</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">代码块</p>
          <p class="text-xs text-gray-500">```语言    代码内容    ```</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">```javascript</code></p>
        </div>
        <div class="border-b pb-2">
          <p class="font-medium text-gray-700 mb-1">链接与图片</p>
          <p class="text-xs text-gray-500">[链接](URL)    ![图片](URL)</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">[百度](https://baidu.com)</code></p>
        </div>
        <div>
          <p class="font-medium text-gray-700 mb-1">分割线</p>
          <p class="text-xs text-gray-500">---</p>
          <p class="text-xs text-gray-400 mt-1">示例：<code class="bg-gray-100 px-1 rounded">---</code></p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 编辑器滚动容器 */
.editor-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.editor-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.editor-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.editor-scroll-container::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}

.editor-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

/* 编辑器 textarea */
.markdown-editor-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  border: none;
  padding: 16px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
  outline: none;
}

.markdown-editor-textarea:focus {
  box-shadow: none;
  outline: none;
}

/* 预览区滚动容器 */
.preview-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.preview-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.preview-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.preview-scroll-container::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}

.preview-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

.preview-container {
  min-height: 100%;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 移动端优化：预览容器宽度 */
@media (max-width: 640px) {
  .preview-container {
    min-height: 250px;
    font-size: 14px !important;
  }
}

/* 预览内容过渡动画 */
.preview-container :deep(*) {
  transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.preview-container :deep(h1),
.preview-container :deep(h2),
.preview-container :deep(h3) {
  font-weight: 600;
  transition: all 0.3s ease;
}

/* 移动端标题字体调整 */
@media (max-width: 640px) {
  .preview-container :deep(h1) {
    font-size: 22px !important;
  }

  .preview-container :deep(h2) {
    font-size: 18px !important;
  }

  .preview-container :deep(h3) {
    font-size: 16px !important;
  }
}

.preview-container :deep(p) {
  margin: 12px 0;
  transition: all 0.3s ease;
}

.preview-container :deep(ul),
.preview-container :deep(ol) {
  margin: 15px 0;
  padding-left: 20px;
  transition: all 0.3s ease;
}

/* 移动端列表缩进优化 */
@media (max-width: 640px) {
  .preview-container :deep(ul),
  .preview-container :deep(ol) {
    padding-left: 16px;
  }
}

.preview-container :deep(li) {
  margin: 8px 0;
  transition: all 0.3s ease;
}

.preview-container :deep(a) {
  text-decoration: none;
  transition: all 0.2s ease;
}

.preview-container :deep(a):hover {
  opacity: 0.8;
}

.preview-container :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 15px 0;
  transition: all 0.3s ease;
}

.preview-container :deep(pre) {
  overflow-x: auto;
  transition: all 0.3s ease;
}

/* 移动端代码块优化 */
@media (max-width: 640px) {
  .preview-container :deep(pre) {
    padding: 12px !important;
    font-size: 12px !important;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .preview-container :deep(code) {
    font-size: 12px !important;
  }
}

.preview-container :deep(code) {
  font-family: Consolas, Monaco, monospace;
  transition: all 0.3s ease;
}

.preview-container :deep(blockquote) {
  transition: all 0.3s ease;
}

.preview-container :deep(hr) {
  transition: all 0.3s ease;
}

.toc-item {
  font-size: 13px;
  padding: 4px 0;
  transition: all 0.2s;
}

.toc-item:hover {
  transform: translateX(4px);
}

/* 移动端目录优化 */
@media (max-width: 640px) {
  .toc-item {
    font-size: 12px;
    padding: 6px 0;
  }
}

/* 移动端编辑器高度优化 */
@media (max-width: 1024px) {
  .markdown-editor-textarea {
    min-height: 400px !important;
  }
}

/* 保存提示动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
