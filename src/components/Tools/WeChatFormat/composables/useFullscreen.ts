/**
 * 全屏模式支持
 */
import { ref, onMounted, onUnmounted } from 'vue'

export function useFullscreen() {
  const isFullscreen = ref(false)
  const targetElement = ref<HTMLElement | null>(null)

  // 进入全屏
  const enter = (element?: HTMLElement) => {
    const target = element || targetElement.value
    if (!target) return

    if (target.requestFullscreen) {
      target.requestFullscreen()
    } else if ((target as any).webkitRequestFullscreen) {
      (target as any).webkitRequestFullscreen()
    } else if ((target as any).mozRequestFullScreen) {
      (target as any).mozRequestFullScreen()
    } else if ((target as any).msRequestFullscreen) {
      (target as any).msRequestFullscreen()
    }
  }

  // 退出全屏
  const exit = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
  }

  // 切换全屏
  const toggle = (element?: HTMLElement) => {
    if (isFullscreen.value) {
      exit()
    } else {
      enter(element)
    }
  }

  const handleFullscreenChange = () => {
    isFullscreen.value = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('msfullscreenchange', handleFullscreenChange)
  })

  return {
    isFullscreen,
    targetElement,
    enter,
    exit,
    toggle,
  }
}
