<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/store/modules/admin'

const router = useRouter()
const adminStore = useAdminStore()

interface MenuItem {
  index: string
  title: string
  icon?: string
}

const menus: MenuItem[] = [
  { index: '/admin', title: '仪表盘', icon: 'dashboard' },
  { index: '/admin/users', title: '用户管理', icon: 'user' },
  { index: '/admin/credits', title: '积分流水', icon: 'coin' },
  { index: '/admin/tools', title: '工具开关', icon: 'tools' },
  { index: '/admin/generation-records', title: '请求日志', icon: 'logs' },
]

const activeIndex = (path: string) => {
  if (path === '/admin') return '/admin'
  return path
}

const handleSelect = (path: string) => {
  router.push(path)
  // 移动端选完收起 drawer
  if (window.innerWidth < 768) {
    adminStore.setSidebarCollapsed(false)
  }
}
</script>

<template>
  <nav class="admin-sidebar-nav py-3">
    <el-menu
      :default-active="activeIndex($route.path)"
      :router="false"
      class="border-none !bg-transparent"
      @select="handleSelect"
    >
      <el-menu-item
        v-for="m in menus"
        :key="m.index"
        :index="m.index"
        class="!h-10 !my-1 mx-2 !rounded-lg text-sm"
      >
        <span class="flex items-center gap-2">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-accent-500"
            :class="[$route.path === m.index ? 'opacity-100' : 'opacity-0']"
            aria-hidden="true"
          />
          {{ m.title }}
        </span>
      </el-menu-item>
    </el-menu>
  </nav>
</template>

<style scoped>
.admin-sidebar-nav :deep(.el-menu-item) {
  color: rgb(var(--ink-700));
}
.admin-sidebar-nav :deep(.el-menu-item:hover) {
  background: rgb(var(--accent-50));
}
.admin-sidebar-nav :deep(.el-menu-item.is-active) {
  background: rgb(var(--accent-50));
  color: rgb(var(--accent-700));
  font-weight: 500;
}
</style>