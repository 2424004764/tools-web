<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElButton, ElMessageBox } from "element-plus";
import { getUserFromToken, isTokenExpired, logout } from "@/utils/user";
import type { UserInfo } from "@/utils/user";
import { useRouter } from "vue-router";

const user = ref<UserInfo | null>(null);
const loading = ref(true);
const router = useRouter();

onMounted(() => {
  const userInfo = getUserFromToken();
  if (userInfo && !isTokenExpired()) {
    user.value = userInfo;
  } else {
    ElMessage.error("用户信息已过期，请重新登录");
    // 跳转到登录页
    window.location.href = "/login";
  }
  loading.value = false;
});

const handleSignOut = async () => {
  await ElMessageBox.confirm("确定要退出登录吗？", "确认退出", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  });

  // 用户确认后执行退出操作
  logout();
  user.value = null;
  ElMessage.success("已退出登录");
  // 跳转到首页
  router.push("/");
};

const copyUserId = async () => {
  await navigator.clipboard.writeText(user.value?.uid || "");
  ElMessage.success("已复制");
};
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 sm:p-10">
    <div class="w-full max-w-md sm:w-96">
      <div class="text-center mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">用户信息</h1>
      </div>

      <div v-if="loading" class="text-center">
        <span class="text-gray-600">加载中...</span>
      </div>

      <div v-else-if="user" class="space-y-4 sm:space-y-6">
        <!-- 用户头像 -->
        <div class="text-center">
          <img
            :src="user.avatar"
            :alt="user.username"
            class="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 border-4 border-gray-200"
          />
        </div>

        <!-- 用户信息 -->
        <div class="space-y-3 sm:space-y-4">
          <div
            class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1 sm:gap-0"
          >
            <span class="font-medium text-gray-700">用户名：</span>
            <span class="text-gray-900">{{ user.username }}</span>
          </div>

          <div
            class="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg gap-1 sm:gap-0"
          >
            <span class="font-medium text-gray-700">邮箱：</span>
            <span class="text-gray-900 text-sm break-all">{{ user.email }}</span>
          </div>

          <div
            class="flex flex-col p-3 bg-gray-50 rounded-lg gap-2"
          >
            <span class="font-medium text-gray-700">用户ID：</span>
            <div class="flex items-center">
              <span class="text-gray-900 text-sm break-all flex-1">{{ user.uid }}</span>
              <ElButton
                type="primary"
                size="small"
                @click="copyUserId"
                class="px-2 py-1 text-xs ml-1 flex-shrink-0"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </ElButton>
            </div>
          </div>
        </div>

        <!-- 退出登录按钮 -->
        <div class="text-center pt-4">
          <ElButton type="danger" @click="handleSignOut"> 退出登录 </ElButton>
        </div>
      </div>

      <div v-else class="text-center text-gray-500">
        <p>未找到用户信息</p>
        <ElButton
          type="primary"
          class="mt-4"
          @click="() => router.push('/login')"
        >
          去登录
        </ElButton>
      </div>
    </div>
  </div>
</template>
