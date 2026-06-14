<template>
  <div>
    <!-- 主题输入 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">视频主题</label>
      <div class="flex gap-2">
        <textarea
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          placeholder="例如：一只可爱的猫咪在草地上玩耍"
          rows="3"
          class="flex-1 px-3 py-2 border rounded-lg text-sm"
          :disabled="disabled"
        />
        <button
          @click="$emit('random')"
          :disabled="disabled"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm whitespace-nowrap disabled:bg-gray-50 disabled:cursor-not-allowed"
          title="随机示例"
        >
          🎲 随机
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        描述主体、动作、场景、镜头运动、光照和视觉风格，生成效果更佳
      </p>
    </div>

    <!-- 时长选择 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">视频时长</label>
      <select
        :value="duration"
        @input="$emit('update:duration', Number(($event.target as HTMLSelectElement).value))"
        class="px-3 py-2 border rounded-lg text-sm"
        :disabled="disabled"
      >
        <option v-for="opt in durationOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- 提示词生成开关 -->
    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="autoOptimize"
          @input="$emit('update:autoOptimize', ($event.target as HTMLInputElement).checked)"
          :disabled="disabled"
          class="w-4 h-4"
        />
        <span class="text-sm font-medium">自动优化提示词</span>
      </label>
      <p class="text-xs text-gray-500 mt-1 ml-6">
        开启后将使用AI优化您的主题描述，生成更专业的视频提示词
      </p>
    </div>

    <!-- 宽高比选择 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">视频比例</label>
      <select
        :value="aspectRatio"
        @input="$emit('update:aspectRatio', ($event.target as HTMLSelectElement).value)"
        class="px-3 py-2 border rounded-lg text-sm"
        :disabled="disabled"
      >
        <option v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- 生成按钮 -->
    <button
      @click="$emit('generate')"
      :disabled="disabled"
      class="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
    >
      {{ disabled ? '生成中...' : '生成视频' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { durationOptions, aspectRatioOptions } from './prompts'

interface Props {
  modelValue: string
  duration: number
  aspectRatio: string
  autoOptimize: boolean
  disabled: boolean
}

defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: string]
  'update:duration': [value: number]
  'update:aspectRatio': [value: string]
  'update:autoOptimize': [value: boolean]
  'random': []
  'generate': []
}>()
</script>
