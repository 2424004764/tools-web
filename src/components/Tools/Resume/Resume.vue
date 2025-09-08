<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Edit, Delete, View, Briefcase } from '@element-plus/icons-vue'

interface Resume {
  id: string
  name: string
  personalInfo: any
  workExperience: any[]
  education: any[]
  skills: any[]
  projects: any[]
  certificates: any[]
  others: any
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
  title: "简历管理",
})

const resumes = ref<Resume[]>([])
const currentResume = ref<Resume | null>(null)
const isEditing = ref(false)
const showForm = ref(false)
const showPreview = ref(false)
const editingResumeId = ref<string | null>(null)

// 分页相关数据
const pagination = ref<Pagination>({
  total: 0,
  page: 1,
  pageSize: 12,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

// 学历选项
const degreeOptions = [
  { value: '博士', label: '博士研究生' },
  { value: '硕士', label: '硕士研究生' },
  { value: '本科', label: '本科/学士' },
  { value: '专科', label: '专科/大专' },
  { value: '高中', label: '高中' },
  { value: '中专', label: '中专/中职' },
  { value: '初中', label: '初中' },
  { value: '其他', label: '其他' }
]

const formData = reactive({
  name: '',
  personalInfo: {
    name: '',
    phone: '',
    email: '',
    address: '',
    summary: ''
  },
  workExperience: [
    {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: ''
    }
  ],
  education: [
    {
      school: '',
      major: '',
      degree: '',
      startDate: '',
      endDate: ''
    }
  ],
  skills: [''],
  projects: [
    {
      name: '',
      description: '',
      technologies: '',
      startDate: '',
      endDate: ''
    }
  ],
  certificates: [
    {
      name: '',
      issuer: '',
      date: ''
    }
  ],
  others: {
    hobbies: '',
    languages: ''
  }
})

// loading状态
const loading = ref(false)
const operationLoading = ref(false)

// 解析简历数据中的JSON字段
const parseResumeData = (resume: any) => {
  try {
    return {
      ...resume,
      personalInfo: typeof resume.personalInfo === 'string' 
        ? JSON.parse(resume.personalInfo || '{}') 
        : resume.personalInfo || {},
      workExperience: typeof resume.workExperience === 'string'
        ? JSON.parse(resume.workExperience || '[]')
        : resume.workExperience || [],
      education: typeof resume.education === 'string'
        ? JSON.parse(resume.education || '[]')
        : resume.education || [],
      skills: typeof resume.skills === 'string'
        ? JSON.parse(resume.skills || '[]')
        : resume.skills || [],
      projects: typeof resume.projects === 'string'
        ? JSON.parse(resume.projects || '[]')
        : resume.projects || [],
      certificates: typeof resume.certificates === 'string'
        ? JSON.parse(resume.certificates || '[]')
        : resume.certificates || [],
      others: typeof resume.others === 'string'
        ? JSON.parse(resume.others || '{}')
        : resume.others || {}
    }
  } catch (error) {
    console.error('解析简历数据失败:', error)
    return resume
  }
}

// 获取简历列表（支持分页）
const fetchResumes = async (page = 1, pageSize = 12) => {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/resumes', {
      params: { page, pageSize }
    })
    if (response.status === 200) {
      const data = response.data
      resumes.value = (data.data || []).map(parseResumeData)
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取简历列表失败:', error)
    ElMessage.error('获取简历列表失败')
  } finally {
    loading.value = false
  }
}

// 分页变化处理
const handlePageChange = (page: number) => {
  fetchResumes(page, pagination.value.pageSize)
}

// 每页条数变化处理
const handleSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  fetchResumes(1, pageSize)
}

// 创建简历
const createResume = async () => {
  if (!formData.name.trim()) {
    ElMessage.warning('简历名称不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/resumes', formData)

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      await fetchResumes(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('创建失败')
    }
  } catch (error) {
    console.error('创建简历失败:', error)
    ElMessage.error('创建失败')
  } finally {
    operationLoading.value = false
  }
}

