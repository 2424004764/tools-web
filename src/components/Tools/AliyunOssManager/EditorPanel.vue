<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Close, Refresh, Document, View, DocumentCopy, Upload } from '@element-plus/icons-vue'
import type { OssConfig } from '@/api/oss'
import { ossStsProvider } from '@/api/oss'
import { OssClient, callWithOss, formatSize, guessContentType, isTextFile } from '@/utils/oss'

const props = defineProps<{ config: OssConfig }>()

// Tab 结构：每个 Tab 描述一个打开的 OSS 文件
interface EditorTab {
  id: string
  key: string  // OSS 对象 key
  name: string
  content: string
  originalContent: string
  loading: boolean
  saving: boolean
  dirty: boolean
  previewHtml?: string
  mime: string
}

const tabs = ref<EditorTab[]>([])
const activeTabId = ref<string | null>(null)
const showPreview = ref(true)
const iframeRef = ref<HTMLIFrameElement | null>(null)

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) || null)

const hasDirty = computed(() => tabs.value.some(t => t.dirty))

// 统一 OSS 调用：每次从 Provider 取最新 STS（快过期自动重签，403 强制重签后重试）
const ossCall = <T>(fn: (c: OssClient) => Promise<T>) =>
  callWithOss(props.config.id, ossStsProvider, fn)

const newTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// 打开一个文件到 Tab
const openFile = async (key: string) => {
  if (!key) return
  // 已打开则激活
  const existed = tabs.value.find(t => t.key === key)
  if (existed) {
    activeTabId.value = existed.id
    return
  }
  const name = key.split('/').filter(Boolean).pop() || key
  if (!isTextFile(name)) {
    ElMessage.warning(`暂不支持编辑 ${name.split('.').pop()} 文件，仅支持文本类型`)
    return
  }
  const tab: EditorTab = reactive({
    id: newTabId(),
    key,
    name,
    content: '',
    originalContent: '',
    loading: true,
    saving: false,
    dirty: false,
    mime: guessContentType(name)
  }) as any
  tabs.value.push(tab)
  activeTabId.value = tab.id

  try {
    const text = await ossCall(c => c.getObjectText(key))
    tab.content = text
    tab.originalContent = text
    tab.loading = false
    updatePreview(tab)
  } catch (e: any) {
    ElMessage.error(e.message || '打开文件失败')
    tab.loading = false
  }
}

const updatePreview = (tab: EditorTab) => {
  const ext = tab.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'html' || ext === 'htm') {
    tab.previewHtml = tab.content
  } else if (ext === 'md') {
    // 简易 Markdown -> HTML（仅标题、粗体、代码块）
    tab.previewHtml = simpleMarkdownToHtml(tab.content)
  } else if (ext === 'json') {
    try {
      const obj = JSON.parse(tab.content)
      tab.previewHtml = `<pre style="background:#f8fafc;padding:14px;border-radius:8px;font-size:13px;overflow:auto;">${
        escapeHtml(JSON.stringify(obj, null, 2))
      }</pre>`
    } catch {
      tab.previewHtml = `<pre style="color:#ef4444">JSON 解析失败：${escapeHtml(tab.content)}</pre>`
    }
  } else if (ext === 'css' || ext === 'js' || ext === 'ts') {
    tab.previewHtml = `<pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap;">${escapeHtml(tab.content)}</pre>`
  } else {
    tab.previewHtml = `<pre style="background:#f8fafc;padding:14px;border-radius:8px;font-size:13px;overflow:auto;white-space:pre-wrap;">${escapeHtml(tab.content)}</pre>`
  }
}

