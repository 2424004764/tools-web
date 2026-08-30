<script setup lang="ts">
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/store/modules/admin'
import IconOdometer from '~icons/ep/odometer'
import IconUser from '~icons/ep/user'
import IconCoin from '~icons/ep/coin'
import IconTicket from '~icons/ep/ticket'
import IconBox from '~icons/ep/box'
import IconSetUp from '~icons/ep/set-up'
import IconHistogram from '~icons/ep/histogram'
import IconDocument from '~icons/ep/document'
import IconPicture from '~icons/ep/picture'
import IconWarning from '~icons/ep/warning'
import IconLightning from '~icons/ep/lightning'
import IconDataAnalysis from '~icons/ep/data-analysis'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

interface MenuItem {
  index: string
  title: string
  icon: Component
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

const groups: MenuGroup[] = [
  {
    title: '总览',
    items: [{ index: '/admin', title: '仪表盘', icon: IconOdometer }],
  },
  {
    title: '用户与积分',
    items: [
      { index: '/admin/users', title: '用户管理', icon: IconUser },
      { index: '/admin/credits', title: '积分流水', icon: IconCoin },
    ],
  },
  {
    title: '兑换码',
    items: [
      { index: '/admin/redeem-codes', title: '兑换码管理', icon: IconTicket },
      { index: '/admin/redeem-code-batches', title: '兑换码批次', icon: IconBox },
    ],
  },
  {
    title: '工具',
    items: [
      { index: '/admin/tools', title: '工具开关', icon: IconSetUp },
      { index: '/admin/tool-usage', title: '工具使用记录', icon: IconHistogram },
    ],
  },
  {
    title: '日志与作品',
    items: [
      { index: '/admin/generation-records', title: '请求日志', icon: IconDocument },
      { index: '/admin/ai-media-works', title: 'AI 媒体作品', icon: IconPicture },
      { index: '/admin/error-logs', title: '错误日志', icon: IconWarning },
    ],
  },
  {
    title: '系统',
    items: [
      { index: '/admin/db-stats', title: '数据统计', icon: IconDataAnalysis },
    ],
  },
]

const isActive = (path: string) => {
  // 仪表盘菜单索引是 /admin，但实际路由是 /admin/dashboard
  if (path === '/admin') return route.path === '/admin' || route.path.startsWith('/admin/dashboard')
  return route.path.startsWith(path)
}

const go = (path: string) => {
  router.push(path)
  // 移动端选完收起 drawer
  if (window.innerWidth < 768) {
    adminStore.setSidebarCollapsed(false)
  }
}
</script>

<template>
  <nav class="admin-sidebar-nav pb-4">
    <!-- 品牌区 -->
    <div class="flex items-center gap-2.5 px-4 pt-4 pb-3">
      <span
        class="w-8 h-8 rounded-[10px] bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-[0_4px_12px_-4px_rgb(var(--accent-500)/0.5)]"
        aria-hidden="true"
      >
        <IconLightning class="w-4 h-4" />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-ink-900 leading-tight truncate">
          开发者工具箱
        </span>
        <span class="block text-[11px] text-ink-400 leading-tight mt-0.5">管理后台</span>
      </span>
    </div>

    <div
      v-for="g in groups"
      :key="g.title"
      class="admin-nav-group"
    >
      <div class="admin-nav-group-title">{{ g.title }}</div>
      <button
        v-for="m in g.items"
        :key="m.index"
        type="button"
        class="admin-nav-item"
        :class="{ 'is-active': isActive(m.index) }"
        @click="go(m.index)"
      >
        <component :is="m.icon" class="admin-nav-icon" aria-hidden="true" />
        <span>{{ m.title }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.admin-nav-group-title {
  padding: 14px 20px 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: rgb(var(--ink-400));
  user-select: none;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 16px);
  margin: 1px 8px;
  padding: 8px 12px;
  border-radius: 9px;
  font-size: 13.5px;
  color: rgb(var(--ink-600));
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.admin-nav-item:hover {
  background: rgb(var(--surface-2));
  color: rgb(var(--ink-900));
}
.admin-nav-item.is-active {
  background: rgb(var(--accent-50));
  color: rgb(var(--accent-700));
  font-weight: 500;
}

.admin-nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: rgb(var(--ink-400));
  transition: color 0.15s ease;
}
.admin-nav-item:hover .admin-nav-icon {
  color: rgb(var(--ink-600));
}
.admin-nav-item.is-active .admin-nav-icon {
  color: rgb(var(--accent-600));
}
</style>
