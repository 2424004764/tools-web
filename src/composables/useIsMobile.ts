// 响应式断点检测
// 单一职责：返回是否处于移动端宽度（< 640px），并随窗口 resize 自动更新。
// 组件 unmount 时自动清理监听器，无内存泄漏。
//
// 默认断点 640px 与项目内 AdminLayout 侧栏的 md 断点（992px）保持层级一致：
//  < 640 = 纯手机屏
//  640 ~ 991 = 平板 / 小屏 PC（侧栏仍折叠抽屉）
//  ≥ 992 = 桌面（侧栏常驻）
//
// 后台管理页通常断在 640；如有其他场景需要不同阈值，传入数字即可。
import { onMounted, onUnmounted, ref } from 'vue'

export function useIsMobile(breakpoint = 640) {
  const isMobile = ref(false)

  const update = () => {
    if (typeof window === 'undefined') return
    isMobile.value = window.innerWidth < breakpoint
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return { isMobile }
}