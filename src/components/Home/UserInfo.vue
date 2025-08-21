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
