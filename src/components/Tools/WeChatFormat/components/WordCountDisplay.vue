<template>
  <div class="word-count-display">
    <span class="stat-item">{{ stats.characters }} 字符</span>
    <span class="stat-separator">|</span>
    <span class="stat-item">{{ stats.words }} 词</span>
    <span class="stat-separator">|</span>
    <span class="stat-item">{{ stats.paragraphs }} 段落</span>
    <span class="stat-separator">|</span>
    <el-tooltip :content="`预估阅读时间：${formatReadingTime(stats.readingTime)}`" placement="top">
      <span class="stat-item reading-time">📖 {{ formatReadingTime(stats.readingTime) }}</span>
    </el-tooltip>
    <span v-if="draftTitle" class="stat-separator">|</span>
    <span v-if="draftTitle" class="stat-item draft-title">{{ draftTitle }}</span>
    <span v-if="saveTipVisible" class="save-tip">草稿已保存到本地</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWordCount } from '../composables/useWordCount'

interface Props {
  content: string
  draftTitle?: string
  saveTipVisible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  draftTitle: '',
  saveTipVisible: false,
})

const contentRef = computed(() => props.content)
const { stats, formatReadingTime } = useWordCount(contentRef)
</script>

<style scoped>
.word-count-display {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.stat-item {
  white-space: nowrap;
}

.stat-separator {
  color: #e5e7eb;
}

.reading-time {
  color: #3b82f6;
  cursor: help;
}

.draft-title {
  color: #10b981;
}

.save-tip {
  color: #10b981;
  margin-left: auto;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
