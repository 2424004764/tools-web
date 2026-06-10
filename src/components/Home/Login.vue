<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import { ElMessage } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import { jwtDecode } from "jwt-decode";
import { useUserStore } from "@/store/modules/user";
import axios from "axios";
const appTitle = ref(import.meta.env.VITE_APP_TITLE || "");

// 谷歌API类型声明
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | string, options: any) => void;
          disableAutoSelect: () => void;
          prompt: (callback: (notification: any) => void) => void; // 添加 prompt 方法
        };
      };
    };
  }
}

const loading = ref(false);
const googleInitialized = ref(false);
const userStore = useUserStore();

// 邮箱登录相关状态
const activeTab = ref('email-login') // email-login / email-register / email-reset
const loginMethod = ref('password') // password / code
const emailForm = reactive({
  email: '',
  password: '',
  username: '',
  code: '',
  newPassword: ''
})
const sendingCode = ref(false)
const countdown = ref(0)

// 登录成功后跳转的目标地址，优先使用 redirect 参数
const redirectUrl = computed(() => {
  const params = new URLSearchParams(window.location.search)
  return params.get('redirect') || '/userinfo'
})

// 谷歌登录配置
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 计算属性检查用户是否已登录
const isLoggedIn = computed(() => userStore.getLoginStatus);

onMounted(() => {
  // 初始化用户状态
  userStore.initUserState();

  // 如果已登录则跳转
  if (userStore.getLoginStatus) {
    window.location.href = redirectUrl.value;
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
});

// 添加自定义谷歌登录处理函数
const handleCustomGoogleLogin = () => {
  if (typeof window.google !== "undefined") {
    // 触发Google One Tap登录
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // 如果One Tap不可用，则显示弹窗登录
        showGoogleLoginPopup();
      }
    });
  } else {
    ElMessage.error("Google登录服务未加载，请刷新页面重试");
  }
};

// 显示Google登录弹窗
const showGoogleLoginPopup = () => {
  if (typeof window.google !== "undefined") {
    // 创建一个临时的隐藏按钮来触发弹窗
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    
    window.google.accounts.id.renderButton(tempDiv, {
      theme: "outline",
      size: "large",
      type: "standard",
    });
    
    // 模拟点击来触发登录弹窗
    setTimeout(() => {
      const button = tempDiv.querySelector('[role="button"]') as HTMLElement;
      if (button) {
        button.click();
      }
      // 清理临时元素
      document.body.removeChild(tempDiv);
    }, 100);
  }
};

const initializeGoogleSignIn = () => {
  if (typeof window.google !== "undefined") {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // 仍然初始化隐藏的按钮作为备用
    const buttonElement = document.getElementById("google-signin-button");
    if (buttonElement) {
      window.google.accounts.id.renderButton(buttonElement, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
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
        // 登录成功后跳转
        window.location.href = redirectUrl.value;
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

// 发送验证码
const sendVerificationCode = async () => {
  if (!emailForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.email)) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }

  sendingCode.value = true
  try {
    const type = activeTab.value === 'email-register' ? 'register' : activeTab.value === 'email-reset' ? 'reset' : 'login'
    const result = await axios.post('/api/send-verification-code', { email: emailForm.email, type })

    if (result.data.message) {
      ElMessage.success(result.data.message)
      countdown.value = 60
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) clearInterval(timer)
      }, 1000)
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '发送失败')
  } finally {
    sendingCode.value = false
  }
}

