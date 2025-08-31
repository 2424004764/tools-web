<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElMessage } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import { jwtDecode } from "jwt-decode";
import { useUserStore } from "@/store/modules/user";
import axios from "axios";
const appTitle = ref(import.meta.env.VITE_APP_TITLE || "");
const siteUrl = ref(import.meta.env.VITE_SITE_URL || "");

// 谷歌API类型声明
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | string, options: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const loading = ref(false);
const linuxdoLoading = ref(false);
const googleInitialized = ref(false);
const userStore = useUserStore();

// 谷歌登录配置
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 计算属性检查用户是否已登录
const isLoggedIn = computed(() => userStore.getLoginStatus);

onMounted(() => {
  // 初始化用户状态
  userStore.initUserState();

  // 如果已登录则跳转到用户信息页
  if (userStore.getLoginStatus) {
    window.location.href = "/userinfo";
    return;
  }

  // 加载谷歌登录SDK
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    googleInitialized.value = true;
    initializeGoogleSignIn();
  };
  document.head.appendChild(script);

  // 监听Linux.do登录窗口消息
  window.addEventListener("message", handleLinuxdoMessage);
});

const initializeGoogleSignIn = () => {
  if (typeof window.google !== "undefined") {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const buttonElement = document.getElementById("google-signin-button");
    if (buttonElement) {
      window.google.accounts.id.renderButton(buttonElement, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 400,
      });
    }
  }
};

const handleGoogleSignIn = async (response: any) => {
  if (response.credential) {
    loading.value = true;

    try {
      const result = await axios.post("/google-auth", {
        credential: response.credential,
      });

      if (result.data.success) {
        const jwt = jwtDecode<{ username: string }>(result.data.token);
        console.log("jwt", jwt);
        ElMessage.success(`欢迎回来，${jwt.username}！`);
        // 保存 JWT
        localStorage.setItem("TOKEN", result.data.token);
        // 更新store中的用户状态
        userStore.initUserState();
        // 登录成功后跳转到用户信息页
        window.location.href = "/userinfo";
      } else {
        throw new Error(result.data.error || "认证失败");
      }
    } catch (error) {
      ElMessage.error("谷歌登录失败，请重试");
      console.error("Google sign-in error:", error);
    } finally {
      loading.value = false;
    }
  }
};

// Linux.do登录处理
const handleLinuxdoLogin = async () => {
  try {
    linuxdoLoading.value = true;

    // 请求获取Linux.do授权URL
    const result = await axios.post(siteUrl.value + "/linuxdo-auth", {
      params: {
        action: "getAuthUrl",
      },
    });

    if (!result.data.success) {
      throw new Error("Linux.do登录配置错误");
    }

    // 打开授权页面
    const authWindow = window.open(
      result.data.auth_url,
      "linuxdo-auth",
      "width=600,height=600,scrollbars=yes,resizable=yes"
    );

    if (!authWindow) {
      throw new Error("无法打开登录窗口，请检查浏览器弹窗设置");
    }
  } catch (error) {
    console.error("Linux.do login error:", error);
    ElMessage.error("Linux.do登录失败，请重试");
    linuxdoLoading.value = false;
  }
};

// 处理Linux.do登录窗口消息
const handleLinuxdoMessage = (event: MessageEvent) => {
  // 验证消息来源 - 只接受来自可信域名的消息
  const trustedOrigins = [
    'https://connect.linux.do', // Linux.do官方域名
  ];
  
  if (!trustedOrigins.some(origin => event.origin.startsWith(origin))) {
    return; // 忽略不可信来源的消息
  }

  // 验证消息格式
  if (!event.data || typeof event.data !== 'object') {
    return; // 忽略格式不正确的消息
  }

  // 验证消息类型
  if (!['success', 'error'].includes(event.data?.type)) {
    return; // 忽略非Linux.do登录相关的消息
  }

  if (event.data?.type === "success") {
    // 验证成功消息的数据结构
    if (!event.data.data?.token || !event.data.data?.user) {
      console.warn('Linux.do success message missing required data');
      return;
    }

    linuxdoLoading.value = false;

    const { token, user, message } = event.data.data;

    ElMessage.success(message || `欢迎回来，${user.username}！`);

    // 保存 JWT
    localStorage.setItem("TOKEN", token);

    // 更新store中的用户状态
    userStore.initUserState();

    // 登录成功后跳转到用户信息页
    setTimeout(() => {
      window.location.href = "/userinfo";
    }, 1000);
  } else {
    linuxdoLoading.value = false;

    const { error, message } = event.data;
    console.error("Linux.do auth error:", error, message);
    ElMessage.error(message || "Linux.do登录失败，请重试");
  }
};

const handleSignOut = () => {
  if (typeof window.google !== "undefined") {
    window.google.accounts.id.disableAutoSelect();
  }

  // 使用store的logout方法
  userStore.logout();
  ElMessage.success("已退出登录");
};
</script>

<template>
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-10">
    <div class="w-96">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">用户登录</h1>
        <p class="text-gray-600">欢迎使用{{ appTitle }}</p>
      </div>

      <div class="space-y-6">
        <!-- 谷歌登录按钮 -->
        <div class="flex justify-center">
          <div id="google-signin-button"></div>
        </div>

        <!-- Linux.do登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleLinuxdoLogin"
            :disabled="linuxdoLoading"
            class="flex items-center justify-center w-full max-w-[400px] h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <img
              src="https://linux.do/uploads/default/original/4X/c/c/d/ccd8c210609d498cbeb3d5201d4c259348447562.png"
              alt="Linux.do"
              class="w-5 h-5 mr-3"
            />
            <span
              v-if="!linuxdoLoading"
              class="text-sm font-medium text-gray-600"
            >
              使用 Linux.do 登录
            </span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- 或者分隔线 -->
        <div class="flex items-center">
          <div class="flex-1 border-t border-gray-200"></div>
          <span class="px-3 text-sm text-gray-500">或</span>
          <div class="flex-1 border-t border-gray-200"></div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="text-center">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="ml-2 text-gray-600">登录中...</span>
        </div>

        <!-- 登录说明 -->
        <div class="text-center text-gray-500 text-sm">
          <p>支持谷歌账号和Linux.do账号登录</p>
          <p class="mt-2">登录后可以享受更多个性化功能</p>
        </div>

        <!-- 退出登录按钮 -->
        <div v-if="isLoggedIn" class="text-center">
          <el-button type="danger" size="small" @click="handleSignOut">
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
