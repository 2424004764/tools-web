<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TechDocViewer from './TechDocViewer.vue'
import { getTechDoc } from './techDocs'

const route = useRoute()

// 根据路由参数获取技术文档数据
const techDoc = computed(() => {
  const techId = route.params.techId as string
  return getTechDoc(techId)
})
</script>

<template>
  <div v-if="techDoc">
    <TechDocViewer :tech-doc="techDoc" />
  </div>
  <div v-else class="flex items-center justify-center h-screen">
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">文档未找到</h2>
      <p class="text-gray-600">抱歉，您访问的技术文档不存在或正在开发中。</p>
    </div>
  </div>
</template>