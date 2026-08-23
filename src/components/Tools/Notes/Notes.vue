<script setup lang="ts">
import { reactive, ref, onMounted, computed, nextTick } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Refresh from '~icons/ep/refresh'
import Plus from '~icons/ep/plus'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
import View from '~icons/ep/view'
import Document from '~icons/ep/document'
import CopyDocument from '~icons/ep/copyDocument'
// Markdown 渲染（详情页 + 编辑器实时预览共用同一份实例）
import MarkdownIt from 'markdown-it'
import 'highlight.js/styles/github.css'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})

// 列表卡片用：把 Markdown 语法剥离成可读纯文本，避免在卡片里显示 #、* 等符号
const stripMarkdown = (text: string): string => {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, ' [图片] ')
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[*\-+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/---+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface Note {
  id: string
  title: string
  content: string
  createTime: string
  updateTime: string
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const info = reactive({
  title: "笔记备忘录",
})

const notes = ref<Note[]>([])
const currentNote = ref<Note | null>(null)
const isEditing = ref(false)
const showForm = ref(false)
const editingNoteId = ref<string | null>(null)

// 添加分页相关数据
const pagination = ref<Pagination>({
  total: 0,
  page: 1,
  pageSize: 12,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

const formData = reactive({
  title: '',
  content: ''
})

// 添加loading状态
const loading = ref(false)
const operationLoading = ref(false) // 用于表单操作的loading

// 获取笔记列表（支持分页）
const fetchNotes = async (page = 1, pageSize = 12) => {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/notes', {
      params: { page, pageSize }
    })
    if (response.status === 200) {
      const data = response.data
      notes.value = data.data || []
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取笔记列表失败:', error)
    ElMessage.error('获取笔记列表失败')
  } finally {
    loading.value = false
  }
}

// 分页变化处理
const handlePageChange = (page: number) => {
  fetchNotes(page, pagination.value.pageSize)
}

// 每页条数变化处理
const handleSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  fetchNotes(1, pageSize)
}

// 创建笔记
const createNote = async () => {
  if (!formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/notes', {
      title: formData.title.trim(),
      content: formData.content.trim()
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      // 刷新当前页
      await fetchNotes(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('创建失败')
    }
  } catch (error) {
    console.error('创建笔记失败:', error)
    ElMessage.error('创建失败')
  } finally {
    operationLoading.value = false
  }
}

// 修改更新笔记函数
const updateNote = async () => {
  if (!editingNoteId.value || !formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/notes/${editingNoteId.value}`, {
      title: formData.title.trim(),
      content: formData.content.trim()
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingNoteId.value = null
      resetForm()
      // 刷新当前页
      await fetchNotes(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('更新失败')
    }
  } catch (error) {
    console.error('更新笔记失败:', error)
    ElMessage.error('更新失败')
  } finally {
    operationLoading.value = false
  }
}

// 删除笔记
const deleteNote = async (note: Note) => {
  await ElMessageBox.confirm('确定要删除这条笔记吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  try {
    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/notes/${note.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      if (currentNote.value?.id === note.id) {
        currentNote.value = null
      }
      // 如果当前页没有数据且不是第一页，则跳转到上一页
      if (notes.value.length === 1 && pagination.value.page > 1) {
        await fetchNotes(pagination.value.page - 1, pagination.value.pageSize)
      } else {
        await fetchNotes(pagination.value.page, pagination.value.pageSize)
      }
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    console.error('删除笔记失败:', error)
    ElMessage.error('删除失败')
  } finally {
    operationLoading.value = false
  }
}

// 编辑笔记
const editNote = (note: Note) => {
  isEditing.value = true
  editingNoteId.value = note.id
  formData.title = note.title
  formData.content = note.content
  showForm.value = true
}

// 查看笔记
const viewNote = (note: Note) => {
  // 如果正在编辑，不执行查看逻辑
  if (isEditing.value) return
  
  currentNote.value = note
  showForm.value = false
}

// 新建笔记
const newNote = () => {
  currentNote.value = null
  isEditing.value = false
  resetForm()
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  formData.title = ''
  formData.content = ''
}

// 通用复制方法：复制任意文本到剪贴板（含降级方案）
const copyText = async (text: string, successMsg = '已复制到剪贴板') => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // 降级方案：使用 textarea + execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success(successMsg)
  } catch (error) {
    console.error('复制失败:', error)
    ElMessage.error('复制失败，请手动复制')
  }
}

// 复制笔记（标题 + 内容）
const copyNote = async (note: Note) => {
  const text = `${note.title}\n\n${note.content}`
  await copyText(text, '已复制标题与内容')
}

// 仅复制笔记内容（不含标题）
const copyNoteContent = async (note: Note) => {
  await copyText(note.content, '已复制内容')
}

// 格式化时间
const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 添加计算属性
const showNoteDetail = computed(() =>
  currentNote.value !== null &&
  !showForm.value &&
  !isEditing.value
)

// 详情页 Markdown 渲染结果
const renderedDetailContent = computed(() =>
  currentNote.value ? md.render(currentNote.value.content || '') : ''
)

// 编辑器实时预览：用同一份 markdown-it 实例渲染
const renderedFormPreview = computed(() => md.render(formData.content || ''))

// 工具栏：在 textarea 光标处插入 Markdown 语法
// 选中文字 → 把语法包在选区两端；未选中 → 用占位符插入新语法
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const insertAtCursor = (before: string, after = '', placeholder = '') => {
  const ta = textareaRef.value
  if (!ta) {
    formData.content += before + placeholder + after
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end) || placeholder
  const next =
    ta.value.substring(0, start) +
    before +
    selected +
    after +
    ta.value.substring(end)
  formData.content = next
  // 恢复光标：放在被插入内容之后（如果是占位符则选中占位符便于用户直接覆盖）
  nextTick(() => {
    ta.focus()
    const insertedLen = before.length + selected.length + after.length
    const cursorPos = start + insertedLen
    if (!ta.value.substring(start, end) && placeholder) {
      // 用户没选文本：选中占位符便于直接覆盖
      ta.setSelectionRange(start + before.length, start + before.length + placeholder.length)
    } else {
      ta.setSelectionRange(cursorPos, cursorPos)
    }
  })
}

// 在行首插入前缀（标题 #、引用 >、列表 - 1.）：自动换行保证从新行开始
const insertLinePrefix = (prefix: string, placeholder = '') => {
  const ta = textareaRef.value
  if (!ta) {
    formData.content = prefix + placeholder + '\n' + formData.content
    return
  }
  const start = ta.selectionStart
  const value = ta.value
  // 找到当前行的起始位置
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  // 当前行已有前缀则不重复加（避免 ## ## 这种）
  const currentLine = value.substring(lineStart)
  const used = currentLine.startsWith(prefix)
  const realPrefix = used ? '' : prefix
  const inserted = realPrefix + placeholder
  formData.content =
    value.substring(0, lineStart) +
    inserted +
    value.substring(lineStart)
  nextTick(() => {
    ta.focus()
    const selStart = lineStart + realPrefix.length
    const selEnd = selStart + placeholder.length
    ta.setSelectionRange(selStart, selEnd)
  })
}

const insertH1 = () => insertLinePrefix('# ', '一级标题')
const insertH2 = () => insertLinePrefix('## ', '二级标题')
const insertH3 = () => insertLinePrefix('### ', '三级标题')
const insertH4 = () => insertLinePrefix('#### ', '四级标题')
const insertBold = () => insertAtCursor('**', '**', '加粗文字')
const insertItalic = () => insertAtCursor('*', '*', '斜体文字')
const insertStrike = () => insertAtCursor('~~', '~~', '删除线')
const insertUnderline = () => insertAtCursor('<u>', '</u>', '下划线')
const insertInlineCode = () => insertAtCursor('`', '`', 'code')
const insertCodeBlock = () => insertAtCursor('\n```\n', '\n```\n', '// code')
const insertQuote = () => insertLinePrefix('> ', '引用文字')
const insertUl = () => insertLinePrefix('- ', '列表项')
const insertOl = () => insertLinePrefix('1. ', '列表项')
const insertHr = () => insertAtCursor('\n---\n', '', '')
const insertLink = () => insertAtCursor('[', '](https://)', '链接文字')
const insertImage = () => insertAtCursor('![', '](https://)', '图片描述')
const insertTable = () => {
  insertAtCursor(
    '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| ',
    ' | 内容 | 内容 |\n',
    '内容'
  )
}

onMounted(() => {
  fetchNotes()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="notes-container">
      <!-- 操作栏 -->
      <div class="header-section">
        <div class="header-left">
          <div class="icon-wrapper">
            <el-icon class="header-icon"><Document /></el-icon>
          </div>
          <div>
            <h3 class="header-title">我的笔记</h3>
            <p class="header-subtitle">共 {{ pagination.total }} 条笔记</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button 
            class="action-btn refresh-btn"
            @click="fetchNotes(pagination.page, pagination.pageSize)" 
            :icon="Refresh"
            :loading="loading"
            :disabled="loading"
            circle
          />
          <el-button 
            class="action-btn create-btn"
            type="primary" 
            @click="newNote" 
            :icon="Plus"
          >
            新建笔记
          </el-button>
        </div>
      </div>

      <!-- 笔记列表 -->
      <div v-loading="loading" class="notes-grid">
        <div v-if="notes.length === 0 && !loading" class="empty-state">
          <el-icon class="empty-icon"><Document /></el-icon>
          <h3 class="empty-title">暂无笔记</h3>
          <p class="empty-desc">开始创建你的第一条笔记吧</p>
          <el-button type="primary" @click="newNote" :icon="Plus">创建笔记</el-button>
        </div>
        
        <div
          v-for="note in notes"
          :key="note.id"
          class="note-card"
          :class="{ 'note-active': currentNote?.id === note.id }"
          @click="viewNote(note)"
        >
          <div class="note-header">
            <h4 class="note-title">{{ note.title }}</h4>
            <div class="note-actions">
              <el-button
                class="action-icon copy-icon"
                size="small"
                type="success"
                :icon="CopyDocument"
                @click.stop="copyNote(note)"
                circle
                plain
              />
              <el-button
                class="action-icon"
                size="small"
                :icon="View"
                @click.stop="viewNote(note)"
                circle
                plain
              />
              <el-button 
                class="action-icon edit-icon"
                size="small"
                type="primary"
                :icon="Edit"
                :loading="operationLoading"
                :disabled="operationLoading"
                @click.stop="editNote(note)"
                circle
                plain
              />
              <el-button 
                class="action-icon delete-icon"
                size="small"
                type="danger"
                :icon="Delete"
                :loading="operationLoading"
                :disabled="operationLoading"
                @click.stop="deleteNote(note)"
                circle
                plain
              />
            </div>
          </div>
          
          <div class="note-content">
            <p class="note-text">{{ stripMarkdown(note.content) }}</p>
          </div>
          
          <div class="note-footer">
            <div class="note-time">
              <span class="time-label">更新于</span>
              <span class="time-value">{{ formatTime(note.updateTime) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页组件 -->
      <div v-if="pagination.total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[6, 12, 24, 48]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
          class="custom-pagination"
        />
      </div>

      <!-- 笔记表单 -->
      <el-dialog
        v-model="showForm"
        :title="isEditing ? '编辑笔记' : '新建笔记'"
        width="95%"
        max-width="960px"
        class="note-dialog"
        @close="isEditing = false"
        destroy-on-close
      >
        <div class="form-container">
          <el-form :model="formData" label-position="top">
            <el-form-item label="笔记标题" required class="form-item">
              <el-input
                v-model="formData.title"
                placeholder="请输入笔记标题"
                size="large"
                class="title-input"
              />
            </el-form-item>
            <el-form-item label="笔记内容（支持 Markdown）" required class="form-item">
              <div class="content-editor">
                <div class="editor-split">
                  <div class="editor-pane editor-pane-input">
                    <div class="pane-label">Markdown 源码</div>
                    <div class="editor-toolbar">
                      <el-button-group class="toolbar-group">
                        <el-button size="small" plain @click="insertH1" title="一级标题">H1</el-button>
                        <el-button size="small" plain @click="insertH2" title="二级标题">H2</el-button>
                        <el-button size="small" plain @click="insertH3" title="三级标题">H3</el-button>
                        <el-button size="small" plain @click="insertH4" title="四级标题">H4</el-button>
                      </el-button-group>
                      <el-button-group class="toolbar-group">
                        <el-button size="small" plain @click="insertBold" title="加粗"><strong>B</strong></el-button>
                        <el-button size="small" plain @click="insertItalic" title="斜体"><em>I</em></el-button>
                        <el-button size="small" plain @click="insertStrike" title="删除线"><s>S</s></el-button>
                        <el-button size="small" plain @click="insertUnderline" title="下划线"><u>U</u></el-button>
                      </el-button-group>
                      <el-button-group class="toolbar-group">
                        <el-button size="small" plain @click="insertLink" title="链接">🔗 链接</el-button>
                        <el-button size="small" plain @click="insertImage" title="图片">🖼 图片</el-button>
                      </el-button-group>
                      <el-button-group class="toolbar-group">
                        <el-button size="small" plain @click="insertInlineCode" title="行内代码">`code`</el-button>
                        <el-button size="small" plain @click="insertCodeBlock" title="代码块">{ } 代码块</el-button>
                        <el-button size="small" plain @click="insertQuote" title="引用">❝ 引用</el-button>
                      </el-button-group>
                      <el-button-group class="toolbar-group">
                        <el-button size="small" plain @click="insertUl" title="无序列表">• 列表</el-button>
                        <el-button size="small" plain @click="insertOl" title="有序列表">1. 列表</el-button>
                        <el-button size="small" plain @click="insertHr" title="分割线">— 分割线</el-button>
                        <el-button size="small" plain @click="insertTable" title="表格">⊞ 表格</el-button>
                      </el-button-group>
                    </div>
                    <textarea
                      ref="textareaRef"
                      v-model="formData.content"
                      class="editor-textarea"
                      placeholder="在此输入 Markdown 内容…&#10;&#10;# 标题&#10;**加粗** *斜体*&#10;- 列表项&#10;&gt; 引用&#10;```js&#10;console.log('code')&#10;```"
                      spellcheck="false"
                    />
                  </div>
                  <div class="editor-pane editor-pane-preview">
                    <div class="pane-label">实时预览</div>
                    <div class="editor-preview markdown-body">
                      <div v-if="!formData.content" class="preview-empty-hint">
                        在左侧输入 Markdown 内容，右侧会实时渲染…<br />
                        示例：<code># 标题</code> <code>**加粗**</code> <code>- 列表</code> <code>&gt; 引用</code>
                      </div>
                      <div v-else v-html="renderedFormPreview"></div>
                    </div>
                  </div>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button 
              size="large"
              :disabled="operationLoading" 
              @click="showForm = false; isEditing = false"
            >
              取消
            </el-button>
            <el-button 
              type="primary" 
              size="large"
              :loading="operationLoading"
              :disabled="operationLoading"
              @click="isEditing ? updateNote() : createNote()"
            >
              {{ isEditing ? '保存修改' : '创建笔记' }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 笔记详情 -->
      <el-dialog
        v-model="showNoteDetail"
        title="笔记详情"
        width="90%"
        max-width="700px"
        class="detail-dialog"
        @close="currentNote = null"
        destroy-on-close
      >
        <div v-if="currentNote" class="detail-container">
          <div class="detail-header">
            <div class="detail-title-row">
              <h2 class="detail-title">{{ currentNote.title }}</h2>
              <div class="detail-copy-actions">
                <el-button
                  class="detail-copy-btn"
                  size="default"
                  type="success"
                  :icon="CopyDocument"
                  plain
                  @click="currentNote && copyNoteContent(currentNote)"
                >
                  复制内容
                </el-button>
                <el-button
                  class="detail-copy-btn"
                  size="default"
                  type="primary"
                  :icon="CopyDocument"
                  @click="currentNote && copyNote(currentNote)"
                >
                  复制全部
                </el-button>
              </div>
            </div>
            <div class="detail-meta">
              <span class="meta-item">
                <el-icon><Document /></el-icon>
                创建于 {{ formatTime(currentNote.createTime) }}
              </span>
              <span class="meta-item">
                <el-icon><Edit /></el-icon>
                更新于 {{ formatTime(currentNote.updateTime) }}
              </span>
            </div>
          </div>
          
          <div class="detail-content">
            <div class="content-wrapper">
              <div class="markdown-body" v-html="renderedDetailContent"></div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="currentNote = null">关闭</el-button>
            <el-button 
              type="primary" 
              size="large"
              :icon="Edit"
              @click="currentNote && editNote(currentNote)"
            >
              编辑笔记
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        在线笔记记录工具，支持 Markdown 格式：可使用标题、列表、引用、代码块、表格、加粗、斜体、链接等元素排版。数据安全存储在云端，随时记录想法、待办事项、学习笔记等，所见即所得编辑，实时同步。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 主容器样式 */
.notes-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24px;
  padding: 32px;
  min-height: 600px;
  position: relative;
  overflow: hidden;
}

.notes-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  z-index: 0;
}

.notes-container > * {
  position: relative;
  z-index: 1;
}

/* 头部样式 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 24px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-wrapper {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.header-icon {
  font-size: 28px;
  color: white;
}

.header-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-subtitle {
  font-size: 16px;
  color: #718096;
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-btn {
  border: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
}

.create-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  padding: 12px 24px;
  font-weight: 600;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

/* 笔记网格 */
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 80px 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.empty-icon {
  font-size: 64px;
  color: #cbd5e0;
  margin-bottom: 24px;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 12px 0;
}

.empty-desc {
  font-size: 16px;
  color: #718096;
  margin: 0 0 32px 0;
}

/* 笔记卡片 */
.note-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.note-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 20px 20px 0 0;
}

.note-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.note-active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.note-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
  flex: 1;
  line-height: 1.4;
  word-break: break-word;
}

