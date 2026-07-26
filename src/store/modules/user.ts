import { defineStore } from 'pinia'
import { getUserFromToken, isTokenExpired, logout as logoutUtil } from '@/utils/user'
import type { UserInfo } from '@/utils/user'
import { fetchMyCredits } from '@/api/me'

export interface UserCreditsState {
  balance: number
  total_earned: number
  total_spent: number
  updated_at: string | null
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as UserInfo | null,
    isLoggedIn: false,
    credits: { balance: 0, total_earned: 0, total_spent: 0, updated_at: null } as UserCreditsState,
    creditsLoaded: false,
    _creditsFetchSeq: 0,
  }),

  getters: {
    // 获取用户信息
    getUserInfo: (state) => state.user,
    // 检查是否已登录
    getLoginStatus: (state) => state.isLoggedIn,
    // 检查是否为管理员（老 token 没有 is_admin 字段时按非管理员处理）
    getIsAdmin: (state) => Boolean(state.user?.is_admin),
    // 积分余额
    getBalance: (state) => state.credits.balance,
    getCredits: (state) => state.credits,
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
      this.credits = { balance: 0, total_earned: 0, total_spent: 0, updated_at: null }
      this.creditsLoaded = false
    },

    // 退出登录
    logout() {
      logoutUtil()
      this.clearUser()
    },

    // 拉取积分余额（带序列号避免陈旧响应竞争）
    // force=true 时忽略 creditsLoaded 缓存，始终拉取（用于错误后对齐数据库）
    async fetchCredits(force = false) {
      if (!this.isLoggedIn) return
      if (this.creditsLoaded && !force) return
      const seq = ++this._creditsFetchSeq
      try {
        const data = await fetchMyCredits()
        // 序列号保护：只接受最新的响应，旧的不覆盖新的
        if (seq === this._creditsFetchSeq) {
          this.credits = {
            balance: data.balance,
            total_earned: data.total_earned,
            total_spent: data.total_spent,
            updated_at: data.updated_at,
          }
          this.creditsLoaded = true
        }
      } catch (err) {
        console.warn('[userStore] fetchCredits failed', err)
      }
    },

    // 局部更新余额（生成扣费成功后调用，避免再发请求）
    setBalance(balance: number) {
      this.credits.balance = balance
      this.creditsLoaded = true
    },
  },
})

