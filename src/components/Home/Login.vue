<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive, type Ref } from "vue";
import { ElMessage } from "element-plus";
import Loading from '~icons/ep/loading'
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
const githubLoading = ref(false);
const linuxdoLoading = ref(false);
const qqLoading = ref(false);
const giteeLoading = ref(false);
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
// 仅允许站内相对路径：以 / 开头且不以 // 或 /\ 开头（反斜杠会被浏览器归一化为 /，绕过 // 检查）
const redirectUrl = computed(() => {
  const params = new URLSearchParams(window.location.search)
  const target = params.get('redirect')
  if (target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) {
    return target
  }
  return '/userinfo'
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

  // 监听GitHub弹窗回传的登录结果
  window.addEventListener("message", handleLoginMessage);
});

onUnmounted(() => {
  window.removeEventListener("message", handleLoginMessage);
  stopAllPopupPolls();
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

// ---------- 第三方 OAuth 弹窗登录（GitHub / LinuxDo / QQ / Gitee） ----------
// 统一流程：先同步开窗防弹窗拦截 → POST 对应端点拿授权地址 → 弹窗跳转授权 →
// 回调页（/api/xxx-auth）postMessage 回传结果，由 handleLoginMessage 统一处理。
// 弹窗在回传前被用户关闭时（授权失败停在错误页、回调地址未在平台后台登记导致
// 弹窗无法跳回等），轮询 popup.closed 复位按钮，避免"登录中..."永久卡住
const oauthLabels = { github: "GitHub", linuxdo: "LinuxDo", qq: "QQ", gitee: "Gitee" } as const;
type OAuthProvider = keyof typeof oauthLabels;

const popupTimers: Partial<Record<OAuthProvider, number>> = {};
const stopPopupPoll = (name: OAuthProvider) => {
  if (popupTimers[name] !== undefined) {
    window.clearInterval(popupTimers[name]);
    delete popupTimers[name];
  }
};
const stopAllPopupPolls = () => (Object.keys(popupTimers) as OAuthProvider[]).forEach(stopPopupPoll);

const openOAuthLogin = async (name: OAuthProvider, loading: Ref<boolean>) => {
  if (loading.value) return;
  loading.value = true;

  // 先同步开窗避免被弹窗拦截，拿到授权地址后再跳转
  const popup = window.open("about:blank", `${name}-auth`, "width=600,height=600,scrollbars=yes,resizable=yes");
  if (!popup) {
    loading.value = false;
    ElMessage.error("无法打开登录窗口，请检查浏览器弹窗设置");
    return;
  }

  stopPopupPoll(name);
  popupTimers[name] = window.setInterval(() => {
    if (popup.closed) {
      stopPopupPoll(name);
      loading.value = false;
    }
  }, 500);

  try {
    const result = await axios.post(`/${name}-auth`);
    if (!result.data.success || !result.data.auth_url) {
      throw new Error(result.data.error || "获取授权链接失败");
    }
    popup.location.href = result.data.auth_url;
  } catch (error: any) {
    stopPopupPoll(name);
    popup.close();
    loading.value = false;
    ElMessage.error(error.response?.data?.error || error.message || `${oauthLabels[name]}登录失败，请重试`);
  }
};

// 回调页通过postMessage回传的登录结果
const handleLoginMessage = (event: MessageEvent) => {
  // 回调页由本站 /api/*-auth 端点提供，只接受同源消息
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || typeof data !== "object" || !["success", "error"].includes(data.type)) return;

  githubLoading.value = false;
  linuxdoLoading.value = false;
  qqLoading.value = false;
  giteeLoading.value = false;
  stopAllPopupPolls();
  if (data.type === "success" && data.success) {
    localStorage.setItem("TOKEN", data.data.token);
    userStore.initUserState();
    ElMessage.success(data.message || "登录成功");
    window.location.href = redirectUrl.value;
  } else {
    ElMessage.error(data.message || "登录失败，请重试");
  }
};

const handleGithubLogin = () => openOAuthLogin("github", githubLoading);
const handleLinuxdoLogin = () => openOAuthLogin("linuxdo", linuxdoLoading);
const handleQqLogin = () => openOAuthLogin("qq", qqLoading);
const handleGiteeLogin = () => openOAuthLogin("gitee", giteeLoading);

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
      ElMessage.success(result.data.isNewUser ? `注册成功，欢迎 ${result.data.username}！` : `欢迎回来，${result.data.username}！`)
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
        <h1 class="text-h2 sm:text-h1 font-bold text-gray-800 mb-2">用户登录</h1>
        <p class="text-gray-600">欢迎使用{{ appTitle }}</p>
      </div>

      <div class="space-y-4 sm:space-y-6">
        <!-- 邮箱登录/注册表单 -->
        <div class="border border-gray-200 rounded-lg p-4">
          <!-- Tab 切换 -->
          <div class="flex border-b border-gray-200 mb-4">
            <button @click="activeTab = 'email-login'" :class="['flex-1 pb-2 text-body-sm font-medium', activeTab === 'email-login' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">邮箱登录</button>
            <button @click="activeTab = 'email-register'" :class="['flex-1 pb-2 text-body-sm font-medium', activeTab === 'email-register' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">注册</button>
            <button @click="activeTab = 'email-reset'" :class="['flex-1 pb-2 text-body-sm font-medium', activeTab === 'email-reset' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500']">找回密码</button>
          </div>

          <!-- 邮箱登录 -->
          <div v-if="activeTab === 'email-login'">
            <!-- 登录方式子Tab -->
            <div class="flex gap-2 mb-3">
              <button @click="loginMethod = 'password'" :class="['flex-1 py-1.5 text-body-sm rounded', loginMethod === 'password' ? 'bg-blue-50 text-blue-600 font-medium' : 'bg-gray-100 text-gray-600']">密码登录</button>
              <button @click="loginMethod = 'code'" :class="['flex-1 py-1.5 text-body-sm rounded', loginMethod === 'code' ? 'bg-blue-50 text-blue-600 font-medium' : 'bg-gray-100 text-gray-600']">验证码登录</button>
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
              <p class="text-caption text-gray-400 text-center">未注册的邮箱验证通过后将自动注册</p>
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
          <span class="px-3 text-body-sm text-gray-500">或</span>
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
              class="text-body-sm font-medium text-gray-600 truncate"
            >
              使用 Google 登录
            </span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-body-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- GitHub登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleGithubLogin"
            :disabled="githubLoading"
            class="flex items-center justify-center w-full h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="h-5 w-5 mr-3 flex-shrink-0 text-gray-800">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
            <span v-if="!githubLoading" class="text-body-sm font-medium text-gray-600 truncate">使用 GitHub 登录</span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-body-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- LinuxDo登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleLinuxdoLogin"
            :disabled="linuxdoLoading"
            class="flex items-center justify-center w-full h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4"
          >
            <img
              src="/linuxdo-logo.png"
              alt="LinuxDo"
              class="h-5 w-5 mr-3 flex-shrink-0"
            />
            <span v-if="!linuxdoLoading" class="text-body-sm font-medium text-gray-600 truncate">使用 LinuxDo 登录</span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-body-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- QQ登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleQqLogin"
            :disabled="qqLoading"
            class="flex items-center justify-center w-full h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4"
          >
            <img
              src="/qq-logo.png"
              alt="QQ"
              class="h-5 w-5 mr-3 flex-shrink-0"
            />
            <span v-if="!qqLoading" class="text-body-sm font-medium text-gray-600 truncate">使用 QQ 登录</span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-body-sm text-gray-600">登录中...</span>
            </div>
          </button>
        </div>

        <!-- Gitee登录按钮 -->
        <div class="flex justify-center">
          <button
            @click="handleGiteeLogin"
            :disabled="giteeLoading"
            class="flex items-center justify-center w-full h-[40px] border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-4"
          >
            <img
              src="/gitee-logo.png"
              alt="Gitee"
              class="h-5 w-5 mr-3 flex-shrink-0"
            />
            <span v-if="!giteeLoading" class="text-body-sm font-medium text-gray-600 truncate">使用 Gitee 登录</span>
            <div v-else class="flex items-center">
              <el-icon class="is-loading mr-2"><Loading /></el-icon>
              <span class="text-body-sm text-gray-600">登录中...</span>
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
        <div class="text-center text-gray-500 text-caption sm:text-body-sm px-2">
          <p>支持邮箱验证码登录（未注册将自动注册）及 Google / GitHub / LinuxDo / QQ / Gitee 第三方登录</p>
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

