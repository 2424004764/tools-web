<script setup lang="ts">
import { ref, reactive, onMounted, computed, onUnmounted, nextTick } from 'vue'
import { Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
import { useUserStore } from '@/store/modules/user'
import 'element-plus/theme-chalk/display.css'
import { ToolsInfo } from '@/components/Tools/tools.type.ts';

import { useRouter } from 'vue-router'

const router = useRouter()
const routeLoading = ref(false)

// 监听路由变化，显示加载状态
router.beforeEach((_to, _from, next) => {
  routeLoading.value = true
  next()
})

router.afterEach(() => {
  routeLoading.value = false
})
// const isNavDrawer = ref(false)
const loading = ref(false)
const options = ref<ToolsInfo[]>([])
//store
const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const userStore = useUserStore()

// 用户相关状态
const userMenuVisible = ref(false)
const hideTimeout = ref<number | null>(null)

// 计算属性：判断用户是否已登录
const isLoggedIn = computed(() => userStore.getLoginStatus)

// 计算属性：获取用户信息
const user = computed(() => userStore.getUserInfo)

//查询参数
const searchParam = reactive({
  cateId: 0,
  title: '',
  route: '',
})

//search
// const search = async () => {
//   try {
//     await toolsStore.getTools(searchParam)
//     //关闭抽屉
//     isNavDrawer.value = false
//   } catch (error) {
//     console.log(error)
//   }
// }

//选择分类
// const chooseCate = (cateId: number) => {
//   searchParam.cateId = cateId
//   search()
// }

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

const optionClick = (url: string) => {
  router.push(url)
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
  <header class="h-24 w-full flex justify-between pt-2 pb-2 c-xs:h-16 c-xs:border-b-[1px] items-center">
    <div class="flex items-center w-full">
      <Transition name="fold" class="hidden c-sm:block c-md:hidden c-xs:block">
        <svg v-if="!componentStore.leftComDrawer" @click="componentStore.setleftComDrawerStatus(true)" t="1702978210636" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7618" width="30" height="30">
          <path fill="#444" fill-opacity=".9" d="M895.936 256l-768-0.896 0.128-64L896 192l-0.064 64zM179.2 689.152l202.688-152a32 32 0 0 0 0-51.2L179.2 333.952a32 32 0 0 0-51.2 25.6v304a32 32 0 0 0 51.2 25.6z m12.8-89.6v-176l117.312 88L192 599.552zM896 544H480v-64H896v64z m-0.064 288l-768-0.896 0.128-64L896 768l-0.064 64z" p-id="7619"></path>
        </svg>
        <svg v-else @click="componentStore.setleftComDrawerStatus(false)" t="1702978577170" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1587" width="30" height="30">
          <path fill="#444" fill-opacity=".9" d="M128.064 192l768 0.896-0.128 64L128 256l0.064-64z m514.048 294.848a32 32 0 0 0 0 51.2l202.688 152a32 32 0 0 0 51.2-25.6v-304a32 32 0 0 0-51.2-25.6l-202.688 152zM832 424.448v176l-117.312-88L832 424.448zM128 480h416v64H128v-64z m0.064 288l768 0.896-0.128 64L128 832l0.064-64z" p-id="1588"></path>
        </svg>
      </Transition>

      <!-- c-md:block -->
      <Transition name="fold" class="hidden c-md:block">
        <svg v-if="!componentStore.leftCom" @click="componentStore.setLeftComStatus(true)" t="1702978577170" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1587" width="30" height="30">
          <path fill="#444" fill-opacity=".9" d="M128.064 192l768 0.896-0.128 64L128 256l0.064-64z m514.048 294.848a32 32 0 0 0 0 51.2l202.688 152a32 32 0 0 0 51.2-25.6v-304a32 32 0 0 0-51.2-25.6l-202.688 152zM832 424.448v176l-117.312-88L832 424.448zM128 480h416v64H128v-64z m0.064 288l768 0.896-0.128 64L128 832l0.064-64z" p-id="1588"></path>
        </svg>
        <svg v-else @click="componentStore.setLeftComStatus(false)" t="1702978210636" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7618" width="30" height="30">
          <path fill="#444" fill-opacity=".9" d="M895.936 256l-768-0.896 0.128-64L896 192l-0.064 64zM895.936 256l-768-0.896 0.128-64L896 192l-0.064 64zM179.2 689.152l202.688-152a32 32 0 0 0 0-51.2L179.2 333.952a32 32 0 0 0-51.2 25.6v304a32 32 0 0 0 51.2 25.6z m12.8-89.6v-176l117.312 88L192 599.552zM896 544H480v-64H896v64z m-0.064 288l-768-0.896 0.128-64L896 768l-0.064 64z" p-id="7619"></path>
        </svg>
      </Transition>

      <div class="ml-3 mr-1">
        <router-link to="/">
          <svg t="1715590310537" class="icon" viewBox="0 0 1053 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4287" width="25" height="25">
            <path d="M526.63454 58.067422a21.503527 21.503527 0 0 1-27.501109 0.175539l474.979265 381.50475a31.538506 31.538506 0 1 0 39.496274-49.150919L538.629705 9.004273a41.602742 41.602742 0 0 0-51.988799 0.234052L11.573871 398.671586a31.538506 31.538506 0 1 0 39.993635 48.79984L526.63454 58.067422z" fill="#2c2c2c" p-id="4288"></path><path d="M1013.60897 564.087832L538.629705 182.583083a41.602742 41.602742 0 0 0-51.988799 0.204795L11.573871 572.191883a31.538506 31.538506 0 1 0 39.993635 48.79984l66.763331-54.709653v361.61033A94.644775 94.644775 0 0 0 213.004869 1022.537175H441.732179v-247.275931a15.79851 15.79851 0 0 1 15.739997-15.79851h110.472541c8.68918 0 15.769253 7.080073 15.769253 15.79851v247.275931H812.441281a94.615518 94.615518 0 0 0 94.644775-94.615518V559.465305l66.997383 53.831959a31.538506 31.538506 0 1 0 39.525531-49.209432z m-169.629183 363.804568c0 17.436874-14.101633 31.538506-31.567763 31.538506h-165.591785v-184.198919a78.875522 78.875522 0 0 0-78.875522-78.904778h-110.472541a78.875522 78.875522 0 0 0-78.846265 78.904778v184.198919h-165.591786c-17.46613 0-31.597019-14.130889-31.597019-31.538506V514.527323L512.883986 242.851471l331.095801 265.941578v419.128608z" fill="#2c2c2c" p-id="4289" stroke="black" stroke-width="10"></path>
          </svg>
        </router-link>
      </div>
      
    
      <div class="c-xs:w-[85%] w-full mr-3">
        <!-- <el-input 
          v-model="searchParam.title" 
          placeholder="搜索工具" 
          class="h-10 ml-3" 
          @keyup.enter.native="search">
          <template #append>
            <el-button :icon="Search" @click="search"/>
          </template>
        </el-input> -->
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
          class="ml-3 w-full"
          size="large"
        >
          <el-option
            v-for="item in options"
            :key="item.id"
            :label="item.title + ' - ' + item.desc"
            :value="item.id"
            @click="optionClick(item.url)"
          >
          </el-option>
        </el-select>
      </div>
    </div>

    <div class=" w-full md:w-auto flex md:block c-xs:w-auto">
      <ul class="flex mt-4 flex-col md:flex-row md:mt-0 justify-end items-center c-xs:mt-0">
        <!-- 用户信息区域 -->
        <li class="ml-3 relative user-menu-container">
          <!-- 未登录状态：显示登录按钮 -->
          <router-link v-if="!isLoggedIn" to="/login">
            <el-tooltip
              class="box-item"
              effect="dark"
              content="用户登录"
              placement="bottom"
            >
              <el-button type="primary" size="large" class="bg-gradient-to-r from-green-500 to-blue-500 w-20">
                登录
              </el-button>
            </el-tooltip>
          </router-link>
          
          <!-- 已登录状态：显示用户名和下拉菜单 -->
          <div v-else class="relative">
            <div 
              class="relative cursor-pointer text-gray-700 hover:text-blue-600 flex items-center gap-1 px-3 py-2 rounded hover:bg-gray-100"
              @click="toggleUserMenu"
              @mouseenter="showUserMenu"
              @mouseleave="hideUserMenu"
            >
              <span class="whitespace-nowrap">{{ user?.username || user?.email || '用户' }}</span>
              <svg class="w-4 h-4 text-gray-500 transition-transform duration-200" :class="{ 'rotate-180': userMenuVisible }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
              
              <!-- 悬浮菜单 -->
              <div 
                v-show="userMenuVisible"
                class="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[120px] z-50"
                @mouseenter="showUserMenu"
                @mouseleave="hideUserMenu"
              >
                <div 
                  class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  @click.stop="goToUserInfo"
                >
                  个人中心
                </div>
                <div 
                  class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-600"
                  @click.stop="handleLogout"
                >
                  退出登录
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </header>
  <!-- 更新加载状态样式 -->
  <div v-if="routeLoading" class="fixed top-0 left-0 w-full h-full bg-black bg-opacity-40 flex items-center justify-center z-50 loading-overlay">
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
    @apply w-full;
}

.el-select :deep(.el-select__wrapper){
  background-color: rgba(46, 51, 56, 0.05);
  background-color: rgb(255, 255, 255);
}

/* 用户菜单样式 */
.user-menu-container {
  position: relative;
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

.user-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #374151;
  transition: all 0.2s;
}

.user-menu-item:hover {
  background-color: #f3f4f6;
  color: #111827;
}

/* 加载动画样式 */
.loading-overlay {
  backdrop-filter: blur(2px);
  animation: fadeIn 0.3s ease-out;
}

.loading-container {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
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
  border-top: 2px solid #10b981;
  border-radius: 50%;
  animation: spin 2s linear infinite reverse;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
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