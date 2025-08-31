<script setup lang="ts">
import { onMounted, watch, nextTick, onUnmounted, ref } from 'vue';
import { RouterLink } from "vue-router"
// import { Star } from '@element-plus/icons-vue'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
// import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from "vue-router"
//store
const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const route = useRoute()
const router = useRouter()
// const getToolsCate = async () => {
//   try {
//     await toolsStore.getToolCate()
//   } catch (error: any) {
//     ElMessage.error(error.message)
//   }
// }


const scrollToAnchor = async () => {
  const v = route.query?.value as any
  const anchor = Array.isArray(v) ? v[0] : v
  if (typeof anchor !== 'string' || !anchor) return
  await nextTick()
  requestAnimationFrame(() => {
    document?.getElementById(anchor)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'start',
    })
  })
}

// 滚动监听相关
const isScrollListenerActive = ref(false)

// 滚动监听函数
const handleScroll = () => {
  if (!isScrollListenerActive.value) return
  
  const categories = toolsStore.cates
  if (categories.length === 0) return

  // 获取当前滚动位置
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop

  // 查找当前可视区域内的分类
  let activeCategory = ''
  
  for (const cate of categories) {
    const element = document.getElementById(`cate_${cate.id}`)
    if (element) {
      const rect = element.getBoundingClientRect()
      const elementTop = scrollTop + rect.top
      
      // 如果分类标题在视窗顶部以下100px范围内，则认为是当前活跃分类
      if (elementTop <= scrollTop + 100) {
        activeCategory = `cate_${cate.id}`
      } else {
        break
      }
    }
  }
  
  // 更新活跃分类
  if (activeCategory && activeCategory !== componentStore.activeCategory) {
    componentStore.setActiveCategory(activeCategory)
  }
}

// 防抖处理
let scrollTimer: number | null = null
const throttledHandleScroll = () => {
  if (scrollTimer) return
  scrollTimer = window.requestAnimationFrame(() => {
    handleScroll()
    scrollTimer = null
  })
}

//跳转锚点 - 复用Left.vue的逻辑
const gotoAnchor = async (anchor: string) => {
  const q = route.query?.value as any
  const current = Array.isArray(q) ? q[0] : q

  if (route.path === "/") {
    if (current === anchor) {
      await nextTick()
      document?.getElementById(anchor)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'start',
      })
      return
    }
    await router.replace({
      path: "/",
      query: { value: anchor },
    })
  } else {
    await router.push({
      path: "/",
      query: { value: anchor },
    })
  }
}

onMounted(async () => {
  await nextTick()
  if (route.query && route.query.value) {
    scrollToAnchor()
  } else {
    document?.querySelector('#collect')?.scrollIntoView()
  }
  
  // 只在首页激活滚动监听
  if (route.path === '/') {
    isScrollListenerActive.value = true
    window.addEventListener('scroll', throttledHandleScroll)
  }
})

onUnmounted(() => {
  // 清理滚动监听
  isScrollListenerActive.value = false
  window.removeEventListener('scroll', throttledHandleScroll)
  if (scrollTimer) {
    cancelAnimationFrame(scrollTimer)
  }
})

// 监听路由变化
watch(() => route.path, (newPath) => {
  if (newPath === '/') {
    isScrollListenerActive.value = true
    window.addEventListener('scroll', throttledHandleScroll)
  } else {
    isScrollListenerActive.value = false
    window.removeEventListener('scroll', throttledHandleScroll)
  }
})

watch(() => route.query.value, () => {
  scrollToAnchor()
})

watch(() => toolsStore.cates.length, () => {
  scrollToAnchor()
})
</script>

<template>
  <div class="md:mr-6 c-xs:mr-0">
    <!-- list -->
    <div v-for="(cate, index) in toolsStore.cates" :key="index">
      <!-- cate title -->
      <div 
        class="mt-8 mb-3 text-xl font-bold text-[--base-black] cursor-pointer hover:text-blue-600 transition-colors duration-200" 
        :id="'cate_' + cate.id"
        @click="gotoAnchor('cate_' + cate.id)"
      >
        {{ cate.title }}
      </div>
      <!-- card -->
      <div class="flex justify-between flex-wrap self-card-div c-xs:ml-0" :gutter="10">
          <router-link v-for="(item, index) in cate.list" :key="index" :to="item.url" class="flex flex-col mt-5 border-solid rounded-2xl border-gray w-[24%] p-2 bg-white hover:shadow-md c-xs:w-[99.5%] c-md:w-[24%] c-sm:w-[32%] p-5 hover:-translate-y-2 duration-300">
            <div class="flex items-center border-b pb-2">
              <el-image :src="item.logo" class="w-10 h-10 min-h-[2.5rem] min-w-[2.5rem]"></el-image>
              <div class="flex flex-col ml-2 w-full">
                <div class="flex">
                  <div class="font-semibold text-lg line-clamp-1">{{ item.title }}</div>
                </div>
                <div class="flex justify-between">
                  <el-text size="small">{{ item.cate }}</el-text>
                  <!-- <el-button :icon="Star" circle size="small" @click.prevent="collect(item.id)" type="warning" :plain="!toolsStore.collectIds.includes(item.id)"/> -->
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between mt-2">
              <el-text line-clamp="2">{{ item.desc }}</el-text>
            </div>
          </router-link>
          <!-- 占位 div -->
          <div class="w-[24%] c-md:w-[24%] c-sm:w-[32%] "></div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <el-backtop :right="10" :bottom="50" />
  </div>
</template>

<style scoped>
.self-card-div:after{
  content: "";
  width: 24%
}
</style>