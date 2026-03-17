/**
 * 编辑器历史记录（撤销/重做）
 */
import { ref, Ref } from 'vue'

export interface HistoryState {
  content: string
  cursorPosition?: number
}

export interface UseEditorHistoryOptions {
  maxSize?: number
}

export function useEditorHistory(content: Ref<string>, options: UseEditorHistoryOptions = {}) {
  const { maxSize = 50 } = options

  const undoStack = ref<HistoryState[]>([])
  const redoStack = ref<HistoryState[]>([])
  const lastSavedContent = ref('')

  // 保存当前状态到历史栈
  const pushState = (cursorPosition?: number) => {
    const currentContent = content.value

    // 如果内容没有变化，不保存
    if (currentContent === lastSavedContent.value) {
      return
    }

    // 保存当前状态到撤销栈
    undoStack.value.push({
      content: lastSavedContent.value,
      cursorPosition,
    })

    // 限制栈大小
    if (undoStack.value.length > maxSize) {
      undoStack.value.shift()
    }

    // 清空重做栈（新操作后不能重做）
    redoStack.value = []

    // 更新最后保存的内容
    lastSavedContent.value = currentContent
  }

  // 撤销
  const undo = (): boolean => {
    if (undoStack.value.length === 0) {
      return false
    }

    // 保存当前状态到重做栈
    redoStack.value.push({
      content: content.value,
    })

    // 恢复上一个状态
    const state = undoStack.value.pop()!
    content.value = state.content
    lastSavedContent.value = state.content

    return true
  }

  // 重做
  const redo = (): boolean => {
    if (redoStack.value.length === 0) {
      return false
    }

    // 保存当前状态到撤销栈
    undoStack.value.push({
      content: content.value,
    })

    // 恢复重做栈中的状态
    const state = redoStack.value.pop()!
    content.value = state.content
    lastSavedContent.value = state.content

    return true
  }

  // 清空历史记录
  const clear = () => {
    undoStack.value = []
    redoStack.value = []
    lastSavedContent.value = content.value
  }

  // 初始化
  lastSavedContent.value = content.value

  return {
    undoStack,
    redoStack,
    canUndo: () => undoStack.value.length > 0,
    canRedo: () => redoStack.value.length > 0,
    undo,
    redo,
    pushState,
    clear,
  }
}
