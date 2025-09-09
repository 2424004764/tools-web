<script setup lang="ts">
import { onMounted } from "vue";
import { useUserStore } from "@/store/modules/user";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";

const userStore = useUserStore();
const router = useRouter();

onMounted(() => {
  // 检查用户是否已登录
  if (!userStore.getLoginStatus) {
    router.push("/login");
    return;
  }
});

// 退出登录
const handleLogout = async () => {
  await ElMessageBox.confirm("确定要退出登录吗？", "退出确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  });

  // 用户确认后执行退出登录
  userStore.logout();
  router.push("/");
  ElMessage.success("已退出登录");
};

// 复制用户ID到剪贴板
const copyUserId = async () => {
  try {
    if (userStore.getUserInfo?.uid) {
      await navigator.clipboard.writeText(userStore.getUserInfo.uid);
      ElMessage.success("用户ID已复制到剪贴板");
    }
  } catch (err) {
    ElMessage.error("复制失败");
  }
};

// 跳转到笔记页面
const goToNotes = () => {
  router.push('/notes');
}

// 跳转到简历页面
const goToResume = () => {
  router.push('/resume');
};

// 跳转到公司对比页面
const goToCompanyCompare = () => {
  router.push('/company-compare');
};
</script>

<template>
  <div
    class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 c-sm:p-6 c-md:p-10"
  >
    <div class="w-full max-w-md c-sm:max-w-lg c-md:max-w-xl">
      <div class="text-center mb-6 c-sm:mb-8">
        <h1 class="text-2xl c-sm:text-3xl font-bold text-gray-800 mb-2">
          用户信息
        </h1>
      </div>

      <div class="space-y-4 c-sm:space-y-6">
        <!-- 用户信息显示 -->
        <div v-if="userStore.getUserInfo" class="space-y-3 c-sm:space-y-4">
          <!-- 用户头像 -->
          <div class="text-center mb-4 c-sm:mb-6">
            <img
              :src="
                userStore.getUserInfo.avatar || '/src/assets/default_avatar.png'
              "
              :alt="userStore.getUserInfo.username"
              class="w-20 h-20 c-sm:w-24 c-sm:h-24 rounded-full mx-auto border-4 border-gray-200 shadow-lg"
            />
          </div>

          <!-- 用户名 -->
          <div class="bg-white border border-gray-200 rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-gray-700 font-medium text-sm c-sm:text-base"
                >用户名:</span
              >
              <span class="text-gray-600 text-sm c-sm:text-base break-all">{{
                userStore.getUserInfo.username
              }}</span>
            </div>
          </div>

          <!-- 邮箱 -->
          <div class="bg-white border border-gray-200 rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-gray-700 font-medium text-sm c-sm:text-base"
                >邮箱:</span
              >
              <span class="text-gray-600 text-sm c-sm:text-base break-all">{{
                userStore.getUserInfo.email
              }}</span>
            </div>
          </div>

          <!-- 用户ID -->
          <div class="bg-white border border-gray-200 rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-start c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-gray-700 font-medium text-sm c-sm:text-base"
                >用户ID:</span
              >
              <div
                class="flex flex-col c-sm:flex-row c-sm:items-center gap-2 w-full c-sm:w-auto"
              >
                <span class="text-gray-600 text-xs c-sm:text-sm break-all">{{
                  userStore.getUserInfo.uid
                }}</span>
                <el-button
                  type="primary"
                  size="small"
                  @click="copyUserId"
                  class="px-2 py-1 self-start c-sm:self-center"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path
                      d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                    />
                  </svg>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 个人功能区域 -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-gray-800 mb-3 text-center">个人功能</h3>
          <div class="grid grid-cols-1 gap-3">
            <!-- 笔记备忘录 -->
            <div 
              @click="goToNotes"
              class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <img 
                    src="/images/logo/notes.png" 
                    alt="笔记备忘录" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-gray-800 text-sm c-sm:text-base group-hover:text-blue-600 transition-colors">
                    笔记备忘录
                  </h4>
                  <p class="text-gray-500 text-xs c-sm:text-sm">
                    记录和管理您的个人笔记
                  </p>
                </div>
                <div class="text-gray-400 group-hover:text-blue-500 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 简历管理 -->
            <div 
              @click="goToResume"
              class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-green-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <img 
                    src="/images/logo/resume.png" 
                    alt="简历管理" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-gray-800 text-sm c-sm:text-base group-hover:text-green-600 transition-colors">
                    简历管理
                  </h4>
                  <p class="text-gray-500 text-xs c-sm:text-sm">
                    制作和管理您的个人简历
                  </p>
                </div>
                <div class="text-gray-400 group-hover:text-green-500 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 公司对比 -->
            <div 
              @click="goToCompanyCompare"
              class="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-purple-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <img 
                    src="/images/logo/company_compare.png" 
                    alt="公司对比" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-gray-800 text-sm c-sm:text-base group-hover:text-purple-600 transition-colors">
                    公司对比
                  </h4>
                  <p class="text-gray-500 text-xs c-sm:text-sm">
                    对比不同公司的薪资福利待遇
                  </p>
                </div>
                <div class="text-gray-400 group-hover:text-purple-500 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 退出登录按钮 -->
        <div class="text-center pt-2">
          <el-button
            type="danger"
            size="small"
            @click="handleLogout"
            class="w-full c-sm:w-auto"
          >
            退出登录
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 头像样式 */
.user-avatar {
  transition: transform 0.2s ease-in-out;
}

.user-avatar:hover {
  transform: scale(1.05);
}

/* 响应式断点样式 */
@media (max-width: 640px) {
  /* 小屏幕样式 */
}

@media (min-width: 641px) and (max-width: 768px) {
  /* 中等屏幕样式 */
}

@media (min-width: 769px) {
  /* 大屏幕样式 */
}
</style>
