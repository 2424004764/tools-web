<script setup lang="ts">
import { reactive, ref, onMounted, computed, nextTick, watch } from 'vue'
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
import CopyDocument from '~icons/ep/copy-document'
import MoreFilled from '~icons/ep/more-filled'
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
  groupId: string | null
  createTime: string
  updateTime: string
}

interface NoteGroup {
  id: string
  uid?: string
  name: string
  color: string
  sortOrder?: number
  count?: number
  createTime?: string
  updateTime?: string
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
  title: '笔记备忘录',
})

const notes = ref<Note[]>([])
const currentNote = ref<Note | null>(null)
const isEditing = ref(false)
const showForm = ref(false)
const editingNoteId = ref<string | null>(null)

// ===== 分组相关状态 =====
const groups = ref<NoteGroup[]>([])
const ungroupedCount = ref(0)
const selectedGroup = ref<string>('all') // 'all' | 'ungrouped' | 具体 group id
const showGroupDialog = ref(false)
const groupDialogMode = ref<'add' | 'edit'>('add')
const editingGroupId = ref<string | null>(null)
const groupLoading = ref(false)
const groupForm = reactive({
  name: '',
  color: '#667eea',
  sortOrder: 0,
})

// 调色板：分组 dialog 里给用户快速选色（不要让用户敲 hex）
const colorPalette = [
  '#667eea', // 默认紫
  '#5a67d8', // 靛蓝
  '#4299e1', // 天蓝
  '#38b2ac', // 青绿
  '#48bb78', // 绿
  '#ecc94b', // 黄
  '#ed8936', // 橙
  '#f56565', // 红
  '#ed64a6', // 粉
  '#a0aec0', // 灰
]

// 分页相关数据
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
  content: '',
  groupId: null as string | null,
})

// loading 状态
const loading = ref(false)
const operationLoading = ref(false)

// ===== 计算属性 =====

// 当前分组对象（用于卡片显示分组色）
function getGroupById(groupId: string | null | undefined): NoteGroup | undefined {
  if (!groupId) return undefined
  return groups.value.find(g => g.id === groupId)
}

// 总笔记数（来自分组聚合）
const totalNotesCount = computed(() => {
  const groupedTotal = groups.value.reduce((sum, g) => sum + (g.count || 0), 0)
  return groupedTotal + ungroupedCount.value
})

// 当前分组名称（用于头部副标题）
const currentGroupTitle = computed(() => {
  if (selectedGroup.value === 'all') return '全部笔记'
  if (selectedGroup.value === 'ungrouped') return '未分组'
  const g = getGroupById(selectedGroup.value)
  return g?.name || '全部笔记'
})

// ===== 分组 API =====

async function fetchGroups() {
  try {
    groupLoading.value = true
    const response = await functionsRequest.get('/api/notes/groups')
    if (response.status === 200) {
      const data = response.data?.data || response.data
      groups.value = data?.groups || []
      ungroupedCount.value = data?.ungroupedCount || 0
    }
  } catch (error) {
    console.error('获取分组列表失败:', error)
    ElMessage.error('获取分组列表失败')
  } finally {
    groupLoading.value = false
  }
}

function openAddGroupDialog() {
  groupDialogMode.value = 'add'
  editingGroupId.value = null
  groupForm.name = ''
  groupForm.color = '#667eea'
  groupForm.sortOrder = groups.value.length
  showGroupDialog.value = true
}

function openEditGroupDialog(group: NoteGroup) {
  groupDialogMode.value = 'edit'
  editingGroupId.value = group.id
  groupForm.name = group.name
  groupForm.color = group.color
  groupForm.sortOrder = group.sortOrder ?? 0
  showGroupDialog.value = true
}

