// 全屏预览（el-image-viewer）的状态与关闭接管。
// 自注册全局 keydown / mousedown / MutationObserver（onMounted/onUnmounted 内），
// 组件只需在模板里绑定返回的 previewList / previewIndex / previewOpen。
import { ref, nextTick, onMounted, onUnmounted } from 'vue'

export function useViewer() {
  const previewList = ref<string[]>([])
  const previewIndex = ref(0)
  const previewOpen = ref(false)

  // 全屏预览（统一接管：历史缩略图 + 上传区点击缩略图 + 生成结果图）
  // 用 urlList + activeIndex 取代原来的 previewUrl，单图预览也包成单元素数组
  const openPreview = (url: string, list?: string[], index?: number) => {
    if (list && list.length > 0) {
      previewList.value = list
      previewIndex.value = typeof index === 'number' && index >= 0 && index < list.length
        ? index
        : list.indexOf(url)
      if (previewIndex.value < 0) previewIndex.value = 0
    } else {
      previewList.value = [url]
      previewIndex.value = 0
    }
    previewOpen.value = true
  }

  const closePreview = () => {
    previewOpen.value = false
    // EP 的 image-viewer 只在自己的 hide() 里恢复 body 滚动锁（overflow: hidden），
    // 而移动端「点图片/遮罩关闭」走的是 capture mousedown 兜底 → v-if 直接卸载，
    // hide() 不会执行 → 锁泄漏后整页无法滑动。这里统一兜底恢复。
    nextTick(restoreBodyScrollLock)
  }

  // 恢复 body 滚动锁。viewer 或其他 EP 弹层（dialog/drawer 的 .el-overlay）仍在展示时
  // 不动——锁归它们管，由各自的生命周期负责恢复
  const restoreBodyScrollLock = () => {
    if (document.body.style.overflow !== 'hidden') return
    if (document.querySelector('.el-image-viewer__wrapper')) return
    const overlays = document.querySelectorAll<HTMLElement>('.el-overlay')
    for (const el of overlays) {
      if (el.style.display !== 'none') return
    }
    document.body.style.overflow = ''
  }

  // 全局 ESC 键关闭全屏预览
  const onGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && previewOpen.value) {
      closePreview()
    }
  }

  // ============ 强制接管 viewer 关闭 ============
  // 痛点：EP 默认的 hide-on-click-modal 在触屏 + 移动浏览器 + 部分事件穿透场景下不响应。
  // 解决：viewer wrapper 一旦挂载（teleported 到 body），立刻在它上面挂 capture 阶段的
  // mousedown 监听，点 wrapper 本身 / mask / 图片都能直接关闭；只有底部操作栏不关。
  // 用 MutationObserver 自动跟随 wrapper 的挂载与卸载（v-if 控制的 viewer 反复进出）。
  const viewerWrapperObserver = new MutationObserver(() => {
    attachViewerCloseHandlers()
  })

  // 哪些区域是「点击不关闭」（viewer 内部的工具栏 / 关闭按钮本身 / 切换按钮）
  const VIEWER_KEEP_OPEN_SELECTOR = [
    '.el-image-viewer__actions',     // 底部操作栏（缩放/旋转/重置/左/右）
    '.el-image-viewer__close',     // 关闭按钮（按它自己会触发 EP close，不重复处理）
    '.el-image-viewer__arrow',     // 左右切换按钮
    '.el-image-viewer__prev',
    '.el-image-viewer__next',
  ].join(',')

  // 当前已绑定的 wrapper 元素，用于解绑时去重
  let attachedViewerWrapper: HTMLElement | null = null
  const viewerMousedownHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    // 点在操作栏内 → 不关
    if (target.closest(VIEWER_KEEP_OPEN_SELECTOR)) return
    // 其余全部视为关闭信号（遮罩、图片本体、wrapper 空白区）
    e.stopPropagation()
    e.preventDefault()
    closePreview()
  }

  const attachViewerCloseHandlers = () => {
    // viewer 通过 teleport 渲染到 body 下，与组件 DOM 树解耦
    const wrapper = document.querySelector<HTMLElement>('.el-image-viewer__wrapper')
    if (!wrapper) return
    if (wrapper === attachedViewerWrapper) return
    // 先解绑旧 wrapper（如果存在）
    if (attachedViewerWrapper) {
      attachedViewerWrapper.removeEventListener('mousedown', viewerMousedownHandler, true)
    }
    // 在 capture 阶段抢先触发，确保比 EP 自带 handler 更早执行
    wrapper.addEventListener('mousedown', viewerMousedownHandler, true)
    attachedViewerWrapper = wrapper
  }

  const detachViewerCloseHandlers = () => {
    if (attachedViewerWrapper) {
      attachedViewerWrapper.removeEventListener('mousedown', viewerMousedownHandler, true)
      attachedViewerWrapper = null
    }
  }

  // 旧的兜底（保留给非 viewer 的边缘情况，但实际场景下 viewer 已经全覆盖）
  const onGlobalClickOutside = (e: MouseEvent) => {
    if (!previewOpen.value) return
    const target = e.target as HTMLElement | null
    if (!target) return
    // 黑名单：viewer 自身 / 缩略图 / el-image wrapper（已被 viewer 内部监听器接管）
    if (target.closest('.el-image-viewer__wrapper')) return
    if (target.closest('.upload-thumb')) return
    if (target.closest('.el-image')) return
    closePreview()
  }

  onMounted(() => {
    // 全局 ESC 兜底关闭预览（el-image / el-image-viewer 默认就支持，
    // 但移动端触屏或某些嵌套场景下不一定触发，这里强制接管）
    window.addEventListener('keydown', onGlobalKeydown)
    // 全局点击外部兜底关闭预览：移动端/嵌套 el-upload-dragger 时 EP 自带遮罩关闭
    // 偶尔不响应，这里用 mousedown 抢先一步（click 会晚一拍，避免和触发预览的 click 抢同一拍）
    window.addEventListener('mousedown', onGlobalClickOutside, true)
    // 监听 body 子树变化：viewer 通过 teleport 渲染到 body，需要观察其挂载时机
    viewerWrapperObserver.observe(document.body, { childList: true, subtree: true })
    // 首次扫描（可能在 mount 时 viewer 已渲染）
    attachViewerCloseHandlers()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown)
    window.removeEventListener('mousedown', onGlobalClickOutside, true)
    viewerWrapperObserver.disconnect()
    detachViewerCloseHandlers()
  })

  return {
    previewList,
    previewIndex,
    previewOpen,
    openPreview,
    closePreview,
    restoreBodyScrollLock,
  }
}