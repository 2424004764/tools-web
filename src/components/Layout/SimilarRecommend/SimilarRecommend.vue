<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getToolsCate } from '@/components/Tools/tools'
import { rtrim } from '@/utils/string'

const route = useRoute()
const cates = getToolsCate()

const currentPath = computed(() => rtrim(route.path, '/'))

const current = computed(() => {
  for (const cate of cates) {
    for (const tool of cate.list) {
      if (rtrim(tool.url, '/') === currentPath.value) {
        return { cate, tool }
      }
    }
  }
  return { cate: null as any, tool: null as any }
})

const recommends = computed(() => {
  if (!current.value.cate || !current.value.tool) return []
  return current.value.cate.list.filter(
    (t: any) => rtrim(t.url, '/') !== currentPath.value
  )
})
</script>

<template>
  <div v-if="recommends.length" class="mt-3 rounded-2xl bg-white p-4">
    <div class="text-base font-semibold mb-2">类似功能推荐</div>
    <div class="flex flex-wrap gap-3">
      <a
        v-for="item in recommends"
        :key="item.url"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-blue-600 hover:underline"
      >
        {{ item.title }}
      </a>
    </div>
  </div>
</template>

<style scoped>
</style>