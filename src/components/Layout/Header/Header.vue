<script setup lang="ts">
import { ref, reactive, onMounted, computed, onUnmounted, nextTick } from 'vue'
import Search from '~icons/ep/search'
import IconMoon from '~icons/ep/moon'
import IconSunny from '~icons/ep/sunny'
import { ElMessage } from 'element-plus'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
import { useUserStore } from '@/store/modules/user'
import { useTheme } from '@/composables/useTheme'
import 'element-plus/theme-chalk/display.css'
import { ToolsInfo } from '@/components/Tools/tools.type.ts';

import UserBalanceBadge from '@/components/User/UserBalanceBadge.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const routeLoading = ref(false)

// 监听路由变化，显示加载状态。
// 10s 超时兜底：chunk 加载失败且 onError 兜底也未触发时，避免 loading 永久卡住。
let loadingTimer: ReturnType<typeof setTimeout> | null = null

router.beforeEach((_to, _from, next) => {
  routeLoading.value = true
  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => {
    routeLoading.value = false
    loadingTimer = null
  }, 10_000)
  next()
})

router.afterEach(() => {
  routeLoading.value = false
  if (loadingTimer) {
    clearTimeout(loadingTimer)
    loadingTimer = null
  }
})

const loading = ref(false)
const options = ref<ToolsInfo[]>([])
//store
const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const userStore = useUserStore()
const { isDark, toggleTheme } = useTheme()

// 用户相关状态
const userMenuVisible = ref(false)
const hideTimeout = ref<number | null>(null)

// 计算属性：判断用户是否已登录
const isLoggedIn = computed(() => userStore.getLoginStatus)

// 计算属性：获取用户信息
const user = computed(() => userStore.getUserInfo)

// 头像圆里显示的字符：用户名 / 邮箱首字符
const avatarChar = computed(() => {
  const name = user.value?.username || user.value?.email || '用'
  return String(name).charAt(0).toUpperCase()
})

//查询参数
const searchParam = reactive({
  cateId: 0,
  title: '',
  route: '',
})

//搜索工具
const searchTools = async (query: string) => {
  loading.value = true
  options.value = []
  if (query) {
    searchParam.title = query
    options.value = await toolsStore.getTools(searchParam)
  }
  loading.value = false
}

const optionClick = (item: any) => {
  // 如果是好物网站,直接打开外部链接
  if (item.isExternalSite && item.externalUrl) {
    window.open(item.externalUrl, '_blank')
  } else {
    router.push(item.url)
  }
  // 跳转后清空搜索框与候选项，方便下一次搜索
  searchParam.title = ''
  options.value = []
}

// 兼容鼠标点击与键盘上下键+回车：el-select 在两种选中方式下都会触发 @change。
// 之前仅在 el-option 上挂 @click，键盘选中不会触发 DOM click 事件，因此回车无反应。
const handleSelectChange = (selectedId: string | number | undefined | null) => {
  if (selectedId === undefined || selectedId === '' || selectedId === null) return
  const item = options.value.find((opt) => String(opt.id) === String(selectedId))
  if (!item) return
  optionClick(item)
}

// 处理退出登录
const handleLogout = async () => {
  try {
    // 先清除用户状态
    userStore.logout()

    // 关闭菜单
    userMenuVisible.value = false

    // 等待DOM更新
    await nextTick()

    // 强制跳转到首页，使用replace避免历史记录问题
    await router.replace('/')

    // 显示成功消息
    ElMessage.success('已退出登录')
  } catch (error) {
    console.error('退出登录失败:', error)
    // 即使出错也要跳转到首页
    await router.replace('/')
    ElMessage.success('已退出登录')
  }
}

// 跳转到个人中心
const goToUserInfo = async () => {
  userMenuVisible.value = false
  await nextTick()
  router.push('/userinfo')
}

// 跳转到管理后台（新标签页打开，避免在工具页跳转导致状态丢失）
const goToAdmin = async () => {
  userMenuVisible.value = false
  await nextTick()
  window.open('/admin/dashboard', '_blank', 'noopener,noreferrer')
}

