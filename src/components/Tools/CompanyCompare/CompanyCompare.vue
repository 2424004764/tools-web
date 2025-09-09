<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Refresh, 
  Plus, 
  Edit, 
  Delete, 
  View, 
  Search, 
  OfficeBuilding, 
  Document, 
  Picture, 
  Filter, 
  DataBoard
} from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface Company {
  id: string
  name: string
  position: string
  salary: string
  benefits: string
  workDays: string
  workHours: string
  location: string
  welfare: string
  overtime: string
  leavePolicy: string
  notes: string
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
  title: "公司对比",
})

const companies = ref<Company[]>([])
const currentCompany = ref<Company | null>(null)
const isEditing = ref(false)
const showForm = ref(false)
const showCompareDialog = ref(false)
const editingCompanyId = ref<string | null>(null)
const compareCompanies = ref<Company[]>([])

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
  name: '',
  position: '',
  salary: '',
  benefits: '',
  workDays: '',
  workHours: '',
  location: '',
  welfare: '',
  overtime: '',
  leavePolicy: '',
  notes: ''
})

// 添加loading状态
const loading = ref(false)
const operationLoading = ref(false)

// 添加搜索相关变量
const searchKeyword = ref('')
const filteredCompanies = computed(() => {
  if (!searchKeyword.value) return companies.value
  return companies.value.filter(company => 
    company.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
    company.position.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 添加筛选和排序相关变量
const showStatsDialog = ref(false)
const showFilterDialog = ref(false)
const sortField = ref('updateTime')
const sortOrder = ref('desc')
const filterOptions = reactive({
  salaryRange: { min: '', max: '' },
  location: '',
  workDays: '',
  hasBenefits: false
})

// 添加统计计算属性
const salaryStats = computed(() => {
  const salaries = companies.value
    .map(c => c.salary)
    .filter(s => s && s.includes('K'))
    .map(s => {
      const match = s.match(/(\d+)-?(\d+)?K/)
      if (match) {
        const min = parseInt(match[1])
        const max = match[2] ? parseInt(match[2]) : min
        return { min, max, avg: (min + max) / 2 }
      }
      return null
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
  
  if (salaries.length === 0) return null
  
  const avgSalaries = salaries.map(s => s.avg)
  return {
    min: Math.min(...avgSalaries),
    max: Math.max(...avgSalaries),
    avg: avgSalaries.reduce((a, b) => a + b, 0) / avgSalaries.length,
    count: salaries.length
  }
})

const locationStats = computed(() => {
  const locations = companies.value.map(c => c.location).filter(Boolean)
  const locationCount: Record<string, number> = {}
  locations.forEach(loc => {
    locationCount[loc] = (locationCount[loc] || 0) + 1
  })
  return Object.entries(locationCount)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
})

// 添加筛选和排序后的公司列表
const filteredAndSortedCompanies = computed(() => {
  let result = filteredCompanies.value

  // 应用筛选
  if (filterOptions.salaryRange.min || filterOptions.salaryRange.max) {
    result = result.filter(company => {
      if (!company.salary) return false
      const match = company.salary.match(/(\d+)-?(\d+)?K/)
      if (!match) return false
      
      const min = parseInt(match[1])
      const max = match[2] ? parseInt(match[2]) : min
      const avg = (min + max) / 2
      
      if (filterOptions.salaryRange.min && avg < parseInt(filterOptions.salaryRange.min)) return false
      if (filterOptions.salaryRange.max && avg > parseInt(filterOptions.salaryRange.max)) return false
      return true
    })
  }

  if (filterOptions.location) {
    result = result.filter(company => 
      company.location.toLowerCase().includes(filterOptions.location.toLowerCase())
    )
  }

  if (filterOptions.workDays) {
    result = result.filter(company => 
      company.workDays.toLowerCase().includes(filterOptions.workDays.toLowerCase())
    )
  }

  if (filterOptions.hasBenefits) {
    result = result.filter(company => 
      company.benefits && company.benefits.trim() !== ''
    )
  }

  // 应用排序
  result.sort((a, b) => {
    let aVal = a[sortField.value as keyof Company]
    let bVal = b[sortField.value as keyof Company]
    
    if (sortField.value === 'salary') {
      // 特殊处理薪资排序
      const aMatch = a.salary?.match(/(\d+)-?(\d+)?K/)
      const bMatch = b.salary?.match(/(\d+)-?(\d+)?K/)
      if (aMatch && bMatch) {
        const aAvg = (parseInt(aMatch[1]) + (aMatch[2] ? parseInt(aMatch[2]) : parseInt(aMatch[1]))) / 2
        const bAvg = (parseInt(bMatch[1]) + (bMatch[2] ? parseInt(bMatch[2]) : parseInt(bMatch[1]))) / 2
        aVal = aAvg as any
        bVal = bAvg as any
      }
    }
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  return result
})

// 添加批量选择功能
const selectedCompanies = ref<Company[]>([])
const isAllSelected = computed(() => 
  filteredAndSortedCompanies.value.length > 0 && 
  selectedCompanies.value.length === filteredAndSortedCompanies.value.length
)

// 获取公司列表（支持分页）
const fetchCompanies = async (page = 1, pageSize = 12) => {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/companies', {
      params: { page, pageSize }
    })
    if (response.status === 200) {
      const data = response.data
      companies.value = data.data || []
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取公司列表失败:', error)
    ElMessage.error('获取公司列表失败')
  } finally {
    loading.value = false
  }
}

// 分页变化处理
const handlePageChange = (page: number) => {
  fetchCompanies(page, pagination.value.pageSize)
}

// 每页条数变化处理
const handleSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  fetchCompanies(1, pageSize)
}

// 创建公司记录
const createCompany = async () => {
  if (!formData.name.trim() || !formData.position.trim()) {
    ElMessage.warning('公司名称和职位不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/companies', {
      name: formData.name.trim(),
      position: formData.position.trim(),
      salary: formData.salary.trim(),
      benefits: formData.benefits.trim(),
      workDays: formData.workDays.trim(),
      workHours: formData.workHours.trim(),
      location: formData.location.trim(),
      welfare: formData.welfare.trim(),
      overtime: formData.overtime.trim(),
      leavePolicy: formData.leavePolicy.trim(),
      notes: formData.notes.trim()
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      await fetchCompanies(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('创建失败')
    }
  } catch (error) {
    console.error('创建公司记录失败:', error)
    ElMessage.error('创建失败')
  } finally {
    operationLoading.value = false
  }
}

// 更新公司记录
const updateCompany = async () => {
  if (!editingCompanyId.value || !formData.name.trim() || !formData.position.trim()) {
    ElMessage.warning('公司名称和职位不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/companies/${editingCompanyId.value}`, {
      name: formData.name.trim(),
      position: formData.position.trim(),
      salary: formData.salary.trim(),
      benefits: formData.benefits.trim(),
      workDays: formData.workDays.trim(),
      workHours: formData.workHours.trim(),
      location: formData.location.trim(),
      welfare: formData.welfare.trim(),
      overtime: formData.overtime.trim(),
      leavePolicy: formData.leavePolicy.trim(),
      notes: formData.notes.trim()
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingCompanyId.value = null
      resetForm()
      await fetchCompanies(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('更新失败')
    }
  } catch (error) {
    console.error('更新公司记录失败:', error)
    ElMessage.error('更新失败')
  } finally {
    operationLoading.value = false
  }
}

// 删除公司记录
const deleteCompany = async (company: Company) => {
  await ElMessageBox.confirm('确定要删除这条公司记录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  try {
    operationLoading.value = true
    const response = await functionsRequest.delete(`/api/companies/${company.id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      if (currentCompany.value?.id === company.id) {
        currentCompany.value = null
      }
      if (companies.value.length === 1 && pagination.value.page > 1) {
        await fetchCompanies(pagination.value.page - 1, pagination.value.pageSize)
      } else {
        await fetchCompanies(pagination.value.page, pagination.value.pageSize)
      }
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error) {
    console.error('删除公司记录失败:', error)
    ElMessage.error('删除失败')
  } finally {
    operationLoading.value = false
  }
}

// 编辑公司记录
const editCompany = (company: Company) => {
  isEditing.value = true
  editingCompanyId.value = company.id
  formData.name = company.name
  formData.position = company.position
  formData.salary = company.salary
  formData.benefits = company.benefits
  formData.workDays = company.workDays
  formData.workHours = company.workHours
  formData.location = company.location
  formData.welfare = company.welfare
  formData.overtime = company.overtime
  formData.leavePolicy = company.leavePolicy
  formData.notes = company.notes
  showForm.value = true
}

// 查看公司记录
const viewCompany = (company: Company) => {
  if (isEditing.value) return
  currentCompany.value = company
  showForm.value = false
}

// 新建公司记录
const newCompany = () => {
  currentCompany.value = null
  isEditing.value = false
  resetForm()
  showForm.value = true
}

// 重置表单
const resetForm = () => {
  formData.name = ''
  formData.position = ''
  formData.salary = ''
  formData.benefits = ''
  formData.workDays = ''
  formData.workHours = ''
  formData.location = ''
  formData.welfare = ''
  formData.overtime = ''
  formData.leavePolicy = ''
  formData.notes = ''
}

// 开始对比
const startCompare = () => {
  if (companies.value.length < 2) {
    ElMessage.warning('至少需要2家公司才能进行对比')
    return
  }
  compareCompanies.value = []
  showCompareDialog.value = true
}

// 添加到对比
const addToCompare = (company: Company) => {
  if (compareCompanies.value.length >= 4) {
    ElMessage.warning('最多只能对比4家公司')
    return
  }
  if (compareCompanies.value.find(c => c.id === company.id)) {
    ElMessage.warning('该公司已在对比列表中')
    return
  }
  compareCompanies.value.push(company)
}

// 从对比中移除
const removeFromCompare = (companyId: string) => {
  const index = compareCompanies.value.findIndex(c => c.id === companyId)
  if (index > -1) {
    compareCompanies.value.splice(index, 1)
  }
}

// 格式化时间
const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 添加计算属性
const showCompanyDetail = computed(() => 
  currentCompany.value !== null && 
  !showForm.value && 
  !isEditing.value
)

// 导出相关方法
const exportToPDF = async () => {
  try {
    const tableElement = document.querySelector('.compare-table')
    if (!tableElement) {
      ElMessage.error('未找到对比表格')
      return
    }

    const canvas = await html2canvas(tableElement as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: tableElement.scrollWidth,
      height: tableElement.scrollHeight
    })
    
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('l', 'mm', 'a4')
    const pageWidth = 297
    const pageHeight = 210
    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 10

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - 20

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - 20
    }

    pdf.save(`公司对比_${new Date().toLocaleDateString()}.pdf`)
    ElMessage.success('PDF导出成功')
  } catch (error) {
    console.error('PDF导出失败:', error)
    ElMessage.error('PDF导出失败')
  }
}

const exportToImage = async () => {
  try {
    const tableElement = document.querySelector('.compare-table')
    if (!tableElement) {
      ElMessage.error('未找到对比表格')
      return
    }

    const canvas = await html2canvas(tableElement as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      width: tableElement.scrollWidth,
      height: tableElement.scrollHeight
    })
    
    const link = document.createElement('a')
    link.download = `公司对比_${new Date().toLocaleDateString()}.png`
    link.href = canvas.toDataURL()
    link.click()
    
    ElMessage.success('图片导出成功')
  } catch (error) {
    console.error('图片导出失败:', error)
    ElMessage.error('图片导出失败')
  }
}

const clearCompareList = () => {
  compareCompanies.value = []
  ElMessage.success('已清空对比列表')
}

// 添加方法
const showStatistics = () => {
  showStatsDialog.value = true
}

const showFilters = () => {
  showFilterDialog.value = true
}

const clearFilters = () => {
  filterOptions.salaryRange = { min: '', max: '' }
  filterOptions.location = ''
  filterOptions.workDays = ''
  filterOptions.hasBenefits = false
  ElMessage.success('已清空筛选条件')
}

const applyFilters = () => {
  showFilterDialog.value = false
  ElMessage.success('筛选条件已应用')
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedCompanies.value = []
  } else {
    selectedCompanies.value = [...filteredAndSortedCompanies.value]
  }
}

const toggleSelectCompany = (company: Company) => {
  const index = selectedCompanies.value.findIndex(c => c.id === company.id)
  if (index > -1) {
    selectedCompanies.value.splice(index, 1)
  } else {
    selectedCompanies.value.push(company)
  }
}

const batchDelete = async () => {
  if (selectedCompanies.value.length === 0) {
    ElMessage.warning('请选择要删除的公司')
    return
  }

  await ElMessageBox.confirm(
    `确定要删除选中的 ${selectedCompanies.value.length} 家公司吗？`,
    '批量删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )

  try {
    operationLoading.value = true
    const deletePromises = selectedCompanies.value.map(company => 
      functionsRequest.delete(`/api/companies/${company.id}`)
    )
    
    await Promise.all(deletePromises)
    
    ElMessage.success(`成功删除 ${selectedCompanies.value.length} 家公司`)
    selectedCompanies.value = []
    await fetchCompanies(pagination.value.page, pagination.value.pageSize)
  } catch (error) {
    console.error('批量删除失败:', error)
    ElMessage.error('批量删除失败')
  } finally {
    operationLoading.value = false
  }
}

const handleSearch = () => {
  // 搜索功能已通过computed属性实现
}

onMounted(() => {
  fetchCompanies()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="companies-container">
      <!-- 操作栏 -->
      <div class="header-section">
        <div class="header-left">
          <div class="icon-wrapper">
            <el-icon class="header-icon"><OfficeBuilding /></el-icon>
          </div>
          <div>
            <h3 class="header-title">公司对比</h3>
            <p class="header-subtitle">共 {{ pagination.total }} 家公司</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button
            class="action-btn stats-btn"
            @click="showStatistics"
            :icon="DataBoard"
            type="info"
          >
            数据统计
          </el-button>
          <el-button
            class="action-btn filter-btn"
            @click="showFilters"
            :icon="Filter"
            type="warning"
          >
            筛选排序
          </el-button>
          <el-button
            class="action-btn refresh-btn"
            @click="fetchCompanies(pagination.page, pagination.pageSize)"
            :icon="Refresh"
            :loading="loading"
            :disabled="loading"
            circle
          />
          <el-button
            class="action-btn compare-btn"
            type="success"
            @click="startCompare"
            :icon="Search"
            :disabled="companies.length < 2"
          >
            开始对比
          </el-button>
          <el-button
            class="action-btn create-btn"
            type="primary"
            @click="newCompany"
            :icon="Plus"
          >
            添加公司
          </el-button>
        </div>
      </div>

      <!-- 搜索和批量操作栏 -->
      <div class="search-section">
        <div class="search-left">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索公司名称或职位..."
            :prefix-icon="Search"
            size="large"
            class="search-input"
            clearable
            @input="handleSearch"
          />
        </div>
        <div class="search-right" v-if="selectedCompanies.length > 0">
          <el-button
            type="danger"
            :icon="Delete"
            @click="batchDelete"
            :loading="operationLoading"
            :disabled="operationLoading"
          >
            批量删除 ({{ selectedCompanies.length }})
          </el-button>
        </div>
      </div>

      <!-- 公司列表 -->
      <div v-loading="loading" class="companies-grid">
        <div v-if="filteredAndSortedCompanies.length === 0 && !loading" class="empty-state">
          <el-icon class="empty-icon"><OfficeBuilding /></el-icon>
          <h3 class="empty-title">{{ searchKeyword ? '未找到匹配的公司' : '暂无公司记录' }}</h3>
          <p class="empty-desc">{{ searchKeyword ? '尝试调整搜索关键词' : '开始添加你的第一家公司记录吧' }}</p>
          <el-button v-if="!searchKeyword" type="primary" @click="newCompany" :icon="Plus">
            添加公司
          </el-button>
        </div>

        <div
          v-for="company in filteredAndSortedCompanies"
          :key="company.id"
          class="company-card"
          :class="{ 
            'company-active': currentCompany?.id === company.id,
            'company-selected': selectedCompanies.find(c => c.id === company.id)
          }"
          @click="viewCompany(company)"
        >
          <!-- 选择框 -->
          <div class="company-checkbox" @click.stop="toggleSelectCompany(company)">
            <el-checkbox 
              :model-value="selectedCompanies.find(c => c.id === company.id) !== undefined"
              @change="toggleSelectCompany(company)"
            />
          </div>
          
          <!-- 公司卡片内容保持不变 -->
          <div class="company-header">
            <div class="company-info">
              <h4 class="company-name">{{ company.name }}</h4>
              <p class="company-position">{{ company.position }}</p>
            </div>
            <div class="company-actions">
              <el-button
                class="action-icon"
                size="small"
                :icon="View"
                @click.stop="viewCompany(company)"
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
                @click.stop="editCompany(company)"
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
                @click.stop="deleteCompany(company)"
                circle
                plain
              />
            </div>
          </div>

          <div class="company-content">
            <div class="company-item">
              <span class="label">薪资:</span>
              <span class="value">{{ company.salary || "未填写" }}</span>
            </div>
            <div class="company-item">
              <span class="label">工作日:</span>
              <span class="value">{{ company.workDays || "未填写" }}</span>
            </div>
            <div class="company-item">
              <span class="label">地点:</span>
              <span class="value">{{ company.location || "未填写" }}</span>
            </div>
          </div>

          <div class="company-footer">
            <div class="company-time">
              <span class="time-label">更新于</span>
              <span class="time-value">{{
                formatTime(company.updateTime)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 全选操作栏 -->
      <div v-if="filteredAndSortedCompanies.length > 0" class="select-all-section">
        <el-checkbox 
          :model-value="isAllSelected"
          @change="toggleSelectAll"
        >
          全选 ({{ selectedCompanies.length }}/{{ filteredAndSortedCompanies.length }})
        </el-checkbox>
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

      <!-- 公司表单 -->
      <el-dialog
        v-model="showForm"
        :title="isEditing ? '编辑公司' : '添加公司'"
        width="90%"
        max-width="800px"
        class="company-dialog"
        @close="isEditing = false"
        destroy-on-close
      >
        <div class="form-container">
          <el-form :model="formData" label-position="top" class="company-form">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="公司名称" required class="form-item">
                  <el-input
                    v-model="formData.name"
                    placeholder="请输入公司名称"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="职位" required class="form-item">
                  <el-input
                    v-model="formData.position"
                    placeholder="请输入职位"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="薪资待遇" class="form-item">
                  <el-input
                    v-model="formData.salary"
                    placeholder="如：8-12K·13薪"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="工作日" class="form-item">
                  <el-input
                    v-model="formData.workDays"
                    placeholder="如：周一至周五、大小周等"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="工作时间" class="form-item">
                  <el-input
                    v-model="formData.workHours"
                    placeholder="如：9:00-18:00"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="工作地点" class="form-item">
                  <el-input
                    v-model="formData.location"
                    placeholder="请输入工作地点"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="福利待遇" class="form-item">
              <el-input
                v-model="formData.benefits"
                type="textarea"
                :rows="3"
                placeholder="如：五险一金、餐补、交通补贴、年终奖等"
                class="form-textarea"
                resize="vertical"
              />
            </el-form-item>

            <el-form-item label="其他福利" class="form-item">
              <el-input
                v-model="formData.welfare"
                type="textarea"
                :rows="2"
                placeholder="如：团建、培训、弹性工作等"
                class="form-textarea"
                resize="vertical"
              />
            </el-form-item>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="加班情况" class="form-item">
                  <el-input
                    v-model="formData.overtime"
                    placeholder="如：很少加班、偶尔加班等"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="请假政策" class="form-item">
                  <el-input
                    v-model="formData.leavePolicy"
                    placeholder="如：年假15天、病假等"
                    size="large"
                    class="form-input"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="备注" class="form-item">
              <el-input
                v-model="formData.notes"
                type="textarea"
                :rows="3"
                placeholder="其他备注信息..."
                class="form-textarea"
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
              @click="
                showForm = false;
                isEditing = false;
              "
            >
              取消
            </el-button>
            <el-button
              type="primary"
              size="large"
              :loading="operationLoading"
              :disabled="operationLoading"
              @click="isEditing ? updateCompany() : createCompany()"
            >
              {{ isEditing ? "保存修改" : "添加公司" }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 公司详情 -->
      <el-dialog
        v-model="showCompanyDetail"
        title="公司详情"
        width="90%"
        max-width="800px"
        class="detail-dialog"
        @close="currentCompany = null"
        destroy-on-close
      >
        <div v-if="currentCompany" class="detail-container">
          <div class="detail-header">
            <h2 class="detail-title">{{ currentCompany.name }}</h2>
            <p class="detail-position">{{ currentCompany.position }}</p>
            <div class="detail-meta">
              <span class="meta-item">
                <el-icon><OfficeBuilding /></el-icon>
                创建于 {{ formatTime(currentCompany.createTime) }}
              </span>
              <span class="meta-item">
                <el-icon><Edit /></el-icon>
                更新于 {{ formatTime(currentCompany.updateTime) }}
              </span>
            </div>
          </div>

          <div class="detail-content">
            <div class="detail-grid">
              <div class="detail-item">
                <label>薪资待遇</label>
                <span>{{ currentCompany.salary || "未填写" }}</span>
              </div>
              <div class="detail-item">
                <label>工作日</label>
                <span>{{ currentCompany.workDays || "未填写" }}</span>
              </div>
              <div class="detail-item">
                <label>工作时间</label>
                <span>{{ currentCompany.workHours || "未填写" }}</span>
              </div>
              <div class="detail-item">
                <label>工作地点</label>
                <span>{{ currentCompany.location || "未填写" }}</span>
              </div>
              <div class="detail-item">
                <label>加班情况</label>
                <span>{{ currentCompany.overtime || "未填写" }}</span>
              </div>
              <div class="detail-item">
                <label>请假政策</label>
                <span>{{ currentCompany.leavePolicy || "未填写" }}</span>
              </div>
            </div>

            <div class="detail-section">
              <label>福利待遇</label>
              <div class="detail-text">
                {{ currentCompany.benefits || "未填写" }}
              </div>
            </div>

            <div class="detail-section">
              <label>其他福利</label>
              <div class="detail-text">
                {{ currentCompany.welfare || "未填写" }}
              </div>
            </div>

            <div class="detail-section" v-if="currentCompany.notes">
              <label>备注</label>
              <div class="detail-text">{{ currentCompany.notes }}</div>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="currentCompany = null"
              >关闭</el-button
            >
            <el-button
              type="primary"
              size="large"
              :icon="Edit"
              @click="currentCompany && editCompany(currentCompany)"
            >
              编辑公司
            </el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 对比弹窗 -->
      <el-dialog
        v-model="showCompareDialog"
        title="公司对比"
        width="95%"
        max-width="1200px"
        class="compare-dialog"
        destroy-on-close
      >
        <div class="compare-container">
          <div class="compare-selector">
            <h4>选择要对比的公司（最多4家）：</h4>
            <div class="company-selector-grid">
              <div
                v-for="company in companies"
                :key="company.id"
                class="selector-card"
                :class="{
                  selected: compareCompanies.find((c) => c.id === company.id),
                }"
                @click="
                  compareCompanies.find((c) => c.id === company.id)
                    ? removeFromCompare(company.id)
                    : addToCompare(company)
                "
              >
                <div class="selector-content">
                  <h5>{{ company.name }}</h5>
                  <p>{{ company.position }}</p>
                </div>
                <div
                  class="selector-check"
                  v-if="compareCompanies.find((c) => c.id === company.id)"
                >
                  ✓
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="compareCompanies.length >= 2"
            class="compare-table-container"
          >
            <h4>对比结果：</h4>
            <div class="compare-table">
              <table>
                <thead>
                  <tr>
                    <th class="compare-label">对比公司</th>
                    <th
                      v-for="company in compareCompanies"
                      :key="company.id"
                      class="compare-company"
                    >
                      <div class="company-header-cell">
                        <div class="company-name">{{ company.name }}</div>
                        <div class="company-position">
                          {{ company.position }}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="compare-label">薪资待遇</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.salary || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">工作日</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.workDays || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">工作时间</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.workHours || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">工作地点</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.location || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">福利待遇</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      <div class="compare-text">
                        {{ company.benefits || "未填写" }}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">其他福利</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      <div class="compare-text">
                        {{ company.welfare || "未填写" }}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">加班情况</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.overtime || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">请假政策</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      {{ company.leavePolicy || "未填写" }}
                    </td>
                  </tr>
                  <tr>
                    <td class="compare-label">备注</td>
                    <td v-for="company in compareCompanies" :key="company.id">
                      <div class="compare-text">
                        {{ company.notes || "未填写" }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <div class="footer-left">
              <el-button 
                size="large" 
                @click="clearCompareList"
                :disabled="compareCompanies.length === 0"
                :icon="Delete"
              >
                清空选择
              </el-button>
            </div>
            <div class="footer-right">
              <el-button 
                size="large" 
                @click="exportToImage"
                :disabled="compareCompanies.length < 2"
                :icon="Picture"
                type="warning"
              >
                导出图片
              </el-button>
              <el-button 
                size="large" 
                @click="exportToPDF"
                :disabled="compareCompanies.length < 2"
                :icon="Document"
                type="success"
              >
                导出PDF
              </el-button>
              <el-button size="large" @click="showCompareDialog = false">
                关闭
              </el-button>
            </div>
          </div>
        </template>
      </el-dialog>

      <!-- 数据统计弹窗 -->
      <el-dialog
        v-model="showStatsDialog"
        title="数据统计"
        width="90%"
        max-width="800px"
        class="stats-dialog"
        destroy-on-close
      >
        <div class="stats-content">
          <h4>薪资统计</h4>
          <p v-if="salaryStats">平均薪资：{{ salaryStats.avg.toFixed(0) }}K</p>
          <p v-if="salaryStats">薪资范围：{{ salaryStats.min }}K - {{ salaryStats.max }}K</p>
          <p v-if="salaryStats">样本数量：{{ salaryStats.count }}</p>

          <h4>工作地点统计</h4>
          <div v-if="locationStats.length > 0">
            <p v-for="loc in locationStats" :key="loc.location">
              {{ loc.location }} ({{ loc.count }}家)
            </p>
          </div>
          <p v-else>暂无工作地点统计数据</p>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="showStatsDialog = false">关闭</el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 筛选排序弹窗 -->
      <el-dialog
        v-model="showFilterDialog"
        title="筛选排序"
        width="90%"
        max-width="600px"
        class="filter-dialog"
        destroy-on-close
      >
        <div class="filter-form">
          <el-form :model="filterOptions" label-position="top">
            <el-row :gutter="20">
              <el-col :span="24">
                <el-form-item label="薪资范围" class="filter-item">
                  <el-input-number
                    v-model="filterOptions.salaryRange.min"
                    placeholder="最小"
                    :min="0"
                    :max="100"
                    style="width: 120px; margin-right: 10px;"
                  />
                  -
                  <el-input-number
                    v-model="filterOptions.salaryRange.max"
                    placeholder="最大"
                    :min="0"
                    :max="100"
                    style="width: 120px; margin-left: 10px;"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="工作地点" class="filter-item">
                  <el-input
                    v-model="filterOptions.location"
                    placeholder="请输入工作地点"
                    clearable
                  />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="工作日" class="filter-item">
                  <el-input
                    v-model="filterOptions.workDays"
                    placeholder="如：周一至周五、大小周等"
                    clearable
                  />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="包含福利" class="filter-item">
                  <el-checkbox v-model="filterOptions.hasBenefits">
                    只显示有福利的公司
                  </el-checkbox>
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="large" @click="clearFilters">清空筛选</el-button>
            <el-button size="large" type="primary" @click="applyFilters">应用筛选</el-button>
            <el-button size="large" @click="showFilterDialog = false">关闭</el-button>
          </div>
        </template>
      </el-dialog>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        公司对比工具，帮助你记录和对比不同公司的待遇信息。支持录入薪资、工作时间、福利待遇、加班情况等多维度信息，并提供直观的对比功能，让你更好地评估和选择心仪的工作机会。所有数据安全存储在云端，支持历史记录管理。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 主容器样式 */
.companies-container {
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  border-radius: 24px;
  padding: 32px;
  min-height: 600px;
  position: relative;
  overflow: hidden;
}

.companies-container::before {
  content: "";
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

.companies-container > * {
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
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.3);
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
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
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
  color: #4f46e5;
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.2);
}

.compare-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  padding: 12px 24px;
  font-weight: 600;
}

.compare-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
}

.create-btn {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  border: none;
  padding: 12px 24px;
  font-weight: 600;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4);
}

/* 公司网格 */
.companies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
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

/* 公司卡片 */
.company-card {
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

.company-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4f46e5, #06b6d4);
  border-radius: 20px 20px 0 0;
}

.company-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: #4f46e5;
}

.company-active {
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.05);
}

.company-selected {
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
}

.company-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.company-info {
  flex: 1;
}

.company-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 4px 0;
  line-height: 1.3;
  word-break: break-word;
}

.company-position {
  font-size: 14px;
  color: #4f46e5;
  margin: 0;
  font-weight: 500;
}

.company-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: all 0.3s ease;
}

.company-card:hover .company-actions {
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
  background: rgba(79, 70, 229, 0.1);
}

.delete-icon:hover {
  background: rgba(245, 101, 101, 0.1);
}

.company-content {
  margin-bottom: 16px;
}

.company-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.company-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #718096;
  font-weight: 500;
  min-width: 60px;
}

.value {
  color: #2d3748;
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: 12px;
}

.company-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.company-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.time-label {
  color: #a0aec0;
}

.time-value {
  color: #4f46e5;
  font-weight: 500;
}

/* 弹窗样式 */
:deep(.company-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.company-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: white;
  padding: 24px 32px;
  border-bottom: none;
}

:deep(.company-dialog .el-dialog__title) {
  font-size: 20px;
  font-weight: 600;
}

:deep(.company-dialog .el-dialog__body) {
  padding: 32px;
  background: #f8fafc;
}

.form-container {
  max-width: 100%;
}

.company-form {
  margin-bottom: 0;
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

:deep(.form-input .el-input__wrapper) {
  border-radius: 12px;
  padding: 16px;
  font-size: 16px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
}

:deep(.form-input .el-input__wrapper:hover) {
  border-color: #4f46e5;
}

:deep(.form-input .el-input__wrapper.is-focus) {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

:deep(.form-textarea .el-textarea__inner) {
  border-radius: 12px;
  padding: 16px;
  font-size: 15px;
  line-height: 1.6;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  font-family: inherit;
}

:deep(.form-textarea .el-textarea__inner:hover) {
  border-color: #4f46e5;
}

:deep(.form-textarea .el-textarea__inner:focus) {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
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
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
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
  font-size: 28px;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 8px 0;
  line-height: 1.3;
  word-break: break-word;
}

.detail-position {
  font-size: 18px;
  color: #4f46e5;
  margin: 0 0 16px 0;
  font-weight: 500;
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
  color: #4f46e5;
}

.detail-content {
  padding: 32px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.detail-item {
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item label {
  font-size: 14px;
  font-weight: 600;
  color: #718096;
}

.detail-item span {
  font-size: 16px;
  color: #2d3748;
  font-weight: 500;
}

.detail-section {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section label {
  font-size: 16px;
  font-weight: 600;
  color: #718096;
  display: block;
  margin-bottom: 12px;
}

.detail-text {
  font-size: 15px;
  color: #2d3748;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

/* 对比弹窗样式 */
:deep(.compare-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.compare-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: white;
  padding: 24px 32px;
}

:deep(.compare-dialog .el-dialog__body) {
  padding: 32px;
  background: #f8fafc;
  max-height: 70vh;
  overflow-y: auto;
}

.compare-container h4 {
  color: #2d3748;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.company-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}

.selector-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selector-card:hover {
  border-color: #4f46e5;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
}

.selector-card.selected {
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.05);
}

.selector-content h5 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 4px 0;
}

.selector-content p {
  font-size: 14px;
  color: #718096;
  margin: 0;
}

.selector-check {
  color: #4f46e5;
  font-size: 18px;
  font-weight: bold;
}

.compare-table-container {
  margin-top: 32px;
}

/* 对比表格样式优化 */
.compare-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 100%;
  width: max-content;
}

.compare-table table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px; /* 确保表格有最小宽度 */
}

.compare-table th,
.compare-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
  white-space: nowrap; /* 防止文字换行 */
  min-width: 120px; /* 设置最小列宽 */
}

.compare-label {
  background: #f7fafc;
  font-weight: 600;
  color: #4f46e5;
  min-width: 120px;
  width: 120px;
  position: sticky;
  left: 0;
  z-index: 1;
}

.compare-company {
  min-width: 200px;
  width: 200px;
}

.company-header-cell {
  text-align: center;
}

.company-name {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 4px;
}

.company-position {
  font-size: 14px;
  color: #718096;
}

.compare-text {
  max-width: 200px;
  word-break: break-word;
  line-height: 1.4;
}

/* 数据统计弹窗样式 */
:deep(.stats-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.stats-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: white;
  padding: 24px 32px;
}

:deep(.stats-dialog .el-dialog__body) {
  padding: 32px;
  background: #f8fafc;
}

.stats-content h4 {
  color: #2d3748;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.stats-content p {
  font-size: 16px;
  color: #4f46e5;
  font-weight: 500;
  margin: 8px 0;
}

/* 筛选排序弹窗样式 */
:deep(.filter-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.filter-dialog .el-dialog__header) {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: white;
  padding: 24px 32px;
}

:deep(.filter-dialog .el-dialog__body) {
  padding: 32px;
  background: #f8fafc;
}

.filter-form .filter-item {
  margin-bottom: 24px;
}

:deep(.filter-form .el-form-item__label) {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 8px;
}

:deep(.filter-form .el-input-number) {
  width: 100%;
}

:deep(.filter-form .el-checkbox) {
  margin-top: 8px;
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
  --el-pagination-text-color: #4f46e5;
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
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
}

:deep(.custom-pagination .el-pager li.is-active) {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: white;
  border-color: transparent;
}

:deep(.custom-pagination .btn-prev),
:deep(.custom-pagination .btn-next) {
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid transparent;
  border-radius: 8px;
  color: #4f46e5;
  transition: all 0.3s ease;
}

:deep(.custom-pagination .btn-prev:hover),
:deep(.custom-pagination .btn-next:hover) {
  border-color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
}

/* 搜索栏样式 */
.search-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.search-left {
  flex: 1;
}

.search-right {
  margin-left: 16px;
}

.search-input {
  max-width: 400px;
}

:deep(.search-input .el-input__wrapper) {
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e2e8f0;
  transition: all 0.3s ease;
  background: white;
}

:deep(.search-input .el-input__wrapper:hover) {
  border-color: #4f46e5;
}

:deep(.search-input .el-input__wrapper.is-focus) {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

/* 对比弹窗footer样式 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 24px 32px;
  background: #f8fafc;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .companies-container {
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

  .companies-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .company-card {
    padding: 16px;
  }

  .company-actions {
    opacity: 1;
  }

  :deep(.company-dialog .el-dialog__body),
  :deep(.detail-dialog .el-dialog__body),
  :deep(.compare-dialog .el-dialog__body),
  :deep(.stats-dialog .el-dialog__body),
  :deep(.filter-dialog .el-dialog__body) {
    padding: 16px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .company-selector-grid {
    grid-template-columns: 1fr;
  }

  .compare-table {
    overflow-x: auto;
  }

  .compare-table table {
    min-width: 600px;
  }

  .pagination-wrapper {
    padding: 16px;
    margin-top: 16px;
  }

  :deep(.custom-pagination .el-pagination__sizes),
  :deep(.custom-pagination .el-pagination__jump) {
    display: none;
  }

  .search-section {
    padding: 16px;
    margin-bottom: 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .search-left {
    width: 100%;
  }

  .search-right {
    width: 100%;
    text-align: center;
  }

  .search-input {
    max-width: 100%;
  }
  
  .dialog-footer {
    flex-direction: column;
    gap: 16px;
  }
  
  .footer-left,
  .footer-right {
    width: 100%;
    justify-content: center;
  }
}

/* 导出时的特殊样式 */
@media print {
  .compare-table {
    box-shadow: none;
    border-radius: 0;
  }
  
  .compare-table table {
    min-width: 100%;
  }
  
  .compare-table th,
  .compare-table td {
    padding: 12px 8px;
    font-size: 12px;
  }
}
</style>