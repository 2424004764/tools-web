<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { useAdminStore } from '@/store/modules/admin'
import AdminSidebar from './AdminSidebar.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const adminStore = useAdminStore()

// 当前页标题（从路由 meta 取）
const pageTitle = computed(() => (route.meta?.title as string) || '管理后台')

const handleLogout = async () => {
  userStore.logout()
  ElMessage.success('已退出登录')
  await router.replace('/login')
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  // 兜底：若进入 admin 后发现 store 中未初始化用户态，先初始化一次
  userStore.initUserState()
})
</script>

<template>
  <div class="admin-root min-h-screen bg-surface-1 text-ink-900">
    <!-- 顶栏 -->
    <header
      class="h-14 px-4 md:px-6 flex items-center justify-between border-b border-border-default bg-surface-0 sticky top-0 z-20"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="md:hidden p-2 rounded hover:bg-accent-50 text-ink-700"
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
        <el-tag size="small" type="warning" effect="plain" class="hidden md:inline-flex">
          管理后台
        </el-tag>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="hidden md:inline text-ink-500 truncate max-w-[200px]">
          {{ userStore.getUserInfo?.email }}
        </span>
        <el-button link size="small" @click="goHome">返回站点</el-button>
        <el-button link size="small" type="danger" @click="handleLogout">
          退出
        </el-button>
      </div>
    </header>

    <!-- 主体：左 sidebar + 右 内容 -->
    <div class="flex">
      <aside
        class="admin-sidebar hidden md:block w-60 shrink-0 border-r border-border-default bg-surface-0 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start"
        :class="{ '!hidden': false }"
      >
        <AdminSidebar />
      </aside>

      <!-- 移动端抽屉 -->
      <el-drawer
        v-model="adminStore.sidebarCollapsed"
        direction="ltr"
        size="240px"
        :with-header="false"
      >
        <AdminSidebar />
      </el-drawer>

      <main class="flex-1 min-w-0 p-4 md:p-6">
        <router-view v-slot="{ Component, route: r }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="r.path" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
</style>