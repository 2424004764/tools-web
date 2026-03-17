/**
 * 快捷键支持
 */
import { onMounted, onUnmounted } from 'vue'

export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  callback: (e: KeyboardEvent) => void
  description: string
}

export function useShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = (e: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault()
        shortcut.callback(e)
        return
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    shortcuts,
  }
}

/**
 * 预定义的快捷键列表
 */
export const DEFAULT_SHORTCUTS = {
  SAVE: { key: 's', ctrl: true, description: '保存草稿' },
  UNDO: { key: 'z', ctrl: true, description: '撤销' },
  REDO: { key: 'y', ctrl: true, description: '重做' },
  REDO_ALT: { key: 'z', ctrl: true, shift: true, description: '重做' },
  BOLD: { key: 'b', ctrl: true, description: '粗体' },
  ITALIC: { key: 'i', ctrl: true, description: '斜体' },
  LINK: { key: 'k', ctrl: true, description: '插入链接' },
  FULLSCREEN: { key: 'f11', description: '全屏模式' },
  ESC: { key: 'escape', description: '退出全屏' },
}
