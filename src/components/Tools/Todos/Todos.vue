<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import Sortable from 'sortablejs'
import functionsRequest from '@/utils/functionsRequest'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Refresh from '~icons/ep/refresh'
import Plus from '~icons/ep/plus'
import Edit from '~icons/ep/edit'
import Delete from '~icons/ep/delete'
import Clock from '~icons/ep/clock'

interface Todo {
  id: string
  title: string
  completed: number
  priority: string
  dueDate: string | null
  category: string
  sortOrder: number
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

// 状态三态：0=已创建，2=进行中，1=已完成（复用 completed 字段，保持历史数据兼容）
const statusOptions = [
  { label: '已创建', value: 0 },
  { label: '进行中', value: 2 },
  { label: '已完成', value: 1 }
]

const getStatusText = (status: number) =>
  statusOptions.find(option => option.value === status)?.label ?? '已创建'

const info = reactive({
  title: "待办事项",
  desc: "在线待办事项管理工具，帮助您高效管理日常任务。支持设置优先级（低/中/高）、截止日期时间（精确到秒）、自定义分类，支持已创建、进行中、已完成三种状态流转。所有数据安全存储在云端，登录后即可随时随地访问和管理您的待办清单。"
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
  priority: '',
  category: '',
  status: [] as number[]
})

const formData = reactive({
  title: '',
  priority: 'medium',
  dueDate: '',
  category: '默认'
})

// 换行批量创建：勾选后标题变为多行输入，一行一条待办（仅新建模式生效）
const MAX_BATCH = 50
const batchMode = ref(false)
const batchCount = computed(() =>
  formData.title.split(/\r?\n/).map(line => line.trim()).filter(Boolean).length
)

const loading = ref(false)
const operationLoading = ref(false)
const collapsedCategories = ref<Set<string>>(new Set())
const groupElements = new Map<string, HTMLElement>()
const sortableInstances = new Map<string, Sortable>()

interface TodoGroup {
  category: string
  todos: Todo[]
}

const groupedTodos = computed<TodoGroup[]>(() => {
  const groups = new Map<string, Todo[]>()
  todos.value.forEach(todo => {
    const category = todo.category || '默认'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(todo)
  })
  if (!groups.has('默认')) groups.set('默认', [])
  return Array.from(groups.entries()).map(([category, groupTodos]) => ({ category, todos: groupTodos }))
})

const isCategoryCollapsed = (category: string) => collapsedCategories.value.has(category)
const toggleCategory = (category: string) => {
  const next = new Set(collapsedCategories.value)
  next.has(category) ? next.delete(category) : next.add(category)
  collapsedCategories.value = next
}

const destroySortables = () => {
  sortableInstances.forEach(instance => instance.destroy())
  sortableInstances.clear()
  groupElements.clear()
}

const reorderGroup = async (category: string, oldIndex: number, newIndex: number) => {
  if (oldIndex === newIndex) return
  const group = groupedTodos.value.find(item => item.category === category)
  if (!group) return
  const moved = group.todos.splice(oldIndex, 1)[0]
  group.todos.splice(newIndex, 0, moved)
  const reorderedTodos = groupedTodos.value.flatMap(item => item.todos)
  todos.value = reorderedTodos.map((todo, index) => ({ ...todo, sortOrder: index }))
  try {
    const response = await functionsRequest.post('/api/todos/reorder', {
      items: group.todos.map((todo, index) => ({ id: todo.id, sortOrder: index }))
    })
    if (response.status !== 200) throw new Error('排序保存失败')
    ElMessage.success('排序已保存')
  } catch (error) {
    console.error('保存待办排序失败:', error)
    ElMessage.error('排序保存失败')
    await fetchTodos(pagination.value.page, pagination.value.pageSize)
  }
}

const initSortables = async () => {
  await nextTick()
  destroySortables()
  groupedTodos.value.forEach(group => {
    const element = document.querySelector(`[data-todo-group="${CSS.escape(group.category)}"] .todo-sortable`) as HTMLElement | null
    if (!element || group.todos.length < 2 || isCategoryCollapsed(group.category)) return
    groupElements.set(group.category, element)
    sortableInstances.set(group.category, Sortable.create(element, {
      animation: 150,
      handle: '.todo-drag-handle',
      ghostClass: 'todo-drag-ghost',
      chosenClass: 'todo-drag-chosen',
      onEnd: event => reorderGroup(group.category, event.oldIndex ?? 0, event.newIndex ?? 0)
    }))
  })
}


const userCategories = computed(() => {
  const categories = new Set<string>()
  categories.add('默认')
  todos.value.forEach(todo => {
    if (todo.category) {
      categories.add(todo.category)
    }
  })
  return Array.from(categories).sort()
})

// 分类搜索建议
const handleCategorySearch = (queryString: string) => {
  const suggestions = userCategories.value.filter(category =>
    category.toLowerCase().includes(queryString.toLowerCase())
  )
  return suggestions.length > 0 ? suggestions : (queryString ? [queryString] : userCategories.value.slice(0, 5))
}

const fetchTodos = async (page = 1, pageSize = 10) => {
  try {
    loading.value = true
    const params: any = { page, pageSize }
    if (filterData.title) params.title = filterData.title
    if (filterData.priority) params.priority = filterData.priority
    if (filterData.category) params.category = filterData.category
    if (filterData.status.length) params.completed = filterData.status.join(',')

    const response = await functionsRequest.get('/api/todos', { params })
    if (response.status === 200) {
      const data = response.data
      todos.value = data.data || []
      if (data.pagination) {
        pagination.value = data.pagination
      }
      await initSortables()
    }
  } catch (error) {
    console.error('获取待办事项失败:', error)
    ElMessage.error('获取待办事项失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  fetchTodos(page, pagination.value.pageSize)
}

const formatDateTime = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const createTodoPayload = () => ({
  priority: formData.priority,
  dueDate: formData.dueDate ? formatDateTime(new Date(formData.dueDate)) : null,
  category: formData.category.trim() || '默认'
})

const createTodo = async () => {
  // 批量模式：一行一条待办，共用优先级 / 分类 / 截止时间
  if (batchMode.value) {
    const lines = formData.title.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (!lines.length) {
      ElMessage.warning('请至少输入一条待办')
      return
    }
    if (lines.length > MAX_BATCH) {
      ElMessage.warning(`一次最多创建 ${MAX_BATCH} 条，请分批操作`)
      return
    }
    const tooLong = lines.findIndex(line => line.length > 200)
    if (tooLong !== -1) {
      ElMessage.warning(`第 ${tooLong + 1} 行超过 200 字，请缩短后再创建`)
      return
    }

    try {
      operationLoading.value = true
      let success = 0
      // 顺序创建，遇到第一条失败即停止（其余保留在输入框可重试）
      for (const line of lines) {
        try {
          const response = await functionsRequest.post('/api/todos', { title: line, ...createTodoPayload() })
          if (response.status !== 201) break
          success += 1
        } catch {
          break
        }
      }
      if (!success) {
        ElMessage.error('创建失败')
        return
      }
      const failed = lines.slice(success)
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
      if (failed.length) {
        // 部分失败：对话框保持打开，未创建的行留在输入框里可直接重试
        ElMessage.warning(`成功创建 ${success} 条，${failed.length} 条失败：${failed[0]}${failed.length > 1 ? ' 等' : ''}`)
        formData.title = failed.join('\n')
        return
      }
      ElMessage.success(`成功创建 ${success} 条待办`)
      showForm.value = false
      resetForm()
    } catch (error) {
      console.error('批量创建待办失败:', error)
      ElMessage.error('创建失败')
      return
    } finally {
      operationLoading.value = false
    }
  }

  if (!formData.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }

  try {
    operationLoading.value = true
    const response = await functionsRequest.post('/api/todos', {
      title: formData.title.trim(),
      ...createTodoPayload()
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
      dueDate: formData.dueDate ? formatDateTime(new Date(formData.dueDate)) : null,
      category: formData.category.trim() || '默认'
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

const changeStatus = async (todo: Todo, status: number) => {
  if (status === todo.completed) return
  try {
    const response = await functionsRequest.put(`/api/todos/${todo.id}`, {
      completed: status
    })

    if (response.status === 200) {
      ElMessage.success(`状态已更新为「${getStatusText(status)}」`)
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    ElMessage.error('更新状态失败')
    await fetchTodos(pagination.value.page, pagination.value.pageSize)
  }
}

const deleteTodo = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个待办事项吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  operationLoading.value = true
  try {
    const response = await functionsRequest.delete(`/api/todos/${id}`)

    if (response.status === 200) {
      ElMessage.success('删除成功')
      await fetchTodos(pagination.value.page, pagination.value.pageSize)
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error: any) {
    console.error('删除待办事项失败:', error)
    ElMessage.error('删除失败')
  } finally {
    operationLoading.value = false
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
  formData.category = todo.category || '默认'
  editingTodoId.value = todo.id
  isEditing.value = true
  showForm.value = true
}

const resetForm = () => {
  formData.title = ''
  formData.priority = 'medium'
  formData.dueDate = ''
  formData.category = '默认'
  editingTodoId.value = null
}

const cancelForm = () => {
  showForm.value = false
  isEditing.value = false
  resetForm()
}

// 描边胶囊样式（参考飞书项目状态标签）：彩色描边 + 淡色底 + 同色文字
const STATUS_PILL: Record<number, string> = {
  0: 'border-accent-300 bg-accent-50/80 text-accent-700 dark:border-accent-500/40 dark:bg-accent-500/10 dark:text-accent-300',
  2: 'border-warning-300 bg-warning-50/80 text-warning-700 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-400',
  1: 'border-ink-300 bg-surface-1 text-ink-500 dark:border-ink-600 dark:bg-surface-2 dark:text-ink-400'
}

const PRIORITY_PILL: Record<string, string> = {
  low: 'border-success-300 bg-success-50/80 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400',
  medium: 'border-warning-300 bg-warning-50/80 text-warning-700 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-400',
  high: 'border-danger-300 bg-danger-50/80 text-danger-700 dark:border-danger-500/40 dark:bg-danger-500/10 dark:text-danger-400'
}

const CATEGORY_PILL = 'border-violet-300 bg-violet-50/80 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300'

const getPriorityText = (priority: string) => {
  const texts: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高'
  }
  return texts[priority] || priority
}

// 实时搜索（防抖）
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [filterData.title, filterData.priority, filterData.category, filterData.status], () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchTodos(1, pagination.value.pageSize)
  }, 300)
})

onMounted(() => {
  fetchTodos()
})

onBeforeUnmount(() => {
  destroySortables()
})
</script>

<template>
  <DetailHeader :title="info.title" />
  <div class="flex flex-col flex-1 bg-white rounded-md p-4 c-sm:p-6 mt-3">
    <!-- 筛选栏 -->
    <div class="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div class="w-full sm:flex-1">
          <label class="block text-body-sm font-medium text-gray-700 mb-1">标题搜索</label>
          <el-input v-model="filterData.title" placeholder="输入标题关键词" clearable />
        </div>
        <div class="w-full sm:w-32">
          <label class="block text-body-sm font-medium text-gray-700 mb-1">优先级</label>
          <el-select v-model="filterData.priority" placeholder="全部" clearable class="w-full">
            <el-option label="低" value="low" />
            <el-option label="中" value="medium" />
            <el-option label="高" value="high" />
          </el-select>
        </div>
        <div class="w-full sm:w-32">
          <label class="block text-body-sm font-medium text-gray-700 mb-1">分类</label>
          <el-select v-model="filterData.category" placeholder="全部" clearable class="w-full">
            <el-option label="默认" value="默认" />
            <el-option v-for="cat in userCategories.filter(c => c !== '默认')" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </div>
        <div class="w-full sm:w-36">
          <label class="block text-body-sm font-medium text-gray-700 mb-1">状态</label>
          <el-select
            v-model="filterData.status"
            placeholder="全部"
            clearable
            multiple
            collapse-tags
            collapse-tags-tooltip
            class="w-full"
          >
            <el-option label="已创建" :value="0" />
            <el-option label="进行中" :value="2" />
            <el-option label="已完成" :value="1" />
          </el-select>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
      <h2 class="text-h3 font-semibold text-gray-800">我的待办</h2>
      <div class="flex gap-2 w-full sm:w-auto">
        <el-button :icon="Refresh" @click="fetchTodos(pagination.page, pagination.pageSize)" :loading="loading">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="showCreateForm" class="flex-1 sm:flex-none">
          新建待办
        </el-button>
      </div>
    </div>

    <!-- 表单弹窗 -->
    <el-dialog v-model="showForm" :title="isEditing ? '编辑待办' : '新建待办'" width="500px">
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-body-sm font-medium text-gray-700">标题</label>
            <el-checkbox
              v-if="!isEditing"
              v-model="batchMode"
              size="small"
            >换行批量创建</el-checkbox>
          </div>
          <el-input
            v-if="batchMode && !isEditing"
            v-model="formData.title"
            type="textarea"
            :rows="6"
            placeholder="一行一个待办，换行分隔，最多 50 条"
          />
          <el-input
            v-else
            v-model="formData.title"
            placeholder="请输入待办事项标题"
            maxlength="200"
            show-word-limit
          />
          <p v-if="batchMode && !isEditing" class="mt-1 text-caption text-gray-500">
            将创建 <span class="font-medium" :class="batchCount > MAX_BATCH ? 'text-red-500' : ''">{{ batchCount }}</span> / {{ MAX_BATCH }} 条待办，共用下方优先级、分类与截止时间
          </p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-1">优先级</label>
            <el-select v-model="formData.priority" class="w-full">
              <el-option label="低" value="low" />
              <el-option label="中" value="medium" />
              <el-option label="高" value="high" />
            </el-select>
          </div>
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-1">分类</label>
            <el-autocomplete
              v-model="formData.category"
              :fetch-suggestions="(queryString, cb) => cb(handleCategorySearch(queryString).map(s => ({ value: s })))"
              placeholder="输入或选择分类"
              class="w-full"
            />
          </div>
        </div>
        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-1">截止时间</label>
          <el-date-picker
            v-model="formData.dueDate"
            type="datetime"
            placeholder="选择日期时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            class="w-full"
          />
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
      <div v-else class="space-y-4">
        <section v-for="group in groupedTodos" :key="group.category" :data-todo-group="group.category" class="todo-group">
          <button type="button" class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-left" @click="toggleCategory(group.category)">
            <span class="flex items-center gap-2 font-semibold text-gray-800">
              <span class="text-xs text-gray-500">{{ isCategoryCollapsed(group.category) ? '▶' : '▼' }}</span>
              <span>{{ group.category }}</span>
              <span class="text-caption font-normal text-gray-500">{{ group.todos.length }}</span>
            </span>
            <span class="text-caption text-gray-500">拖动调整组内顺序</span>
          </button>
          <div v-show="!isCategoryCollapsed(group.category)" class="todo-sortable space-y-2 mt-2">
            <div v-for="todo in group.todos" :key="todo.id"
              class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              :class="{ 'bg-gray-50': todo.completed === 1, 'bg-blue-50': todo.completed === 2 }">
              <span class="todo-drag-handle cursor-grab text-gray-400 select-none" title="拖动排序" aria-label="拖动排序">⋮⋮</span>
              <!-- 状态胶囊：点击弹出菜单切换 -->
              <el-dropdown trigger="click" class="shrink-0" @command="(value: number) => changeStatus(todo, value)">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption leading-5 transition-colors hover:opacity-80"
                  :class="STATUS_PILL[todo.completed] ?? STATUS_PILL[0]"
                  :title="'点击修改状态'"
                >
                  {{ getStatusText(todo.completed) }}
                  <svg class="w-2.5 h-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="option in statusOptions"
                      :key="option.value"
                      :command="option.value"
                      :disabled="option.value === todo.completed"
                    >{{ option.label }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span :class="{ 'line-through text-gray-400': todo.completed === 1 }" class="font-medium">
                    {{ todo.title }}
                  </span>
                  <span
                    class="text-caption px-2.5 py-0.5 rounded-full border leading-5"
                    :class="PRIORITY_PILL[todo.priority] || 'border-ink-300 bg-surface-1 text-ink-500'"
                  >
                    {{ getPriorityText(todo.priority) }}
                  </span>
                  <span
                    v-if="todo.category && todo.category !== '默认'"
                    class="text-caption px-2.5 py-0.5 rounded-full border leading-5"
                    :class="CATEGORY_PILL"
                  >
                    {{ todo.category }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-3 text-caption text-gray-500 mt-1">
                  <span v-if="todo.dueDate" class="flex items-center gap-1">
                    <el-icon><Clock /></el-icon>
                    {{ todo.dueDate }}
                  </span>
                  <span>创建于 {{ new Date(todo.createTime).toLocaleString('zh-CN') }}</span>
                </div>
              </div>
              <div class="flex gap-1">
                <el-button :icon="Edit" size="small" @click="showEditForm(todo)" />
                <el-button :icon="Delete" size="small" type="danger" @click="deleteTodo(todo.id)" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 分页：只有一页时不渲染，避免出现无意义的翻页控件 -->
    <div v-if="pagination.totalPages > 1" class="mt-4 flex justify-center">
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
.todo-drag-handle {
  touch-action: none;
}

.todo-drag-ghost {
  opacity: 0.45;
  background: #eff6ff;
}

.todo-drag-chosen {
  cursor: grabbing;
}
</style>