async function submitGroupForm() {
  if (!groupForm.name.trim()) {
    ElMessage.warning('请输入分组名称')
    return
  }
  try {
    operationLoading.value = true
    const payload = {
      name: groupForm.name.trim(),
      color: groupForm.color,
      sortOrder: groupForm.sortOrder,
    }
    if (groupDialogMode.value === 'add') {
      const response = await functionsRequest.post('/api/notes/groups', payload)
      if (response.status === 201) {
        ElMessage.success('分组创建成功')
        showGroupDialog.value = false
        await fetchGroups()
      } else {
        ElMessage.error('分组创建失败')
      }
    } else {
      if (!editingGroupId.value) return
      const response = await functionsRequest.put(`/api/notes/groups/${editingGroupId.value}`, payload)
      if (response.status === 200) {
        ElMessage.success('分组更新成功')
        showGroupDialog.value = false
        await fetchGroups()
        // 刷新当前笔记列表（分组名变了不影响数据，但保持一致性）
        await fetchNotes(pagination.value.page, pagination.value.pageSize)
      } else {
        ElMessage.error('分组更新失败')
      }
    }
  } catch (error) {
    console.error('分组操作失败:', error)
    ElMessage.error('操作失败')
  } finally {
    operationLoading.value = false
  }
}

async function deleteGroup(group: NoteGroup) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分组「${group.name}」吗？该分组下的笔记会移到「未分组」。`,
      '删除分组',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return // 用户取消
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/notes/groups/${group.id}`)
    if (response.status === 200) {
      ElMessage.success('分组删除成功')
      // 如果当前选中的就是这个分组，切到全部
      if (selectedGroup.value === group.id) {
        selectedGroup.value = 'all'
      }
      await fetchGroups()
      await fetchNotes(1, pagination.value.pageSize)
    } else {
      const msg = response.data?.error || '分组删除失败'
      ElMessage.error(msg)
    }
  } catch (error: any) {
    console.error('分组删除失败:', error)
    const msg = error?.response?.data?.error || '分组删除失败'
    ElMessage.error(msg)
  } finally {
    operationLoading.value = false
  }
}

// ===== 笔记 API =====

