<template>
  <el-select
    :model-value="modelValue"
    placeholder="选择主题"
    @change="handleChange"
    class="theme-selector"
    :style="{ width: width || '140px' }"
  >
    <el-option
      v-for="theme in themes"
      :key="theme.id"
      :label="theme.name"
      :value="theme.id"
    >
      <div class="theme-option">
        <div
          class="theme-preview-color"
          :style="{ background: theme.previewColor }"
        ></div>
        <div class="theme-info">
          <span class="theme-name">{{ theme.name }}</span>
          <span class="theme-desc">{{ theme.description }}</span>
        </div>
      </div>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { themes } from '../themes'

interface Props {
  modelValue: string
  width?: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const handleChange = (value: string) => {
  emit('update:modelValue', value)
}
</script>

<style>
/* 增加下拉选项高度 */
.el-select-dropdown__item {
  padding: 10px 12px !important;
  min-height: 56px !important;
  height: auto !important;
  line-height: normal !important;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-preview-color {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.theme-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.theme-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.theme-desc {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