.note-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: all 0.3s ease;
}

.note-card:hover .note-actions {
  opacity: 1;
}

.action-icon {
  width: 32px;
  height: 32px;
  border: none;
  transition: all 0.3s ease;
}

.action-icon:hover {
  transform: scale(1.1);
}

.edit-icon:hover {
  background: rgba(102, 126, 234, 0.1);
}

.delete-icon:hover {
  background: rgba(245, 101, 101, 0.1);
}

.copy-icon:hover {
  background: rgba(72, 187, 120, 0.1);
}

.note-content {
  margin-bottom: 16px;
}

.note-text {
  color: #4a5568;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.note-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.note-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.time-label {
  color: #a0aec0;
}

.time-value {
  color: #667eea;
  font-weight: 500;
}

/* 弹窗样式 */
:deep(.note-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.note-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 24px 32px;
  border-bottom: none;
}

:deep(.note-dialog .el-dialog__title) {
  font-size: 20px;
  font-weight: 600;
}

:deep(.note-dialog .el-dialog__body) {
  padding: 32px;
  background: #f8fafc;
}

.form-container {
  max-width: 100%;
}

.form-item {
  margin-bottom: 24px;
}

:deep(.form-item .el-form-item__label) {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

:deep(.title-input .el-input__wrapper) {
  border-radius: 12px;
  padding: 16px;
  font-size: 16px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
}

:deep(.title-input .el-input__wrapper:hover) {
  border-color: #667eea;
}

:deep(.title-input .el-input__wrapper.is-focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

:deep(.content-textarea .el-textarea__inner) {
  border-radius: 12px;
  padding: 16px;
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  font-family: inherit;
}

:deep(.content-textarea .el-textarea__inner:hover) {
  border-color: #667eea;
}

:deep(.content-textarea .el-textarea__inner:focus) {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Markdown 编辑器：左 textarea + 右实时预览，左右分栏 */
.content-editor {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e2e8f0;
  transition: border-color 0.3s ease;
}

.content-editor:hover,
.content-editor:focus-within {
  border-color: #667eea;
}

.editor-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 480px;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  min-height: 480px;
  min-width: 0;
}

.editor-pane-input {
  background: #fafbfc;
  border-right: 1px solid #e2e8f0;
}

.editor-pane-preview {
  background: #ffffff;
}

.pane-label {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.06);
  border-bottom: 1px solid #e2e8f0;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.editor-pane-preview .pane-label {
  background: rgba(118, 75, 162, 0.06);
  color: #764ba2;
}

/* Markdown 快捷插入工具栏 */
.editor-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-group {
  display: inline-flex !important;
}

/* 工具栏按钮：小巧、紧凑、悬停态用紫色提示 */
:deep(.editor-toolbar .el-button) {
  padding: 4px 10px !important;
  min-height: 28px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-color: rgba(102, 126, 234, 0.2) !important;
  color: #4a5568 !important;
  background: #ffffff !important;
  transition: all 0.2s ease !important;
}

:deep(.editor-toolbar .el-button:hover) {
  border-color: #667eea !important;
  color: #667eea !important;
  background: rgba(102, 126, 234, 0.06) !important;
  transform: translateY(-1px);
}

:deep(.editor-toolbar .el-button + .el-button) {
  margin-left: -1px !important;
}

:deep(.editor-toolbar .el-button:first-child) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

:deep(.editor-toolbar .el-button:last-child) {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

:deep(.editor-toolbar .toolbar-group + .toolbar-group .el-button:first-child) {
  border-top-left-radius: 6px !important;
  border-bottom-left-radius: 6px !important;
}

.editor-textarea {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 16px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #1a202c;
  background: transparent;
  box-sizing: border-box;
  min-height: 0;
}

.editor-textarea:focus {
  background: #ffffff;
}

.editor-preview {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.7;
  min-height: 0;
}

.editor-preview.is-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-empty-hint {
  color: #a0aec0;
  font-size: 13px;
  text-align: center;
  font-style: italic;
  line-height: 1.8;
}

.preview-empty-hint code {
  background: rgba(102, 126, 234, 0.08);
  color: #667eea;
  padding: 1px 6px;
  border-radius: 4px;
  font-style: normal;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 24px 32px;
  background: #f8fafc;
}

/* 详情弹窗样式 */
:deep(.detail-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.detail-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 24px 32px;
}

:deep(.detail-dialog .el-dialog__body) {
  padding: 0;
  background: #f8fafc;
}

.detail-container {
  min-height: 400px;
}

.detail-header {
  padding: 32px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.detail-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 16px 0;
  line-height: 1.3;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.detail-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-title-row .detail-title {
  margin: 0;
  flex: 1;
}

.detail-copy-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.detail-copy-btn {
  font-weight: 500;
  transition: transform 0.3s ease;
}

.detail-copy-btn:hover {
  transform: translateY(-2px);
}

.detail-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #718096;
}

.meta-item .el-icon {
  color: #667eea;
}

.detail-content {
  padding: 32px;
}

.content-wrapper {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

/* Markdown 详情渲染样式（基于 markdown-it 输出 + github.css 代码高亮） */
.markdown-body {
  color: #2d3748;
  font-size: 15px;
  line-height: 1.7;
  word-break: break-word;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1em 0 0.6em;
  font-weight: 700;
  line-height: 1.3;
  color: #1a202c;
}

.markdown-body :deep(h1) { font-size: 1.8em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
.markdown-body :deep(h2) { font-size: 1.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
.markdown-body :deep(h3) { font-size: 1.25em; }
.markdown-body :deep(h4) { font-size: 1.1em; }
.markdown-body :deep(h5) { font-size: 1em; }
.markdown-body :deep(h6) { font-size: 0.9em; color: #4a5568; }

.markdown-body :deep(p) {
  margin: 0.6em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.8em;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
}

.markdown-body :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.4em 1em;
  border-left: 4px solid #667eea;
  background: #f7fafc;
  color: #4a5568;
  border-radius: 0 6px 6px 0;
}

.markdown-body :deep(blockquote > :first-child) { margin-top: 0; }
.markdown-body :deep(blockquote > :last-child) { margin-bottom: 0; }

.markdown-body :deep(code) {
  background-color: #f3f4f6;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  color: #db2777;
}

.markdown-body :deep(pre) {
  background-color: #f6f8fa;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.8em 0;
  border: 1px solid #e2e8f0;
  line-height: 1.5;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
  font-size: 0.875em;
}

.markdown-body :deep(a) {
  color: #667eea;
  text-decoration: none;
  border-bottom: 1px solid rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
}

.markdown-body :deep(a:hover) {
  color: #5a67d8;
  border-bottom-color: #5a67d8;
}

.markdown-body :deep(strong) {
  font-weight: 700;
  color: #1a202c;
}

.markdown-body :deep(em) {
  font-style: italic;
}

.markdown-body :deep(del) {
  color: #a0aec0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.8em 0;
  font-size: 0.95em;
  overflow: auto;
  display: block;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  background-color: #f7fafc;
  font-weight: 600;
}

.markdown-body :deep(tr:nth-child(even)) {
  background-color: #fafbfc;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 1.5em 0;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 0.5em 0;
}

/* 分页组件样式 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

:deep(.custom-pagination) {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: #667eea;
  --el-pagination-border-radius: 12px;
}

:deep(.custom-pagination .el-pagination__total) {
  color: #718096;
  font-weight: 500;
}

:deep(.custom-pagination .el-pager li) {
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid transparent;
  border-radius: 8px;
  margin: 0 4px;
  transition: all 0.3s ease;
}

:deep(.custom-pagination .el-pager li:hover) {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

:deep(.custom-pagination .el-pager li.is-active) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: transparent;
}

:deep(.custom-pagination .btn-prev),
:deep(.custom-pagination .btn-next) {
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid transparent;
  border-radius: 8px;
  color: #667eea;
  transition: all 0.3s ease;
}

:deep(.custom-pagination .btn-prev:hover),
:deep(.custom-pagination .btn-next:hover) {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .notes-container {
    padding: 16px;
    border-radius: 16px;
  }
  
  .header-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    padding: 16px;
  }
  
  .header-left {
    justify-content: center;
    text-align: center;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .notes-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .note-card {
    padding: 16px;
  }
  
  .note-actions {
    opacity: 1;
  }
  
  :deep(.note-dialog .el-dialog__body),
  :deep(.detail-dialog .el-dialog__body) {
    padding: 16px;
  }
  
  :deep(.detail-dialog .el-dialog__header) {
    padding: 16px 20px;
  }
  
  :deep(.detail-dialog .el-dialog__title) {
    font-size: 18px;
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1.4;
  }
  
  .detail-header,
  .detail-content {
    padding: 16px;
  }
  
  .detail-title {
    font-size: 20px;
    line-height: 1.4;
    margin-bottom: 12px;
  }

  .detail-title-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .detail-copy-actions {
    width: 100%;
    justify-content: stretch;
  }

  .detail-copy-btn {
    flex: 1;
    min-width: 0;
  }

  .detail-meta {
    gap: 16px;
  }

  .meta-item {
    font-size: 13px;
  }

  /* 响应式：Markdown 编辑器在窄屏下改为上下排布 */
  .editor-split {
    grid-template-columns: 1fr;
  }

  .editor-pane {
    min-height: 220px;
  }

  .editor-pane-input {
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }

  .editor-toolbar {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: thin;
  }

  .editor-preview {
    max-height: 240px;
  }

  /* 响应式分页 */
  .pagination-wrapper {
    padding: 16px;
    margin-top: 16px;
  }

  :deep(.custom-pagination) {
    justify-content: center;
  }

  :deep(.custom-pagination .el-pagination__sizes),
  :deep(.custom-pagination .el-pagination__jump) {
    display: none;
  }
}
</style>