// 邮箱注册
const handleEmailRegister = async () => {
  if (!emailForm.email || !emailForm.password || !emailForm.code || !emailForm.username) {
    ElMessage.warning('请填写完整信息')
    return
  }

  loading.value = true
  try {
    const result = await axios.post('/api/email-register', {
      email: emailForm.email,
      password: emailForm.password,
      code: emailForm.code,
      username: emailForm.username
    })

    if (result.data.token) {
      ElMessage.success(`注册成功，欢迎 ${result.data.username}！`)
      localStorage.setItem('TOKEN', result.data.token)
      userStore.initUserState()
      window.location.href = redirectUrl.value
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}

// 邮箱验证码登录
const handleEmailCodeLogin = async () => {
  if (!emailForm.email || !emailForm.code) {
    ElMessage.warning('请填写邮箱和验证码')
    return
  }

  loading.value = true
  try {
    const result = await axios.post('/api/email-login', {
      email: emailForm.email,
      code: emailForm.code
    })

    if (result.data.token) {
      ElMessage.success(`欢迎回来，${result.data.username}！`)
      localStorage.setItem('TOKEN', result.data.token)
      userStore.initUserState()
      window.location.href = redirectUrl.value
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

// 邮箱密码登录
const handleEmailPasswordLogin = async () => {
  if (!emailForm.email || !emailForm.password) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }

  loading.value = true
  try {
    const result = await axios.post('/api/email-password-login', {
      email: emailForm.email,
      password: emailForm.password
    })

    if (result.data.token) {
      ElMessage.success(`欢迎回来，${result.data.user.username}！`)
      localStorage.setItem('TOKEN', result.data.token)
      userStore.initUserState()
      window.location.href = redirectUrl.value
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

// 重置密码
const handleResetPassword = async () => {
  if (!emailForm.email || !emailForm.code || !emailForm.newPassword) {
    ElMessage.warning('请填写完整信息')
    return
  }

  loading.value = true
  try {
    await axios.post('/api/reset-password', {
      email: emailForm.email,
      code: emailForm.code,
      newPassword: emailForm.newPassword
    })

    ElMessage.success('密码重置成功，请登录')
    activeTab.value = 'email-login'
    emailForm.code = ''
    emailForm.newPassword = ''
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '重置失败')
  } finally {
    loading.value = false
  }
}

// Linux.do登录处理
// const handleLinuxdoLogin = async () => {
//   try {
//     linuxdoLoading.value = true;

//     // 请求获取Linux.do授权URL
//     const result = await axios.post(siteUrl.value + "/linuxdo-auth", {
//       params: {
//         action: "getAuthUrl",
//       },
//     });

//     if (!result.data.success) {
//       throw new Error("Linux.do登录配置错误");
//     }

//     // 打开授权页面
//     const authWindow = window.open(
//       result.data.auth_url,
//       "linuxdo-auth",
//       "width=600,height=600,scrollbars=yes,resizable=yes"
//     );

//     if (!authWindow) {
//       throw new Error("无法打开登录窗口，请检查浏览器弹窗设置");
//     }
//   } catch (error) {
//     console.error("Linux.do login error:", error);
//     ElMessage.error("Linux.do登录失败，请重试");
//     linuxdoLoading.value = false;
//   }
// };

// Gitee登录处理 (替换原QQ登录处理)
// const handleGiteeLogin = async () => {
//   try {
//     giteeLoading.value = true;

//     // 请求获取Gitee授权URL
//     const result = await axios.post(siteUrl.value + "/gitee-auth", {
//       params: {
//         action: "getAuthUrl",
//       },
//     });

//     if (!result.data.success) {
//       throw new Error("Gitee登录配置错误");
//     }

//     // 打开授权页面
//     const authWindow = window.open(
//       result.data.auth_url,
//       "gitee-auth",
//       "width=600,height=600,scrollbars=yes,resizable=yes"
//     );

//     if (!authWindow) {
//       throw new Error("无法打开登录窗口，请检查浏览器弹窗设置");
//     }
//   } catch (error) {
//     console.error("Gitee login error:", error);
//     ElMessage.error("Gitee登录失败，请重试");
//     giteeLoading.value = false;
//   }
// };

// GitHub登录处理
// const handleGithubLogin = async () => {
//   try {
//     githubLoading.value = true;

//     // 请求获取GitHub授权URL
//     const result = await axios.post(siteUrl.value + "/github-auth", {
//       params: {
//         action: "getAuthUrl",
//       },
//     });

//     if (!result.data.success) {
//       throw new Error("GitHub登录配置错误");
//     }

//     // 打开授权页面
//     const authWindow = window.open(
//       result.data.auth_url,
//       "github-auth",
//       "width=600,height=600,scrollbars=yes,resizable=yes"
//     );

//     if (!authWindow) {
//       throw new Error("无法打开登录窗口，请检查浏览器弹窗设置");
//     }
//   } catch (error) {
//     console.error("GitHub login error:", error);
//     ElMessage.error("GitHub登录失败，请重试");
//     githubLoading.value = false;
//   }
// };

// QQ登录处理
// const handleQQLogin = async () => {
//   try {
//     qqLoading.value = true;

//     // 请求获取QQ授权URL
//     const result = await axios.post(siteUrl.value + "/qq-auth", {
//       params: {
//         action: "getAuthUrl",
//       },
//     });

//     if (!result.data.success) {
//       throw new Error("QQ登录配置错误");
//     }

//     // 打开授权页面
//     const authWindow = window.open(
//       result.data.auth_url,
//       "qq-auth",
//       "width=600,height=600,scrollbars=yes,resizable=yes"
//     );

//     if (!authWindow) {
//       throw new Error("无法打开登录窗口，请检查浏览器弹窗设置");
//     }
//   } catch (error) {
//     console.error("QQ login error:", error);
//     ElMessage.error("QQ登录失败，请重试");
//     qqLoading.value = false;
//   }
// };

// 处理登录窗口消息 - 统一处理所有第三方登录
// const handleLoginMessage = (event: MessageEvent) => {
//   // 验证消息来源 - 只接受来自可信域名的消息
//   const trustedOrigins = [
//     'https://connect.linux.do', // Linux.do官方域名
//     'https://gitee.com', // Gitee官方域名 (替换QQ域名)
//     'https://github.com', // GitHub官方域名
//     'https://graph.qq.com', // QQ官方域名
//     siteUrl.value, // 添加当前站点域名
//     window.location.origin, // 添加当前页面域名
//   ];

//   if (!trustedOrigins.some(origin => event.origin.startsWith(origin))) {
//     return; // 忽略不可信来源的消息
//   }

//   // 验证消息格式
//   if (!event.data || typeof event.data !== 'object') {
//     return; // 忽略格式不正确的消息
//   }

//   // 验证消息类型
//   if (!['success', 'error'].includes(event.data?.type)) {
//     return; // 忽略非登录相关的消息
//   }

//   // 处理登录结果
//   if (event.data.type === 'success' && event.data.success) {
//     // 保存 JWT
//     localStorage.setItem("TOKEN", event.data.data.token);
//     // 更新store中的用户状态
//     userStore.initUserState();
//     // 显示成功消息
//     ElMessage.success(event.data.message || "登录成功");
//     // 跳转
//     window.location.href = redirectUrl.value;
//   } else if (event.data.type === 'error' || !event.data.success) {
//     // 显示错误消息
//     ElMessage.error(event.data.message || "登录失败，请重试");
//   }

//   // 重置加载状态
//   linuxdoLoading.value = false;
//   giteeLoading.value = false;
//   githubLoading.value = false;  // 新增
//   qqLoading.value = false;  // 添加QQ loading重置
// };

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
  <div class="flex flex-col mt-8 flex-1 items-center bg-white rounded-md p-4 sm:p-10">
    <div class="w-full max-w-sm sm:max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">用户登录</h1>
        <p class="text-gray-600">欢迎使用{{ appTitle }}</p>
      </div>

      <div class="space-y-4 sm:space-y-6">
        <!-- 邮箱登录/注册表单 -->
        <div class="border border-gray-200 rounded-lg p-4">
          <!-- Tab 切换 -->
          <div class="flex border-b border-gray-200 mb-4">
            <button @click="activeTab = 'email-login'" :class="['flex-1 pb-2 text-sm font-medium', activeTab === 'email-login' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">邮箱登录</button>
            <button @click="activeTab = 'email-register'" :class="['flex-1 pb-2 text-sm font-medium', activeTab === 'email-register' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">注册</button>
            <button @click="activeTab = 'email-reset'" :class="['flex-1 pb-2 text-sm font-medium', activeTab === 'email-reset' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">找回密码</button>
          </div>

          <!-- 邮箱登录 -->
          <div v-if="activeTab === 'email-login'">
            <!-- 登录方式子Tab -->
            <div class="flex gap-2 mb-3">
              <button @click="loginMethod = 'password'" :class="['flex-1 py-1.5 text-sm rounded', loginMethod === 'password' ? 'bg-blue-50 text-blue-600 font-medium' : 'bg-gray-100 text-gray-600']">密码登录</button>
              <button @click="loginMethod = 'code'" :class="['flex-1 py-1.5 text-sm rounded', loginMethod === 'code' ? 'bg-blue-50 text-blue-600 font-medium' : 'bg-gray-100 text-gray-600']">验证码登录</button>
            </div>

            <!-- 密码登录 -->
            <div v-if="loginMethod === 'password'" class="space-y-3">
              <el-input v-model="emailForm.email" placeholder="请输入邮箱" />
              <el-input v-model="emailForm.password" type="password" placeholder="请输入密码" show-password />
              <el-button type="primary" class="w-full" @click="handleEmailPasswordLogin" :loading="loading">登录</el-button>
            </div>

            <!-- 验证码登录 -->
            <div v-if="loginMethod === 'code'" class="space-y-3">
              <el-input v-model="emailForm.email" placeholder="请输入邮箱" />
              <div class="flex gap-2">
                <el-input v-model="emailForm.code" placeholder="验证码" class="flex-1" />
                <el-button @click="sendVerificationCode" :loading="sendingCode" :disabled="countdown > 0">
                  {{ countdown > 0 ? `${countdown}秒` : '发送验证码' }}
                </el-button>
              </div>
              <el-button type="primary" class="w-full" @click="handleEmailCodeLogin" :loading="loading">登录</el-button>
            </div>
          </div>

          <!-- 邮箱注册 -->
          <div v-if="activeTab === 'email-register'" class="space-y-3">
            <el-input v-model="emailForm.email" placeholder="请输入邮箱" />
            <el-input v-model="emailForm.username" placeholder="用户名" maxlength="20" />
            <el-input v-model="emailForm.password" type="password" placeholder="密码（至少6位）" show-password />
            <div class="flex gap-2">
              <el-input v-model="emailForm.code" placeholder="验证码" class="flex-1" />
              <el-button @click="sendVerificationCode" :loading="sendingCode" :disabled="countdown > 0">
                {{ countdown > 0 ? `${countdown}秒` : '发送验证码' }}
              </el-button>
            </div>
            <el-button type="primary" class="w-full" @click="handleEmailRegister" :loading="loading">注册</el-button>
          </div>

          <!-- 找回密码 -->
          <div v-if="activeTab === 'email-reset'" class="space-y-3">
            <el-input v-model="emailForm.email" placeholder="请输入邮箱" />
            <div class="flex gap-2">
              <el-input v-model="emailForm.code" placeholder="验证码" class="flex-1" />
              <el-button @click="sendVerificationCode" :loading="sendingCode" :disabled="countdown > 0">
                {{ countdown > 0 ? `${countdown}秒` : '发送验证码' }}
              </el-button>
            </div>
            <el-input v-model="emailForm.newPassword" type="password" placeholder="新密码（至少6位）" show-password />
            <el-button type="primary" class="w-full" @click="handleResetPassword" :loading="loading">重置密码</el-button>
          </div>
        </div>

        <!-- 分割线 -->
        <div class="flex items-center">
          <div class="flex-1 border-t border-gray-300"></div>
          <span class="px-3 text-sm text-gray-500">或</span>
          <div class="flex-1 border-t border-gray-300"></div>
        </div>

        <!-- 自定义谷歌登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleCustomGoogleLogin"
            :disabled="loading"
            class="flex items-center justify-center w-full h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4"
          >
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google"
              class="h-5 w-auto mr-3 flex-shrink-0"
            />
            <span
              v-if="!loading"
              class="text-sm font-medium text-gray-600 truncate"
            >
              使用 Google 登录
            </span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- 隐藏的Google SDK按钮 -->
        <div style="display: none;">
          <div id="google-signin-button"></div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="text-center">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="ml-2 text-gray-600">登录中...</span>
        </div>

        <!-- 登录说明 -->
        <div class="text-center text-gray-500 text-xs sm:text-sm px-2">
          <p>支持邮箱验证码登录 / 谷歌账号登录</p>
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
/* 移除所有复杂的Google按钮样式，因为现在使用自定义按钮 */
</style>

