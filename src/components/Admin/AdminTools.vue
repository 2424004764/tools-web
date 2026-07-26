<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  fetchAdminTools,
  updateAdminTool,
  batchToggleTools,
} from '@/api/admin/tool'
import {
  fetchAdminToolModels,
  createAdminToolModel,
  updateAdminToolModel,
  deleteAdminToolModel,
} from '@/api/admin/tool-model'
import type {
  AdminPagination,
  ToolCategorySummary,
  ToolFeature,
  ToolModel,
} from '@/types/admin'
import { ElMessage, ElMessageBox } from 'element-plus'

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
  try {
    modelList.value = await fetchAdminToolModels(toolUrl)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err?.response?.data?.error || '加载 model 列表失败')
  } finally {
    modelLoading.value = false
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

// ============ 按分类批量启停 ============
const handleCategoryToggle = async (cat: ToolCategorySummary, enable: boolean) => {
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

onMounted(() => {
  activeCategories.value = [] // 默认全部折叠
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
        clearable
        class="!w-40"
        @change="handleSearch"
      >
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

      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 分类聚合卡片 -->
    <div v-if="categories.length" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
      <el-card
        v-for="cat in categories"
        :key="cat.category_id"
        shadow="never"
        class="!rounded-xl cursor-pointer hover:!shadow-md transition-shadow"
        @click="filter.categoryId = cat.category_id; handleSearch()"
      >
        <div class="text-sm text-ink-700 truncate">{{ cat.category_name }}</div>
        <div class="mt-1 text-lg font-semibold text-ink-900">
          {{ cat.enabled }}
          <span class="text-xs text-ink-400">/ {{ cat.total }}</span>
        </div>
        <div class="mt-2 flex gap-1">
          <el-button
            size="small"
            type="success"
            link
            @click.stop="handleCategoryToggle(cat, true)"
          >
            全部启用
          </el-button>
          <el-button
            size="small"
            type="danger"
            link
            @click.stop="handleCategoryToggle(cat, false)"
          >
            全部禁用
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 工具列表（按分类折叠） -->
    <el-collapse v-model="activeCategories">
      <el-collapse-item
        v-for="group in groupedList"
        :key="group.id"
        :name="group.id"
        class="!border !border-border-default !rounded-xl mb-3"
      >
        <template #title>
          <div class="flex items-center gap-2 px-2">
            <span class="font-medium text-ink-900">{{ group.name }}</span>
            <el-tag size="small" effect="plain">
              {{ group.tools.filter(t => t.is_enabled === 1).length }} / {{ group.tools.length }}
            </el-tag>
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
              <div class="flex flex-col">
                <span class="text-ink-900 font-medium">{{ row.title }}</span>
                <span class="text-xs text-ink-400 truncate max-w-md">{{ row.description }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="URL" min-width="180">
            <template #default="{ row }">
              <div class="flex items-center gap-1">
                <code class="text-xs text-ink-500 truncate max-w-[140px]">{{ row.url }}</code>
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
              :data="modelList"
              v-loading="modelLoading"
              size="small"
              :empty-text="modelList.length === 0 && !modelLoading ? '该工具还没有配置 model（点击右上角新增）' : '加载中'"
              border
            >
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
  </div>
</template>