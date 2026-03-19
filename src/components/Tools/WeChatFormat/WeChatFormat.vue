<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage, ElMessageBox, ElButton } from 'element-plus'
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

// 新增：导入主题配置和 composables
import { getThemeName, getThemeStyles, type ThemeStyles } from './themes'
import { useEditorHistory } from './composables/useEditorHistory'
import { useShortcuts, DEFAULT_SHORTCUTS } from './composables/useShortcuts'
import { useWordCount } from './composables/useWordCount'
import { useFullscreen } from './composables/useFullscreen'
import { exportToPDF, printPreview } from './utils/exportPDF'
import ThemeSelector from './components/ThemeSelector.vue'
import WordCountDisplay from './components/WordCountDisplay.vue'
import ShortcutsDialog from './components/ShortcutsDialog.vue'

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
// 草稿数据结构
type DraftStatus = 'unfinished' | 'completed'

interface Draft {
  id: string
  title: string
  content: string
  currentTheme: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  status: DraftStatus
  createdAt: number
  updatedAt: number
}


const info = reactive({
  title: "微信公众号文章排版",
  content: '',
  mode: 'markdown', // markdown | rich
  currentTheme: 'literary',
  showToc: true,
})

// 草稿列表相关状态
const draftList = ref<Draft[]>([])
const currentDraftId = ref<string>('')
const draftDrawerVisible = ref(false)
const editingDraftId = ref<string>('')
const editingDraftTitle = ref('')

// 初始内容
const INITIAL_CONTENT = `

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

`

// Markdown 内容
const markdownContent = ref(INITIAL_CONTENT)

// ========== 新增功能状态 ==========
// 导入状态（大文件导入优化）
const isImporting = ref(false)

// 快捷键对话框
const shortcutsDialogRef = ref<InstanceType<typeof ShortcutsDialog> | null>(null)

// 导入按钮引用
const importButtonRef = ref<InstanceType<typeof ElButton> | null>(null)

// 触发导入
const triggerImport = () => {
  const input = document.querySelector('.el-upload input') as HTMLInputElement
  input?.click()
}

// 使用历史记录（撤销/重做）
const history = useEditorHistory(markdownContent, { maxSize: 50 })

// 监听内容变化，保存历史状态（防抖）
let historySaveTimer: NodeJS.Timeout | null = null
watch(markdownContent, () => {
  if (historySaveTimer) {
    clearTimeout(historySaveTimer)
  }
  historySaveTimer = setTimeout(() => {
    history.pushState()
  }, 500) // 500ms 防抖
})

// 使用字数统计（已移至 WordCountDisplay 组件）
useWordCount(markdownContent)

// 使用全屏模式
const fullscreen = useFullscreen()
const fullscreenTarget = ref<HTMLElement | null>(null)

// 监听 fullscreenTarget 变化并绑定到 fullscreen composable
watch(fullscreenTarget, (el) => {
  if (el) {
    fullscreen.targetElement.value = el
  }
}, { immediate: true })

// ========== 主题配置（已移至 themes.ts）==========
// 使用时: import { themes, getThemeStyles } from './themes'

// 字体样式配置
const fontStyles = reactive({
  fontSize: 16, // px
  lineHeight: 1.8,
  letterSpacing: 0,
})

// 本地存储的key
const STORAGE_KEY = 'wechat_format_config'
const DRAFTS_STORAGE_KEY = 'wechat_format_drafts'
const CURRENT_DRAFT_ID_KEY = 'wechat_format_current_draft_id'

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
    // 保存到本地存储（原来的逻辑）
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveToStorage()
      // 如果有当前草稿，同时保存到草稿
      if (currentDraftId.value) {
        autoSaveToDraft()
      }
    }, 500)
  },
  { deep: true }
)

// 自动保存到当前草稿（静默保存，不显示消息）
const autoSaveToDraft = () => {
  if (!currentDraftId.value) return

  const draftIndex = draftList.value.findIndex(d => d.id === currentDraftId.value)
  if (draftIndex !== -1) {
    draftList.value[draftIndex] = {
      ...draftList.value[draftIndex],
      content: markdownContent.value,
      currentTheme: info.currentTheme,
      fontSize: fontStyles.fontSize,
      lineHeight: fontStyles.lineHeight,
      letterSpacing: fontStyles.letterSpacing,
      updatedAt: Date.now(),
    }
    // 只重新排序而不保存到本地存储（saveDraftsList会保存）
    draftList.value.sort((a, b) => b.updatedAt - a.updatedAt)
    saveDraftsList()
  }
}