// 更新简历
const updateResume = async () => {
  if (!editingResumeId.value || !formData.name.trim()) {
    ElMessage.warning('简历名称不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/resumes/${editingResumeId.value}`, formData)

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingResumeId.value = null
      resetForm()
      await fetchResumes(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('更新失败')
    }
  } catch (error) {
    console.error('更新简历失败:', error)
    ElMessage.error('更新失败')
  } finally {
    operationLoading.value = false
  }
}

// 删除简历
const deleteResume = async (resume: Resume) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除简历"${resume.name}"吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/resumes/${resume.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      await fetchResumes(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除简历失败:', error)
      ElMessage.error('删除失败')
    }
  } finally {
    operationLoading.value = false
  }
}

// 查看简历
const viewResume = (resume: Resume) => {
  currentResume.value = parseResumeData(resume)
  showPreview.value = true
}

// 编辑简历
const editResume = (resume: Resume) => {
  editingResumeId.value = resume.id
  isEditing.value = true
  
  // 填充表单数据
  formData.name = resume.name
  
  // 解析JSON字段
  try {
    formData.personalInfo = typeof resume.personalInfo === 'string' 
      ? JSON.parse(resume.personalInfo) 
      : resume.personalInfo || {}
    formData.workExperience = typeof resume.workExperience === 'string'
      ? JSON.parse(resume.workExperience)
      : resume.workExperience || [{ company: '', position: '', startDate: '', endDate: '', description: '' }]
    formData.education = typeof resume.education === 'string'
      ? JSON.parse(resume.education)
      : resume.education || [{ school: '', major: '', degree: '', startDate: '', endDate: '' }]
    formData.skills = typeof resume.skills === 'string'
      ? JSON.parse(resume.skills)
      : resume.skills || ['']
    formData.projects = typeof resume.projects === 'string'
      ? JSON.parse(resume.projects)
      : resume.projects || [{ name: '', description: '', technologies: '', startDate: '', endDate: '' }]
    formData.certificates = typeof resume.certificates === 'string'
      ? JSON.parse(resume.certificates)
      : resume.certificates || [{ name: '', issuer: '', date: '' }]
    formData.others = typeof resume.others === 'string'
      ? JSON.parse(resume.others)
      : resume.others || { hobbies: '', languages: '' }
  } catch (error) {
    console.error('解析简历数据失败:', error)
    ElMessage.error('简历数据格式错误')
    return
  }
  
  showForm.value = true
}

// 新建简历
const newResume = () => {
  isEditing.value = false
  editingResumeId.value = null
  resetForm()
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  formData.name = ''
  formData.personalInfo = {
    name: '',
    phone: '',
    email: '',
    address: '',
    summary: ''
  }
  formData.workExperience = [
    {
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      description: ''
    }
  ]
  formData.education = [
    {
      school: '',
      major: '',
      degree: '',
      startDate: '',
      endDate: ''
    }
  ]
  formData.skills = ['']
  formData.projects = [
    {
      name: '',
      description: '',
      technologies: '',
      startDate: '',
      endDate: ''
    }
  ]
  formData.certificates = [
    {
      name: '',
      issuer: '',
      date: ''
    }
  ]
  formData.others = {
    hobbies: '',
    languages: ''
  }
}

// 添加工作经历
const addWorkExperience = () => {
  formData.workExperience.push({
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    description: ''
  })
}

// 删除工作经历
const removeWorkExperience = (index: number) => {
  if (formData.workExperience.length > 1) {
    formData.workExperience.splice(index, 1)
  }
}

// 添加教育经历
const addEducation = () => {
  formData.education.push({
    school: '',
    major: '',
    degree: '',
    startDate: '',
    endDate: ''
  })
}

// 删除教育经历
const removeEducation = (index: number) => {
  if (formData.education.length > 1) {
    formData.education.splice(index, 1)
  }
}

