<script setup lang="ts">
// 用户级提示词库弹窗（支持分组）
// 父组件用法：
//   <UserPromptLibraryDialog ref="dlgRef" scene="ai-image-edit" @select="onSelect" />
//   dlgRef.value?.open()
// 选中某条时 emit('select', { id, title, content })；父组件把 content 回填到输入框。
//
// 布局：
//  - 桌面端（>= 768px）：左侧分组列表 + 右侧提示词列表
//  - 移动端（< 768px）：顶部 chips 选择分组（横向滚动） + 下方卡片列表
//
// 分组 CRUD：左侧（桌面）/ 顶部操作区（移动）「+ 新建分组」按钮；
// 提示词 CRUD：右侧卡片列表 / 移动端卡片列表。

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchUserToolPrompts,
  createUserToolPrompt,
  updateUserToolPrompt,
  deleteUserToolPrompt,
  fetchUserToolPromptGroups,
  createUserToolPromptGroup,
  updateUserToolPromptGroup,
  deleteUserToolPromptGroup,
  type PromptScene,
  type UserToolPrompt,
  type UserToolPromptGroup,
} from '@/api/user-tool-prompts'

const props = defineProps<{
  scene: PromptScene
}>()

const emit = defineEmits<{
  select: [payload: { id: string; title: string; content: string }]
}>()

// ============ 状态 ============
const loading = ref(false)
const list = ref<UserToolPrompt[]>([])
const groups = ref<UserToolPromptGroup[]>([])

// 当前选中分组 ID；'__all__' = 全部；'__none__' = 未分组；具体字符串 = 该组
const activeGroupId = ref<string>('__all__')

const keyword = ref('')

// 移动端检测
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 768
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

// 提示词编辑弹窗
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formTitleInput = ref('')
const formContentInput = ref('')
const formGroupIdInput = ref<string | null>(null) // null = 未分组
const formSaving = ref(false)
const editingId = ref<string | null>(null)

// 分组编辑弹窗
const groupFormVisible = ref(false)
const groupFormMode = ref<'create' | 'edit'>('create')
const groupFormNameInput = ref('')
const groupFormColorInput = ref<string>('')
const groupFormSaving = ref(false)
const editingGroupId = ref<string | null>(null)

// 大控件：外层弹窗可见
const visible = ref(false)

function resetForm() {
  formTitleInput.value = ''
  formContentInput.value = ''
  formGroupIdInput.value = activeGroupId.value === '__all__' || activeGroupId.value === '__none__'
    ? null
    : activeGroupId.value
  editingId.value = null
  formMode.value = 'create'
}

function resetGroupForm() {
  groupFormNameInput.value = ''
  groupFormColorInput.value = ''
  editingGroupId.value = null
  groupFormMode.value = 'create'
}

// ============ 加载 ============
async function loadGroups() {
  try {
    groups.value = await fetchUserToolPromptGroups(props.scene)
  } catch (e: any) {
    console.error('[prompt-library] 加载分组失败', e)
  }
}

async function loadPrompts() {
  loading.value = true
  try {
    // 当「全部」时 groupId 传 undefined；「未分组」传 '__none__'
    const gid = activeGroupId.value === '__all__'
      ? undefined
      : activeGroupId.value
    list.value = await fetchUserToolPrompts(props.scene, gid)
  } catch (e: any) {
    console.error('[prompt-library] 加载失败', e)
  } finally {
    loading.value = false
  }
}

// 选中分组变化时重新拉列表
watch(activeGroupId, () => {
  if (visible.value) loadPrompts()
})

async function open() {
  visible.value = true
  keyword.value = ''
  await loadGroups()
  await loadPrompts()
}

defineExpose({ open })

watch(visible, (v) => {
  if (!v) {
    // 关闭时清掉表单残留
    resetForm()
    resetGroupForm()
    formVisible.value = false
    groupFormVisible.value = false
  }
})

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

// ============ 过滤后的提示词 ============
const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list.value
  return list.value.filter((row) => {
    return (
      (row.title || '').toLowerCase().includes(k) ||
      (row.content || '').toLowerCase().includes(k)
    )
  })
})

// ============ 选中 ============
function onRowClick(row: UserToolPrompt) {
  emit('select', { id: row.id, title: row.title, content: row.content })
  visible.value = false
}

// ============ 提示词 新建 / 编辑 ============
function openCreate() {
  resetForm()
  formVisible.value = true
}

