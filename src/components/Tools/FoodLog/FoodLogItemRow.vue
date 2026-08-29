<script setup lang="ts">
// 食物记录列表行（今日列表 / 历史记录共用）
import { CATEGORY_LABELS, type FoodLogItem } from '@/api/food-log'

defineProps<{ item: FoodLogItem }>()
const emit = defineEmits<{
  edit: [item: FoodLogItem]
  delete: [item: FoodLogItem]
}>()

function formatTime(sec: number) {
  const d = new Date(sec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <li class="flex items-center gap-3 py-2.5">
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
      class="text-caption text-ink-400 hover:text-accent-600 px-2 py-1 rounded hover:bg-accent-50 transition-colors shrink-0"
      :aria-label="`编辑 ${item.name}`"
      @click="emit('edit', item)"
    >
      编辑
    </button>
    <button
      type="button"
      class="text-caption text-ink-400 hover:text-danger-600 px-2 py-1 rounded hover:bg-danger-50 transition-colors shrink-0"
      :aria-label="`删除 ${item.name}`"
      @click="emit('delete', item)"
    >
      删除
    </button>
  </li>
</template>
