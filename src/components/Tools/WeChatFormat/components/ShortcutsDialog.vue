<template>
  <el-dialog
    v-model="visible"
    title="快捷键"
    width="500px"
    :close-on-click-modal="false"
  >
    <div class="shortcuts-list">
      <div
        v-for="(group, index) in shortcutGroups"
        :key="index"
        class="shortcut-group"
      >
        <div class="group-title">{{ group.title }}</div>
        <div
          v-for="item in group.items"
          :key="item.keys.join('-')"
          class="shortcut-item"
        >
          <span class="shortcut-desc">{{ item.description }}</span>
          <div class="shortcut-keys">
            <kbd
              v-for="key in item.keys"
              :key="key"
              class="kbd"
            >{{ key }}</kbd>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)

const shortcutGroups = [
  {
    title: '文件操作',
    items: [
      { keys: ['Ctrl', 'S'], description: '保存草稿' },
      { keys: ['Ctrl', 'P'], description: '导出 PDF' },
    ],
  },
  {
    title: '编辑操作',
    items: [
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Y'], description: '重做' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: '重做' },
    ],
  },
  {
    title: '文本格式',
    items: [
      { keys: ['Ctrl', 'B'], description: '粗体' },
      { keys: ['Ctrl', 'I'], description: '斜体' },
      { keys: ['Ctrl', 'K'], description: '插入链接' },
    ],
  },
  {
    title: '视图',
    items: [
      { keys: ['F11'], description: '全屏模式' },
      { keys: ['Esc'], description: '退出全屏' },
      { keys: ['Ctrl', '/'], description: '显示快捷键' },
    ],
  },
]

const open = () => {
  visible.value = true
}

defineExpose({
  open,
})
</script>

<style scoped>
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.shortcut-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  padding-bottom: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.shortcut-desc {
  font-size: 13px;
  color: #6b7280;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kbd {
  display: inline-block;
  padding: 3px 8px;
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}
</style>
