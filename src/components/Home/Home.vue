<script setup lang="ts">
import { onMounted, watch, nextTick, onUnmounted, ref } from 'vue';
import { RouterLink } from "vue-router"
// import { Star } from '@element-plus/icons-vue'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
// import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from "vue-router"
import Top from '~icons/ep/top'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
import HotList from './HotList.vue'
//store
const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const route = useRoute()
const router = useRouter()

// 首页直接消费的 toolsStore.cates 必须自己保证已加载，不依赖 Left.vue 的副作用 onMounted
// （Left 是 defineAsyncComponent + v-show 隐藏的，移动端在抽屉里才挂载，首次加载顺序不稳定会导致首页空白）
const ensureCatesLoaded = async () => {
  if (toolsStore.cates.length > 0) return
  try {
    await toolsStore.getToolCate()
  } catch (error: any) {
    console.warn('[Home] 工具列表加载失败：', error?.message || error)
  }
}

const showBackTop = ref(false)

const scrollToTop = () => {
  history.replaceState(null, '', '/')
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  if (scrollTop <= 0) return
  const step = () => {
    const current = document.documentElement.scrollTop || document.body.scrollTop
    if (current <= 0) return
    const distance = Math.max(current / 12, 3)
    document.documentElement.scrollTop = current - distance
    document.body.scrollTop = current - distance
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const scrollToAnchor = async () => {
  const v = route.query?.value as any
  const anchor = Array.isArray(v) ? v[0] : v
  if (typeof anchor !== 'string' || !anchor) return

  // 如果是滚动触发的路由更新，不执行 scrollIntoView，避免循环
  if (isScrollTriggeredUpdate.value) return

  // 如果已经在滚动到同一个锚点，跳过以避免重叠调用
  if (isScrollingToAnchor.value && pendingScrollAnchor.value === anchor) return

  // 暂时禁用滚动监听（双重门控），避免循环触发
  isScrollListenerActive.value = false
  isScrollingToAnchor.value = true
  pendingScrollAnchor.value = anchor

  await nextTick()
  // 等待目标锚点元素渲染：cates 是异步加载的，刷新场景下首次调用时元素可能尚未挂载。
  // 最多等 2s，期间每 50ms 重试一次；若标志位被新调用重置（cates 加载完成后的强制重试），主动让出。
  const waitStart = Date.now()
  while (!document.getElementById(anchor) && Date.now() - waitStart < 2000) {
    if (!isScrollingToAnchor.value) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  requestAnimationFrame(() => {
    document?.getElementById(anchor)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'start',
    })

    // 滚动完成后，延迟恢复滚动监听
    // 延迟 1.5s 确保 smooth scroll 动画完全结束，避免残余滚动事件触发 URL 变更
    setTimeout(() => {
      isScrollingToAnchor.value = false
      isScrollListenerActive.value = true
      pendingScrollAnchor.value = ''
    }, 1500)
  })
}

// 滚动监听相关
const isScrollListenerActive = ref(false)
// 用户手动点击分类后，暂时禁用滚动监听（避免冲突）
const isUserClickingCategory = ref(false)
// 标记是否是滚动触发的路由更新（避免循环）
const isScrollTriggeredUpdate = ref(false)
// 标记是否正在执行 scrollToAnchor（scrollIntoView 产生的滚动事件不触发 URL 变更）
const isScrollingToAnchor = ref(false)
// 记录正在滚动到的目标锚点，用于 handleScroll 比对以避免在安全期结束后误触发 URL 回写
const pendingScrollAnchor = ref('')

// 滚动监听函数
const handleScroll = () => {
  showBackTop.value = (window.pageYOffset || document.documentElement.scrollTop) > 300
  if (!isScrollListenerActive.value) return
  // 如果用户正在点击分类，暂时跳过滚动监听
  if (isUserClickingCategory.value) return
  // scrollToAnchor 产生的平滑滚动事件不触发 URL 变更，避免与版本守卫形成硬刷循环
  if (isScrollingToAnchor.value) return

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

  // 如果检测到的活跃分类与 scrollToAnchor 正在滚向的目标一致，跳过 URL 更新
  // 避免安全期（1.5s）结束后残余滚动事件又把 URL 改写成不同值
  if (pendingScrollAnchor.value && activeCategory === pendingScrollAnchor.value) return

  // 更新活跃分类和URL
  if (activeCategory && activeCategory !== componentStore.activeCategory) {
    componentStore.setActiveCategory(activeCategory)
    // 同步更新URL地址栏
    const currentValue = route.query?.value as string
    if (currentValue !== activeCategory) {
      // 标记这是滚动触发的更新
      isScrollTriggeredUpdate.value = true
      // 使用 replace 避免添加历史记录；finally 确保导航完成后（或失败后）才复位标志位，
      // 避免 setTimeout(100ms) 早于 router 异步流程结束而导致 scrollToAnchor 误触发
      router.replace({
        path: "/",
        query: { value: activeCategory }
      }).finally(() => {
        isScrollTriggeredUpdate.value = false
      })
    }
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

  // 标记用户正在点击分类，暂时禁用滚动监听
  isUserClickingCategory.value = true

  // 1秒后恢复滚动监听
  setTimeout(() => {
    isUserClickingCategory.value = false
  }, 1000)

  if (route.path === "/") {
    if (current === anchor) {
      // 直接滚动时也设置 pendingScrollAnchor，防止 handleScroll 误判
      pendingScrollAnchor.value = anchor
      await nextTick()
      document?.getElementById(anchor)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'start',
      })
      // 滚动完成后清除
      setTimeout(() => {
        pendingScrollAnchor.value = ''
      }, 1500)
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

  // 主动加载工具列表（避免依赖 Left.vue 的副作用）
  ensureCatesLoaded()

  // 预先添加滚动监听器；handleScroll 通过 isScrollListenerActive / isScrollingToAnchor 双重门控
  window.addEventListener('scroll', throttledHandleScroll)

  // 只在有明确的 query.value 时才滚动到锚点
  if (route.query && route.query.value) {
    scrollToAnchor()
    // scrollToAnchor 将在 ~1.5s 后设置 isScrollListenerActive = true
  } else {
    // 无锚点需求，延迟激活滚动监听
    setTimeout(() => {
      if (route.path === '/') {
        isScrollListenerActive.value = true
      }
    }, 500)
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
    // 回到首页时重新激活滚动监听（scrollToAnchor 会自行管理 isScrollingToAnchor 门控）
    if (!isScrollingToAnchor.value) {
      isScrollListenerActive.value = true
    }
  } else {
    isScrollListenerActive.value = false
  }
})

watch(() => route.query.value, () => {
  scrollToAnchor()
})

watch(() => toolsStore.cates.length, (newLen, oldLen) => {
  // cates 从无到有首次加载：onMounted 中的 scrollToAnchor 调用时锚点元素可能尚未渲染，
  // 会导致 scrollIntoView 失败；此时需重置标志位强制重新触发滚动，避免被同锚点拦截吞掉。
  if (oldLen === 0 && newLen > 0 && route.query.value) {
    isScrollingToAnchor.value = false
    pendingScrollAnchor.value = ''
    scrollToAnchor()
  }
})
</script>

<template>
  <div class="md:mr-6 c-xs:mr-0">
    <!-- 全球与全国热门信息 -->
    <HotList />

    <!-- list -->
    <div v-for="(cate, index) in toolsStore.cates" :key="index">
      <!-- cate title -->
      <button
        type="button"
        class="mt-8 mb-3 text-h3 font-bold text-ink-900 cursor-pointer hover:text-accent-600 transition-colors duration-200 bg-transparent border-0 text-left w-full"
        :id="'cate_' + cate.id"
        :aria-label="`跳转到 ${cate.title} 分类`"
        @click="gotoAnchor('cate_' + cate.id)"
      >
        <h2 class="text-h3 font-bold m-0">{{ cate.title }}</h2>
      </button>
      <!-- card -->
      <div class="flex justify-start flex-wrap gap-[1.25%] c-xs:ml-0">
        <div
          v-for="(item, index) in cate.list"
          :key="index"
          class="w-full sm:w-[49%] md:w-[32%] lg:w-[24%] xl:w-[19%] group"
        >
          <router-link
            :to="item.url"
            class="flex flex-col mt-5 border-solid rounded-2xl border-border-default p-2 bg-white shadow-lg group-hover:bg-accent-50 group-hover:shadow-xl group-hover:border-border-default w-full p-5 group-hover:-translate-y-3 duration-300 transition-all"
          >
            <div class="flex items-center border-b border-border-subtle pb-2">
              <img
                v-if="!useSpriteLogo(item).style"
                :src="item.logo"
                loading="lazy"
                class="w-10 h-10 min-h-[2.5rem] min-w-[2.5rem] object-contain"
                :alt="item.title"
              >
              <div
                v-else
                class="w-10 h-10 min-h-[2.5rem] min-w-[2.5rem]"
                :style="useSpriteLogo(item).style"
                role="img"
                :aria-label="item.title"
              ></div>
              <div class="flex flex-col ml-2 w-full">
                <div class="flex">
                  <div class="font-semibold text-body-lg line-clamp-1 text-ink-900">{{ item.title }}</div>
                </div>
                <div class="flex justify-between">
                  <el-text size="small" class="text-ink-700">{{ item.cate }}</el-text>
                </div>
              </div>
            </div>
            <div class="mt-2 min-h-[3rem]">
              <el-text line-clamp="2" class="text-ink-900">{{ item.desc }}</el-text>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <transition name="fade">
      <button
        v-show="showBackTop"
        type="button"
        aria-label="回到顶部"
        title="回到顶部"
        class="fixed right-[30px] bottom-[60px] z-50 cursor-pointer w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors border border-gray-100 bg-white"
        @click="scrollToTop"
      >
        <el-icon :size="28" color="#409EFF" aria-hidden="true"><Top /></el-icon>
      </button>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>