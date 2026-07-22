// Admin 模块状态
import { defineStore } from 'pinia'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    /** 侧边栏是否折叠 */
    sidebarCollapsed: false,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setSidebarCollapsed(v: boolean) {
      this.sidebarCollapsed = v
    },
  },
})