<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Edit, Delete, View, QuestionFilled, ChatDotRound, CopyDocument, Minus } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'
import { useRouter } from 'vue-router'

interface QAItem {
  id: string
  title: string
  question: string
  answer: string
  qaItems: Array<{
    question: string
    answer: string
  }>
  headerContent: string
  footerContent: string
  createTime: string
  updateTime: string
  isPublic: boolean
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
  title: "QA问答页面制作",
})

const userStore = useUserStore()
const router = useRouter()

const qaList = ref<QAItem[]>([])
const currentQA = ref<QAItem | null>(null)
const isEditing = ref(false)
const showForm = ref(false)
const editingQAId = ref<string | null>(null)
const showPreview = ref(false)

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
  qaItems: [
    { question: '', answer: '' }
  ],
  headerContent: '',
  footerContent: '',
  isPublic: false
})

// 添加loading状态
const loading = ref(false)
const operationLoading = ref(false)

// 检查登录状态
onMounted(() => {
  if (!userStore.getLoginStatus) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  fetchQAList()
})

// 获取QA列表（支持分页）
const fetchQAList = async (page = 1, pageSize = 12) => {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/qa', {
      params: { page, pageSize }
    })
    if (response.status === 200) {
      const data = response.data
      qaList.value = data.data || []
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取QA列表失败:', error)
    ElMessage.error('获取QA列表失败')
  } finally {
    loading.value = false
  }
}

// 分页变化处理
const handlePageChange = (page: number) => {
  fetchQAList(page, pagination.value.pageSize)
}

// 每页条数变化处理
const handleSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  fetchQAList(1, pageSize)
}

// 添加问答对
const addQAItem = () => {
  formData.qaItems.push({ question: '', answer: '' })
}

// 删除问答对
const removeQAItem = (index: number) => {
  if (formData.qaItems.length > 1) {
    formData.qaItems.splice(index, 1)
  } else {
    ElMessage.warning('至少需要保留一个问答对')
  }
}

// 创建QA
const createQA = async () => {
  if (!formData.title.trim() || formData.qaItems.length === 0) {
    ElMessage.warning('标题和问答对不能为空')
    return
  }

  // 验证问答对
  for (let i = 0; i < formData.qaItems.length; i++) {
    const item = formData.qaItems[i]
    if (!item.question.trim() || !item.answer.trim()) {
      ElMessage.warning(`第${i + 1}个问答对的问题和答案不能为空`)
      return
    }
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/qa', {
      title: formData.title.trim(),
      qaItems: formData.qaItems.map(item => ({
        question: item.question.trim(),
        answer: item.answer.trim()
      })),
      headerContent: formData.headerContent.trim(),
      footerContent: formData.footerContent.trim(),
      isPublic: formData.isPublic
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      await fetchQAList(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('创建失败')
    }
  } catch (error) {
    console.error('创建QA失败:', error)
    ElMessage.error('创建失败')
  } finally {
    operationLoading.value = false
  }
}