// ========== 快捷键支持 ==========
useShortcuts([
  {
    key: DEFAULT_SHORTCUTS.SAVE.key,
    ctrl: DEFAULT_SHORTCUTS.SAVE.ctrl,
    callback: () => saveCurrentDraft(),
    description: DEFAULT_SHORTCUTS.SAVE.description,
  },
  {
    key: DEFAULT_SHORTCUTS.UNDO.key,
    ctrl: DEFAULT_SHORTCUTS.UNDO.ctrl,
    callback: () => {
      if (history.undo()) {
        ElMessage.success('已撤销')
      }
    },
    description: DEFAULT_SHORTCUTS.UNDO.description,
  },
  {
    key: DEFAULT_SHORTCUTS.REDO.key,
    ctrl: DEFAULT_SHORTCUTS.REDO.ctrl,
    callback: () => {
      if (history.redo()) {
        ElMessage.success('已重做')
      }
    },
    description: DEFAULT_SHORTCUTS.REDO.description,
  },
  {
    key: DEFAULT_SHORTCUTS.REDO_ALT.key,
    ctrl: DEFAULT_SHORTCUTS.REDO_ALT.ctrl,
    shift: DEFAULT_SHORTCUTS.REDO_ALT.shift,
    callback: () => {
      if (history.redo()) {
        ElMessage.success('已重做')
      }
    },
    description: DEFAULT_SHORTCUTS.REDO_ALT.description,
  },
  {
    key: DEFAULT_SHORTCUTS.BOLD.key,
    ctrl: DEFAULT_SHORTCUTS.BOLD.ctrl,
    callback: () => insertSyntax('**粗体文本**'),
    description: DEFAULT_SHORTCUTS.BOLD.description,
  },
  {
    key: DEFAULT_SHORTCUTS.ITALIC.key,
    ctrl: DEFAULT_SHORTCUTS.ITALIC.ctrl,
    callback: () => insertSyntax('*斜体文本*'),
    description: DEFAULT_SHORTCUTS.ITALIC.description,
  },
  {
    key: DEFAULT_SHORTCUTS.LINK.key,
    ctrl: DEFAULT_SHORTCUTS.LINK.ctrl,
    callback: () => insertSyntax('[链接文字](https://example.com)'),
    description: DEFAULT_SHORTCUTS.LINK.description,
  },
  {
    key: DEFAULT_SHORTCUTS.FULLSCREEN.key,
    callback: () => fullscreen.toggle(),
    description: DEFAULT_SHORTCUTS.FULLSCREEN.description,
  },
  {
    key: DEFAULT_SHORTCUTS.ESC.key,
    callback: () => {
      if (fullscreen.isFullscreen.value) {
        fullscreen.exit()
      }
    },
    description: DEFAULT_SHORTCUTS.ESC.description,
  },
  {
    key: '/',
    ctrl: true,
    shift: true,
    callback: () => shortcutsDialogRef.value?.open(),
    description: '显示快捷键',
  },
  {
    key: 'p',
    ctrl: true,
    callback: () => handleExportPDF(),
    description: '导出 PDF',
  },
])

// 组件挂载时加载配置
onMounted(() => {
  loadFromStorage()
  loadDraftsList()
  loadCurrentDraft()
})

// ========== 新增方法 ==========

// 撤销
const handleUndo = () => {
  if (history.undo()) {
    ElMessage.success('已撤销')
  } else {
    ElMessage.info('没有可撤销的操作')
  }
}

// 重做
const handleRedo = () => {
  if (history.redo()) {
    ElMessage.success('已重做')
  } else {
    ElMessage.info('没有可重做的操作')
  }
}

// 导出 PDF
const handleExportPDF = async () => {
  const title = currentDraftTitle.value || '未命名文档'
  await exportToPDF(previewContent.value, title)
}

// 打印预览（PDF 导出的备选方案）
const handlePrintPreview = () => {
  printPreview(previewContent.value)
}

// 当前草稿标题（用于显示）
const currentDraftTitle = computed(() => {
  if (!currentDraftId.value) return ''
  const draft = draftList.value.find(d => d.id === currentDraftId.value)
  return draft?.title || ''
})

// ============ 草稿管理 ============

// 加载草稿列表
const loadDraftsList = () => {
  try {
    const saved = localStorage.getItem(DRAFTS_STORAGE_KEY)
    if (saved) {
      draftList.value = JSON.parse(saved).map((draft: any) => ({
        ...draft,
        status: draft.status || 'unfinished',
      }))
      // 按更新时间倒序排列
      draftList.value.sort((a, b) => b.updatedAt - a.updatedAt)
    }
  } catch (e) {
    console.error('加载草稿列表失败:', e)
  }
}

