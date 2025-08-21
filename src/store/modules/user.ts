import { defineStore } from 'pinia'
import { getUserFromToken, isTokenExpired, logout as logoutUtil } from '@/utils/user'
import type { UserInfo } from '@/utils/user'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as UserInfo | null,
    isLoggedIn: false
  }),
  
  getters: {
    // 获取用户信息
    getUserInfo: (state) => state.user,
    // 检查是否已登录
    getLoginStatus: (state) => state.isLoggedIn
  },
  
  actions: {
    // 初始化用户状态
    initUserState() {
      const userInfo = getUserFromToken()
      if (userInfo && !isTokenExpired()) {
        this.user = userInfo
        this.isLoggedIn = true
      } else {
        this.user = null
        this.isLoggedIn = false
      }
    },
    
    // 设置用户信息
    setUser(userInfo: UserInfo) {
      this.user = userInfo
      this.isLoggedIn = true
    },
    
    // 清除用户信息
    clearUser() {
      this.user = null
      this.isLoggedIn = false
    },
    
    // 退出登录
    logout() {
      logoutUtil()
      this.clearUser()
    }
  }
})