// 更新QA
const updateQA = async () => {
  if (!editingQAId.value || !formData.title.trim() || formData.qaItems.length === 0) {
    ElMessage.warning('标题和问答对不能为空')
    return
  }

  // 验证问答对
  for (let i = 0; i < formData.qaItems.length; i++) {
    const item = formData.qaItems[i]
    if (!item.question.trim() || !item.answer.trim()) {
      ElMessage.warning(`第${i + 1}个问答对的问题和答案不能为空`)
      return
    }
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/qa/${editingQAId.value}`, {
      title: formData.title.trim(),
      qaItems: formData.qaItems.map(item => ({
        question: item.question.trim(),
        answer: item.answer.trim()
      })),
      headerContent: formData.headerContent.trim(),
      footerContent: formData.footerContent.trim(),
      isPublic: formData.isPublic
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingQAId.value = null
      resetForm()
      await fetchQAList(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('更新失败')
    }
  } catch (error) {
    console.error('更新QA失败:', error)
    ElMessage.error('更新失败')
  } finally {
    operationLoading.value = false
  }
}

// 删除QA
const deleteQA = async (qa: QAItem) => {
  await ElMessageBox.confirm('确定要删除这个QA吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  try {
    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/qa/${qa.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      if (currentQA.value?.id === qa.id) {
        currentQA.value = null
      }
      if (qaList.value.length === 1 && pagination.value.page > 1) {
        await fetchQAList(pagination.value.page - 1, pagination.value.pageSize)
      } else {
        await fetchQAList(pagination.value.page, pagination.value.pageSize)
      }
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    console.error('删除QA失败:', error)
    ElMessage.error('删除失败')
  } finally {
    operationLoading.value = false
  }
}

// 编辑QA
const editQA = (qa: QAItem) => {
  isEditing.value = true
  editingQAId.value = qa.id
  formData.title = qa.title
  formData.qaItems = qa.qaItems && qa.qaItems.length > 0 ? [...qa.qaItems] : [{ question: '', answer: '' }]
  formData.headerContent = qa.headerContent
  formData.footerContent = qa.footerContent
  formData.isPublic = qa.isPublic
  showForm.value = true
}

// 查看QA
const viewQA = (qa: QAItem) => {
  if (isEditing.value) return
  currentQA.value = qa
  showForm.value = false
}

// 预览QA页面
const previewQA = (qa: QAItem) => {
  currentQA.value = qa
  showPreview.value = true
}

// 新建QA
const newQA = () => {
  currentQA.value = null
  isEditing.value = false
  resetForm()
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  formData.title = ''
  formData.qaItems = [{ question: '', answer: '' }]
  formData.headerContent = ''
  formData.footerContent = ''
  formData.isPublic = false
}

// 格式化时间
const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 复制QA链接
const copyQALink = async (qa: QAItem) => {
  try {
    const link = `${window.location.origin}/qa-view/${qa.id}`
    await navigator.clipboard.writeText(link)
    ElMessage.success('链接已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 添加计算属性
const showQADetail = computed(() => 
  currentQA.value !== null && 
  !showForm.value && 
  !isEditing.value &&
  !showPreview.value
)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="qa-container">
      <!-- 操作栏 -->
      <div class="header-section">
        <div class="header-left">
          <div class="icon-wrapper">
            <el-icon class="header-icon"><QuestionFilled /></el-icon>
          </div>
          <div>
            <h3 class="header-title">我的QA页面</h3>
            <p class="header-subtitle">共 {{ pagination.total }} 个QA页面</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button 
            class="action-btn refresh-btn"
            @click="fetchQAList(pagination.page, pagination.pageSize)" 
            :icon="Refresh"
            :loading="loading"
            :disabled="loading"
            circle
          />
          <el-button 
            class="action-btn create-btn"
            type="primary" 
            @click="newQA" 
            :icon="Plus"
          >
            新建QA页面
          </el-button>
        </div>
      </div>

      <!-- QA列表 -->
      <div v-loading="loading" class="qa-grid">
        <div v-if="qaList.length === 0 && !loading" class="empty-state">
          <el-icon class="empty-icon"><QuestionFilled /></el-icon>
          <h3 class="empty-title">暂无QA页面</h3>
          <p class="empty-desc">开始创建你的第一个QA页面吧</p>
          <el-button type="primary" @click="newQA" :icon="Plus">创建QA页面</el-button>
        </div>
        
        <div
          v-for="qa in qaList"
          :key="qa.id"
          class="qa-card"
          :class="{ 'qa-active': currentQA?.id === qa.id }"
          @click="viewQA(qa)"
        >
          <div class="qa-header">
            <h4 class="qa-title">{{ qa.title }}</h4>
            <div class="qa-actions">
              <el-button 
                class="action-icon"
                size="small"
                :icon="View"
                @click.stop="viewQA(qa)"
                circle
                plain
              />
              <el-button 
                class="action-icon preview-icon"
                size="small"
                type="success"
                :icon="ChatDotRound"
                @click.stop="previewQA(qa)"
                circle
                plain
              />
              <el-button 
                class="action-icon copy-icon"
                size="small"
                type="info"
                :icon="CopyDocument"
                @click.stop="copyQALink(qa)"
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
                @click.stop="editQA(qa)"
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
                @click.stop="deleteQA(qa)"
                circle
                plain
              />
            </div>
          </div>
          
          <div class="qa-content">
            <div v-if="qa.qaItems && qa.qaItems.length > 0" class="qa-items-preview">
              <div 
                v-for="(item, index) in qa.qaItems.slice(0, 2)" 
                :key="index" 
                class="qa-item-preview"
              >
                <div class="qa-question">
                  <h5 class="question-label">问题{{ index + 1 }}：</h5>
                  <p class="question-text">{{ item.question }}</p>
                </div>
                <div class="qa-answer">
                  <h5 class="answer-label">答案{{ index + 1 }}：</h5>
                  <p class="answer-text">{{ item.answer }}</p>
                </div>
              </div>
              <div v-if="qa.qaItems.length > 2" class="more-items">
                <span class="more-text">还有 {{ qa.qaItems.length - 2 }} 个问答对...</span>
              </div>
            </div>
            <div v-else class="qa-fallback">
              <div class="qa-question">
                <h5 class="question-label">问题：</h5>
                <p class="question-text">{{ qa.question || '暂无问题' }}</p>
              </div>
              <div class="qa-answer">
                <h5 class="answer-label">答案：</h5>
                <p class="answer-text">{{ qa.answer || '暂无答案' }}</p>
              </div>
            </div>
          </div>
          
          <div class="qa-footer">
            <div class="qa-meta">
              <div class="qa-time">
                <span class="time-label">更新于</span>
                <span class="time-value">{{ formatTime(qa.updateTime) }}</span>
              </div>
              <div class="qa-status">
                <el-tag :type="qa.isPublic ? 'success' : 'warning'" size="small">
                  {{ qa.isPublic ? '公开' : '私有' }}
                </el-tag>
              </div>
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

      <!-- QA表单 -->
      <el-dialog
        v-model="showForm"
        :title="isEditing ? '编辑QA页面' : '新建QA页面'"
        width="90%"
        max-width="900px"
        class="qa-dialog"
        @close="isEditing = false"
        destroy-on-close
      >
        <div class="form-container">
          <el-form :model="formData" label-position="top">
            <el-form-item label="页面标题" required class="form-item">
              <el-input 
                v-model="formData.title" 
                placeholder="请输入QA页面标题" 
                size="large"
                class="title-input"
              />
            </el-form-item>
            
            <!-- 问答对列表 -->
            <el-form-item label="问答对" required class="form-item">
              <div class="qa-items-container">
                <div 
                  v-for="(item, index) in formData.qaItems" 
                  :key="index" 
                  class="qa-item-form"
                >
                  <div class="qa-item-header">
                    <h4 class="qa-item-title">问答对 {{ index + 1 }}</h4>
                    <el-button 
                      v-if="formData.qaItems.length > 1"
                      type="danger" 
                      :icon="Minus"
                      size="small"
                      circle
                      @click="removeQAItem(index)"
                    />
                  </div>
                  
                  <div class="qa-item-content">
                    <el-form-item :label="`问题 ${index + 1}`" class="qa-form-item">
                      <el-input
                        v-model="item.question"
                        type="textarea"
                        :rows="3"
                        placeholder="请输入问题内容..."
                        class="question-textarea"
                        resize="vertical"
                      />
                    </el-form-item>
                    
                    <el-form-item :label="`答案 ${index + 1}`" class="qa-form-item">
                      <el-input
                        v-model="item.answer"
                        type="textarea"
                        :rows="4"
                        placeholder="请输入答案内容..."
                        class="answer-textarea"
                        resize="vertical"
                      />
                    </el-form-item>
                  </div>
                </div>
                
                <el-button 
                  type="primary" 
                  :icon="Plus"
                  @click="addQAItem"
                  class="add-qa-btn"
                >
                  添加问答对
                </el-button>
              </div>
            </el-form-item>
            
            <el-form-item label="页面头部内容（可选）" class="form-item">
              <el-input
                v-model="formData.headerContent"
                type="textarea"
                :rows="3"
                placeholder="在QA问题上方显示的自定义内容..."
                class="header-textarea"
                resize="vertical"
              />
            </el-form-item>
            
            <el-form-item label="页面尾部内容（可选）" class="form-item">
              <el-input
                v-model="formData.footerContent"
                type="textarea"
                :rows="3"
                placeholder="在QA答案下方显示的自定义内容..."
                class="footer-textarea"
                resize="vertical"
              />
            </el-form-item>
            
            <el-form-item label="页面设置" class="form-item">
              <el-checkbox v-model="formData.isPublic">
                设为公开页面（其他人可以访问）
              </el-checkbox>
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
              @click="isEditing ? updateQA() : createQA()"
            >
              {{ isEditing ? '保存修改' : '创建QA页面' }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- QA详情 -->
      <el-dialog
        v-model="showQADetail"
        title="QA详情"
        width="90%"
        max-width="800px"
        class="detail-dialog"
        @close="currentQA = null"
        destroy-on-close
      >
        <div v-if="currentQA" class="detail-container">
          <div class="detail-header">
            <h2 class="detail-title">{{ currentQA.title }}</h2>
            <div class="detail-meta">
              <span class="meta-item">
                <el-icon><QuestionFilled /></el-icon>
                创建于 {{ formatTime(currentQA.createTime) }}
              </span>
              <span class="meta-item">
                <el-icon><Edit /></el-icon>
                更新于 {{ formatTime(currentQA.updateTime) }}
              </span>
              <span class="meta-item">
                <el-tag :type="currentQA.isPublic ? 'success' : 'warning'" size="small">
                  {{ currentQA.isPublic ? '公开' : '私有' }}
                </el-tag>
              </span>
            </div>
          </div>
          
          <div class="detail-content">
            <div class="content-wrapper">
              <div v-if="currentQA.qaItems && currentQA.qaItems.length > 0" class="qa-detail-items">
                <div 
                  v-for="(item, index) in currentQA.qaItems" 
                  :key="index" 
                  class="qa-detail-item"
                >
                  <div class="qa-detail-question">
                    <h3 class="detail-question-label">问题 {{ index + 1 }}：</h3>
                    <p class="detail-question-text">{{ item.question }}</p>
                  </div>
                  <div class="qa-detail-answer">
                    <h3 class="detail-answer-label">答案 {{ index + 1 }}：</h3>
                    <p class="detail-answer-text">{{ item.answer }}</p>
                  </div>
                </div>
              </div>
              <div v-else class="qa-detail-fallback">
                <div class="qa-detail-question">
                  <h3 class="detail-question-label">问题：</h3>
                  <p class="detail-question-text">{{ currentQA.question || '暂无问题' }}</p>
                </div>
                <div class="qa-detail-answer">
                  <h3 class="detail-answer-label">答案：</h3>
                  <p class="detail-answer-text">{{ currentQA.answer || '暂无答案' }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="currentQA = null">关闭</el-button>
            <el-button 
              type="success" 
              size="large"
              :icon="ChatDotRound"
              @click="currentQA && previewQA(currentQA)"
            >
              预览页面
            </el-button>
            <el-button 
              type="primary" 
              size="large"
              :icon="Edit"
              @click="currentQA && editQA(currentQA)"
            >
              编辑QA
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- QA预览 -->
      <el-dialog
        v-model="showPreview"
        title="QA页面预览"
        width="95%"
        max-width="1000px"
        class="preview-dialog"
        @close="currentQA = null"
        destroy-on-close
      >
        <div v-if="currentQA" class="preview-container">
          <div class="preview-header">
            <h1 class="preview-title">{{ currentQA.title }}</h1>
            <div class="preview-actions">
              <el-button 
                type="primary" 
                :icon="CopyDocument"
                @click="copyQALink(currentQA)"
              >
                复制链接
              </el-button>
            </div>
          </div>
          
          <div class="preview-content">
            <!-- 头部自定义内容 -->
            <div v-if="currentQA.headerContent" class="preview-header-content">
              <div class="custom-content" v-html="currentQA.headerContent"></div>
            </div>
            
            <!-- QA内容 -->
            <div class="preview-qa-section">
              <div v-if="currentQA.qaItems && currentQA.qaItems.length > 0" class="preview-qa-items">
                <div 
                  v-for="(item, index) in currentQA.qaItems" 
                  :key="index" 
                  class="preview-qa-item"
                >
                  <div class="preview-question-section">
                    <h2 class="preview-question-title">问题 {{ index + 1 }}</h2>
                    <div class="preview-question-content">
                      {{ item.question }}
                    </div>
                  </div>
                  
                  <div class="preview-answer-section">
                    <h2 class="preview-answer-title">答案 {{ index + 1 }}</h2>
                    <div class="preview-answer-content">
                      {{ item.answer }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="preview-qa-fallback">
                <div class="preview-question-section">
                  <h2 class="preview-question-title">问题</h2>
                  <div class="preview-question-content">
                    {{ currentQA.question || '暂无问题' }}
                  </div>
                </div>
                
                <div class="preview-answer-section">
                  <h2 class="preview-answer-title">答案</h2>
                  <div class="preview-answer-content">
                    {{ currentQA.answer || '暂无答案' }}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 尾部自定义内容 -->
            <div v-if="currentQA.footerContent" class="preview-footer-content">
              <div class="custom-content" v-html="currentQA.footerContent"></div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="showPreview = false">关闭</el-button>
            <el-button 
              type="primary" 
              size="large"
              :icon="Edit"
              @click="currentQA && editQA(currentQA)"
            >
              编辑QA
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        QA问答页面制作工具，支持创建多个问答对的个性化页面。可以添加多个问题和答案，支持在页面头部和尾部添加自定义内容。创建后可以生成公开链接供他人访问。
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 主容器样式 */
.qa-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24px;
  padding: 32px;
  min-height: 600px;
  position: relative;
  overflow: hidden;
}

.qa-container::before {
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

.qa-container > * {
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

/* QA网格 */
.qa-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
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

/* QA卡片 */
.qa-card {
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

.qa-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 20px 20px 0 0;
}

.qa-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.qa-active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.qa-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.qa-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
  flex: 1;
  line-height: 1.4;
  word-break: break-word;
}

.qa-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: all 0.3s ease;
}

.qa-card:hover .qa-actions {
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

.preview-icon:hover {
  background: rgba(34, 197, 94, 0.1);
}

.copy-icon:hover {
  background: rgba(59, 130, 246, 0.1);
}

.delete-icon:hover {
  background: rgba(245, 101, 101, 0.1);
}

.qa-content {
  margin-bottom: 16px;
}

/* 问答对预览样式 */
.qa-items-preview {
  space-y: 16px;
}

.qa-item-preview {
  margin-bottom: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.qa-item-preview:last-child {
  margin-bottom: 0;
}

.qa-question, .qa-answer {
  margin-bottom: 12px;
}

.qa-question:last-child, .qa-answer:last-child {
  margin-bottom: 0;
}

.question-label, .answer-label {
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 8px 0;
}

.question-text, .answer-text {
  color: #4a5568;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.more-items {
  text-align: center;
  padding: 12px;
  background: #e2e8f0;
  border-radius: 8px;
  margin-top: 12px;
}

.more-text {
  font-size: 14px;
  color: #718096;
  font-style: italic;
}

.qa-fallback {
  /* 兼容旧数据格式 */
}

.qa-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.qa-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.qa-time {
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

/* 表单样式 */
.qa-items-container {
  space-y: 24px;
}

.qa-item-form {
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.qa-item-form:hover {
  border-color: #667eea;
  background: #f1f5f9;
}

.qa-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
}

.qa-item-title {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.qa-item-content {
  space-y: 16px;
}

.qa-form-item {
  margin-bottom: 16px;
}

.qa-form-item:last-child {
  margin-bottom: 0;
}

.add-qa-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px 24px;
  font-weight: 600;
  border: 2px dashed #667eea;
  background: rgba(102, 126, 234, 0.05);
  color: #667eea;
  transition: all 0.3s ease;
}

.add-qa-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  border-color: #667eea;
  transform: translateY(-2px);
}

/* 弹窗样式 */
:deep(.qa-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.qa-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 24px 32px;
  border-bottom: none;
}

:deep(.qa-dialog .el-dialog__title) {
  font-size: 20px;
  font-weight: 600;
}

:deep(.qa-dialog .el-dialog__body) {
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

:deep(.title-input .el-input__wrapper),
:deep(.question-textarea .el-textarea__inner),
:deep(.answer-textarea .el-textarea__inner),
:deep(.header-textarea .el-textarea__inner),
:deep(.footer-textarea .el-textarea__inner) {
  border-radius: 12px;
  padding: 16px;
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  font-family: inherit;
}

:deep(.title-input .el-input__wrapper:hover),
:deep(.question-textarea .el-textarea__inner:hover),
:deep(.answer-textarea .el-textarea__inner:hover),
:deep(.header-textarea .el-textarea__inner:hover),
:deep(.footer-textarea .el-textarea__inner:hover) {
  border-color: #667eea;
}

:deep(.title-input .el-input__wrapper.is-focus),
:deep(.question-textarea .el-textarea__inner:focus),
:deep(.answer-textarea .el-textarea__inner:focus),
:deep(.header-textarea .el-textarea__inner:focus),
:deep(.footer-textarea .el-textarea__inner:focus) {
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
}

.detail-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
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

.qa-detail-items {
  space-y: 24px;
}

.qa-detail-item {
  margin-bottom: 32px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.qa-detail-item:last-child {
  margin-bottom: 0;
}

.qa-detail-question, .qa-detail-answer {
  margin-bottom: 20px;
}

.qa-detail-answer:last-child {
  margin-bottom: 0;
}

.detail-question-label, .detail-answer-label {
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 12px 0;
}

.detail-question-text, .detail-answer-text {
  color: #2d3748;
  font-size: 15px;
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.qa-detail-fallback {
  /* 兼容旧数据格式 */
}

/* 预览弹窗样式 */
:deep(.preview-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.preview-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 24px 32px;
}

:deep(.preview-dialog .el-dialog__body) {
  padding: 0;
  background: #f8fafc;
}

.preview-container {
  min-height: 500px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.preview-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
  line-height: 1.3;
}

.preview-content {
  padding: 32px;
}

.preview-header-content, .preview-footer-content {
  margin-bottom: 24px;
  padding: 20px;
  background: #f1f5f9;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.custom-content {
  color: #2d3748;
  font-size: 15px;
  line-height: 1.6;
}

.preview-qa-section {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.preview-qa-items {
  space-y: 32px;
}

.preview-qa-item {
  margin-bottom: 40px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.preview-qa-item:last-child {
  margin-bottom: 0;
}

.preview-question-section, .preview-answer-section {
  margin-bottom: 24px;
}

.preview-answer-section:last-child {
  margin-bottom: 0;
}

.preview-question-title, .preview-answer-title {
  font-size: 20px;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.preview-question-content, .preview-answer-content {
  color: #2d3748;
  font-size: 16px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.preview-qa-fallback {
  /* 兼容旧数据格式 */
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
  .qa-container {
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
  
  .qa-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .qa-card {
    padding: 16px;
  }
  
  .qa-actions {
    opacity: 1;
  }
  
  :deep(.qa-dialog .el-dialog__body),
  :deep(.detail-dialog .el-dialog__body),
  :deep(.preview-dialog .el-dialog__body) {
    padding: 16px;
  }
  
  :deep(.qa-dialog .el-dialog__header),
  :deep(.detail-dialog .el-dialog__header),
  :deep(.preview-dialog .el-dialog__header) {
    padding: 16px 20px;
  }
  
  .preview-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .preview-title {
    font-size: 24px;
  }
  
  .preview-content {
    padding: 16px;
  }
  
  .preview-qa-section {
    padding: 20px;
  }
  
  .preview-question-title, .preview-answer-title {
    font-size: 18px;
  }
  
  .preview-question-content, .preview-answer-content {
    font-size: 15px;
  }
  
  .qa-item-form {
    padding: 16px;
  }
  
  .qa-item-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .detail-meta {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>