// 保存草稿列表
const saveDraftsList = () => {
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(draftList.value))
  } catch (e) {
    console.error('保存草稿列表失败:', e)
  }
}

// 加载当前草稿
const loadCurrentDraft = () => {
  try {
    const savedDraftId = localStorage.getItem(CURRENT_DRAFT_ID_KEY)
    if (savedDraftId) {
      const draft = draftList.value.find(d => d.id === savedDraftId)
      if (draft) {
        loadDraft(draft)
      }
    }
  } catch (e) {
    console.error('加载当前草稿失败:', e)
  }
}

// 新建草稿
const createNewDraft = () => {
  const newDraft: Draft = {
    id: `draft_${Date.now()}`,
    title: `未命名草稿 ${draftList.value.length + 1}`,
    content: markdownContent.value,
    currentTheme: info.currentTheme,
    fontSize: fontStyles.fontSize,
    lineHeight: fontStyles.lineHeight,
    letterSpacing: fontStyles.letterSpacing,
    status: 'unfinished',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  draftList.value.unshift(newDraft)
  saveDraftsList()
  setCurrentDraft(newDraft.id)
  ElMessage.success('草稿已创建')
}

// 保存当前草稿
const saveCurrentDraft = () => {
  if (!currentDraftId.value) {
    // 如果没有当前草稿，自动创建一个
    createNewDraft()
    return
  }

  const draftIndex = draftList.value.findIndex(d => d.id === currentDraftId.value)
  if (draftIndex !== -1) {
    draftList.value[draftIndex] = {
      ...draftList.value[draftIndex],
      content: markdownContent.value,
      currentTheme: info.currentTheme,
      fontSize: fontStyles.fontSize,
      lineHeight: fontStyles.lineHeight,
      letterSpacing: fontStyles.letterSpacing,
      updatedAt: Date.now(),
    }
    // 重新排序
    draftList.value.sort((a, b) => b.updatedAt - a.updatedAt)
    saveDraftsList()
    ElMessage.success('草稿已保存')
  }
}

// 切换草稿状态（未完成 / 已完结）
const toggleDraftStatus = (draftId: string) => {
  const draftIndex = draftList.value.findIndex((d) => d.id === draftId)
  if (draftIndex !== -1) {
    const currentStatus = draftList.value[draftIndex].status
    draftList.value[draftIndex].status = currentStatus === 'completed' ? 'unfinished' : 'completed'
    saveDraftsList()
    ElMessage.success(`草稿状态已标记为：${draftList.value[draftIndex].status === 'completed' ? '已完结' : '未完成'}`)
  }
}

// 加载草稿内容
const loadDraft = (draft: Draft) => {
  markdownContent.value = draft.content
  info.currentTheme = draft.currentTheme
  fontStyles.fontSize = draft.fontSize
  fontStyles.lineHeight = draft.lineHeight
  fontStyles.letterSpacing = draft.letterSpacing
  setCurrentDraft(draft.id)
  draftDrawerVisible.value = false
  ElMessage.success(`已加载草稿：${draft.title}`)
}

// 设置当前草稿ID
const setCurrentDraft = (draftId: string) => {
  currentDraftId.value = draftId
  localStorage.setItem(CURRENT_DRAFT_ID_KEY, draftId)
}

// 删除草稿
const deleteDraft = (draftId: string) => {
  const index = draftList.value.findIndex(d => d.id === draftId)
  if (index !== -1) {
    const draft = draftList.value[index]
    draftList.value.splice(index, 1)
    saveDraftsList()

    // 如果删除的是当前草稿，清空当前草稿ID
    if (currentDraftId.value === draftId) {
      currentDraftId.value = ''
      localStorage.removeItem(CURRENT_DRAFT_ID_KEY)
    }

    ElMessage.success(`已删除草稿：${draft.title}`)
  }
}

// 开始编辑草稿标题
const startEditTitle = (draft: Draft) => {
  editingDraftId.value = draft.id
  editingDraftTitle.value = draft.title
}

// 确认编辑草稿标题
const confirmEditTitle = (draft: Draft) => {
  const draftIndex = draftList.value.findIndex(d => d.id === draft.id)
  if (draftIndex !== -1 && editingDraftTitle.value.trim()) {
    draftList.value[draftIndex].title = editingDraftTitle.value.trim()
    draftList.value[draftIndex].updatedAt = Date.now()
    saveDraftsList()
    ElMessage.success('标题已修改')
  }
  editingDraftId.value = ''
  editingDraftTitle.value = ''
}

// 取消编辑草稿标题
const cancelEditTitle = () => {
  editingDraftId.value = ''
  editingDraftTitle.value = ''
}

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 预览内容 (HTML)
const previewContent = computed(() => {
  const theme = getThemeStyles(info.currentTheme)
  return formatMarkdown(markdownContent.value, theme)
})

// 完整的预览 HTML（包含容器）
const previewHTML = computed(() => {
  const theme = getThemeStyles(info.currentTheme)
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

  // 只返回图片，不显示图片名称
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

// 还原到初始内容
const resetContent = () => {
  ElMessageBox.confirm(
    '还原将清空当前编辑的内容，恢复到初始示例内容，是否继续？',
    '确认还原',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    markdownContent.value = INITIAL_CONTENT
    ElMessage.success('已还原到初始内容')
  }).catch(() => {
    // 取消操作
  })
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

// 导入 Markdown 文件（带大文件优化）
const importMarkdown = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  // 文件大小限制（5MB）
  const MAX_FILE_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件过大（超过 5MB），请导入较小的文件`)
    return
  }

  // 显示 loading
  isImporting.value = true
  const loadingInstance = ElMessage.info({
    message: '正在导入...',
    duration: 0,
  })

  try {
    // 使用 Promise 包装 FileReader
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })

    // 分批处理大文件（避免 UI 阻塞）
    if (file.size > 1024 * 1024) { // 大于 1MB
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    markdownContent.value = content
    history.clear() // 清空历史记录

    loadingInstance.close()
    ElMessage.success(`已导入 Markdown 文件（${(file.size / 1024).toFixed(1)} KB）`)
  } catch (error) {
    loadingInstance.close()
    ElMessage.error('导入失败，请重试')
    console.error('导入错误:', error)
  } finally {
    isImporting.value = false
  }
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

    <!-- 全屏容器：包含操作栏 + 编辑区 + 预览区 -->
    <div
      ref="fullscreenTarget"
      :class="{ 'fullscreen-mode': fullscreen.isFullscreen.value }"
    >
      <!-- 顶部操作栏 -->
      <div class="p-3 sm:p-4 rounded-2xl bg-white mb-3 shadow-sm" :class="{ 'sticky top-0 z-50': !fullscreen.isFullscreen.value }">
      <div class="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 sm:gap-4">
        <!-- 主题选择 -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium shrink-0">主题:</span>
          <ThemeSelector v-model="info.currentTheme" class="flex-1" />
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
          <!-- 撤销/重做 -->
          <el-button
            class="w-full sm:w-auto"
            :disabled="!history.canUndo()"
            @click="handleUndo"
            title="撤销 (Ctrl+Z)"
          >
            ↩️
          </el-button>
          <el-button
            class="w-full sm:w-auto"
            :disabled="!history.canRedo()"
            @click="handleRedo"
            title="重做 (Ctrl+Y)"
          >
            ↪️
          </el-button>

          <!-- 主要操作 -->
          <el-button class="w-full sm:w-auto" @click="draftDrawerVisible = true">
            📁 草稿箱
          </el-button>
          <el-button class="w-full sm:w-auto" @click="saveCurrentDraft" title="保存草稿 (Ctrl+S)">
            💾 保存
          </el-button>

          <!-- 更多操作下拉菜单 -->
          <el-dropdown split-button type="primary" class="w-full sm:w-auto" @click="copyRichText">
            复制到公众号
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="copyHTML">复制 HTML</el-dropdown-item>
                <el-dropdown-item @click="handleExportPDF">导出 PDF (Ctrl+P)</el-dropdown-item>
                <el-dropdown-item @click="handlePrintPreview">打印预览</el-dropdown-item>
                <el-dropdown-item divided @click="shortcutsDialogRef?.open()">⌨️ 快捷键 (Ctrl+/)</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 工具按钮 -->
          <el-button
            class="w-full sm:w-auto"
            :type="fullscreen.isFullscreen.value ? 'primary' : 'default'"
            @click="fullscreen.toggle()"
            :title="fullscreen.isFullscreen.value ? '退出全屏 (Esc)' : '全屏模式 (F11)'"
          >
            {{ fullscreen.isFullscreen.value ? '⛶' : '⛶' }}
          </el-button>

          <el-dropdown>
            <el-button class="w-full sm:w-auto">
              更多
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <a href="https://mjj.today/" target="_blank" rel="noopener noreferrer" class="block w-full h-full">
                    🖼️ 图床
                  </a>
                </el-dropdown-item>
                <el-dropdown-item @click="triggerImport">
                  📥 导入 MD
                </el-dropdown-item>
                <el-dropdown-item @click="exportMarkdown">📤 导出 MD</el-dropdown-item>
                <el-dropdown-item divided @click="resetContent">🔄 还原</el-dropdown-item>
                <el-dropdown-item @click="clearContent" class="text-red-500">🗑️ 清空</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 字数统计 -->
      <WordCountDisplay
        :content="markdownContent"
        :draft-title="currentDraftTitle"
        :save-tip-visible="saveTipVisible"
      />

      <!-- 隐藏的文件输入 -->
      <el-upload
        :auto-upload="false"
        :on-change="importMarkdown"
        :show-file-list="false"
        style="display: none;"
      >
        <el-button ref="importButtonRef" class="hidden">导入</el-button>
      </el-upload>
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
    </div><!-- 关闭全屏容器 -->

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

    <!-- 草稿列表抽屉 -->
    <el-drawer
      v-model="draftDrawerVisible"
      title="草稿箱"
      direction="rtl"
      size="360px"
      :with-header="true"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-lg font-semibold">📁 草稿箱</span>
          <el-button
            type="primary"
            size="small"
            @click="createNewDraft"
            class="!ml-2"
          >
            + 新建草稿
          </el-button>
        </div>
      </template>

      <div v-if="draftList.length === 0" class="text-center text-gray-400 py-12">
        <p class="text-4xl mb-3">📝</p>
        <p>暂无草稿</p>
        <p class="text-xs mt-2">点击上方"新建草稿"创建第一个草稿</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="draft in draftList"
          :key="draft.id"
          class="group relative rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md"
          :class="currentDraftId === draft.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'"
          @click="loadDraft(draft)"
        >
          <!-- 编辑状态 -->
          <div v-if="editingDraftId === draft.id" class="p-3" @click.stop>
            <el-input
              v-model="editingDraftTitle"
              size="small"
              placeholder="请输入标题"
              @keyup.enter="confirmEditTitle(draft)"
              @keyup.esc="cancelEditTitle"
              class="mb-2"
            />
            <div class="flex gap-2">
              <el-button type="primary" size="small" @click="confirmEditTitle(draft)">确认</el-button>
              <el-button size="small" @click="cancelEditTitle">取消</el-button>
            </div>
          </div>

          <!-- 正常状态 -->
          <div v-else class="p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-800 truncate">{{ draft.title }}</h3>
                <p class="text-xs text-gray-400 mt-1 flex items-center flex-wrap gap-1.5">
                  <span>{{ formatTime(draft.updatedAt) }}</span>
                  <span class="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{{ getThemeName(draft.currentTheme) }}</span>
                  <span :class="draft.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'" class="px-1.5 py-0.5 rounded text-xs">
                    {{ draft.status === 'completed' ? '已完结' : '未完成' }}
                  </span>
                  <span v-if="draft.id === currentDraftId" class="text-blue-500">当前</span>
                </p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {{ draft.content.slice(0, 50) }}{{ draft.content.length > 50 ? '...' : '' }}
                </p>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex gap-2 mt-3 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <el-button
                size="small"
                text
                type="success"
                @click.stop="toggleDraftStatus(draft.id)"
                class="!text-xs"
              >
                {{ draft.status === 'completed' ? '标记为未完成' : '标记为已完结' }}
              </el-button>
              <el-button
                size="small"
                text
                type="primary"
                @click.stop="startEditTitle(draft)"
                class="!text-xs"
              >
                重命名
              </el-button>
              <el-button
                size="small"
                text
                type="danger"
                @click.stop="deleteDraft(draft.id)"
                class="!text-xs"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 快捷键对话框 -->
    <ShortcutsDialog ref="shortcutsDialogRef" />
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

/* 草稿列表样式 */
:deep(.el-drawer__header) {
  padding: 16px 20px;
  margin-bottom: 0;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.el-drawer__body) {
  padding: 16px;
}

/* 隐藏元素 */
.hidden {
  display: none !important;
}

/* ========== 全屏模式样式 ========== */
.fullscreen-mode {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 9999 !important;
  border-radius: 0 !important;
  padding: 16px !important;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 全屏模式下主要内容区占满剩余空间 */
.fullscreen-mode > div:nth-child(2) {
  flex: 1 !important;
  min-height: 0 !important;
}

.fullscreen-mode .el-input-number {
  width: 100px !important;
}

/* 隐藏外部元素 */
:deep(.fullscreen-mode) + * {
  display: none;
}
</style>
