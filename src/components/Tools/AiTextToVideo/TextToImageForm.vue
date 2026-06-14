<template>
  <div>
    <!-- 模型选择 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">图像模型</label>
      <select
        :value="model"
        @input="$emit('update:model', ($event.target as HTMLSelectElement).value)"
        class="px-3 py-2 border rounded-lg text-sm"
        :disabled="disabled"
      >
        <option value="agnes-image-2.1-flash">Agnes Image 2.1 Flash (快速)</option>
        <option value="agnes-image-2.0">Agnes Image 2.0</option>
      </select>
    </div>

    <!-- 图片描述 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">图片描述</label>
      <div class="flex gap-2">
        <textarea
          :value="prompt"
          @input="$emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
          placeholder="例如：一位穿着白裙的少女站在薰衣草花田中..."
          rows="4"
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
        描述主体、场景、光照、风格等细节，越详细效果越好
      </p>
    </div>

    <!-- 图片比例 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">图片比例</label>
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

    <!-- 生成数量 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">生成数量</label>
      <select
        :value="count"
        @input="$emit('update:count', Number(($event.target as HTMLSelectElement).value))"
        class="px-3 py-2 border rounded-lg text-sm"
        :disabled="disabled"
      >
        <option :value="1">1张</option>
        <option :value="2">2张</option>
        <option :value="3">3张</option>
        <option :value="4">4张</option>
      </select>
    </div>

    <!-- 生成按钮 -->
    <button
      @click="$emit('generate')"
      :disabled="disabled"
      class="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
    >
      {{ disabled ? '生成中...' : '生成图片' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { aspectRatioOptions } from './prompts'

interface Props {
  model: string
  prompt: string
  aspectRatio: string
  count: number
  disabled: boolean
}

defineProps<Props>()

defineEmits<{
  'update:model': [value: string]
  'update:prompt': [value: string]
  'update:aspectRatio': [value: string]
  'update:count': [value: number]
  'random': []
  'generate': []
}>()
</script>
