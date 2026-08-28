<script setup lang="ts">
// 今日吃啥 - 食物记录
// 极简单用户工具：录入 → 列表 → 删行
// 不做 member / chart / 统计,聚焦「今天吃了什么」

import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import {
  fetchFoodLog,
  createFoodLog,
  updateFoodLog,
  deleteFoodLog,
  MEAL_LABELS,
  CATEGORY_LABELS,
  todayRange,
  type FoodLogItem,
  type FoodMeal,
  type FoodCategory,
} from '@/api/food-log'
import { useUserStore } from '@/store/modules/user'

const info = { title: '今日吃啥' }

const userStore = useUserStore()

// ============ 数据 ============
const list = ref<FoodLogItem[]>([])
const summary = ref({
  count: 0,
  totalCalories: 0,
  byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
  rangeStart: 0,
  rangeEnd: 0,
})
const loading = ref(false)
const submitting = ref(false)

// ============ 表单 ============
const form = ref({
  name: '',
  meal: 'breakfast' as FoodMeal,
  category: 'staple' as FoodCategory,
  quantity: '',
  calories: undefined as number | undefined,
  note: '',
})
// 弹窗：移动端友好
const formVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const isMobile = ref(false)
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 768
}

function resetForm() {
  form.value = {
    name: '',
    meal: inferMealByTime(),
    category: 'staple',
    quantity: '',
    calories: undefined,
    note: '',
  }
  editingId.value = null
  formMode.value = 'create'
}

// 根据本地时间推断默认时段（早 5-10 / 中 11-14 / 晚 17-21 / 其余 加餐）
function inferMealByTime(): FoodMeal {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return 'breakfast'
  if (h >= 11 && h < 14) return 'lunch'
  if (h >= 17 && h < 21) return 'dinner'
  return 'snack'
}

// ============ 加载 ============
async function load() {
  if (!userStore.getLoginStatus) {
    ElMessage.warning('请先登录后再记录')
    return
  }
  loading.value = true
  try {
    const { startAt, endAt } = todayRange()
    const res = await fetchFoodLog({ startAt, endAt })
    list.value = res.items
    summary.value = res.summary
  } catch (err: any) {
    console.error('[food-log] load error', err)
    ElMessage.error(err?.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  load()
})

// ============ 提交 ============
function openCreate() {
  resetForm()
  formVisible.value = true
}

function openEdit(item: FoodLogItem) {
  formMode.value = 'edit'
  editingId.value = item.id
  form.value = {
    name: item.name,
    meal: item.meal,
    category: item.category,
    quantity: item.quantity || '',
    calories: item.calories ?? undefined,
    note: item.note || '',
  }
  formVisible.value = true
}

async function submit() {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('请输入食物名称')
    return
  }
  if (form.value.calories != null && (form.value.calories < 0 || form.value.calories > 100000)) {
    ElMessage.warning('卡路里应在 0-100000 之间')
    return
  }
  submitting.value = true
  try {
    const payload = {
      name,
      meal: form.value.meal,
      category: form.value.category,
      quantity: form.value.quantity.trim() || undefined,
      calories: form.value.calories,
      note: form.value.note.trim() || undefined,
    }
    if (formMode.value === 'edit' && editingId.value) {
      await updateFoodLog(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createFoodLog(payload)
      ElMessage.success('已记录')
    }
    formVisible.value = false
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '保存失败')
  } finally {
    submitting.value = false
  }
}

