<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Props定义
interface TechDocData {
  name: string
  icon: string
  color: string
  chapters: {
    id: string
    title: string
    content: any[]
  }[]
}

interface Props {
  techDoc: TechDocData
  backUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  backUrl: '/backend-docs'
})

const route = useRoute()
const router = useRouter()

// 检测是否为移动端
const isMobile = ref(false)
const leftDrawerVisible = ref(false)

// 当前激活的章节
const activeChapter = ref('')

// 返回顶部按钮显示状态
const showBackToTop = ref(false)

// 左侧目录的顶部偏移（动态）
const sidebarTopOffset = ref(100)
// 左侧目录的底部偏移
const sidebarBottomOffset = ref(32)

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// 检测当前可见章节
const updateActiveChapter = () => {
  const chapters = props.techDoc.chapters

  for (let i = chapters.length - 1; i >= 0; i--) {
    const element = document.getElementById(chapters[i].id)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top <= 100) { // 章节顶部距离视口顶部100px以内
        activeChapter.value = chapters[i].id
        break
      }
    }
  }

  // 控制返回顶部按钮显示
  showBackToTop.value = window.pageYOffset > 300

  // 动态调整左侧目录顶部偏移：向上滚动时top值逐渐变成0
  const scrollY = window.pageYOffset
  const scrollThreshold = 100 // 滚动100px后top值变为0
  const initialTop = 100 // 初始top值

  if (scrollY < scrollThreshold) {
    const progress = scrollY / scrollThreshold
    sidebarTopOffset.value = initialTop * (1 - progress)
  } else {
    sidebarTopOffset.value = 0
  }

  // 动态调整左侧目录底部偏移，避免遮挡500px高度的评论区
  const scrollPosition = window.pageYOffset + window.innerHeight
  const pageHeight = document.documentElement.scrollHeight
  const commentHeight = 600 // 评论区高度（增加一些缓冲）

  // 当接近底部时，增加底部偏移量
  const distanceToBottom = pageHeight - scrollPosition
  if (distanceToBottom < commentHeight) {
    // 增加额外的偏移量系数，让目录收缩得更明显
    sidebarBottomOffset.value = 32 + (commentHeight - distanceToBottom) * 1.2
  } else {
    sidebarBottomOffset.value = 32
  }
}

// 滚动到指定章节
const scrollToChapter = (chapterId: string) => {
  const element = document.getElementById(chapterId)
  if (element) {
    const offset = 80 // 顶部导航栏高度
    const elementPosition = element.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })

    // 更新URL hash
    router.replace({ hash: `#${chapterId}` })

    // 设置激活状态
    activeChapter.value = chapterId

    // 聚焦到元素（无障碍性）
    element.focus({ preventScroll: true })

    if (isMobile.value) {
      leftDrawerVisible.value = false
    }
  }
}

