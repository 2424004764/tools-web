<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { useToolsStore } from '@/store/modules/tools'
import {rtrim} from '@/utils/string'
const props = defineProps({
  title: String,
  id: Number
})
const route = useRoute()
const router = useRouter()
//store
const toolsStore = useToolsStore()
// 保存工具所属的分类ID
const toolCateId = ref<number>(0)

//根据路由查找工具所属的分类ID
const findToolCateId = () => {
  const currentPath = rtrim(route.path, '/')

  // 遍历所有分类，查找当前路由对应的工具
  for (const cate of toolsStore.cates) {
    if (cate.list) {
      const tool = cate.list.find((t: any) => rtrim(t.url, '/') === currentPath)
      if (tool) {
        toolCateId.value = cate.id
        console.log('Found tool:', tool.title, 'in category:', cate.title, 'cateId:', cate.id)
        return
      }
    }
  }

  // 如果没找到，使用第一个分类
  if (toolsStore.cates.length > 0) {
    toolCateId.value = toolsStore.cates[0].id
    console.log('Tool not found, using default category:', toolCateId.value)
  }
}

// 返回到工具对应的分类
const goBack = () => {
  // 如果有分类ID，跳转到对应分类；否则跳转到首页
  if (toolCateId.value > 0) {
    router.push({
      path: '/',
      query: { value: `cate_${toolCateId.value}` }
    })
  } else {
    router.push('/')
  }
}

onMounted(() => {
  findToolCateId()
})

</script>

<template>
  <div class="flex items-center rounded-2xl bg-white p-4 mt-5 mb-5">
    <!-- 返回按钮 -->
    <button
      @click="goBack"
      class="flex items-center gap-2 text-warm-700 hover:text-warm-600 transition-colors duration-200 mr-4 px-3 py-2 rounded-lg hover:bg-warm-50"
    >
      <el-icon :size="20">
        <ArrowLeft />
      </el-icon>
      <span class="text-sm font-medium">返回</span>
    </button>

    <!-- 标题 -->
    <div class="text-xl font-semibold text-warm-900 flex-1">
      {{ props.title }}
    </div>
  </div>
</template>

<style scoped>

</style>