<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Edit, Delete, View, Document } from '@element-plus/icons-vue'

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
            <p class="note-text">{{ note.content }}</p>
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
        width="90%"
        max-width="600px"
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
            <el-form-item label="笔记内容" required class="form-item">
              <el-input
                v-model="formData.content"
                type="textarea"
                :rows="12"
                placeholder="在这里记录你的想法..."
                class="content-textarea"
                resize="vertical"
              />
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
            <h2 class="detail-title">{{ currentNote.title }}</h2>
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
              <pre class="content-text">{{ currentNote.content }}</pre>
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
        在线笔记记录工具，支持创建、编辑、删除笔记，数据安全存储在云端。您可以随时记录想法、待办事项、学习笔记等，支持富文本编辑，数据实时同步。
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

.content-text {
  color: #2d3748;
  font-size: 15px;
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
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
  
  .detail-meta {
    gap: 16px;
  }
  
  .meta-item {
    font-size: 13px;
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