onMounted(async () => {
  await nextTick()
  window.requestAnimationFrame(() => {
    checkMobile()
  })
  window.addEventListener('resize', checkMobile)
  window.addEventListener('scroll', updateActiveChapter)

  // 检查 URL hash，滚动到对应章节
  if (route.hash) {
    nextTick(() => {
      const chapterId = route.hash.slice(1)
      scrollToChapter(chapterId)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('scroll', updateActiveChapter)
})

// 监听路由 hash 变化
watch(() => route.hash, (newHash) => {
  if (newHash) {
    nextTick(() => {
      const chapterId = newHash.slice(1)
      scrollToChapter(chapterId)
    })
  }
})

// 返回列表页
const goBack = () => {
  router.push(props.backUrl)
}

// 渲染内容块
const renderContent = (item: any) => {
  switch (item.type) {
    case 'heading':
      return item.text
    case 'paragraph':
      return item.text
    case 'list':
      return item.items
    case 'table':
      return { headers: item.headers, rows: item.rows }
    case 'code':
      return { lang: item.lang, code: item.code }
    default:
      return item
  }
}

// 返回顶部
const backToTop = () => {
  const scrollToTop = () => {
    const currentScroll = window.pageYOffset
    if (currentScroll > 0) {
      window.requestAnimationFrame(scrollToTop)
      window.scrollTo(0, currentScroll - currentScroll / 30) // 约30帧完成，更平滑的过渡
    }
  }
  scrollToTop()
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <!-- <DetailHeader :title="`${techDoc.name} 技术文档`"></DetailHeader> -->

    <!-- 主内容区 -->
    <div class="bg-white rounded-2xl flex-1 overflow-hidden">
      <div class="flex h-full relative">
      <!-- 左侧目录 -->
      <div
        :class="[
          'fixed left-[260px] bg-gray-50 border-r border-gray-200 transition-all duration-300 z-20 flex-shrink-0',
          isMobile ? (leftDrawerVisible ? 'w-80' : 'w-0') : 'w-80'
        ]"
        :style="{
          top: sidebarTopOffset + 'px',
          height: `calc(100vh - ${sidebarTopOffset}px - ${sidebarBottomOffset}px)`,
          overflowY: 'auto'
        }"
      >
          <div class="p-6">
            <!-- 技术栈信息 -->
            <div class="mb-6">
              <div :class="['w-16 h-16 rounded-xl bg-gradient-to-br ' + techDoc.color + ' flex items-center justify-center mb-4 shadow-lg']">
                <span class="text-2xl font-bold text-white">{{ techDoc.icon || techDoc.name.charAt(0) }}</span>
              </div>
              <h2 class="text-xl font-bold text-gray-800">{{ techDoc.name }}</h2>
            </div>

            <!-- 章节目录 -->
            <nav class="space-y-2">
              <button
                v-for="chapter in techDoc.chapters"
                :key="chapter.id"
                :class="[
                  'w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                  activeChapter === chapter.id
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                ]"
                @click="scrollToChapter(chapter.id)"
              >
                {{ chapter.title }}
              </button>
            </nav>
          </div>
        </div>

        <!-- 主内容区 -->
        <div :class="isMobile ? 'flex-1' : 'ml-[330px] flex-1'">
          <!-- 移动端目录按钮 -->
          <div v-if="isMobile" class="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
            <el-button @click="leftDrawerVisible = !leftDrawerVisible" type="text" class="p-2">
              <el-icon><Menu /></el-icon>
              <span class="ml-2">目录</span>
            </el-button>
          </div>

          <!-- 返回按钮 -->
          <div class="p-6 pb-0">
            <el-button @click="goBack" type="text" class="p-0 text-gray-600 hover:text-gray-800">
              <el-icon class="mr-2"><ArrowLeft /></el-icon>
              返回技术栈列表
            </el-button>
          </div>

          <!-- 文档内容 -->
          <div class="p-6 pt-4 overflow-y-auto">
            <div v-if="techDoc" class="space-y-12">
              <!-- 遍历所有章节 -->
              <div
                v-for="chapter in techDoc.chapters"
                :id="chapter.id"
                :key="chapter.id"
                class="chapter-section scroll-mt-20"
                tabindex="-1"
              >
                <h2 class="text-2xl font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">
                  {{ chapter.title }}
                </h2>

                <div class="prose prose-gray max-w-none space-y-6">
                  <div v-for="(item, index) in chapter.content" :key="index" class="content-block">
                    <!-- 标题 -->
                    <h3 v-if="item.type === 'heading'" class="text-xl font-semibold text-gray-800 mt-6 mb-3">
                      {{ renderContent(item) }}
                    </h3>

                    <!-- 段落 -->
                    <p v-else-if="item.type === 'paragraph'" class="text-gray-600 leading-relaxed">
                      {{ renderContent(item) }}
                    </p>

                    <!-- 列表 -->
                    <ul v-else-if="item.type === 'list'" class="space-y-2">
                      <li v-for="(listItem, i) in item.items" :key="i" class="flex items-start gap-2 text-gray-600">
                        <span class="text-green-500 mt-1">•</span>
                        <span v-html="listItem"></span>
                      </li>
                    </ul>

                    <!-- 表格 -->
                    <div v-else-if="item.type === 'table'" :class="isMobile ? 'my-4 break-words' : 'overflow-x-auto my-4 break-words'">
                      <table class="min-w-full divide-y divide-gray-200 border border-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th
                              v-for="(header, i) in item.headers"
                              :key="i"
                              class="px-4 py-3 text-left text-sm font-semibold text-gray-700"
                            >
                              {{ header }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr v-for="(row, i) in item.rows" :key="i">
                            <td
                              v-for="(cell, j) in row"
                              :key="j"
                              class="px-4 py-3 text-sm text-gray-600"
                              v-html="cell"
                            ></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- 代码块 -->
                    <div v-else-if="item.type === 'code'" class="my-4 break-words">
                      <div class="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-t-lg">
                        <span>{{ item.lang }}</span>
                      </div>
                      <pre :class="isMobile ? 'bg-gray-900 text-gray-100 p-4 rounded-b-lg text-sm leading-relaxed break-words whitespace-pre-wrap' : 'bg-gray-900 text-gray-100 p-4 overflow-x-auto rounded-b-lg text-sm leading-relaxed break-words whitespace-pre-wrap'"><code>{{ item.code }}</code></pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="flex items-center justify-center text-gray-400 h-64">
              加载中...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 返回顶部按钮 -->
    <Transition name="fade-slide">
      <button
        v-if="showBackToTop"
        @click="backToTop"
        class="fixed bottom-8 right-8 w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 z-50"
        aria-label="返回顶部"
        style="transition: all 0.3s ease;"
      >
        <el-icon :size="20"><CaretTop /></el-icon>
      </button>
    </Transition>
  </div>
</template>

<script lang="ts">
import { ArrowLeft, Menu, CaretTop } from '@element-plus/icons-vue'
export default {
  components: { ArrowLeft, Menu, CaretTop }
}
</script>

<style scoped>
.content-block h3:first-child {
  margin-top: 0;
}

/* 代码块样式优化 */
pre code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 表格样式优化 */
table {
  font-size: 14px;
}

/* 响应式表格 */
@media (max-width: 768px) {
  table {
    font-size: 12px;
  }
}

/* 锚点偏移 */
.scroll-mt-20 {
  scroll-margin-top: 5rem;
}

/* 取消锚点聚焦自动黑色边框 */
.chapter-section:focus,
.chapter-section:focus-visible,
.chapter-section:target {
  outline: none !important;
  box-shadow: none !important;
}

/* 左侧目录滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 返回顶部按钮动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>