// 切换用户菜单显示状态
const toggleUserMenu = () => {
  userMenuVisible.value = !userMenuVisible.value
}

// 显示用户菜单
const showUserMenu = () => {
  // 清除之前的隐藏定时器
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  userMenuVisible.value = true
}

// 隐藏用户菜单（延迟）
const hideUserMenu = () => {
  // 设置延迟隐藏，给用户时间移动到菜单
  hideTimeout.value = window.setTimeout(() => {
    userMenuVisible.value = false
    hideTimeout.value = null
  }, 150) // 150ms延迟
}

// 立即隐藏用户菜单
const hideUserMenuImmediately = () => {
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  userMenuVisible.value = false
}

// 点击外部区域关闭菜单
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest('.user-menu-container')) {
    hideUserMenuImmediately()
  }
}

onMounted(() => {
  // 初始化用户状态
  userStore.initUserState()
  // 添加全局点击事件监听
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  // 移除事件监听
  document.removeEventListener('click', handleClickOutside)
  // 清理定时器
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
  }
})
</script>

<template>
  <header class="h-20 w-full flex items-center justify-between gap-4 c-xs:h-16 c-xs:fixed c-xs:top-0 c-xs:left-0 c-xs:right-0 c-xs:z-50 c-xs:bg-surface-1 dark:c-xs:bg-surface-1 c-xs:border-b c-xs:border-border-subtle">
    <div class="flex items-center flex-1 min-w-0">
      <Transition name="fold" class="hidden c-sm:block c-md:hidden c-xs:block text-ink-700">
        <button v-if="!componentStore.leftComDrawer" type="button" class="icon-btn bg-transparent border-0 p-0 cursor-pointer text-ink-700" aria-label="打开导航菜单" :aria-expanded="componentStore.leftComDrawer" @click="componentStore.setleftComDrawerStatus(true)">
          <svg t="1702978210636" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7618" width="30" height="30" aria-hidden="true">
            <path fill="currentColor" fill-opacity=".9" d="M895.936 256l-768-0.896 0.128-64L896 192l-0.064 64zM179.2 689.152l202.688-152a32 32 0 0 0 0-51.2L179.2 333.952a32 32 0 0 0-51.2 25.6v304a32 32 0 0 0 51.2 25.6z m12.8-89.6v-176l117.312 88L192 599.552zM896 544H480v-64H896v64z m-0.064 288l-768-0.896 0.128-64L896 768l-0.064 64z" p-id="7619"></path>
          </svg>
        </button>
        <button v-else type="button" class="icon-btn bg-transparent border-0 p-0 cursor-pointer text-ink-700" aria-label="关闭导航菜单" :aria-expanded="componentStore.leftComDrawer" @click="componentStore.setleftComDrawerStatus(false)">
          <svg t="1702978577170" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1587" width="30" height="30" aria-hidden="true">
            <path fill="currentColor" fill-opacity=".9" d="M128.064 192l768 0.896-0.128 64L128 256l0.064-64z m514.048 294.848a32 32 0 0 0 0 51.2l202.688 152a32 32 0 0 0 51.2-25.6v-304a32 32 0 0 0-51.2-25.6l-202.688 152zM832 424.448v176l-117.312-88L832 424.448zM128 480h416v64H128v-64z m0.064 288l768 0.896-0.128 64L128 832l0.064-64z" p-id="1588"></path>
          </svg>
        </button>
      </Transition>

      <Transition name="fold" class="hidden c-md:block text-ink-700">
        <button v-if="!componentStore.leftCom" type="button" class="icon-btn bg-transparent border-0 p-0 cursor-pointer text-ink-700" aria-label="打开侧边栏" :aria-expanded="!componentStore.leftCom" @click="componentStore.setLeftComStatus(true)">
          <svg t="1702978577170" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1587" width="30" height="30" aria-hidden="true">
            <path fill="currentColor" fill-opacity=".9" d="M128.064 192l768 0.896-0.128 64L128 256l0.064-64z m514.048 294.848a32 32 0 0 0 0 51.2l202.688 152a32 32 0 0 0 51.2-25.6v-304a32 32 0 0 0-51.2-25.6l-202.688 152zM832 424.448v176l-117.312-88L832 424.448zM128 480h416v64H128v-64z m0.064 288l768 0.896-0.128 64L128 832l0.064-64z" p-id="1588"></path>
          </svg>
        </button>
        <button v-else type="button" class="icon-btn bg-transparent border-0 p-0 cursor-pointer text-ink-700" aria-label="关闭侧边栏" :aria-expanded="!componentStore.leftCom" @click="componentStore.setLeftComStatus(false)">
          <svg t="1702978210636" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7618" width="30" height="30" aria-hidden="true">
            <path fill="currentColor" fill-opacity=".9" d="M895.936 256l-768-0.896 0.128-64L896 192l-0.064 64zM179.2 689.152l202.688-152a32 32 0 0 0 0-51.2L179.2 333.952a32 32 0 0 0-51.2 25.6v304a32 32 0 0 0 51.2 25.6z m12.8-89.6v-176l117.312 88L192 599.552zM896 544H480v-64H896v64z m-0.064 288l-768-0.896 0.128-64L896 768l-0.064 64z" p-id="7619"></path>
          </svg>
        </button>
      </Transition>

      <div class="flex-1 min-w-0 w-full max-w-2xl mr-2 c-xs:mr-0">
        <el-select
          v-model="searchParam.title"
          filterable
          remote
          reserve-keyword
          remote-show-suffix
          :suffix-transition="false"
          :suffix-icon="Search"
          placeholder="输入关键词搜索，如文本、json、图片等"
          :remote-method="searchTools"
          :loading="loading"
          class="w-full c-sm:ml-3"
          size="large"
          @change="handleSelectChange"
        >
          <el-option
            v-for="item in options"
            :key="item.id"
            :label="item.title + ' - ' + item.desc"
            :value="item.id"
          >
          </el-option>
        </el-select>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0 c-xs:pr-3">
      <!-- 主题切换 -->
      <button
        type="button"
        class="w-10 h-10 rounded-full bg-white dark:bg-surface-0 shadow-sm shadow-ink-950/5 border border-border-subtle flex items-center justify-center text-ink-500 hover:text-accent-600 hover:border-accent-300 transition-colors"
        :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
        :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
        @click="toggleTheme"
      >
        <IconSunny v-if="isDark" class="w-5 h-5" aria-hidden="true" />
        <IconMoon v-else class="w-5 h-5" aria-hidden="true" />
      </button>

      <!-- 用户信息区域 -->
      <div class="relative user-menu-container">
        <!-- 未登录状态：显示登录按钮 -->
        <router-link v-if="!isLoggedIn" to="/login">
          <el-tooltip
            class="box-item"
            effect="dark"
            content="用户登录"
            placement="bottom"
          >
            <el-button type="primary" size="large" class="bg-brand-gradient hover:opacity-90 w-20 border-none rounded-full">
              登录
            </el-button>
          </el-tooltip>
        </router-link>

        <!-- 已登录状态：积分徽章 + 头像 + 下拉菜单 -->
        <div v-else class="flex items-center gap-1">
          <UserBalanceBadge class="c-xs:hidden" />
          <button
            type="button"
            class="relative cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-accent-50 dark:hover:bg-surface-3 bg-transparent border-0"
            :aria-haspopup="'menu'"
            :aria-expanded="userMenuVisible"
            aria-label="用户菜单"
            @click="toggleUserMenu"
            @mouseenter="showUserMenu"
            @mouseleave="hideUserMenu"
          >
            <span
              class="w-8 h-8 rounded-full bg-brand-gradient text-white text-sm font-semibold flex items-center justify-center shadow-sm shadow-accent-500/30"
              aria-hidden="true"
            >{{ avatarChar }}</span>
            <span class="whitespace-nowrap text-sm text-ink-700 c-xs:hidden">{{ user?.username || user?.email || '用户' }}</span>
            <svg class="w-4 h-4 text-ink-400 transition-transform duration-200" :class="{ 'rotate-180': userMenuVisible }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </button>

          <!-- 悬浮菜单 -->
          <div
            v-show="userMenuVisible"
            role="menu"
            aria-label="用户菜单"
            class="absolute top-full right-0 mt-1 bg-surface-0 dark:bg-surface-0 border border-border-default rounded-2xl shadow-lg py-2 min-w-[140px] z-50"
            @mouseenter="showUserMenu"
            @mouseleave="hideUserMenu"
          >
            <div
              role="menuitem"
              tabindex="0"
              class="px-4 py-2 hover:bg-accent-50 dark:hover:bg-surface-3 cursor-pointer text-ink-700 dark:text-ink-800 hover:text-accent-700 dark:hover:text-accent-300"
              @click.stop="goToUserInfo"
              @keyup.enter="goToUserInfo"
              @keyup.space.prevent="goToUserInfo"
            >
              个人中心
            </div>
            <div
              v-if="userStore.getIsAdmin"
              role="menuitem"
              tabindex="0"
              class="px-4 py-2 hover:bg-accent-50 dark:hover:bg-surface-3 cursor-pointer text-accent-700 dark:text-accent-300 hover:text-accent-800 dark:hover:text-accent-200"
              @click.stop="goToAdmin"
              @keyup.enter="goToAdmin"
              @keyup.space.prevent="goToAdmin"
            >
              管理后台
            </div>
            <div
              role="menuitem"
              tabindex="0"
              class="px-4 py-2 hover:bg-danger-50 dark:hover:bg-danger-500/15 cursor-pointer text-danger-600 dark:text-danger-400"
              @click.stop="handleLogout"
              @keyup.enter="handleLogout"
              @keyup.space.prevent="handleLogout"
            >
              退出登录
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
  <!-- 更新加载状态样式 -->
  <div v-if="routeLoading" class="fixed top-0 left-0 w-full h-full bg-ink-900/40 flex items-center justify-center z-50 loading-overlay">
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>
  </div>