// ============ 删除 ============
async function onDelete(item: FoodLogItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${item.name}」？`,
      '删除记录',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteFoodLog(item.id)
    ElMessage.success('已删除')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '删除失败')
  }
}

// ============ 派生:按时段分组的展示顺序 ============
const mealOrder: FoodMeal[] = ['breakfast', 'lunch', 'dinner', 'snack']
const groupedByMeal = computed(() => {
  const map: Record<FoodMeal, FoodLogItem[]> = {
    breakfast: [], lunch: [], dinner: [], snack: [],
  }
  for (const it of list.value) {
    if (map[it.meal]) map[it.meal].push(it)
  }
  return mealOrder
    .filter((m) => map[m].length > 0)
    .map((m) => ({ meal: m, items: map[m] }))
})

// ============ 展示工具 ============
function formatTime(sec: number) {
  const d = new Date(sec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title">
      <template #right>
        <button
          v-if="userStore.getLoginStatus"
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors flex items-center gap-1.5"
          @click="openCreate"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          记录一条
        </button>
      </template>
    </DetailHeader>

    <!-- 概览 -->
    <div v-if="userStore.getLoginStatus" class="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="rounded-xl bg-white p-4 border border-border-default">
        <div class="text-caption text-ink-500">今日总条数</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900 tabular-nums">{{ summary.count }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 border border-border-default">
        <div class="text-caption text-ink-500">总卡路里</div>
        <div class="mt-1 text-2xl font-semibold text-accent-700 tabular-nums">
          {{ summary.totalCalories }}
          <span class="text-caption text-ink-500 font-normal">kcal</span>
        </div>
      </div>
      <div class="rounded-xl bg-white p-4 border border-border-default">
        <div class="text-caption text-ink-500">早餐</div>
        <div class="mt-1 text-xl font-semibold text-ink-900 tabular-nums">{{ summary.byMeal.breakfast }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 border border-border-default">
        <div class="text-caption text-ink-500">午餐</div>
        <div class="mt-1 text-xl font-semibold text-ink-900 tabular-nums">{{ summary.byMeal.lunch }}</div>
      </div>
      <div class="rounded-xl bg-white p-4 border border-border-default">
        <div class="text-caption text-ink-500">晚餐</div>
        <div class="mt-1 text-xl font-semibold text-ink-900 tabular-nums">{{ summary.byMeal.dinner }}</div>
      </div>
    </div>

    <!-- 列表（按 meal 分组） -->
    <div v-loading="loading" class="mt-4 space-y-3">
      <div v-if="!userStore.getLoginStatus" class="rounded-xl bg-white p-8 text-center text-ink-500 border border-border-default">
        请先登录后再记录
      </div>
      <div v-else-if="list.length === 0" class="rounded-xl bg-white p-8 text-center text-ink-500 border border-border-default">
        还没有记录，点击右上角「记录一条」开始
      </div>
      <section
        v-for="group in groupedByMeal"
        :key="group.meal"
        class="rounded-xl bg-white p-4 border border-border-default"
      >
        <header class="flex items-center justify-between mb-3">
          <h3 class="text-body font-semibold text-ink-900 flex items-center gap-2">
            <span class="inline-block w-1.5 h-4 rounded-full bg-accent-500"></span>
            {{ MEAL_LABELS[group.meal] }}
          </h3>
          <span class="text-caption text-ink-500">{{ group.items.length }} 条</span>
        </header>
        <ul class="divide-y divide-border-subtle">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="flex items-center gap-3 py-2.5"
            >
              <span class="text-caption text-ink-400 tabular-nums w-12 shrink-0">
                {{ formatTime(item.eatenAt) }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-body-sm text-ink-900 truncate">{{ item.name }}</div>
                <div class="text-caption text-ink-500 flex items-center gap-2 mt-0.5 truncate">
                  <span class="px-1.5 py-0.5 rounded bg-surface-2 text-ink-600">{{ CATEGORY_LABELS[item.category] }}</span>
                  <span v-if="item.quantity">{{ item.quantity }}</span>
                  <span v-if="item.calories != null" class="tabular-nums">{{ item.calories }} kcal</span>
                  <span v-if="item.note" class="truncate">· {{ item.note }}</span>
                </div>
              </div>
              <button
                type="button"
                @click="openEdit(item)"
                class="text-caption text-ink-400 hover:text-accent-600 px-2 py-1 rounded hover:bg-accent-50 transition-colors shrink-0"
                :aria-label="`编辑 ${item.name}`"
              >
                编辑
              </button>
              <button
                type="button"
                @click="onDelete(item)"
                class="text-caption text-ink-400 hover:text-danger-600 px-2 py-1 rounded hover:bg-danger-50 transition-colors shrink-0"
                :aria-label="`删除 ${item.name}`"
              >
                删除
              </button>
            </li>
        </ul>
      </section>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'edit' ? '编辑记录' : '记录一条'"
      :width="isMobile ? '92vw' : '520px'"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <el-form label-width="80px" class="!mt-2">
        <el-form-item label="名称" required>
          <el-input
            v-model="form.name"
            placeholder="如：白米饭 / 炸鸡腿 / 苹果"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="时段">
          <el-radio-group v-model="form.meal">
            <el-radio-button value="breakfast">早餐</el-radio-button>
            <el-radio-button value="lunch">午餐</el-radio-button>
            <el-radio-button value="dinner">晚餐</el-radio-button>
            <el-radio-button value="snack">加餐</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" class="!w-full">
            <el-option
              v-for="(label, value) in CATEGORY_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input
            v-model="form.quantity"
            placeholder="可选，如 1 碗 / 200g / 2 个"
            maxlength="30"
            clearable
          />
        </el-form-item>
        <el-form-item label="卡路里">
          <el-input-number
            v-model="form.calories"
            :min="0"
            :max="100000"
            :step="10"
            controls-position="right"
            class="!w-full"
            placeholder="估算 kcal，可选"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.note"
            type="textarea"
            :rows="2"
            placeholder="可选"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div :class="isMobile ? 'flex flex-col gap-2 w-full' : 'flex justify-end gap-2'">
          <el-button
            @click="formVisible = false"
            :class="isMobile ? '!w-full !order-2' : '!order-1'"
          >取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            @click="submit"
            :class="isMobile ? '!w-full !order-1' : '!order-2'"
          >{{ formMode === 'edit' ? '保存修改' : '保存' }}</el-button>
        </div>
      </template>
    </el-dialog>

    <ToolDetail title="功能说明">
      <div class="space-y-3 text-body-sm text-ink-800">
        <p><strong>用途：</strong>快速记录今天吃了什么，按早 / 中 / 晚 / 加餐分组，可选填入估算卡路里，每天自动统计条数与总卡路里。</p>
        <p><strong>使用建议：</strong>不需要精确到克，只需大致估算。吃过的随手记一条就行，避免最后补记遗漏。</p>
        <p><strong>隐私：</strong>所有记录仅本人可见，存储在 Cloudflare D1 持久化数据中。删除单条不影响其他数据。</p>
      </div>
    </ToolDetail>
  </div>
</template>