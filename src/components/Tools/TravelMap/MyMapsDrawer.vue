<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchMyMaps, createMap, deleteMap } from '@/api/travel-maps'
import { formatDistance } from './constants'
import type { TravelMapMeta } from './types'

const props = defineProps<{
  modelValue: boolean
  /** 当前正在编辑的地图 id，用于高亮 */
  currentId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'open', id: string): void
  (e: 'deleted', id: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const list = ref<TravelMapMeta[]>([])
const loading = ref(false)
const creating = ref(false)

const load = async () => {
  loading.value = true
  try {
    const { list: data } = await fetchMyMaps(1, 50)
    list.value = data
  } catch {
    // functionsRequest 的拦截器已经弹过错误提示了
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => { if (open) load() }
)

const handleCreate = async () => {
  creating.value = true
  try {
    const created = await createMap({ title: `我的旅游地图 ${list.value.length + 1}` })
    ElMessage.success('已创建新地图')
    emit('open', created.id)
    visible.value = false
  } catch {
    // 同上
  } finally {
    creating.value = false
  }
}

const handleDelete = async (item: TravelMapMeta) => {
  try {
    await ElMessageBox.confirm(
      `确定删除「${item.title}」吗？地图上的点位和路线会一并删除，且无法恢复。`,
      '删除地图',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return // 用户取消
  }

  try {
    await deleteMap(item.id)
    ElMessage.success('已删除')
    list.value = list.value.filter((m) => m.id !== item.id)
    emit('deleted', item.id)
  } catch {
    // 同上
  }
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <el-drawer v-model="visible" title="我的地图" size="420px" append-to-body :lock-scroll="false">
    <div class="space-y-3">
      <el-button
        type="primary"
        class="w-full"
        :loading="creating"
        @click="handleCreate"
      >
        + 新建地图
      </el-button>

      <div v-if="loading" class="py-8 text-center text-body-sm text-ink-500">加载中…</div>

      <div v-else-if="!list.length" class="py-10 text-center space-y-2">
        <div class="text-3xl">🗺️</div>
        <p class="text-body-sm text-ink-500">还没有地图，点上面的按钮创建第一张</p>
      </div>

      <div
        v-for="item in list"
        :key="item.id"
        class="p-3 rounded-xl border transition-colors"
        :class="item.id === currentId
          ? 'border-accent-400 bg-accent-50'
          : 'border-border-subtle hover:border-accent-300'"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h4 class="font-medium text-ink-900 truncate">{{ item.title }}</h4>
              <span
                v-if="item.isPublic"
                class="shrink-0 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700"
              >已分享</span>
            </div>
            <p v-if="item.description" class="mt-0.5 text-xs text-ink-600 line-clamp-2">
              {{ item.description }}
            </p>
            <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-500">
              <span>📍 {{ item.pointCount }} 点位</span>
              <span>🥾 {{ item.routeCount }} 路线</span>
              <span v-if="item.totalDistance > 0">{{ formatDistance(item.totalDistance) }}</span>
            </div>
            <div class="mt-1 text-xs text-ink-400">更新于 {{ formatTime(item.updatedAt) }}</div>
          </div>
        </div>

        <div class="mt-2.5 flex gap-2">
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="item.id === currentId"
            @click="emit('open', item.id); visible = false"
          >
            {{ item.id === currentId ? '编辑中' : '打开' }}
          </el-button>
          <el-button size="small" type="danger" plain @click="handleDelete(item)">
            删除
          </el-button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>