</template>

<style scoped>
.fold-enter-active {
  transition: all 1s ease-out;
}

.fold-enter-from,
.fold-leave-to {
  transform: translateX(20px);
  opacity: 0;
}


:deep(.el-select__wrapper) {
    box-shadow: 0 0 0 0px var(--el-input-border-color, var(--el-border-color)) inset;
    cursor: default;
    border-radius: 9999px;
    @apply w-full;
}

/* 搜索框：胶囊造型。EP 2.5+ 的 .el-select__wrapper 用 box-shadow 实现边框，
   必须用 box-shadow inset 显式画边框 */
.el-select :deep(.el-select__wrapper) {
  background-color: rgb(var(--surface-0));
  border-radius: 9999px;
  box-shadow: 0 0 0 1px rgb(var(--border-default)) inset, 0 2px 8px rgb(var(--ink-950) / 0.04);
  transition: box-shadow 0.2s ease;
}
.el-select :deep(.el-select__wrapper.is-hovering:not(.is-focused)) {
  box-shadow: 0 0 0 1px rgb(var(--accent-300)) inset, 0 2px 12px rgb(var(--accent-500) / 0.1);
}
.el-select :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 2px rgb(var(--accent-500)) inset, 0 2px 12px rgb(var(--accent-500) / 0.12);
}

/* 用户菜单容器（保持定位上下文） */
.user-menu-container {
  position: relative;
}

/* 加载动画样式 */
.loading-overlay {
  backdrop-filter: blur(2px);
  animation: fadeIn 0.3s ease-out;
}

/* 加载动画样式 - accent 主题 */
.loading-container {
  background: rgb(var(--surface-0) / 0.95);
  border: 1px solid rgb(var(--accent-200));
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(10px);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgb(var(--accent-200));
  border-top: 4px solid rgb(var(--accent-500));
  border-radius: 50%;
  animation: spin 1s linear infinite;
  position: relative;
}

.loading-spinner::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 2px solid transparent;
  border-top: 2px solid rgb(var(--accent-300));
  border-radius: 50%;
  animation: spin 2s linear infinite reverse;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: rgb(var(--ink-800));
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 响应式适配 */
@media (max-width: 640px) {
  .loading-container {
    padding: 24px 32px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
  }

  .loading-text {
    font-size: 14px;
  }
}
</style>
