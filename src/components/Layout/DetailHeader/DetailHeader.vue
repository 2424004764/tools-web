<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { onMounted, computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { useToolsStore } from '@/store/modules/tools'
import {rtrim} from '@/utils/string'
import { ElMessage } from 'element-plus'
import QrcodeVue3 from 'qrcode-vue3'
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

const showQrcode = ref(false)
const toolLink = computed(() => window.location.href)

const toggleQrcode = () => {
  showQrcode.value = !showQrcode.value
}

const shareText = computed(() => {
  return `推荐一个好用的工具：${props.title}，快来试试吧！\n${toolLink.value}`
})

const copyShareText = async () => {
  try {
    await navigator.clipboard.writeText(shareText.value)
    ElMessage.success('分享文本已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(() => {
  findToolCateId()
})

</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center rounded-2xl bg-white p-4 mt-5 mb-5 gap-3">
    <!-- 返回按钮 -->
    <button
      @click="goBack"
      class="flex items-center gap-2 text-warm-700 hover:text-warm-600 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-warm-50"
    >
      <el-icon :size="20">
        <ArrowLeft />
      </el-icon>
      <span class="text-sm font-medium">返回</span>
    </button>

    <!-- 标题 -->
    <div class="text-xl font-semibold text-warm-900 flex-1 min-w-0">
      {{ props.title }}
    </div>

    <div class="flex flex-wrap gap-2 justify-start items-center w-full sm:w-auto">
      <!-- 扫码访问/分享按钮 -->
      <button
        @click="toggleQrcode"
        class="flex items-center gap-1 text-warm-700 hover:text-warm-600 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-warm-50"
        title="扫码访问/分享当前工具"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <path d="M15 15h2v2h-2z" />
          <path d="M19 19h2v2h-2z" />
        </svg>
        <span class="text-sm font-medium">扫码访问/分享</span>
      </button>
    </div>
  </div>

  <div v-if="showQrcode" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="toggleQrcode">
    <div class="bg-white rounded-2xl p-5 max-w-sm w-full mx-4" @click.stop>
      <div class="flex justify-between items-center mb-4">
        <div>
          <div class="text-lg font-semibold">扫码访问</div>
          <div class="text-sm text-slate-500">当前工具链接</div>
        </div>
        <el-button text size="small" @click="toggleQrcode">关闭</el-button>
      </div>
      <div class="flex flex-col items-center gap-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200">
          <QrcodeVue3 :value="toolLink" :size="200" :margin="2" :level="'M'" />
        </div>
        <div class="w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 break-words whitespace-pre-wrap">
          推荐一个好用的工具：{{ props.title }}，快来试试吧！
          <br />
          {{ toolLink }}
        </div>
        <el-button type="primary" size="small" @click="copyShareText">复制分享文本</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>