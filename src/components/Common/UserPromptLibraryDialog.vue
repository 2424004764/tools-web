<script setup lang="ts">
// 用户级提示词库弹窗
// 父组件用法：
//   <UserPromptLibraryDialog ref="dlgRef" scene="ai-image-edit" @select="onSelect" />
//   dlgRef.value?.open()
// 选中某条时 emit('select', { id, title, content })；父组件把 content 回填到输入框。
//
// 设计：单文件容纳「列表 + 新建/编辑表单 + 选中即关闭」。
//  - 列表用 el-table：title / content 预览 / 更新时间 / 操作
//  - 新建 / 编辑共用一个表单弹窗（el-dialog 嵌套）
//  - 删除走 ElMessageBox 二次确认
//  - 行点击 = 选中；操作列按钮拦截冒泡避免误触发

import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchUserToolPrompts,
  createUserToolPrompt,
  updateUserToolPrompt,
  deleteUserToolPrompt,
  type PromptScene,
  type UserToolPrompt,
} from '@/api/user-tool-prompts'

const props = defineProps<{
  scene: PromptScene
}>()

const emit = defineEmits<{
  select: [payload: { id: string; title: string; content: string }]
}>()

const visible = ref(false)
const loading = ref(false)
const list = ref<UserToolPrompt[]>([])

// 新建/编辑表单弹窗
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formTitleInput = ref('')
const formContentInput = ref('')
const formSaving = ref(false)
const editingId = ref<string | null>(null)

function resetForm() {
  formTitleInput.value = ''
  formContentInput.value = ''
  editingId.value = null
  formMode.value = 'create'
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchUserToolPrompts(props.scene)
  } catch (e: any) {
    // axios 拦截器已弹过 ElMessage，这里静默即可
    console.error('[prompt-library] 加载失败', e)
  } finally {
    loading.value = false
  }
}

function open() {
  visible.value = true
  load()
}

defineExpose({ open })

watch(visible, (v) => {
  if (!v) {
    // 关闭时清掉表单残留，避免下次打开看到旧内容
    resetForm()
    formVisible.value = false
  }
})

// ============ 选中 ============
function onRowClick(row: UserToolPrompt) {
  emit('select', { id: row.id, title: row.title, content: row.content })
  visible.value = false
}

// ============ 新建 / 编辑 ============
function openCreate() {
  resetForm()
  formVisible.value = true
}

function openEdit(row: UserToolPrompt) {
  formMode.value = 'edit'
  editingId.value = row.id
  formTitleInput.value = row.title
  formContentInput.value = row.content
  formVisible.value = true
}

async function submitForm() {
  const title = formTitleInput.value.trim()
  const content = formContentInput.value.trim()
  if (!content) return ElMessage.warning('请输入提示词内容')
  if (title.length > 50) return ElMessage.warning('标题不能超过 50 字符')
  if (content.length > 5000) return ElMessage.warning('提示词不能超过 5000 字符')

  formSaving.value = true
  try {
    if (formMode.value === 'create') {
      await createUserToolPrompt({ scene: props.scene, title, content })
      ElMessage.success('已保存到提示词库')
    } else if (editingId.value) {
      await updateUserToolPrompt(editingId.value, { title, content })
      ElMessage.success('已更新')
    }
    formVisible.value = false
    await load()
  } catch (e: any) {
    // 拦截器已提示
    console.error('[prompt-library] 保存失败', e)
  } finally {
    formSaving.value = false
  }
}

// ============ 删除 ============
async function onDelete(row: UserToolPrompt) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.title}」？此操作不可撤销。`,
      '删除提示词',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteUserToolPrompt(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e: any) {
    console.error('[prompt-library] 删除失败', e)
  }
}

// 内容预览截断：长内容只显示前 60 字 + …
function preview(content: string, max = 60) {
  const s = (content || '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}

function formatTime(s: string) {
  if (!s) return ''
  // SQLite 默认 'YYYY-MM-DD HH:mm:ss'，把空格换成 T 让 Date 正确解析（避免本地时区漂移）
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`提示词库 · ${props.scene}`"
    width="780px"
    :close-on-click-modal="true"
    append-to-body
    destroy-on-close
  >
    <div class="flex items-center justify-between mb-3">
      <div class="text-sm text-gray-500">
        点击列表中的某条即可填入到上方输入框；最多 5000 字。
      </div>
      <el-button type="primary" :icon="undefined" @click="openCreate">
        + 新建提示词
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      empty-text="还没有提示词，点击右上角新建一条试试"
      row-key="id"
      @row-click="onRowClick"
      style="cursor: pointer"
    >
      <el-table-column prop="title" label="标题" min-width="120">
        <template #default="{ row }">
          <span class="font-medium">{{ row.title || '未命名' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="内容预览" min-width="280">
        <template #default="{ row }">
          <span class="text-gray-600 text-sm">{{ preview(row.content) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="150">
        <template #default="{ row }">
          <span class="text-xs text-gray-500">{{ formatTime(row.updated_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="right">
        <template #default="{ row }">
          <el-button
            size="small"
            link
            type="primary"
            @click.stop="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button
            size="small"
            link
            type="danger"
            @click.stop="onDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建 / 编辑 表单 -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新建提示词' : '编辑提示词'"
      width="560px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form @submit.prevent="submitForm">
        <el-form-item label="标题">
          <el-input
            v-model="formTitleInput"
            placeholder="可选；为空时显示「未命名」"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="提示词内容" required>
          <el-input
            v-model="formContentInput"
            type="textarea"
            :rows="6"
            placeholder="输入提示词正文"
            maxlength="5000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="submitForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>