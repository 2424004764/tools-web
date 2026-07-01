<template>
  <div>
    <!-- 参考图片上传 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">参考图片</label>
      <div v-if="!sourceImage" class="border-2 border-dashed rounded-lg p-6 text-center">
        <input
          type="file"
          accept="image/jpeg,image/png"
          @change="$emit('upload', $event)"
          :disabled="disabled || isUploading"
          class="hidden"
          id="imageToImageUpload"
        />
        <label
          for="imageToImageUpload"
          :class="['cursor-pointer text-sm text-gray-600',
            (disabled || isUploading) && 'opacity-50 cursor-not-allowed']"
        >
          <div class="text-4xl mb-2">📷</div>
          <div>{{ isUploading ? '上传中...' : '点击上传参考图片' }}</div>
          <div class="text-xs text-gray-400 mt-1">支持 JPG、PNG 格式</div>
        </label>
      </div>
      <div v-else class="relative">
        <img :src="sourceImage" class="w-full max-h-48 object-contain rounded-lg shadow" />
        <button
          @click="$emit('remove')"
          :disabled="disabled"
          class="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs disabled:bg-gray-300"
        >
          删除
        </button>
      </div>
    </div>

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

    <!-- 修改描述 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">修改描述</label>
      <textarea
        id="image-to-image-prompt-input"
        :value="prompt"
        @input="$emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
        placeholder="例如：将天空改成日落，添加彩虹..."
        rows="3"
        class="w-full px-3 py-2 border rounded-lg text-sm"
        :disabled="disabled"
      />
      <p class="text-xs text-gray-500 mt-1">
        描述想要修改或添加的内容
      </p>
    </div>

    <!-- 生成强度 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">
        生成强度: {{ strength.toFixed(1) }}
      </label>
      <input
        type="range"
        :value="strength"
        @input="$emit('update:strength', Number(($event.target as HTMLInputElement).value))"
        min="0"
        max="1"
        step="0.1"
        class="w-full"
        :disabled="disabled"
      />
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>保留原图 0</span>
        <span>完全重绘 1.0</span>
      </div>
    </div>

    <!-- 图片比例 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">图片比例</label>
      <select
        id="image-to-image-aspect-ratio-select"
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
      :disabled="disabled || isUploading"
      class="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
    >
      {{ disabled ? '生成中...' : isUploading ? '上传中...' : '生成图片' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { aspectRatioOptions } from './prompts'

interface Props {
  sourceImage: string
  model: string
  prompt: string
  strength: number
  aspectRatio: string
  count: number
  disabled: boolean
  isUploading: boolean
}

defineProps<Props>()

defineEmits<{
  'upload': [event: Event]
  'remove': []
  'update:model': [value: string]
  'update:prompt': [value: string]
  'update:strength': [value: number]
  'update:aspectRatio': [value: string]
  'update:count': [value: number]
  'generate': []
}>()
</script>