// 获取笔记列表（支持分页 + 分组过滤）
async function fetchNotes(page = 1, pageSize = 12) {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/notes', {
      params: {
        page,
        pageSize,
        groupId: selectedGroup.value,
      }
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

// 分组切换处理
async function handleGroupChange(groupId: string) {
  selectedGroup.value = groupId
  pagination.value.page = 1
  await fetchNotes(1, pagination.value.pageSize)
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
async function createNote() {
  if (!formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/notes', {
      title: formData.title.trim(),
      content: formData.content.trim(),
      groupId: formData.groupId || null,
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      // 刷新分组计数和笔记
      await fetchGroups()
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
async function updateNote() {
  if (!editingNoteId.value || !formData.title.trim() || !formData.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/notes/${editingNoteId.value}`, {
      title: formData.title.trim(),
      content: formData.content.trim(),
      groupId: formData.groupId,
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingNoteId.value = null
      resetForm()
      await fetchGroups()
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
async function deleteNote(note: Note) {
  try {
    await ElMessageBox.confirm('确定要删除这条笔记吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/notes/${note.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      if (currentNote.value?.id === note.id) {
        currentNote.value = null
      }
      await fetchGroups()
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
function editNote(note: Note) {
  isEditing.value = true
  editingNoteId.value = note.id
  formData.title = note.title
  formData.content = note.content
  formData.groupId = note.groupId
  showForm.value = true
}

// 查看笔记
function viewNote(note: Note) {
  // 如果正在编辑，不执行查看逻辑
  if (isEditing.value) return

  currentNote.value = note
  showForm.value = false
}

// 新建笔记
function newNote() {
  currentNote.value = null
  isEditing.value = false
  resetForm()
  // 默认归到当前选中的分组（'all' 时归第一个分组）
  if (selectedGroup.value === 'all') {
    formData.groupId = groups.value[0]?.id || null
  } else if (selectedGroup.value === 'ungrouped') {
    formData.groupId = null
  } else {
    formData.groupId = selectedGroup.value
  }
  showForm.value = true
}

// 重置表单
function resetForm() {
  formData.title = ''
  formData.content = ''
  formData.groupId = null
}

// 通用复制方法：复制任意文本到剪贴板（含降级方案）
async function copyText(text: string, successMsg = '已复制到剪贴板') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
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
async function copyNote(note: Note) {
  const text = `${note.title}\n\n${note.content}`
  await copyText(text, '已复制标题与内容')
}

// 仅复制笔记内容（不含标题）
async function copyNoteContent(note: Note) {
  await copyText(note.content, '已复制内容')
}

// 格式化时间
const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 计算属性
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
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function insertAtCursor(before: string, after = '', placeholder = '') {
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
  nextTick(() => {
    ta.focus()
    const insertedLen = before.length + selected.length + after.length
    const cursorPos = start + insertedLen
    if (!ta.value.substring(start, end) && placeholder) {
      ta.setSelectionRange(start + before.length, start + before.length + placeholder.length)
    } else {
      ta.setSelectionRange(cursorPos, cursorPos)
    }
  })
}

// 在行首插入前缀（标题 #、引用 >、列表 - 1.）：自动换行保证从新行开始
function insertLinePrefix(prefix: string, placeholder = '') {
  const ta = textareaRef.value
  if (!ta) {
    formData.content = prefix + placeholder + '\n' + formData.content
    return
  }
  const start = ta.selectionStart
  const value = ta.value
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
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

// 卡片顶部色条：根据笔记所在分组决定颜色（未分组则用灰色）
const groupColorOf = (note: Note): string => {
  const g = getGroupById(note.groupId)
  return g?.color || '#a0aec0'
}

// 详情页里也要显示分组
const detailGroup = computed(() =>
  currentNote.value ? getGroupById(currentNote.value.groupId) : null
)

// 监听 dialog 关闭时重置 groupDialogMode，避免下次打开状态错乱
watch(showGroupDialog, (val) => {
  if (!val) {
    groupDialogMode.value = 'add'
    editingGroupId.value = null
  }
})

onMounted(async () => {
  await fetchGroups()
  await fetchNotes()
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
            <h3 class="header-title">{{ currentGroupTitle }}</h3>
            <p class="header-subtitle">
              共 {{ pagination.total }} 条笔记
              <span v-if="selectedGroup !== 'all'" class="filter-tag">
                · 已筛选自全部 {{ totalNotesCount }} 条
              </span>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <!-- 移动端：分组下拉 -->
          <el-select
            v-if="groups.length > 0 || ungroupedCount > 0"
            class="mobile-group-select"
            :model-value="selectedGroup"
            @change="handleGroupChange"
            size="default"
          >
            <el-option label="全部" value="all" />
            <el-option
              v-for="g in groups"
              :key="g.id"
              :label="`${g.name} (${g.count || 0})`"
              :value="g.id"
            />
            <el-option
              v-if="ungroupedCount > 0"
              :label="`未分组 (${ungroupedCount})`"
              value="ungrouped"
            />
          </el-select>
          <el-button
            class="action-btn refresh-btn"
            @click="async () => { await fetchGroups(); await fetchNotes(pagination.page, pagination.pageSize) }"
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

      <!-- 主体：左侧分组侧边栏 + 右侧笔记列表 -->
      <div class="notes-layout">
        <!-- 分组侧边栏（桌面端） -->
        <aside class="groups-sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">分组</span>
            <el-button
              :icon="Plus"
              size="small"
              circle
              plain
              @click="openAddGroupDialog"
              title="新建分组"
            />
          </div>

          <!-- 全部 -->
          <div
            class="group-item"
            :class="{ 'is-active': selectedGroup === 'all' }"
            @click="handleGroupChange('all')"
          >
            <span class="group-color group-color-all" />
            <span class="group-name">全部</span>
            <span class="group-count">{{ totalNotesCount }}</span>
          </div>

          <!-- 未分组（仅在有未分组笔记时显示） -->
          <div
            v-if="ungroupedCount > 0"
            class="group-item"
            :class="{ 'is-active': selectedGroup === 'ungrouped' }"
            @click="handleGroupChange('ungrouped')"
          >
            <span class="group-color group-color-none" />
            <span class="group-name">未分组</span>
            <span class="group-count">{{ ungroupedCount }}</span>
          </div>

          <!-- 分组列表 -->
          <div
            v-for="g in groups"
            :key="g.id"
            class="group-item"
            :class="{ 'is-active': selectedGroup === g.id }"
            @click="handleGroupChange(g.id)"
          >
            <span class="group-color" :style="{ background: g.color }" />
            <span class="group-name" :title="g.name">{{ g.name }}</span>
            <span class="group-count">{{ g.count || 0 }}</span>
            <el-dropdown trigger="click" @click.stop>
              <el-icon class="group-more"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-item @click="openEditGroupDialog(g)">
                  <el-icon><Edit /></el-icon> 编辑
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="g.name !== '默认'"
                  @click="deleteGroup(g)"
                  divided
                >
                  <el-icon><Delete /></el-icon> 删除
                </el-dropdown-item>
              </template>
            </el-dropdown>
          </div>

          <div v-if="groups.length === 0 && !groupLoading" class="sidebar-empty">
            暂无分组
          </div>
        </aside>

        <!-- 笔记列表 -->
        <div class="notes-main">
          <div v-loading="loading" class="notes-grid">
            <div v-if="notes.length === 0 && !loading" class="empty-state">
              <el-icon class="empty-icon"><Document /></el-icon>
              <h3 class="empty-title">
                {{ selectedGroup === 'all' ? '暂无笔记' : '该分组下暂无笔记' }}
              </h3>
              <p class="empty-desc">
                {{ selectedGroup === 'all' ? '开始创建你的第一条笔记吧' : '切换到「全部」查看所有笔记，或在这里新建一条' }}
              </p>
              <el-button type="primary" @click="newNote" :icon="Plus">创建笔记</el-button>
            </div>

            <div
              v-for="note in notes"
              :key="note.id"
              class="note-card"
              :class="{ 'note-active': currentNote?.id === note.id }"
              :style="{ '--group-color': groupColorOf(note) }"
              @click="viewNote(note)"
            >
              <div class="note-card-strip" />
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
        </div>
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
            <el-form-item label="所属分组" class="form-item">
              <el-select
                v-model="formData.groupId"
                placeholder="选择分组（不选则归入「默认」）"
                class="group-select"
                clearable
              >
                <el-option
                  v-for="g in groups"
                  :key="g.id"
                  :label="g.name"
                  :value="g.id"
                >
                  <span class="group-option-dot" :style="{ background: g.color }" />
                  {{ g.name }}
                  <span class="group-option-count">{{ g.count || 0 }}</span>
                </el-option>
                <el-option label="未分组" :value="null" />
              </el-select>
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

      <!-- 分组管理对话框 -->
      <el-dialog
        v-model="showGroupDialog"
        :title="groupDialogMode === 'add' ? '新建分组' : '编辑分组'"
        width="90%"
        max-width="480px"
        class="group-dialog"
        destroy-on-close
      >
        <el-form :model="groupForm" label-position="top">
          <el-form-item label="分组名称" required>
            <el-input
              v-model="groupForm.name"
              placeholder="例如：工作 / 学习 / 灵感"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="分组颜色">
            <div class="color-picker">
              <div
                v-for="c in colorPalette"
                :key="c"
                class="color-swatch"
                :class="{ 'is-active': groupForm.color === c }"
                :style="{ background: c }"
                @click="groupForm.color = c"
              />
              <el-color-picker v-model="groupForm.color" size="small" class="custom-color-picker" />
            </div>
          </el-form-item>
          <el-form-item label="排序值" v-if="groupDialogMode === 'edit'">
            <el-input-number
              v-model="groupForm.sortOrder"
              :min="0"
              :max="999"
              size="default"
            />
            <span class="form-hint">数字越小排序越靠前</span>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button :disabled="operationLoading" @click="showGroupDialog = false">取消</el-button>
            <el-button
              type="primary"
              :loading="operationLoading"
              :disabled="operationLoading"
              @click="submitGroupForm"
            >
              {{ groupDialogMode === 'add' ? '创建' : '保存' }}
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
              <span v-if="detailGroup" class="meta-item">
                <span class="meta-group-dot" :style="{ background: detailGroup.color }" />
                {{ detailGroup.name }}
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
        在线笔记记录工具，支持 Markdown 格式：可使用标题、列表、引用、代码块、表格、加粗、斜体、链接等元素排版。数据安全存储在云端，随时记录想法、待办事项、学习笔记等，所见即所得编辑，实时同步。可创建多个分组（工作 / 学习 / 灵感等）对笔记进行分类管理。
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
  margin-bottom: 24px;
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

.filter-tag {
  margin-left: 4px;
  font-size: 13px;
  color: #a0aec0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 移动端分组下拉：默认隐藏在桌面端 */
.mobile-group-select {
  display: none;
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

/* 主体两栏布局 */
.notes-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  align-items: start;
}

/* 分组侧边栏 */
.groups-sidebar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 8px;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #718096;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sidebar-empty {
  padding: 24px 8px;
  text-align: center;
  color: #a0aec0;
  font-size: 13px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #2d3748;
  margin-bottom: 2px;
  position: relative;
}

.group-item:hover {
  background: rgba(102, 126, 234, 0.06);
}

.group-item.is-active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
  color: #667eea;
  font-weight: 600;
}

.group-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.group-color-all {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.group-color-none {
  background: repeating-linear-gradient(
    45deg,
    #cbd5e0,
    #cbd5e0 2px,
    #e2e8f0 2px,
    #e2e8f0 4px
  );
}

.group-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-count {
  font-size: 12px;
  color: #a0aec0;
  background: rgba(160, 174, 192, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.group-item.is-active .group-count {
  background: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.group-more {
  font-size: 14px;
  color: #cbd5e0;
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.group-item:hover .group-more,
.group-item.is-active .group-more {
  opacity: 1;
}

.group-more:hover {
  color: #667eea;
}

/* 笔记主体区 */
.notes-main {
  min-width: 0;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

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
  padding-top: 20px; /* 让顶部色条更显眼 */
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.note-card-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--group-color, #667eea);
  border-radius: 20px 20px 0 0;
}

.note-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: var(--group-color, #667eea);
}

.note-active {
  border-color: var(--group-color, #667eea);
  background: rgba(255, 255, 255, 0.98);
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  margin-top: 4px;
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

.group-select {
  width: 100%;
}

:deep(.group-select .el-select__wrapper) {
  border-radius: 12px;
  padding: 8px 16px;
  border: 2px solid #e2e8f0;
}

.group-option-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}

.group-option-count {
  float: right;
  color: #a0aec0;
  font-size: 13px;
}

/* Markdown 编辑器：左 textarea + 右实时预览 */
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

/* 分组对话框 */
:deep(.group-dialog .el-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

:deep(.group-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 20px 24px;
  margin-right: 0;
}

:deep(.group-dialog .el-dialog__title) {
  color: white;
  font-weight: 600;
}

:deep(.group-dialog .el-dialog__body) {
  padding: 24px;
  background: #f8fafc;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.is-active {
  border-color: #1a202c;
  transform: scale(1.05);
}

.custom-color-picker {
  margin-left: 8px;
}

.form-hint {
  margin-left: 12px;
  color: #a0aec0;
  font-size: 13px;
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

.meta-group-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
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
@media (max-width: 900px) {
  /* 桌面端隐藏移动下拉 */
  .mobile-group-select {
    display: none !important;
  }

  /* < 900px：单列布局，侧栏显示 */
  .notes-layout {
    grid-template-columns: 200px 1fr;
    gap: 16px;
  }
}

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
    flex-wrap: wrap;
  }

  /* 移动端：显示下拉、隐藏侧栏 */
  .mobile-group-select {
    display: inline-block;
    width: 180px;
  }

  .notes-layout {
    grid-template-columns: 1fr;
  }

  .groups-sidebar {
    display: none;
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