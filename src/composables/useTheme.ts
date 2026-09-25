// 暗色主题切换：class 策略（html.dark），偏好持久化在 localStorage
// tailwind.config.js 已配置 darkMode: 'class'，css 变量覆盖见 src/styles/tailwind.css 的 html.dark 块
import { ref } from 'vue'

const THEME_KEY = 'tools_theme'

const isDark = ref(false)

function applyTheme(dark: boolean) {
  isDark.value = dark
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  } catch {
    // localStorage 不可用（隐私模式等）时静默忽略
  }
}

/** 应用启动时调用：恢复上次的主题偏好 */
export function initTheme() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(THEME_KEY)
  } catch {
    // 静默
  }
  applyTheme(saved === 'dark')
}

/** 布局组件里用：读当前状态 + 切换 */
export function useTheme() {
  const toggleTheme = () => applyTheme(!isDark.value)
  return { isDark, toggleTheme }
}
