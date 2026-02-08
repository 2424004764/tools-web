<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus, Edit, Delete, Clock } from '@element-plus/icons-vue'

interface Todo {
  id: string
  title: string
  completed: number
  priority: string
  dueDate: string | null
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
  title: "待办事项",
  desc: "在线待办事项管理工具，帮助您高效管理日常任务。支持设置优先级（低/中/高）、截止日期提醒，一键标记完成状态。所有数据安全存储在云端，登录后即可随时随地访问和管理您的待办清单。"
})

const todos = ref<Todo[]>([])
const showForm = ref(false)
const isEditing = ref(false)
const editingTodoId = ref<string | null>(null)

const pagination = ref<Pagination>({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0,
  hasNext: false,
  hasPrev: false
})

const filterData = reactive({
  title: '',
  priority: ''
})

const formData = reactive({
  title: '',
  priority: 'medium',
  dueDate: ''
})

const loading = ref(false)
const operationLoading = ref(false)

const fetchTodos = async (page = 1, pageSize = 10) => {
  try {
    loading.value = true
    const params: any = { page, pageSize }
    if (filterData.title) params.title = filterData.title
    if (filterData.priority) params.priority = filterData.priority

    const response = await functionsRequest.get('/api/todos', { params })
    if (response.status === 200) {
      const data = response.data
      todos.value = data.data || []
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取待办事项失败:', error)
    ElMessage.error('获取待办事项失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchTodos(1, pagination.value.pageSize)
}

const handleReset = () => {
  filterData.title = ''
  filterData.priority = ''
  fetchTodos(1, pagination.value.pageSize)
}

const handlePageChange = (page: number) => {
  fetchTodos(page, pagination.value.pageSize)
}

const createTodo = async () => {
  if (!formData.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/todos', {
      title: formData.title.trim(),
      priority: formData.priority,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString('zh-CN') : null
    })

    if (response.status === 201) {
      ElMessage.success('创建成功')
      showForm.value = false
      resetForm()
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    }
  } catch (error) {
    console.error('创建待办事项失败:', error)
    ElMessage.error('创建失败')
  } finally {
    operationLoading.value = false
  }
}

const updateTodo = async () => {
  if (!editingTodoId.value || !formData.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.put(`/api/todos/${editingTodoId.value}`, {
      title: formData.title.trim(),
      priority: formData.priority,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toLocaleDateString('zh-CN') : null
    })

    if (response.status === 200) {
      ElMessage.success('更新成功')
      showForm.value = false
      isEditing.value = false
      editingTodoId.value = null
      resetForm()
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    }
  } catch (error) {
    console.error('更新待办事项失败:', error)
    ElMessage.error('更新失败')
  } finally {
    operationLoading.value = false
  }
}

const toggleComplete = async (todo: Todo) => {
  try {
    const response = await functionsRequest.put(`/api/todos/${todo.id}`, {
      completed: todo.completed === 1 ? 0 : 1
    })

    if (response.status === 200) {
      ElMessage.success(todo.completed === 1 ? '已标记为未完成' : '已标记为完成')
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
  }
}

const deleteTodo = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    const response = await functionsRequest.delete(`/api/todos/${id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除待办事项失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const showCreateForm = () => {
  resetForm()
  isEditing.value = false
  showForm.value = true
}

const showEditForm = (todo: Todo) => {
  formData.title = todo.title
  formData.priority = todo.priority
  formData.dueDate = todo.dueDate || ''
  editingTodoId.value = todo.id
  isEditing.value = true
  showForm.value = true
}

const resetForm = () => {
  formData.title = ''
  formData.priority = 'medium'
  formData.dueDate = ''
  editingTodoId.value = null
}

const cancelForm = () => {
  showForm.value = false
  isEditing.value = false
  resetForm()
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600'
  }
  return colors[priority] || 'text-gray-600'
}

const getPriorityText = (priority: string) => {
  const texts: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高'
  }
  return texts[priority] || priority
}

onMounted(() => {
  fetchTodos()
})
</script>

<template>
  <DetailHeader :info="info" />
  <div class="flex flex-col flex-1 bg-white rounded-md p-4 c-sm:p-6 mt-3">
    <!-- 筛选栏 -->
    <div class="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
      <div class="flex gap-3 items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">标题搜索</label>
          <el-input v-model="filterData.title" placeholder="输入标题关键词" clearable />
        </div>
        <div class="w-40">
          <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
          <el-select v-model="filterData.priority" placeholder="全部" clearable class="w-full">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
          </el-select>
        </div>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold text-gray-800">我的待办</h2>
      <div class="flex gap-2">
        <el-button :icon="Refresh" @click="fetchTodos(pagination.page, pagination.pageSize)" :loading="loading">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="showCreateForm">
          新建待办
        </el-button>
      </div>
    </div>

    <!-- 表单弹窗 -->
    <el-dialog v-model="showForm" :title="isEditing ? '编辑待办' : '新建待办'" width="500px">
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">标题</label>
          <el-input v-model="formData.title" placeholder="请输入待办事项标题" maxlength="200" show-word-limit />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
            <el-select v-model="formData.priority" class="w-full">
              <el-option label="低" value="low" />
              <el-option label="中" value="medium" />
              <el-option label="高" value="high" />
            </el-select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
            <el-date-picker v-model="formData.dueDate" type="date" placeholder="选择日期" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cancelForm">取消</el-button>
        <el-button type="primary" @click="isEditing ? updateTodo() : createTodo()" :loading="operationLoading">
          {{ isEditing ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 待办列表 -->
    <div v-loading="loading" class="flex-1">
      <div v-if="todos.length === 0" class="text-center py-12 text-gray-500">
        暂无待办事项
      </div>
      <div v-else class="space-y-2">
        <div v-for="todo in todos" :key="todo.id"
          class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          :class="{ 'bg-gray-50': todo.completed === 1 }">
          <el-checkbox :model-value="todo.completed === 1" @change="toggleComplete(todo)" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span :class="{ 'line-through text-gray-400': todo.completed === 1 }" class="font-medium">
                {{ todo.title }}
              </span>
              <span :class="getPriorityColor(todo.priority)" class="text-xs">
                {{ getPriorityText(todo.priority) }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
              <span v-if="todo.dueDate" class="flex items-center gap-1">
                <el-icon><Clock /></el-icon>
                {{ todo.dueDate }}
              </span>
              <span>创建于 {{ new Date(todo.createTime).toLocaleDateString() }}</span>
            </div>
          </div>
          <div class="flex gap-1">
            <el-button :icon="Edit" size="small" @click="showEditForm(todo)" />
            <el-button :icon="Delete" size="small" type="danger" @click="deleteTodo(todo.id)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="mt-4 flex justify-center">
      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="prev, pager, next, total"
        @current-change="handlePageChange"
      />
    </div>
  </div>
  <ToolDetail title="描述">
    <div class="text-gray-700 leading-relaxed">
      <p>{{ info.desc }}</p>
    </div>
  </ToolDetail>
</template>

<style scoped>
.el-checkbox {
  margin-right: 0;
}
</style>