const escapeHtml = (s: string) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const simpleMarkdownToHtml = (md: string): string => {
  // 极简 MD 渲染（标题、列表、加粗、斜体、行内代码、代码块）
  const lines = md.split('\n')
  const out: string[] = []
  let inCode = false
  let codeBuffer: string[] = []

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      out.push(`<pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;font-size:12px;overflow:auto;"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
      codeBuffer = []
    }
  }

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuffer.push(raw)
      continue
    }
    let line = raw
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      out.push(`<h${level} style="margin:14px 0 8px">${formatInline(h[2])}</h${level}>`)
      continue
    }
    // 列表
    const li = line.match(/^[\-\*]\s+(.*)$/)
    if (li) {
      out.push(`<li>${formatInline(li[1])}</li>`)
      continue
    }
    if (line.trim() === '') {
      out.push('<br/>')
      continue
    }
    out.push(`<p>${formatInline(line)}</p>`)
  }
  flushCode()
  return `<div style="max-width:760px;margin:0 auto;padding:24px;line-height:1.7;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${
    out.join('\n')
  }</div>`
}

const formatInline = (s: string): string => {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:4px;">$1</code>')
}

// 监听当前 active tab 的 content 变化，更新预览
watch(() => activeTab.value?.content, (val) => {
  if (val != null && activeTab.value) {
    activeTab.value.dirty = val !== activeTab.value.originalContent
    updatePreview(activeTab.value)
  }
})

// Tab 切换时刷新预览 iframe
watch(activeTabId, () => {
  nextTick(() => {
    if (iframeRef.value && activeTab.value?.previewHtml != null) {
      const doc = iframeRef.value.contentDocument
      if (doc) {
        doc.open()
        doc.write(activeTab.value.previewHtml)
        doc.close()
      }
    }
  })
})

// 预览打开/关闭同步刷新
watch(showPreview, (v) => {
  if (v && iframeRef.value && activeTab.value?.previewHtml != null) {
    nextTick(() => {
      const doc = iframeRef.value!.contentDocument
      if (doc) {
        doc.open()
        doc.write(activeTab.value!.previewHtml!)
        doc.close()
      }
    })
  }
})

// 关闭 tab
const closeTab = async (tab: EditorTab) => {
  if (tab.dirty) {
    try {
      await ElMessageBox.confirm(`${tab.name} 有未保存的修改，确认关闭？`, '关闭文件', {
        type: 'warning',
        confirmButtonText: '关闭',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
  }
  tabs.value = tabs.value.filter(t => t.id !== tab.id)
  if (activeTabId.value === tab.id) {
    activeTabId.value = tabs.value[tabs.value.length - 1]?.id || null
  }
}

// 保存当前文件
const saveActive = async () => {
  if (!activeTab.value) return
  await saveTab(activeTab.value)
}

const saveTab = async (tab: EditorTab) => {
  if (!tab.dirty) return
  tab.saving = true
  try {
    const blob = new Blob([tab.content], { type: tab.mime })
    await ossCall(c => c.putObject(tab.key, blob, tab.mime))
    tab.originalContent = tab.content
    tab.dirty = false
    ElMessage.success(`${tab.name} 保存成功`)
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    tab.saving = false
  }
}

const saveAll = async () => {
  for (const tab of tabs.value) {
    if (tab.dirty) {
      // eslint-disable-next-line no-await-in-loop
      await saveTab(tab)
    }
  }
}

const reloadActive = async () => {
  if (!activeTab.value) return
  if (activeTab.value.dirty) {
    try {
      await ElMessageBox.confirm('重新加载将丢失当前修改，确认？', '重新加载', {
        type: 'warning',
        confirmButtonText: '重新加载',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
  }
  activeTab.value.loading = true
  try {
    const tab = activeTab.value
    const text = await ossCall(c => c.getObjectText(tab.key))
    tab.content = text
    tab.originalContent = text
    tab.dirty = false
    updatePreview(tab)
    ElMessage.success('已重新加载')
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    activeTab.value.loading = false
  }
}

// 切换配置时清空 Tab（不同 config 缓存独立，无需清空 STS Provider）
watch(() => props.config.id, () => {
  tabs.value = []
  activeTabId.value = null
})

// 暴露方法给父组件
defineExpose({
  openFile,
  hasDirty
})

// 离开页面前提醒
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (hasDirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
})

// 文件选择器：可打开 Bucket 中的文本文件
const showOpenDialog = ref(false)
const openDialogLoading = ref(false)
const openDialogPrefix = ref('')
const openDialogObjects = ref<{ name: string; key: string; size: number }[]>([])
const currentPrefix = ref('')

const openDialog = async () => {
  showOpenDialog.value = true
  openDialogPrefix.value = ''
  await loadOpenDialog('')
}

const loadOpenDialog = async (prefix: string) => {
  openDialogLoading.value = true
  try {
    const res = await ossCall(c => c.listObjects(prefix, '/'))
    openDialogObjects.value = [
      ...res.prefixes.map(p => ({ name: p.replace(prefix, '').replace(/\/$/, '') + '/', key: p, size: 0 })),
      ...res.objects.filter(o => isTextFile(o.name)).map(o => ({ name: o.name, key: o.key, size: o.size || 0 }))
    ]
    openDialogPrefix.value = prefix
  } catch (e: any) {
    ElMessage.error(e.message || '列举失败')
  } finally {
    openDialogLoading.value = false
  }
}

const enterOpenFolder = (prefix: string) => {
  loadOpenDialog(prefix)
}

const pickOpenFile = async (key: string, name: string) => {
  if (!isTextFile(name)) {
    ElMessage.warning('仅文本类文件可在编辑器中打开')
    return
  }
  showOpenDialog.value = false
  await openFile(key)
}

const newFile = async () => {
  let nameInput: string | null = null
  try {
    const res: any = await ElMessageBox.prompt('输入新文件名（包含路径，如：test.html）', '新建文件', {
      inputPattern: /^[\w\-./]+\.[a-zA-Z0-9]+$/,
      inputErrorMessage: '请输入合法的文件名（含扩展名）',
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    nameInput = res.value
  } catch {
    return
  }
  if (!nameInput) return
  const fullKey = currentPrefix.value + nameInput
  const tab: EditorTab = reactive({
    id: newTabId(),
    key: fullKey,
    name: nameInput.split('/').pop() || nameInput,
    content: '',
    originalContent: '',
    loading: false,
    saving: false,
    dirty: true,
    mime: guessContentType(nameInput)
  }) as any
  tabs.value.push(tab)
  activeTabId.value = tab.id
  updatePreview(tab)
  ElMessage.success('新文件已创建（编辑后点击保存即可上传到 OSS）')
}

// 跟踪当前 Tab 所在的 OSS 前缀
watch(activeTabId, (id) => {
  if (id && activeTab.value) {
    const k = activeTab.value.key
    const idx = k.lastIndexOf('/')
    currentPrefix.value = idx >= 0 ? k.substring(0, idx + 1) : ''
  }
})
</script>

<template>
  <div class="editor-panel">
    <!-- Tab 栏 -->
    <div class="tabs-bar">
      <div class="tabs-scroll">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: tab.id === activeTabId, dirty: tab.dirty }"
          @click="activeTabId = tab.id"
        >
          <el-icon class="tab-icon"><Document /></el-icon>
          <span class="tab-name" :title="tab.key">{{ tab.name }}</span>
          <span v-if="tab.dirty" class="dirty-dot" />
          <el-icon class="tab-close" @click.stop="closeTab(tab)"><Close /></el-icon>
        </div>
        <div v-if="tabs.length === 0" class="no-tabs">
          还没有打开的文件
        </div>
      </div>
      <div class="tabs-actions">
        <el-tooltip content="从 OSS 打开文件" placement="top">
          <el-button :icon="DocumentCopy" size="small" plain @click="openDialog" />
        </el-tooltip>
        <el-tooltip content="新建文件" placement="top">
          <el-button :icon="Plus" size="small" plain @click="newFile" />
        </el-tooltip>
        <el-tooltip content="保存当前" placement="top">
          <el-button
            :icon="Upload"
            size="small"
            type="primary"
            :disabled="!activeTab || !activeTab.dirty"
            :loading="activeTab?.saving"
            @click="saveActive"
          />
        </el-tooltip>
        <el-tooltip content="保存全部" placement="top">
          <el-button :icon="Upload" size="small" :disabled="!hasDirty" @click="saveAll">全部</el-button>
        </el-tooltip>
        <el-tooltip content="重新加载" placement="top">
          <el-button :icon="Refresh" size="small" plain :disabled="!activeTab" @click="reloadActive" />
        </el-tooltip>
        <el-tooltip :content="showPreview ? '隐藏预览' : '显示预览'" placement="top">
          <el-button :icon="View" size="small" :type="showPreview ? 'primary' : 'default'" @click="showPreview = !showPreview" />
        </el-tooltip>
      </div>
    </div>

    <!-- 编辑器 + 预览 -->
    <div v-if="activeTab" class="editor-area" :class="{ 'with-preview': showPreview }">
      <div class="editor-pane">
        <textarea
          v-model="activeTab.content"
          class="code-textarea"
          spellcheck="false"
          :placeholder="`编辑 ${activeTab.name}...`"
        />
      </div>
      <div v-if="showPreview" class="preview-pane">
        <div class="preview-header">
          <el-icon><View /></el-icon>
          <span>实时预览</span>
          <span class="preview-name">{{ activeTab.name }}</span>
        </div>
        <iframe ref="iframeRef" class="preview-iframe" sandbox="allow-scripts" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-editor">
      <el-empty description="从上方工具栏点击“打开文件”选择 OSS 中的文本文件，或点击“新建文件”创建一个">
        <template #image>
          <el-icon :size="80" color="#fdba74"><Document /></el-icon>
        </template>
      </el-empty>
    </div>

    <!-- 打开文件对话框 -->
    <el-dialog
      v-model="showOpenDialog"
      title="选择 OSS 文件"
      width="600px"
      class="open-dialog"
      destroy-on-close
    >
      <div v-loading="openDialogLoading">
        <div class="open-breadcrumb">
          <span class="bc-item" @click="loadOpenDialog('')">{{ props.config.bucket }}</span>
          <template v-for="(part, i) in openDialogPrefix.split('/').filter(Boolean)" :key="i">
            <span class="bc-sep">/</span>
            <span class="bc-item" @click="loadOpenDialog(openDialogPrefix.split('/').slice(0, i + 1).join('/') + '/')">
              {{ part }}
            </span>
          </template>
        </div>
        <div class="open-list">
          <div
            v-if="openDialogPrefix"
            class="open-row"
            @click="loadOpenDialog(openDialogPrefix.split('/').slice(0, -2).join('/') + '/')"
          >
            <el-icon><Document /></el-icon>
            <span>..</span>
          </div>
          <div
            v-for="item in openDialogObjects"
            :key="item.key"
            class="open-row"
            @click="item.name.endsWith('/') ? enterOpenFolder(item.key) : pickOpenFile(item.key, item.name)"
          >
            <el-icon v-if="item.name.endsWith('/')" class="folder"><Document /></el-icon>
            <el-icon v-else><Document /></el-icon>
            <span class="open-name">{{ item.name }}</span>
            <span v-if="!item.name.endsWith('/')" class="open-size">{{ formatSize(item.size) }}</span>
          </div>
          <div v-if="openDialogObjects.length === 0 && !openDialogLoading" class="open-empty">
            空目录
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.editor-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabs-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: #fffbeb;
  border: 1px solid #fdead5;
  border-radius: 10px;
  overflow: hidden;
}

.tabs-scroll {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 0 4px;
  min-height: 36px;
  align-items: center;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 10px;
  background: #fff;
  border: 1px solid #fdead5;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  position: relative;
}

.tab-item:hover {
  background: #fff7ed;
}

.tab-item.active {
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  color: #7c2d12;
  border-color: #f97316;
  font-weight: 500;
}

.tab-icon {
  font-size: 14px;
  color: #ea580c;
}

.tab-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f97316;
}

.tab-close {
  font-size: 12px;
  color: #b45309;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.tab-close:hover {
  background: #fed7aa;
  color: #7c2d12;
}

.no-tabs {
  color: #b45309;
  font-size: 12px;
  padding: 0 10px;
}

.tabs-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  padding: 0 6px;
  border-left: 1px solid #fdead5;
}

.editor-area {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-height: 500px;
}

.editor-area.with-preview {
  grid-template-columns: 1fr 1fr;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid #fdead5;
  border-radius: 10px;
  overflow: hidden;
  background: #0f172a;
}

.code-textarea {
  flex: 1;
  width: 100%;
  min-height: 500px;
  padding: 16px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e2e8f0;
  background: #0f172a;
  border: none;
  outline: none;
  resize: none;
  tab-size: 2;
}

.preview-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid #fdead5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #fffbeb;
  border-bottom: 1px solid #fdead5;
  color: #7c2d12;
  font-size: 13px;
  font-weight: 500;
}

.preview-name {
  margin-left: auto;
  font-size: 11px;
  color: #b45309;
  font-weight: 400;
}

.preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
  min-height: 480px;
}

.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  min-height: 500px;
  background: #fffbeb;
  border: 1.5px dashed #fdead5;
  border-radius: 12px;
}

/* 打开文件对话框 */
.open-breadcrumb {
  padding: 8px 12px;
  background: #fffbeb;
  border-radius: 8px;
  font-size: 13px;
  color: #7c2d12;
  margin-bottom: 10px;
}

.bc-item {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.bc-item:hover {
  background: #fed7aa;
}

.bc-sep {
  color: #fdba74;
  margin: 0 2px;
}

.open-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #fdead5;
  border-radius: 8px;
}

.open-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid #f8fafc;
}

.open-row:hover {
  background: #fffbeb;
}

.open-row .folder {
  color: #f59e0b;
}

.open-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.open-size {
  font-size: 11px;
  color: #94a3b8;
}

.open-empty {
  text-align: center;
  padding: 30px;
  color: #94a3b8;
  font-size: 13px;
}

@media (max-width: 900px) {
  .editor-area.with-preview {
    grid-template-columns: 1fr;
  }
  .tabs-actions :deep(.el-button) {
    padding: 4px 8px;
  }
}
</style>