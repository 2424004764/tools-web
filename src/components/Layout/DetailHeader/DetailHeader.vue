<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { useToolsStore } from '@/store/modules/tools'
import {rtrim} from '@/utils/string'
import { ElMessage } from 'element-plus'
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

const shareTool = async () => {
  const url = window.location.href
  const text = `推荐一个好用的工具：${props.title}，快来试试吧！\n${url}`
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('分享内容已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
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

    <!-- 分享按钮 -->
    <button
      @click="shareTool"
      class="flex items-center gap-1 text-warm-700 hover:text-warm-600 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-warm-50"
      title="分享给好友"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      <span class="text-sm font-medium">分享</span>
    </button>
  </div>
</template>

<style scoped>

</style>