function openEdit(row: UserToolPrompt) {
  formMode.value = 'edit'
  editingId.value = row.id
  formTitleInput.value = row.title
  formContentInput.value = row.content
  formGroupIdInput.value = row.group_id || null
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
      await createUserToolPrompt({
        scene: props.scene,
        title,
        content,
        group_id: formGroupIdInput.value,
      })
      ElMessage.success('已保存到提示词库')
    } else if (editingId.value) {
      await updateUserToolPrompt(editingId.value, {
        title,
        content,
        group_id: formGroupIdInput.value,
      })
      ElMessage.success('已更新')
    }
    formVisible.value = false
    await loadPrompts()
    // 新建/编辑后若改了分组，组内计数也会变
    await loadGroups()
  } catch (e: any) {
    console.error('[prompt-library] 保存失败', e)
  } finally {
    formSaving.value = false
  }
}

async function onDelete(row: UserToolPrompt) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.title || '未命名'}」？此操作不可撤销。`,
      '删除提示词',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteUserToolPrompt(row.id)
    ElMessage.success('已删除')
    await loadPrompts()
    await loadGroups()
  } catch (e: any) {
    console.error('[prompt-library] 删除失败', e)
  }
}

// ============ 分组 新建 / 编辑 / 删除 ============
function openCreateGroup() {
  resetGroupForm()
  groupFormVisible.value = true
}

function openEditGroup(g: UserToolPromptGroup) {
  groupFormMode.value = 'edit'
  editingGroupId.value = g.id
  groupFormNameInput.value = g.name
  groupFormColorInput.value = g.color || ''
  groupFormVisible.value = true
}

async function submitGroupForm() {
  const name = groupFormNameInput.value.trim()
  if (!name) return ElMessage.warning('请输入分组名')
  if (name.length > 30) return ElMessage.warning('分组名不能超过 30 字符')

  groupFormSaving.value = true
  try {
    if (groupFormMode.value === 'create') {
      await createUserToolPromptGroup({
        scene: props.scene,
        name,
        color: groupFormColorInput.value || undefined,
      })
      ElMessage.success('已新建分组')
    } else if (editingGroupId.value) {
      await updateUserToolPromptGroup(editingGroupId.value, {
        name,
        color: groupFormColorInput.value || undefined,
      })
      ElMessage.success('已更新分组')
    }
    groupFormVisible.value = false
    await loadGroups()
  } catch (e: any) {
    console.error('[prompt-library] 分组保存失败', e)
  } finally {
    groupFormSaving.value = false
  }
}

async function onDeleteGroup(g: UserToolPromptGroup) {
  try {
    await ElMessageBox.confirm(
      `删除分组「${g.name}」？组内 ${g.prompt_count} 条提示词将变为「未分组」（不会被删除）。`,
      '删除分组',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  try {
    await deleteUserToolPromptGroup(g.id)
    ElMessage.success('已删除分组')
    // 若当前正选着这个组，切回全部
    if (activeGroupId.value === g.id) activeGroupId.value = '__all__'
    await loadGroups()
    await loadPrompts()
  } catch (e: any) {
    console.error('[prompt-library] 删除分组失败', e)
  }
}

// 把整个分组下的提示词批量移动到另一个分组
async function onMergeGroupInto(g: UserToolPromptGroup, targetGroupId: string | null) {
  try {
    await ElMessageBox.confirm(
      `将「${g.name}」下的 ${g.prompt_count} 条提示词全部移动到${
        targetGroupId ? '「' + (groups.value.find(x => x.id === targetGroupId)?.name ?? '') + '」' : '「未分组」'
      }？分组本身保留。`,
      '合并分组',
      { type: 'info', confirmButtonText: '合并', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    const items = list.value.filter((p) => p.group_id === g.id)
    await Promise.all(
      items.map((p) => updateUserToolPrompt(p.id, {
        title: p.title,
        content: p.content,
        group_id: targetGroupId,
      })),
    )
    ElMessage.success('已合并')
    await loadGroups()
    await loadPrompts()
  } catch (e: any) {
    console.error('[prompt-library] 合并失败', e)
  }
}

// ============ 内容预览截断 / 时间格式化 ============
function preview(content: string, max = 60) {
  const s = (content || '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) + '…' : s
}

function formatTime(s: string) {
  if (!s) return ''
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso)
  if (isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ============ 工具函数 ============
// 当前可见分组列表（顶部 chips 用） + 「全部」「未分组」三个固定项
const groupChips = computed(() => {
  return [
    { id: '__all__', name: '全部', count: null, color: '' },
    ...groups.value.map((g) => ({ id: g.id, name: g.name, count: g.prompt_count, color: g.color })),
    { id: '__none__', name: '未分组', count: null, color: '' },
  ]
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`提示词库 · ${props.scene}`"
    :width="isMobile ? '92vw' : '900px'"
    :close-on-click-modal="true"
    append-to-body
    destroy-on-close
  >
    <div
      :class="isMobile ? 'flex flex-col gap-3' : 'grid grid-cols-[180px_1fr] gap-4'"
      :style="isMobile ? {} : { height: 'min(70vh, 620px)' }"
    >
      <!-- ============ 桌面端：左侧分组列表 ============ -->
      <aside v-if="!isMobile" class="flex flex-col gap-2 border-r border-gray-200 pr-3 overflow-hidden">
        <div class="flex items-center justify-between mb-1 shrink-0">
          <span class="text-sm font-medium text-gray-700">分组</span>
          <el-button link size="small" type="primary" @click="openCreateGroup">
            + 新建
          </el-button>
        </div>
        <ul class="flex flex-col gap-1 overflow-y-auto min-h-0">
          <li v-for="g in [{ id: '__all__', name: '全部', prompt_count: null, color: '' }, ...groups, { id: '__none__', name: '未分组', prompt_count: null, color: '' }]"
              :key="g.id">
            <button
              type="button"
              :class="[
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-sm transition-colors text-left',
                activeGroupId === g.id
                  ? 'bg-accent-100 text-accent-700'
                  : 'hover:bg-gray-100 text-gray-700',
              ]"
              @click="activeGroupId = g.id"
            >
              <span class="flex items-center gap-2 min-w-0">
                <span
                  v-if="g.color"
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="`bg-${g.color}-500`"
                  aria-hidden="true"
                ></span>
                <span class="truncate">{{ g.name }}</span>
              </span>
              <span v-if="g.prompt_count != null" class="text-xs text-gray-400 shrink-0">
                {{ g.prompt_count }}
              </span>
              <el-dropdown v-else trigger="click" @command="(c: string) => c === 'create' && openCreateGroup()">
                <span class="text-xs text-gray-400 hover:text-gray-700" @click.stop>···</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="'create'">+ 新建分组</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </button>
            <!-- 已选中的「普通分组」（非全部/未分组）才显示操作入口 -->
            <div v-if="activeGroupId === g.id && !['__all__', '__none__'].includes(g.id)"
                 class="flex items-center gap-1 mt-1 ml-2">
              <el-button link size="small" @click="openEditGroup(g as UserToolPromptGroup)">编辑</el-button>
              <el-dropdown trigger="click" @command="(c: string) => {
                if (c === 'delete') onDeleteGroup(g as UserToolPromptGroup)
                else if (c === 'mergeAll') onMergeGroupInto(g as UserToolPromptGroup, '__none__')
                else if (c === 'mergeTo') {/* no-op: 留给用户从提示词行单独移动 */}
              }">
                <el-button link size="small" type="danger">
                  删除
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="'mergeAll'">合并所有提示词到「未分组」</el-dropdown-item>
                    <el-dropdown-item :command="'delete'" divided>删除分组（提示词保留）</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </li>
        </ul>
      </aside>

      <!-- ============ 右侧：搜索 + 提示词列表 ============ -->
      <section class="flex flex-col min-w-0 overflow-hidden">
        <!-- 顶部操作区 -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
          <div class="text-sm text-gray-500">
            点击列表中的某条即可填入到上方输入框；最多 5000 字。
          </div>
          <div class="flex items-center gap-2 ml-auto flex-wrap">
            <el-input
              v-model="keyword"
              placeholder="搜索标题或内容"
              clearable
              size="default"
              class="!w-44"
              aria-label="搜索提示词"
            >
              <template #prefix>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </template>
            </el-input>
            <el-button v-if="isMobile" type="primary" size="small" @click="openCreateGroup">
              + 分组
            </el-button>
            <el-button type="primary" @click="openCreate">
              + 新建提示词
            </el-button>
          </div>
        </div>

        <!-- 移动端：分组 chips 横滑 -->
        <div v-if="isMobile" class="flex items-center gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            v-for="chip in groupChips"
            :key="chip.id"
            type="button"
            :class="[
              'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-colors',
              activeGroupId === chip.id
                ? 'bg-accent-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            @click="activeGroupId = chip.id"
          >
            <span v-if="chip.color" class="w-1.5 h-1.5 rounded-full bg-white/80" aria-hidden="true"></span>
            <span>{{ chip.name }}</span>
            <span v-if="chip.count != null" class="text-xs opacity-70">{{ chip.count }}</span>
          </button>
        </div>

        <!-- ============ 桌面端：el-table（内部滚动，弹窗不超出视口） ============ -->
        <div v-if="!isMobile" v-loading="loading" class="flex-1 min-h-0">
          <el-table
            :data="filteredList"
            stripe
            empty-text="该分组下还没有提示词"
            row-key="id"
            height="100%"
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
            <el-table-column label="分组" width="100">
              <template #default="{ row }">
                <span v-if="row.group_id" class="text-xs text-gray-600">
                  {{ groups.find(g => g.id === row.group_id)?.name || '?' }}
                </span>
                <span v-else class="text-xs text-gray-400">未分组</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" align="right" fixed="right">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click.stop="openEdit(row)">
                  编辑
                </el-button>
                <el-button size="small" link type="danger" @click.stop="onDelete(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- ============ 移动端：卡片列表 ============ -->
        <div v-else v-loading="loading" class="prompt-cards">
          <div v-if="filteredList.length === 0" class="text-center text-sm text-gray-400 py-10">
            {{ keyword ? `没有匹配「${keyword}」的提示词` : '该分组下还没有提示词' }}
          </div>
          <article
            v-for="row in filteredList"
            :key="row.id"
            class="prompt-card"
            role="button"
            tabindex="0"
            :aria-label="`选择提示词：${row.title || '未命名'}`"
            @click="onRowClick(row)"
            @keyup.enter="onRowClick(row)"
            @keyup.space.prevent="onRowClick(row)"
          >
            <header class="prompt-card-head">
              <h3 class="prompt-card-title">{{ row.title || '未命名' }}</h3>
              <time class="prompt-card-time">{{ formatTime(row.updated_at) }}</time>
            </header>
            <p class="prompt-card-preview">{{ preview(row.content, 120) }}</p>
            <footer class="prompt-card-actions">
              <el-button size="small" class="!flex-1" @click.stop="openEdit(row)">
                编辑
              </el-button>
              <el-button size="small" type="danger" plain class="!flex-1" @click.stop="onDelete(row)">
                删除
              </el-button>
            </footer>
          </article>
        </div>
      </section>
    </div>

    <!-- ============ 新建 / 编辑 提示词 弹窗 ============ -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新建提示词' : '编辑提示词'"
      :width="isMobile ? '92vw' : '560px'"
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
        <el-form-item label="所属分组">
          <el-select
            v-model="formGroupIdInput"
            placeholder="未分组"
            clearable
            class="!w-full"
          >
            <el-option
              v-for="g in groups"
              :key="g.id"
              :label="`${g.name} (${g.prompt_count})`"
              :value="g.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提示词内容" required>
          <el-input
            v-model="formContentInput"
            type="textarea"
            :rows="isMobile ? 8 : 6"
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

    <!-- ============ 新建 / 编辑 分组 弹窗 ============ -->
    <el-dialog
      v-model="groupFormVisible"
      :title="groupFormMode === 'create' ? '新建分组' : '编辑分组'"
      :width="isMobile ? '92vw' : '460px'"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form @submit.prevent="submitGroupForm">
        <el-form-item label="分组名" required>
          <el-input
            v-model="groupFormNameInput"
            placeholder="如：人物写真 / 商品图 / 风景"
            maxlength="30"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="标签颜色">
          <el-radio-group v-model="groupFormColorInput">
            <el-radio-button value="">无</el-radio-button>
            <el-radio-button value="red">红</el-radio-button>
            <el-radio-button value="orange">橙</el-radio-button>
            <el-radio-button value="amber">琥珀</el-radio-button>
            <el-radio-button value="green">绿</el-radio-button>
            <el-radio-button value="teal">青</el-radio-button>
            <el-radio-button value="blue">蓝</el-radio-button>
            <el-radio-button value="indigo">靛</el-radio-button>
            <el-radio-button value="violet">紫</el-radio-button>
            <el-radio-button value="pink">粉</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="groupFormSaving" @click="submitGroupForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
/* 移动端卡片列表：整卡片可点选，底部放操作按钮（大尺寸触屏友好） */
.prompt-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70vh;
  overflow-y: auto;
}
.prompt-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.prompt-card:hover,
.prompt-card:focus-visible {
  border-color: #93c5fd;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
}
.prompt-card:active {
  background: #eff6ff;
}
.prompt-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.prompt-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: rgb(24, 24, 27);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prompt-card-time {
  font-size: 11px;
  color: rgb(161, 161, 170);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.prompt-card-preview {
  margin: 0;
  font-size: 13px;
  color: rgb(82, 82, 91);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.55;
  word-break: break-word;
}
.prompt-card-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f3f4f6;
}
</style>