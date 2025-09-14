<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import functionsRequest from '@/utils/functionsRequest'
import { ElMessage } from 'element-plus'
import { QuestionFilled, ChatDotRound, Share, CopyDocument } from '@element-plus/icons-vue'

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

const route = useRoute()
const qa = ref<QAItem | null>(null)
const loading = ref(true)

// 获取QA页面数据
const fetchQA = async () => {
  try {
    loading.value = true
    const id = route.params.id as string
    const response = await functionsRequest.get(`/api/qa-view/${id}`)
    
    if (response.status === 200) {
      qa.value = response.data
    } else {
      ElMessage.error('QA页面不存在或未公开')
    }
  } catch (error) {
    console.error('获取QA页面失败:', error)
    ElMessage.error('获取QA页面失败')
  } finally {
    loading.value = false
  }
}

// 复制链接
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('链接已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 分享到社交媒体
const shareToSocial = (platform: string) => {
  const url = encodeURIComponent(window.location.href)
  const title = encodeURIComponent(qa.value?.title || '')
  
  let shareUrl = ''
  switch (platform) {
    case 'weibo':
      shareUrl = `https://service.weibo.com/share/share.php?url=${url}&title=${title}`
      break
    case 'qq':
      shareUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}`
      break
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`
      break
  }
  
  if (shareUrl) {
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }
}

onMounted(() => {
  fetchQA()
})
</script>

<template>
  <div class="qa-view-fullscreen">
    <div v-loading="loading" class="qa-view-content">
      <div v-if="qa" class="qa-page">
        <!-- 页面头部 -->
        <div class="qa-header">
          <h1 class="qa-title">{{ qa.title }}</h1>
          <div class="qa-actions">
            <el-button 
              type="primary" 
              :icon="CopyDocument"
              @click="copyLink"
            >
              复制链接
            </el-button>
            <el-button 
              type="success" 
              :icon="Share"
              @click="shareToSocial('weibo')"
            >
              分享到微博
            </el-button>
          </div>
        </div>
        
        <!-- 头部自定义内容 -->
        <div v-if="qa.headerContent" class="qa-header-content">
          <div class="custom-content" v-html="qa.headerContent"></div>
        </div>
        
        <!-- QA内容区域 -->
        <div class="qa-main-content">
          <!-- 新格式：多个问答对 -->
          <div v-if="qa.qaItems && qa.qaItems.length > 0" class="qa-items-container">
            <div 
              v-for="(item, index) in qa.qaItems" 
              :key="index" 
              class="qa-item-section"
            >
              <div class="qa-question-section">
                <div class="section-header">
                  <el-icon class="section-icon"><QuestionFilled /></el-icon>
                  <h2 class="section-title">问题 {{ index + 1 }}</h2>
                </div>
                <div class="section-content">
                  <div class="question-content">{{ item.question }}</div>
                </div>
              </div>
              
              <div class="qa-answer-section">
                <div class="section-header">
                  <el-icon class="section-icon"><ChatDotRound /></el-icon>
                  <h2 class="section-title">答案 {{ index + 1 }}</h2>
                </div>
                <div class="section-content">
                  <div class="answer-content">{{ item.answer }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 兼容旧格式：单个问答对 -->
          <div v-else class="qa-fallback-container">
            <div class="qa-question-section">
              <div class="section-header">
                <el-icon class="section-icon"><QuestionFilled /></el-icon>
                <h2 class="section-title">问题</h2>
              </div>
              <div class="section-content">
                <div class="question-content">{{ qa.question || '暂无问题' }}</div>
              </div>
            </div>
            
            <div class="qa-answer-section">
              <div class="section-header">
                <el-icon class="section-icon"><ChatDotRound /></el-icon>
                <h2 class="section-title">答案</h2>
              </div>
              <div class="section-content">
                <div class="answer-content">{{ qa.answer || '暂无答案' }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 尾部自定义内容 -->
        <div v-if="qa.footerContent" class="qa-footer-content">
          <div class="custom-content" v-html="qa.footerContent"></div>
        </div>
        
        <!-- 页面信息 -->
        <div class="qa-page-info">
          <div class="page-meta">
            <span class="meta-item">创建时间：{{ new Date(qa.createTime).toLocaleString('zh-CN') }}</span>
            <span class="meta-item">更新时间：{{ new Date(qa.updateTime).toLocaleString('zh-CN') }}</span>
          </div>
        </div>
      </div>
      
      <div v-else-if="!loading" class="qa-not-found">
        <el-icon class="not-found-icon"><QuestionFilled /></el-icon>
        <h2 class="not-found-title">QA页面不存在</h2>
        <p class="not-found-desc">该QA页面可能已被删除或未公开</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qa-view-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow-y: auto;
  z-index: 9999;
}

.qa-view-content {
  max-width: 1000px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 20px;
}

.qa-page {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  min-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

.qa-header {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 40px;
  text-align: center;
  position: relative;
  flex-shrink: 0;
}

.qa-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 20px 0;
  line-height: 1.3;
  word-break: break-word;
}

.qa-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.qa-header-content {
  padding: 30px 40px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.custom-content {
  color: #2d3748;
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
}

.qa-main-content {
  padding: 40px;
  flex: 1;
}

/* 问答对容器样式 */
.qa-items-container {
  space-y: 40px;
}

.qa-item-section {
  margin-bottom: 40px;
  padding: 32px;
  background: #f8fafc;
  border-radius: 16px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
}

.qa-item-section:hover {
  border-color: #667eea;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.1);
}

.qa-item-section:last-child {
  margin-bottom: 0;
}

.qa-question-section, .qa-answer-section {
  margin-bottom: 32px;
}

.qa-answer-section {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
}

.section-icon {
  font-size: 24px;
  color: #667eea;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.section-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border-left: 4px solid #667eea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.question-content, .answer-content {
  color: #2d3748;
  font-size: 16px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

/* 兼容旧格式样式 */
.qa-fallback-container {
  .qa-question-section, .qa-answer-section {
    margin-bottom: 40px;
  }
  
  .qa-answer-section {
    margin-bottom: 0;
  }
}

.qa-footer-content {
  padding: 30px 40px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.qa-page-info {
  padding: 20px 40px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.page-meta {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 14px;
  color: #718096;
}

.qa-not-found {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  min-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.not-found-icon {
  font-size: 64px;
  color: #cbd5e0;
  margin-bottom: 24px;
}

.not-found-title {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 12px 0;
}

.not-found-desc {
  font-size: 16px;
  color: #718096;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .qa-view-content {
    padding: 10px;
  }
  
  .qa-header {
    padding: 30px 20px;
  }
  
  .qa-title {
    font-size: 24px;
  }
  
  .qa-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .qa-header-content,
  .qa-main-content,
  .qa-footer-content,
  .qa-page-info {
    padding: 20px;
  }
  
  .qa-item-section {
    padding: 20px;
    margin-bottom: 24px;
  }
  
  .section-title {
    font-size: 20px;
  }
  
  .question-content, .answer-content {
    font-size: 15px;
  }
  
  .page-meta {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>
