<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { useAdminStore } from '@/store/modules/admin'
import AdminSidebar from './AdminSidebar.vue'
import { ElMessage } from 'element-plus'
import IconBack from '~icons/ep/back'
import IconSwitchButton from '~icons/ep/switch-button'
import '@/styles/admin.scss'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const adminStore = useAdminStore()

// 当前页标题（从路由 meta 取）
const pageTitle = computed(() => (route.meta?.title as string) || '管理后台')

// 邮箱首字母头像
const avatarLetter = computed(() => {
  const email = userStore.getUserInfo?.email || ''
  return email.charAt(0).toUpperCase() || 'A'
})

const handleLogout = async () => {
  userStore.logout()
  ElMessage.success('已退出登录')
  await router.replace('/login')
}

const goHome = () => {
  router.push('/')
}

// 后台皮肤作用于传送浮层（popper / message 等）时需要 body 上的标记类
onMounted(() => {
  document.body.classList.add('admin-mode')
  // 兜底：若进入 admin 后发现 store 中未初始化用户态，先初始化一次
  userStore.initUserState()
})
onUnmounted(() => {
  document.body.classList.remove('admin-mode')
})
</script>

<template>
  <div class="admin-root min-h-screen bg-surface-1 text-ink-900">
    <!-- 顶栏 -->
    <header
      class="h-14 px-4 md:px-6 flex items-center justify-between bg-white/85 backdrop-blur border-b border-border-default sticky top-0 z-20"
    >
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          class="md:hidden p-2 -ml-2 rounded-lg text-ink-600 hover:bg-surface-2 hover:text-ink-900 transition-colors"
          aria-label="切换侧栏"
          @click="adminStore.toggleSidebar()"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-base md:text-lg font-semibold text-ink-900 truncate">
          {{ pageTitle }}
        </h1>
        <span
          class="hidden md:inline-flex items-center text-[11px] font-medium text-accent-700 bg-accent-50 rounded-full px-2 py-0.5"
        >
          管理后台
        </span>
      </div>

      <div class="flex items-center gap-1">
        <div
          class="hidden md:flex items-center gap-2.5 mr-3 pl-4 border-l border-border-default min-w-0"
        >
          <span
            class="w-7 h-7 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white text-xs font-semibold flex items-center justify-center select-none"
            aria-hidden="true"
          >
            {{ avatarLetter }}
          </span>
          <span class="text-sm text-ink-600 truncate max-w-[200px]">
            {{ userStore.getUserInfo?.email }}
          </span>
        </div>
        <button
          type="button"
          class="admin-topbar-btn"
          @click="goHome"
        >
          <IconBack class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">返回站点</span>
        </button>
        <button
          type="button"
          class="admin-topbar-btn hover:!text-danger-600 hover:!bg-danger-50"
          @click="handleLogout"
        >
          <IconSwitchButton class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">退出</span>
        </button>
      </div>
    </header>

    <!-- 主体：左 sidebar + 右 内容 -->
    <div class="flex">
      <aside
        class="admin-sidebar hidden md:block w-60 shrink-0 border-r border-border-default bg-white min-h-[calc(100vh-3.5rem)] sticky top-14 self-start"
      >
        <AdminSidebar />
      </aside>

      <!-- 移动端抽屉 -->
      <el-drawer
        v-model="adminStore.sidebarCollapsed"
        direction="ltr"
        size="264px"
        :with-header="false"
      >
        <AdminSidebar />
      </el-drawer>

      <main class="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
        <div class="max-w-[1440px] mx-auto">
          <router-view v-slot="{ Component, route: r }">
            <transition name="admin-fade" mode="out-in">
              <component :is="Component" :key="r.path" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-topbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--ink-600));
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.admin-topbar-btn:hover {
  background: rgb(var(--surface-2));
  color: rgb(var(--ink-900));
}

.admin-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.admin-fade-leave-to {
  opacity: 0;
}
.admin-fade-enter-active,
.admin-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
</style>
