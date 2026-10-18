<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  fetchAdminTools,
  updateAdminTool,
  batchToggleTools,
  createAdminToolCategory,
  updateAdminToolCategory,
  batchReorderToolCategories,
} from '@/api/admin/tool'
import {
  fetchAdminToolModels,
  createAdminToolModel,
  updateAdminToolModel,
  deleteAdminToolModel,
  batchReorderToolModels,
} from '@/api/admin/tool-model'
import type {
  AdminPagination,
  ToolCategorySummary,
  ToolFeature,
  ToolModel,
} from '@/types/admin'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'

const loading = ref(false)
const list = ref<ToolFeature[]>([])
const categories = ref<ToolCategorySummary[]>([])
const pagination = ref<AdminPagination>({
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

const filter = reactive({
  keyword: '',
  categoryId: '' as number | '',
  enabled: '' as '' | '0' | '1',
})

const activeCategories = ref<number[]>([])

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const load = async () => {
  loading.value = true
  try {
    const result = await fetchAdminTools({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: filter.keyword || undefined,
      categoryId: filter.categoryId || undefined,
      enabled: filter.enabled || undefined,
    })
    list.value = result.list
    categories.value = result.categories
    pagination.value = result.pagination
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.value.page = 1
  load()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  load()
}

// ============ 单个切换 is_enabled ============
const handleToggle = async (row: ToolFeature, value: 0 | 1 | boolean) => {
  const enabled = value === 1 || value === true ? 1 : 0
  // 乐观更新
  row.is_enabled = enabled
  try {
    await updateAdminTool(row.id, { is_enabled: enabled })
    ElMessage.success(enabled ? '已启用' : '已禁用')
    // 同步更新分类聚合
    load()
  } catch (err: any) {
    row.is_enabled = enabled ? 0 : 1
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

// 初次加载完成后把当前所有分类 id 写入 activeCategories → 默认全部展开。
// 之后用户手动折叠/展开的状态由 el-collapse 自身维护；watch 只在「首次从空 → 有数据」时触发。
// 这个 watch 必须在 `groupedList` 声明之后才注册（参见下方 sortedList 之后的 watch）。
const activeInitDone = ref(false)

// ============ 编辑排序/标题 ============
const editDialog = reactive({
  visible: false,
  row: null as ToolFeature | null,
  sort_order: 0,
  title: '',
  description: '',
  credit_cost: 0,
  submitting: false,
})

// ============ 分类编辑（名称/排序，存于 tool_categories 表） ============
const categoryDialog = reactive({
  visible: false,
  id: 0,
  name: '',
  sort_order: 0,
  submitting: false,
})

const openCategoryDialog = (cat: ToolCategorySummary) => {
  categoryDialog.id = cat.category_id
  categoryDialog.name = cat.category_name
  categoryDialog.sort_order = cat.sort_order ?? 0
  categoryDialog.visible = true
}

// 切换分类启用状态：停用后前台隐藏整个分类板块
const handleCategoryEnabled = async (
  cat: ToolCategorySummary,
  value: number | string | boolean,
) => {
  const enabled = value === 1 || value === true ? 1 : 0
  // 乐观更新
  const prev = cat.is_enabled
  cat.is_enabled = enabled
  try {
    await updateAdminToolCategory(cat.category_id, { is_enabled: enabled })
    ElMessage.success(enabled ? '分类已启用' : '分类已停用，前台将隐藏该板块')
  } catch (err: any) {
    cat.is_enabled = prev
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

const openNewCategoryDialog = () => {
  categoryDialog.id = 0
  categoryDialog.name = ''
  const maxSort = Math.max(0, ...categories.value.map((c) => c.sort_order ?? 0))
  categoryDialog.sort_order = maxSort + 10
  categoryDialog.visible = true
}

const submitCategoryDialog = async () => {
  if (!categoryDialog.name.trim()) {
    ElMessage.warning('分类名称不能为空')
    return
  }
  categoryDialog.submitting = true
  try {
    if (categoryDialog.id > 0) {
      await updateAdminToolCategory(categoryDialog.id, {
        name: categoryDialog.name.trim(),
        sort_order: categoryDialog.sort_order,
      })
      ElMessage.success('分类已保存')
    } else {
      await createAdminToolCategory({
        name: categoryDialog.name.trim(),
        sort_order: categoryDialog.sort_order,
      })
      ElMessage.success('分类已创建')
    }
    categoryDialog.visible = false
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  } finally {
    categoryDialog.submitting = false
  }
}

// ============ 工具 model 列表（编辑弹窗内） ============
const modelList = ref<ToolModel[]>([])
const modelLoading = ref(false)
const newModel = reactive({
  visible: false,
  model_key: '',
  model_label: '',
  description: '',
  credit_cost: 0,
  sort_order: 0,
  is_default: false,
  submitting: false,
})

const loadModels = async (toolUrl: string) => {
  if (!toolUrl) return
  modelLoading.value = true
  destroySortable()  // 加载新数据前先清掉旧 Sortable
  try {
    modelList.value = await fetchAdminToolModels(toolUrl)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '加载 model 列表失败')
  } finally {
    modelLoading.value = false
    // 等 el-table 渲染完 DOM 再挂 Sortable
    await nextTick()
    if (modelList.value.length > 0) {
      initModelSortable()
    }
  }
}

const openEditDialog = async (row: ToolFeature) => {
  editDialog.row = row
  editDialog.sort_order = row.sort_order
  editDialog.title = row.title
  editDialog.description = row.description || ''
  editDialog.credit_cost = row.credit_cost ?? 0
  editDialog.visible = true
  await loadModels(row.url)
}

const submitEdit = async () => {
  if (!editDialog.row) return
  editDialog.submitting = true
  try {
    await updateAdminTool(editDialog.row.id, {
      sort_order: editDialog.sort_order,
      title: editDialog.title,
      description: editDialog.description,
      credit_cost: editDialog.credit_cost,
    })
    ElMessage.success('已保存')
    editDialog.visible = false
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  } finally {
    editDialog.submitting = false
  }
}

const openNewModelDialog = () => {
  newModel.model_key = ''
  newModel.model_label = ''
  newModel.description = ''
  newModel.credit_cost = 0
  newModel.sort_order = modelList.value.length
  newModel.is_default = modelList.value.length === 0
  newModel.visible = true
}

const submitNewModel = async () => {
  if (!editDialog.row) return
  if (!newModel.model_key.trim() || !newModel.model_label.trim()) {
    ElMessage.warning('model_key 和 model_label 必填')
    return
  }
  newModel.submitting = true
  try {
    await createAdminToolModel({
      tool_url: editDialog.row.url,
      model_key: newModel.model_key.trim(),
      model_label: newModel.model_label.trim(),
      description: newModel.description.trim(),
      credit_cost: newModel.credit_cost,
      sort_order: newModel.sort_order,
      is_default: newModel.is_default,
    })
    ElMessage.success('已添加')
    newModel.visible = false
    await loadModels(editDialog.row.url)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '添加失败')
  } finally {
    newModel.submitting = false
  }
}

const setDefaultModel = async (m: ToolModel) => {
  if (!editDialog.row) return
  if (m.is_default === 1) return
  try {
    await updateAdminToolModel(m.id, { is_default: 1 })
    ElMessage.success(`已将「${m.model_label}」设为默认`)
    await loadModels(editDialog.row.url)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

const toggleModelEnabled = async (m: ToolModel) => {
  if (!editDialog.row) return
  const next = m.is_enabled === 1 ? 0 : 1
  try {
    await updateAdminToolModel(m.id, { is_enabled: next })
    await loadModels(editDialog.row.url)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

const updateModelCost = async (m: ToolModel, value: number | undefined) => {
  if (!editDialog.row) return
  if (value === undefined || value === m.credit_cost) return
  try {
    await updateAdminToolModel(m.id, { credit_cost: value })
    await loadModels(editDialog.row.url)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

const removeModel = async (m: ToolModel) => {
  try {
    await ElMessageBox.confirm(
      `确认删除 model「${m.model_label}」？若它是默认项，会自动把 sort_order 最小的其它启用项设为默认。`,
      '删除 model',
      { type: 'warning' },
    )
  } catch {
    return
  }
  if (!editDialog.row) return
  try {
    await deleteAdminToolModel(m.id)
    ElMessage.success('已删除')
    await loadModels(editDialog.row.url)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '删除失败')
  }
}

// ============ 拖拽重排 model ============
const modelTableRef = ref<any>(null)
const modelReordering = ref(false)  // 保存中：禁用拖拽、显示 loading
let sortableInstance: Sortable | null = null

// 销毁现有 Sortable（防止重复 init）
const destroySortable = () => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

// 在 model 表格 tbody 上挂 Sortable
const initModelSortable = () => {
  destroySortable()
  const tableEl = modelTableRef.value?.$el
  if (!tableEl) return
  // el-table 的 tbody 在 .el-table__body-wrapper > table > tbody
  const tbody = tableEl.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
  if (!tbody) return
  sortableInstance = Sortable.create(tbody, {
    handle: '.model-drag-handle',
    animation: 150,
    ghostClass: 'model-row-ghost',
    chosenClass: 'model-row-chosen',
    onEnd: handleModelSortEnd,
  })
}

// 拖拽结束：本地重排数组 + 调批量保存
const handleModelSortEnd = async (evt: Sortable.SortableEvent) => {
  if (!editDialog.row) return
  const { oldIndex, newIndex } = evt
  if (oldIndex === newIndex || oldIndex == null || newIndex == null) return

  // 乐观更新：本地数组立即重排
  const moved = modelList.value.splice(oldIndex, 1)[0]
  modelList.value.splice(newIndex, 0, moved)

  // 重新分配 sort_order = 当前下标（保持连续、便于阅读）
  const items = modelList.value.map((m, idx) => ({ id: m.id, sort_order: idx }))
  modelReordering.value = true
  try {
    await batchReorderToolModels(items)
    ElMessage.success('排序已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '保存排序失败，正在恢复…')
    // 失败时从服务端拉回权威顺序
    await loadModels(editDialog.row.url)
  } finally {
    modelReordering.value = false
  }
}

// ============ 拖拽重排分类卡片（tool_categories 表） ============
const categoryGridRef = ref<any>(null)
let categorySortable: Sortable | null = null
let categorySortableInited = false

const destroyCategorySortable = () => {
  if (categorySortable) {
    categorySortable.destroy()
    categorySortable = null
  }
  categorySortableInited = false
}

// 分类聚合数据加载完成后，在卡片网格容器上挂 Sortable
const initCategorySortable = async () => {
  if (categorySortableInited) return
  await nextTick()
  const gridEl = categoryGridRef.value?.$el ?? categoryGridRef.value
  if (!gridEl) return
  categorySortable = Sortable.create(gridEl as HTMLElement, {
    handle: '.category-drag-handle',
    animation: 150,
    ghostClass: 'category-card-ghost',
    chosenClass: 'category-card-chosen',
    onEnd: handleCategorySortEnd,
  })
  categorySortableInited = true
}

// 拖拽结束：本地重排 categories + 批量保存 sort_order（下标 * 10，留出插入空隙）
const handleCategorySortEnd = async (evt: Sortable.SortableEvent) => {
  const { oldIndex, newIndex } = evt
  if (oldIndex === newIndex || oldIndex == null || newIndex == null) return

  const moved = categories.value.splice(oldIndex, 1)[0]
  categories.value.splice(newIndex, 0, moved)

  const items = categories.value.map((c, idx) => ({
    id: c.category_id,
    sort_order: (idx + 1) * 10,
  }))
  try {
    await batchReorderToolCategories(items)
    ElMessage.success('分类排序已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '保存分类排序失败，正在恢复…')
    load()
  }
}

// 分类数据首次到达后初始化拖拽
watch(
  () => categories.value.length,
  (len) => {
    if (len > 0 && !categorySortableInited) {
      initCategorySortable()
    }
  },
)

onBeforeUnmount(() => {
  destroySortable()
  destroyCategorySortable()
})

// ============ 按分类批量启停 ============
const handleCategoryToggle = async (
  cat: { category_id: number; category_name: string },
  enable: boolean,
) => {
  // 找出当前页在该分类下的所有工具 ID
  const ids = list.value
    .filter((t) => t.category_id === cat.category_id && t.is_enabled !== (enable ? 1 : 0))
    .map((t) => t.id)
  if (ids.length === 0) {
    ElMessage.info(`分类「${cat.category_name}」当前页已全部${enable ? '启用' : '禁用'}`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认对分类「${cat.category_name}」当前页的 ${ids.length} 个工具执行${enable ? '启用' : '禁用'}？`,
      '批量操作',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const result = await batchToggleTools(ids, enable)
    ElMessage.success(`已${enable ? '启用' : '禁用'} ${result.updated} 个工具`)
    load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '操作失败')
  }
}

// ============ 复制 URL ============
const copyUrl = (url: string) => {
  navigator.clipboard?.writeText(window.location.origin + url).then(
    () => ElMessage.success('链接已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

// 计算：按分类分组
const groupedList = computed(() => {
  const map = new Map<number, { name: string; tools: ToolFeature[] }>()
  for (const t of list.value) {
    if (!map.has(t.category_id)) {
      map.set(t.category_id, { name: t.category_name, tools: [] })
    }
    map.get(t.category_id)!.tools.push(t)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([cid, v]) => ({ id: cid, name: v.name, tools: v.tools }))
})

// 这里 watch 必须在 groupedList 声明之后注册（避免 setup 阶段的 TDZ 陷阱）。
// 第一次拿到分类数据时自动展开所有折叠面板；之后保留用户手动折叠/展开的状态。
watch(
  () => groupedList.value.map((g) => g.id),
  (ids) => {
    if (activeInitDone.value || ids.length === 0) return
    activeInitDone.value = true
    activeCategories.value = ids
  },
)

onMounted(() => {
  // 默认折叠状态由上面 watch 在 groupedList 首次拿到数据时统一初始化为「全展开」，
  // 这里不再强制清空（之前清空会让用户每次进页都看到一片空折叠面板）
  load()
})
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">工具开关</h2>

      <el-input
        v-model="filter.keyword"
        placeholder="搜索工具名/URL/描述"
        clearable
        class="!w-56"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #append>
          <el-button @click="handleSearch">搜索</el-button>
        </template>
      </el-input>

      <el-select
        v-model="filter.categoryId"
        placeholder="分类"
        class="!w-40"
        @change="handleSearch"
      >
        <el-option label="全部" :value="''" />
        <el-option
          v-for="c in categories"
          :key="c.category_id"
          :label="`${c.category_name} (${c.enabled}/${c.total})`"
          :value="c.category_id"
        />
      </el-select>

      <el-select
        v-model="filter.enabled"
        placeholder="状态"
        clearable
        class="!w-32"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="已启用" value="1" />
        <el-option label="已禁用" value="0" />
      </el-select>

      <el-button @click="openNewCategoryDialog">新建分类</el-button>
      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 左右布局：左侧分类列表（可拖拽排序），右侧工具列表；两侧独立滚动 -->
    <div class="flex items-start gap-4">
      <aside v-if="categories.length" class="w-60 shrink-0 category-pane">
        <div
          ref="categoryGridRef"
          class="flex flex-col gap-2 pr-1"
        >
          <el-card
            v-for="cat in categories"
            :key="cat.category_id"
            shadow="never"
            class="!rounded-xl cursor-pointer hover:!shadow-md transition-shadow"
            @click="filter.categoryId = cat.category_id; handleSearch()"
          >
            <div class="flex items-center gap-1">
              <div class="text-sm text-ink-700 truncate flex-1">{{ cat.category_name }}</div>
              <span
                class="category-drag-handle shrink-0 cursor-grab text-ink-300 hover:text-ink-500 active:cursor-grabbing"
                title="拖拽调整分类顺序"
                @click.stop
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" />
                  <circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" />
                  <circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" />
                </svg>
              </span>
            </div>
            <div class="mt-1 text-lg font-semibold text-ink-900">
              {{ cat.enabled }}
              <span class="text-xs text-ink-400">/ {{ cat.total }}</span>
            </div>
            <div class="mt-2 flex items-center gap-1">
              <el-button
                size="small"
                type="primary"
                link
                @click.stop="openCategoryDialog(cat)"
              >
                编辑
              </el-button>
              <el-switch
                size="small"
                :model-value="cat.is_enabled !== 0"
                @click.stop
                @change="(v: number | string | boolean) => handleCategoryEnabled(cat, v)"
              />
            </div>
          </el-card>
        </div>
      </aside>

      <section class="flex-1 min-w-0 tool-pane">
    <el-collapse v-model="activeCategories">
      <el-collapse-item
        v-for="group in groupedList"
        :key="group.id"
        :name="group.id"
        class="!border !border-border-default !rounded-xl mb-3"
      >
        <template #title>
          <div class="flex items-center gap-2 px-2 w-full">
            <span class="font-medium text-ink-900">{{ group.name }}</span>
            <el-tag size="small" effect="plain">
              {{ group.tools.filter(t => t.is_enabled === 1).length }} / {{ group.tools.length }}
            </el-tag>
            <div class="ml-auto flex items-center gap-1" @click.stop>
              <el-button
                size="small"
                type="success"
                link
                @click.stop="handleCategoryToggle({ category_id: group.id, category_name: group.name }, true)"
              >
                全部启用
              </el-button>
              <el-button
                size="small"
                type="danger"
                link
                @click.stop="handleCategoryToggle({ category_id: group.id, category_name: group.name }, false)"
              >
                全部禁用
              </el-button>
            </div>
          </div>
        </template>

        <el-table :data="group.tools" stripe size="small">
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.is_enabled === 1"
                :loading="false"
                inline-prompt
                active-text="开"
                inactive-text="关"
                @update:model-value="(v: string | number | boolean) => handleToggle(row, v ? 1 : 0)"
              />
            </template>
          </el-table-column>
          <el-table-column label="工具" min-width="200">
            <template #default="{ row }">
              <div class="flex items-center gap-2.5 min-w-0">
                <img
                  v-if="row.logo"
                  :src="row.logo"
                  loading="lazy"
                  class="w-9 h-9 rounded-lg object-contain border border-border-subtle shrink-0"
                  :alt="row.title"
                />
                <div
                  v-else
                  class="w-9 h-9 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-medium shrink-0"
                >
                  {{ (row.title || '?').slice(0, 1) }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-ink-900 font-medium">{{ row.title }}</span>
                  <span class="text-xs text-ink-400 truncate max-w-md">{{ row.description }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="URL" min-width="180">
            <template #default="{ row }">
              <div class="flex items-center gap-1">
                <a
                  :href="row.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-accent-600 hover:underline truncate max-w-[140px]"
                  :title="row.url"
                >{{ row.url }}</a>
                <el-button link size="small" @click="copyUrl(row.url)">复制</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="排序" width="80" prop="sort_order" />
          <el-table-column label="更新时间" width="160">
            <template #default="{ row }">
              <span class="text-xs text-ink-500">{{ formatTime(row.updated_at) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link size="small" @click="openEditDialog(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>
      </section>
    </div>

    <div class="flex justify-end mt-4">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-count="pagination.totalPages"
        layout="total, prev, pager, next, jumper"
        :background="true"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editDialog.visible"
      :title="`编辑工具 - ${editDialog.row?.title || ''}`"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form label-width="80px" class="!mt-2" v-if="editDialog.row">
        <el-form-item label="标题">
          <el-input v-model="editDialog.title" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editDialog.description"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="editDialog.sort_order"
            :min="0"
            :max="9999"
            controls-position="right"
          />
          <span class="ml-2 text-xs text-ink-500">越小越靠前</span>
        </el-form-item>
        <el-form-item label="兜底积分">
          <el-input-number
            v-model="editDialog.credit_cost"
            :min="0"
            :max="999999"
            :step="1"
            controls-position="right"
          />
          <span class="ml-2 text-xs text-ink-500">model 未配置时按此值；0 = 免费</span>
        </el-form-item>

        <!-- 模型列表子表 -->
        <el-form-item label="模型列表">
          <div class="w-full">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-ink-500">
                按 model 维度独立配置积分；前端下拉框从这里渲染
              </span>
              <el-button size="small" type="primary" plain @click="openNewModelDialog">
                + 新增 model
              </el-button>
            </div>
            <el-table
              ref="modelTableRef"
              :data="modelList"
              v-loading="modelLoading || modelReordering"
              size="small"
              row-key="id"
              :empty-text="modelList.length === 0 && !modelLoading ? '该工具还没有配置 model（点击右上角新增）' : '加载中'"
              border
            >
              <el-table-column width="44" align="center" label-class-name="!pl-0">
                <template #default>
                  <span
                    class="model-drag-handle inline-flex items-center justify-center w-6 h-6 text-ink-400 hover:text-ink-700 cursor-grab active:cursor-grabbing select-none"
                    title="拖动调整顺序"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" />
                      <circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" />
                      <circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" />
                    </svg>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="默认" width="70" align="center">
                <template #default="{ row: m }">
                  <el-tag v-if="m.is_default === 1" type="success" size="small" effect="dark">默认</el-tag>
                  <el-button
                    v-else
                    link
                    size="small"
                    type="primary"
                    :disabled="m.is_enabled !== 1"
                    @click="setDefaultModel(m)"
                  >设为默认</el-button>
                </template>
              </el-table-column>
              <el-table-column prop="model_key" label="Key" min-width="140" />
              <el-table-column prop="model_label" label="名称" min-width="160" />
              <el-table-column label="积分" width="130" align="center">
                <template #default="{ row: m }">
                  <el-input-number
                    :model-value="m.credit_cost"
                    :min="0"
                    :max="999999"
                    size="small"
                    controls-position="right"
                    @change="(v) => updateModelCost(m, v)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="启用" width="80" align="center">
                <template #default="{ row: m }">
                  <el-switch
                    :model-value="m.is_enabled === 1"
                    @change="() => toggleModelEnabled(m)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center" fixed="right">
                <template #default="{ row: m }">
                  <el-button link size="small" type="danger" @click="removeModel(m)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="editDialog.submitting"
          @click="submitEdit"
        >保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增 model 弹窗 -->
    <el-dialog
      v-model="newModel.visible"
      title="新增 model"
      width="480px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form label-width="100px" class="!mt-2">
        <el-form-item label="model_key" required>
          <el-input v-model="newModel.model_key" placeholder="例如 gpt-image-2-1k" maxlength="100" />
        </el-form-item>
        <el-form-item label="显示名称" required>
          <el-input v-model="newModel.model_label" placeholder="例如 gpt-image-2 1k（标准）" maxlength="200" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newModel.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item label="积分">
          <el-input-number v-model="newModel.credit_cost" :min="0" :max="999999" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="newModel.sort_order" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="newModel.is_default" />
          <span class="ml-2 text-xs text-ink-500">开启后会把同工具下其它默认项替换</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newModel.visible = false">取消</el-button>
        <el-button type="primary" :loading="newModel.submitting" @click="submitNewModel">添加</el-button>
      </template>
    </el-dialog>

    <!-- 分类编辑弹窗（名称/排序，存于 tool_categories 表） -->
    <el-dialog
      v-model="categoryDialog.visible"
      :title="categoryDialog.id > 0 ? '编辑分类' : '新建分类'"
      width="420px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form label-width="90px" class="!mt-2">
        <el-form-item label="分类名称" required>
          <el-input v-model="categoryDialog.name" placeholder="例如 编码与加密" maxlength="20" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryDialog.sort_order" :min="0" :max="9999" controls-position="right" />
          <span class="ml-2 text-xs text-ink-500">数字越小，首页分类板块越靠前</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="categoryDialog.submitting" @click="submitCategoryDialog">
          {{ categoryDialog.id > 0 ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* Sortable 拖拽视觉反馈（仅作用于编辑弹窗内的 model 表格）；用 token 底色随暗色主题自适应 */
:deep(.model-row-ghost) {
  background: rgb(var(--accent-500) / 0.14) !important;
  opacity: 0.5;
}
:deep(.model-row-chosen) {
  background: rgb(var(--accent-500) / 0.08) !important;
}
:deep(.model-drag-handle:hover) {
  background: rgb(var(--surface-2));
  border-radius: 4px;
}
/* 分类卡片拖拽视觉反馈 */
:deep(.category-card-ghost) {
  opacity: 0.45;
}
:deep(.category-card-chosen) {
  box-shadow: 0 0 0 2px rgb(var(--accent-500) / 0.35);
}

/* 左右布局：分类列表与工具列表各自独立滚动（顶部留出筛选栏高度） */
.category-pane {
  max-height: calc(100vh - 230px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.tool-pane {
  max-height: calc(100vh - 230px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 4px;
}

@media (max-width: 900px) {
  /* 窄屏退化为上下堆叠，滚动交给页面本身 */
  .category-pane,
  .tool-pane {
    max-height: none;
    overflow-y: visible;
  }
}
</style>