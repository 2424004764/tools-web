<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { jwtDecode } from 'jwt-decode'
import { useUserStore } from '@/store/modules/user'
const appTitle = ref(import.meta.env.VITE_APP_TITLE || '')

// 谷歌API类型声明
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement | string, options: any) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const loading = ref(false)
const googleInitialized = ref(false)
const userStore = useUserStore()

// 谷歌登录配置
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// 计算属性检查用户是否已登录
const isLoggedIn = computed(() => userStore.getLoginStatus)

onMounted(() => {
  // 初始化用户状态
  userStore.initUserState()
  
  // 如果已登录则跳转到用户信息页
  if (userStore.getLoginStatus) {
    window.location.href = '/userinfo'
    return
  }
  
  // 加载谷歌登录SDK
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    googleInitialized.value = true
    initializeGoogleSignIn()
  }
  document.head.appendChild(script)
})

const initializeGoogleSignIn = () => {
  if (typeof window.google !== 'undefined') {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    
    const buttonElement = document.getElementById('google-signin-button')
    if (buttonElement) {
      window.google.accounts.id.renderButton(buttonElement, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 400
      })
    }
  }
}

const handleGoogleSignIn = async (response: any) => {
  if (response.credential) {
    loading.value = true
    
    try {
      const authResponse = await fetch('/google-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential
        })
      })
      
      if (!authResponse.ok) {
        throw new Error('认证请求失败')
      }
      
      const result = await authResponse.json()
      
      if (result.success) {
        const jwt = jwtDecode<{ username: string }>(result.token)
        console.log('jwt', jwt)
        ElMessage.success(`欢迎回来，${jwt.username}！`)
        // 保存 JWT
        localStorage.setItem('TOKEN', result.token)
        // 更新store中的用户状态
        userStore.initUserState()
        // 登录成功后跳转到用户信息页
        window.location.href = '/userinfo'
      } else {
        throw new Error(result.error || '认证失败')
      }
      
    } catch (error) {
      ElMessage.error('谷歌登录失败，请重试')
      console.error('Google sign-in error:', error)
    } finally {
      loading.value = false
    }
  }
}

const handleSignOut = () => {
  if (typeof window.google !== 'undefined') {
    window.google.accounts.id.disableAutoSelect()
  }
  
  // 使用store的logout方法
  userStore.logout()
  ElMessage.success('已退出登录')
}
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-10">
    <div class="w-96">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">用户登录</h1>
        <p class="text-gray-600">欢迎使用{{appTitle}}</p>
      </div>
      
      <div class="space-y-6">
        <!-- 谷歌登录按钮 -->
        <div class="flex justify-center">
          <div id="google-signin-button"></div>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="loading" class="text-center">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="ml-2 text-gray-600">登录中...</span>
        </div>
        
        <!-- 登录说明 -->
        <div class="text-center text-gray-500 text-sm">
          <p>目前仅支持谷歌账号登录</p>
          <p class="mt-2">登录后可以享受更多个性化功能</p>
        </div>
        
        <!-- 退出登录按钮 -->
        <div v-if="isLoggedIn" class="text-center">
          <el-button 
            type="danger" 
            size="small" 
            @click="handleSignOut"
          >
            退出登录
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义谷歌登录按钮样式 */
#google-signin-button {
  display: flex;
  justify-content: center;
}

#google-signin-button > div {
  margin: 0 auto;
}
</style>