// 添加技能
const addSkill = () => {
  formData.skills.push('')
}

// 删除技能
const removeSkill = (index: number) => {
  if (formData.skills.length > 1) {
    formData.skills.splice(index, 1)
  }
}

// 添加项目经历
const addProject = () => {
  formData.projects.push({
    name: '',
    description: '',
    technologies: '',
    startDate: '',
    endDate: ''
  })
}

// 删除项目经历
const removeProject = (index: number) => {
  if (formData.projects.length > 1) {
    formData.projects.splice(index, 1)
  }
}

// 添加证书
const addCertificate = () => {
  formData.certificates.push({
    name: '',
    issuer: '',
    date: ''
  })
}

// 删除证书
const removeCertificate = (index: number) => {
  if (formData.certificates.length > 1) {
    formData.certificates.splice(index, 1)
  }
}

// 格式化时间显示
const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 格式化工作日期
const formatWorkDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`
}

onMounted(() => {
  fetchResumes()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="resume-container">
      <!-- 操作栏 -->
      <div class="header-section">
        <div class="header-left">
          <div class="icon-wrapper">
            <el-icon class="header-icon"><Briefcase /></el-icon>
          </div>
          <div>
            <h3 class="header-title">我的简历</h3>
            <p class="header-subtitle">共 {{ pagination.total }} 份简历</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button 
            class="action-btn refresh-btn"
            @click="fetchResumes(pagination.page, pagination.pageSize)" 
            :icon="Refresh"
            :loading="loading"
            :disabled="loading"
            circle
          />
          <el-button 
            class="action-btn create-btn"
            type="primary" 
            @click="newResume" 
            :icon="Plus"
          >
            新建简历
          </el-button>
        </div>
      </div>

      <!-- 简历列表 -->
      <div v-loading="loading" class="resume-grid">
        <div v-if="resumes.length === 0 && !loading" class="empty-state">
          <el-icon class="empty-icon"><Briefcase /></el-icon>
          <h3 class="empty-title">暂无简历</h3>
          <p class="empty-desc">开始创建你的第一份简历吧</p>
          <el-button type="primary" @click="newResume" :icon="Plus">创建简历</el-button>
        </div>
        
        <div
          v-for="resume in resumes"
          :key="resume.id"
          class="resume-card"
          :class="{ 'resume-active': currentResume?.id === resume.id }"
          @click="viewResume(resume)"
        >
          <div class="resume-header">
            <h4 class="resume-title">{{ resume.name }}</h4>
            <div class="resume-actions">
              <el-button 
                class="action-icon"
                size="small"
                :icon="View"
                @click.stop="viewResume(resume)"
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
                @click.stop="editResume(resume)"
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
                @click.stop="deleteResume(resume)"
                circle
                plain
              />
            </div>
          </div>
          
          <div class="resume-content">
            <div class="personal-info">
              <el-icon><Briefcase /></el-icon>
              <span>{{ resume.personalInfo?.name || '未填写姓名' }}</span>
            </div>
          </div>
          
          <div class="resume-footer">
            <span class="time-text">更新于 {{ formatTime(resume.updateTime) }}</span>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[6, 12, 24, 48]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
          class="custom-pagination"
        />
      </div>

      <!-- 简历表单 -->
      <el-dialog
        v-model="showForm"
        :title="isEditing ? '编辑简历' : '新建简历'"
        width="90%"
        max-width="900px"
        class="resume-dialog"
        @close="isEditing = false"
        destroy-on-close
      >
        <div class="form-container">
          <el-form :model="formData" label-position="top">
            <!-- 基本信息 -->
            <div class="form-section">
              <h4 class="section-title">基本信息</h4>
              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="简历名称" required>
                    <el-input 
                      v-model="formData.name" 
                      placeholder="请输入简历名称" 
                      size="large"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>

            <!-- 个人信息 -->
            <div class="form-section">
              <h4 class="section-title">个人信息</h4>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="姓名">
                    <el-input v-model="formData.personalInfo.name" placeholder="请输入姓名" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="电话">
                    <el-input v-model="formData.personalInfo.phone" placeholder="请输入电话" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="邮箱">
                    <el-input v-model="formData.personalInfo.email" placeholder="请输入邮箱" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="地址">
                    <el-input v-model="formData.personalInfo.address" placeholder="请输入地址" />
                  </el-form-item>
                </el-col>
                <el-col :span="24">
                  <el-form-item label="个人简介">
                    <el-input
                      v-model="formData.personalInfo.summary"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入个人简介"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>

            <!-- 工作经历 -->
            <div class="form-section">
              <div class="section-header">
                <h4 class="section-title">工作经历</h4>
                <el-button type="primary" size="small" @click="addWorkExperience" :icon="Plus">添加</el-button>
              </div>
              <div v-for="(work, index) in formData.workExperience" :key="index" class="experience-item">
                <div class="item-header">
                  <span class="item-number">{{ index + 1 }}</span>
                  <el-button
                    v-if="formData.workExperience.length > 1"
                    type="danger"
                    size="small"
                    @click="removeWorkExperience(index)"
                    :icon="Delete"
                    circle
                    plain
                  />
                </div>
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="公司名称">
                      <el-input v-model="work.company" placeholder="请输入公司名称" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="职位">
                      <el-input v-model="work.position" placeholder="请输入职位" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="开始时间">
                      <el-date-picker
                        v-model="work.startDate"
                        type="month"
                        placeholder="选择开始时间"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="结束时间">
                      <el-date-picker
                        v-model="work.endDate"
                        type="month"
                        placeholder="选择结束时间"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="24">
                    <el-form-item label="工作描述">
                      <el-input
                        v-model="work.description"
                        type="textarea"
                        :rows="3"
                        placeholder="请输入工作描述"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>

            <!-- 教育经历 -->
            <div class="form-section">
              <div class="section-header">
                <h4 class="section-title">教育经历</h4>
                <el-button type="primary" size="small" @click="addEducation" :icon="Plus">添加</el-button>
              </div>
              <div v-for="(edu, index) in formData.education" :key="index" class="experience-item">
                <div class="item-header">
                  <span class="item-number">{{ index + 1 }}</span>
                  <el-button
                    v-if="formData.education.length > 1"
                    type="danger"
                    size="small"
                    @click="removeEducation(index)"
                    :icon="Delete"
                    circle
                    plain
                  />
                </div>
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="学校名称">
                      <el-input v-model="edu.school" placeholder="请输入学校名称" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="专业">
                      <el-input v-model="edu.major" placeholder="请输入专业" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="学历">
                      <el-select 
                        v-model="edu.degree" 
                        placeholder="请选择学历" 
                        style="width: 100%"
                        clearable
                      >
                        <el-option
                          v-for="degree in degreeOptions"
                          :key="degree.value"
                          :label="degree.label"
                          :value="degree.value"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6">
                    <el-form-item label="开始时间">
                      <el-date-picker
                        v-model="edu.startDate"
                        type="year"
                        placeholder="选择年份"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="6">
                    <el-form-item label="结束时间">
                      <el-date-picker
                        v-model="edu.endDate"
                        type="year"
                        placeholder="选择年份"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>

            <!-- 技能 -->
            <div class="form-section">
              <div class="section-header">
                <h4 class="section-title">专业技能</h4>
                <el-button type="primary" size="small" @click="addSkill" :icon="Plus">添加</el-button>
              </div>
              <div v-for="(skill, index) in formData.skills" :key="index" class="skill-item">
                <el-input
                  v-model="formData.skills[index]"
                  placeholder="请输入技能"
                  style="margin-bottom: 10px;"
                >
                  <template #append>
                    <el-button
                      v-if="formData.skills.length > 1"
                      type="danger"
                      @click="removeSkill(index)"
                      :icon="Delete"
                    />
                  </template>
                </el-input>
              </div>
            </div>

            <!-- 项目经历 -->
            <div class="form-section">
              <div class="section-header">
                <h4 class="section-title">项目经历</h4>
                <el-button type="primary" size="small" @click="addProject" :icon="Plus">添加</el-button>
              </div>
              <div v-for="(project, index) in formData.projects" :key="index" class="experience-item">
                <div class="item-header">
                  <span class="item-number">{{ index + 1 }}</span>
                  <el-button
                    v-if="formData.projects.length > 1"
                    type="danger"
                    size="small"
                    @click="removeProject(index)"
                    :icon="Delete"
                    circle
                    plain
                  />
                </div>
                <el-row :gutter="20">
                  <el-col :span="24">
                    <el-form-item label="项目名称">
                      <el-input v-model="project.name" placeholder="请输入项目名称" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="24">
                    <el-form-item label="技术栈">
                      <el-input v-model="project.technologies" placeholder="请输入技术栈，如：Vue3, TypeScript, Element Plus" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="开始时间">
                      <el-date-picker
                        v-model="project.startDate"
                        type="month"
                        placeholder="选择开始时间"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="结束时间">
                      <el-date-picker
                        v-model="project.endDate"
                        type="month"
                        placeholder="选择结束时间"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="24">
                    <el-form-item label="项目描述">
                      <el-input
                        v-model="project.description"
                        type="textarea"
                        :rows="3"
                        placeholder="请输入项目描述"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>

            <!-- 证书 -->
            <div class="form-section">
              <div class="section-header">
                <h4 class="section-title">证书</h4>
                <el-button type="primary" size="small" @click="addCertificate" :icon="Plus">添加</el-button>
              </div>
              <div v-for="(cert, index) in formData.certificates" :key="index" class="experience-item">
                <div class="item-header">
                  <span class="item-number">{{ index + 1 }}</span>
                  <el-button
                    v-if="formData.certificates.length > 1"
                    type="danger"
                    size="small"
                    @click="removeCertificate(index)"
                    :icon="Delete"
                    circle
                    plain
                  />
                </div>
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="证书名称">
                      <el-input v-model="cert.name" placeholder="请输入证书名称" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="颁发机构">
                      <el-input v-model="cert.issuer" placeholder="请输入颁发机构" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="获得时间">
                      <el-date-picker
                        v-model="cert.date"
                        type="month"
                        placeholder="选择获得时间"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>

            <!-- 其他信息 -->
            <div class="form-section">
              <h4 class="section-title">其他信息</h4>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="兴趣爱好">
                    <el-input
                      v-model="formData.others.hobbies"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入兴趣爱好"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="语言能力">
                    <el-input
                      v-model="formData.others.languages"
                      type="textarea"
                      :rows="3"
                      placeholder="请输入语言能力"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
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
              @click="isEditing ? updateResume() : createResume()"
            >
              {{ isEditing ? '保存修改' : '创建简历' }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 简历预览 -->
      <el-dialog
        v-model="showPreview"
        title="简历预览"
        width="90%"
        max-width="800px"
        class="preview-dialog"
      >
        <div v-if="currentResume" class="resume-preview">
          <div class="preview-header">
            <h2>{{ currentResume.personalInfo?.name || '未填写姓名' }}</h2>
            <div class="contact-info">
              <span v-if="currentResume.personalInfo?.phone">📞 {{ currentResume.personalInfo.phone }}</span>
              <span v-if="currentResume.personalInfo?.email">📧 {{ currentResume.personalInfo.email }}</span>
              <span v-if="currentResume.personalInfo?.address">📍 {{ currentResume.personalInfo.address }}</span>
            </div>
          </div>
          
          <!-- 个人简介 -->
          <div v-if="currentResume.personalInfo?.summary" class="preview-section">
            <h4>个人简介</h4>
            <p>{{ currentResume.personalInfo.summary }}</p>
          </div>

          <!-- 工作经历 -->
          <div v-if="currentResume.workExperience && currentResume.workExperience.length > 0" class="preview-section">
            <h4>工作经历</h4>
            <div v-for="(work, index) in currentResume.workExperience" :key="index" class="experience-item">
              <div v-if="work.company || work.position" class="work-item">
                <div class="work-header">
                  <h5>{{ work.position || '职位' }} - {{ work.company || '公司' }}</h5>
                  <span class="work-period">
                    {{ formatWorkDate(work.startDate) }} - {{ formatWorkDate(work.endDate) || '至今' }}
                  </span>
                </div>
                <p v-if="work.description" class="work-description">{{ work.description }}</p>
              </div>
            </div>
          </div>

          <!-- 教育经历 -->
          <div v-if="currentResume.education && currentResume.education.length > 0" class="preview-section">
            <h4>教育经历</h4>
            <div v-for="(edu, index) in currentResume.education" :key="index" class="experience-item">
              <div v-if="edu.school || edu.major" class="edu-item">
                <div class="edu-header">
                  <h5>{{ edu.school || '学校' }} - {{ edu.major || '专业' }}</h5>
                  <span class="edu-period">{{ edu.startDate }} - {{ edu.endDate }}</span>
                </div>
                <p v-if="edu.degree" class="edu-degree">{{ edu.degree }}</p>
              </div>
            </div>
          </div>

          <!-- 专业技能 -->
          <div v-if="currentResume.skills && currentResume.skills.length > 0" class="preview-section">
            <h4>专业技能</h4>
            <div class="skills-list">
              <span v-for="(skill, index) in currentResume.skills.filter(s => s && s.trim())" :key="index" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>

          <!-- 项目经历 -->
          <div v-if="currentResume.projects && currentResume.projects.length > 0" class="preview-section">
            <h4>项目经历</h4>
            <div v-for="(project, index) in currentResume.projects" :key="index" class="experience-item">
              <div v-if="project.name || project.description" class="project-item">
                <div class="project-header">
                  <h5>{{ project.name || '项目名称' }}</h5>
                  <span class="project-period">
                    {{ formatWorkDate(project.startDate) }} - {{ formatWorkDate(project.endDate) || '至今' }}
                  </span>
                </div>
                <p v-if="project.technologies" class="project-tech">技术栈：{{ project.technologies }}</p>
                <p v-if="project.description" class="project-description">{{ project.description }}</p>
              </div>
            </div>
          </div>

          <!-- 证书 -->
          <div v-if="currentResume.certificates && currentResume.certificates.length > 0" class="preview-section">
            <h4>证书</h4>
            <div class="certificates-list">
              <div v-for="(cert, index) in currentResume.certificates" :key="index" class="cert-item">
                <div v-if="cert.name || cert.issuer">
                  <strong>{{ cert.name || '证书名称' }}</strong>
                  <span v-if="cert.issuer"> - {{ cert.issuer }}</span>
                  <span v-if="cert.date" class="cert-date">（{{ formatWorkDate(cert.date) }}）</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 其他信息 -->
          <div v-if="currentResume.others && (currentResume.others.hobbies || currentResume.others.languages)" class="preview-section">
            <h4>其他信息</h4>
            <div v-if="currentResume.others.hobbies" class="other-item">
              <strong>兴趣爱好：</strong>{{ currentResume.others.hobbies }}
            </div>
            <div v-if="currentResume.others.languages" class="other-item">
              <strong>语言能力：</strong>{{ currentResume.others.languages }}
            </div>
          </div>
        </div>
      </el-dialog>
    </div>

    <!-- 描述 -->
    <ToolDetail title="功能说明">
      <div class="feature-list">
        <div class="feature-item">
          <h5>📝 完整信息录入</h5>
          <p>支持个人信息、工作经历、教育背景、专业技能、项目经历、证书等全方位信息管理</p>
        </div>
        <div class="feature-item">
          <h5>🔒 数据安全</h5>
          <p>所有简历数据安全存储在云端，支持多设备同步访问</p>
        </div>
        <div class="feature-item">
          <h5>👀 实时预览</h5>
          <p>支持简历内容实时预览，所见即所得的编辑体验</p>
        </div>
        <div class="feature-item">
          <h5>📱 响应式设计</h5>
          <p>完美适配PC和移动端，随时随地管理您的简历</p>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.resume-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon {
  font-size: 24px;
  color: white;
}

.header-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.header-subtitle {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.action-btn {
  border-radius: 8px;
  height: 40px;
  transition: all 0.3s ease;
}

.refresh-btn {
  border: 1px solid #e0e0e0;
  color: #666;
}

.refresh-btn:hover {
  border-color: #4f46e5;
  color: #4f46e5;
}

.create-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 0 20px;
}

.resume-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  min-height: 200px;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  color: #ddd;
}

.empty-title {
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: #666;
}

.empty-desc {
  font-size: 14px;
  margin: 0 0 24px 0;
  color: #999;
}

.resume-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.resume-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.resume-card:hover {
  border-color: #4f46e5;
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.15);
  transform: translateY(-2px);
}

.resume-card:hover::before {
  transform: scaleX(1);
}

.resume-active {
  border-color: #4f46e5;
  background: #fafbff;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.1);
}

.resume-active::before {
  transform: scaleX(1);
}

.resume-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.resume-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.4;
  flex: 1;
  padding-right: 12px;
}

.resume-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.resume-card:hover .resume-actions {
  opacity: 1;
}

.action-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding: 0;
}

.resume-content {
  margin-bottom: 16px;
}

.personal-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.resume-footer {
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.time-text {
  font-size: 12px;
  color: #9ca3af;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.custom-pagination {
  --el-pagination-font-size: 14px;
}

.form-container {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 10px;
}

.form-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #667eea;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.experience-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.item-number {
  background: #667eea;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.skill-item {
  margin-bottom: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.resume-preview {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: white;
  padding: 40px;
  line-height: 1.6;
}

.preview-header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #667eea;
}

.preview-header h2 {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.contact-info {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #666;
}

.preview-section {
  margin-bottom: 25px;
}

.preview-section h4 {
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e9ecef;
}

.work-item, .edu-item, .project-item {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}

.work-item:last-child, .edu-item:last-child, .project-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.work-header, .edu-header, .project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.work-header h5, .edu-header h5, .project-header h5 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  flex: 1;
}

.work-period, .edu-period, .project-period, .cert-date {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  margin-left: 12px;
}

.work-description, .project-description {
  color: #555;
  line-height: 1.6;
  margin: 8px 0 0 0;
}

.edu-degree {
  color: #666;
  font-size: 14px;
  margin: 4px 0 0 0;
}

.project-tech {
  color: #667eea;
  font-size: 14px;
  margin: 4px 0;
  font-weight: 500;
}

.skills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.certificates-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cert-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.other-item {
  margin-bottom: 12px;
  line-height: 1.6;
}

.other-item strong {
  color: #667eea;
  margin-right: 8px;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 16px;
}

.feature-item h5 {
  color: #667eea;
  font-size: 16px;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.feature-item p {
  color: #666;
  font-size: 14px;
  margin: 0;
  line-height: 1.5;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .resume-container {
    padding: 16px;
  }
  
  .header-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .resume-grid {
    grid-template-columns: 1fr;
  }
  
  .form-container {
    max-height: 60vh;
  }
  
  .experience-item {
    padding: 16px;
  }
  
  .contact-info {
    flex-direction: column;
    gap: 8px;
  }
  
  .work-header, .edu-header, .project-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .work-period, .edu-period, .project-period {
    margin-left: 0;
    margin-top: 4px;
  }
}

/* 加载动画 */
.resume-card {
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
