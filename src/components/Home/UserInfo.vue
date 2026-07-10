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
    router.push("/login?redirect=" + encodeURIComponent(router.currentRoute.value.fullPath));
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

// 跳转到QA页面
const goToQA = () => {
  router.push('/qa');
};

// 跳转到待办事项页面
const goToTodos = () => {
  router.push('/userinfo/todos');
};
</script>

<template>
  <div
    class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 c-sm:p-6 c-md:p-10"
  >
    <div class="w-full max-w-md c-sm:max-w-lg c-md:max-w-xl">
      <div class="text-center mb-6 c-sm:mb-8">
        <h1 class="text-h2 c-sm:text-h1 font-bold text-ink-900 mb-2">
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
              class="w-20 h-20 c-sm:w-24 c-sm:h-24 rounded-full mx-auto border-4 border-border-default shadow-lg"
            />
          </div>

          <!-- 用户名 -->
          <div class="bg-white border border-border-default rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-ink-700 font-medium text-body-sm c-sm:text-body"
                >用户名:</span
              >
              <span class="text-ink-600 text-body-sm c-sm:text-body break-all">{{
                userStore.getUserInfo.username
              }}</span>
            </div>
          </div>

          <!-- 邮箱 -->
          <div class="bg-white border border-border-default rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-ink-700 font-medium text-body-sm c-sm:text-body"
                >邮箱:</span
              >
              <span class="text-ink-600 text-body-sm c-sm:text-body break-all">{{
                userStore.getUserInfo.email
              }}</span>
            </div>
          </div>

          <!-- 用户ID -->
          <div class="bg-white border border-border-default rounded-lg p-3 c-sm:p-4">
            <div
              class="flex flex-col c-sm:flex-row c-sm:justify-between c-sm:items-start c-sm:items-center gap-2 c-sm:gap-0"
            >
              <span class="text-ink-700 font-medium text-body-sm c-sm:text-body"
                >用户ID:</span
              >
              <div
                class="flex flex-col c-sm:flex-row c-sm:items-center gap-2 w-full c-sm:w-auto"
              >
                <span class="text-ink-600 text-caption c-sm:text-body-sm break-all">{{
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
        <div class="bg-gradient-to-r from-accent-50 to-accent-100 border border-accent-200 rounded-lg p-4">
          <h3 class="text-body-lg font-semibold text-ink-900 mb-3 text-center">个人功能</h3>
          <div class="grid grid-cols-1 gap-3">
            <!-- 笔记备忘录 -->
            <div 
              @click="goToNotes"
              class="bg-white border border-border-default rounded-lg p-3 hover:shadow-md hover:border-accent-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                  <img 
                    src="/images/logo/notes.png" 
                    alt="笔记备忘录" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-ink-900 text-body-sm c-sm:text-body group-hover:text-accent-600 transition-colors">
                    笔记备忘录
                  </h4>
                  <p class="text-ink-500 text-caption c-sm:text-body-sm">
                    记录和管理您的个人笔记
                  </p>
                </div>
                <div class="text-ink-400 group-hover:text-accent-600 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 简历管理 -->
            <div 
              @click="goToResume"
              class="bg-white border border-border-default rounded-lg p-3 hover:shadow-md hover:border-accent-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                  <img 
                    src="/images/logo/resume.png" 
                    alt="简历管理" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-ink-900 text-body-sm c-sm:text-body group-hover:text-accent-600 transition-colors">
                    简历管理
                  </h4>
                  <p class="text-ink-500 text-caption c-sm:text-body-sm">
                    制作和管理您的个人简历
                  </p>
                </div>
                <div class="text-ink-400 group-hover:text-accent-600 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 公司对比 -->
            <div 
              @click="goToCompanyCompare"
              class="bg-white border border-border-default rounded-lg p-3 hover:shadow-md hover:border-accent-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                  <img 
                    src="/images/logo/company_compare.png" 
                    alt="公司对比" 
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-ink-900 text-body-sm c-sm:text-body group-hover:text-accent-600 transition-colors">
                    公司对比
                  </h4>
                  <p class="text-ink-500 text-caption c-sm:text-body-sm">
                    对比不同公司的薪资福利待遇
                  </p>
                </div>
                <div class="text-ink-400 group-hover:text-accent-600 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- QA页面制作 -->
            <div
              @click="goToQA"
              class="bg-white border border-border-default rounded-lg p-3 hover:shadow-md hover:border-accent-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                  <img
                    src="/images/logo/qa.png"
                    alt="QA页面制作"
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-ink-900 text-body-sm c-sm:text-body group-hover:text-accent-600 transition-colors">
                    QA页面制作
                  </h4>
                  <p class="text-ink-500 text-caption c-sm:text-body-sm">
                    创建个性化的问答页面
                  </p>
                </div>
                <div class="text-ink-400 group-hover:text-accent-600 transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 待办事项 -->
            <div
              @click="goToTodos"
              class="bg-white border border-border-default rounded-lg p-3 hover:shadow-md hover:border-accent-300 transition-all duration-200 cursor-pointer group"
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center group-hover:bg-accent-100 transition-colors">
                  <img
                    src="/images/logo/todos.png"
                    alt="待办事项"
                    class="w-10 h-10 object-contain"
                  />
                </div>
                <div class="flex-1">
                  <h4 class="font-medium text-ink-900 text-body-sm c-sm:text-body group-hover:text-accent-600 transition-colors">
                    待办事项
                  </h4>
                  <p class="text-ink-500 text-caption c-sm:text-body-sm">
                    管理您的任务和待办清单
                  </p>
                </div>
                <div class="text-ink-400 group-hover:text-accent-600 transition-colors">
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
