<template>
  <div>
    <!-- 图片模式选择 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">图片模式</label>
      <div class="flex gap-2">
        <button
          @click="$emit('update:imageMode', 'single')"
          :class="['flex-1 py-2 px-4 rounded-lg border transition-colors',
            imageMode === 'single'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500']"
        >
          单图模式
        </button>
        <button
          @click="$emit('update:imageMode', 'double')"
          :class="['flex-1 py-2 px-4 rounded-lg border transition-colors',
            imageMode === 'double'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500']"
        >
          双图模式
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        {{ imageMode === 'single' ? '单图：生成基于一张图片的视频' : '双图：生成两张图片间的过渡视频' }}
      </p>
    </div>

    <!-- 已上传图片 -->
    <div v-if="uploadedImages.length > 0" class="mb-4">
      <label class="block text-sm font-medium mb-2">已上传图片</label>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="(img, index) in uploadedImages" :key="index" class="relative group">
          <img :src="img" class="w-full rounded-lg shadow" />
          <button
            @click="$emit('remove-image', index)"
            :disabled="disabled"
            class="absolute top-1 right-1 px-2 py-1 bg-red-500 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:bg-gray-300"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 上传按钮 -->
    <div v-if="uploadedImages.length < maxImages" class="mb-4">
      <input
        type="file"
        accept="image/*"
        @change="$emit('upload', $event)"
        :disabled="disabled || isUploading"
        class="hidden"
        :id="`imageUpload_${Date.now()}`"
      />
      <label
        :for="`imageUpload_${Date.now()}`"
        :class="['block w-full py-3 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed']"
      >
        <div class="text-2xl mb-1">📷</div>
        <div class="text-sm text-gray-600">
          {{ isUploading ? '上传中...' : `上传图片 (${uploadedImages.length}/${maxImages})` }}
        </div>
      </label>
    </div>

    <!-- 预设图片 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">或选择预设图片</label>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="preset in presetImages"
          :key="preset.url"
          @click="$emit('add-preset', preset.url)"
          class="relative group cursor-pointer"
        >
          <img :src="preset.url" class="w-full rounded-lg shadow hover:opacity-80 transition-opacity" />
          <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center py-1 rounded-b-lg">
            {{ preset.name }}
          </div>
        </div>
      </div>
    </div>

    <!-- 视频描述 -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">视频描述</label>
      <div class="flex gap-2">
        <textarea
          :value="videoPrompt"
          @input="$emit('update:videoPrompt', ($event.target as HTMLTextAreaElement).value)"
          placeholder="例如：慢镜头展示，柔和光照，电影质感"
          rows="3"
          class="flex-1 px-3 py-2 border rounded-lg text-sm"
          :disabled="disabled"
        />
        <button
          @click="$emit('random-prompt')"
          :disabled="disabled"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm whitespace-nowrap disabled:bg-gray-50 disabled:cursor-not-allowed"
          title="随机示例"
        >
          🎲 随机
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-1">
        描述希望的运动效果、镜头运动、光照和视觉风格
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

    <!-- 提示词优化开关 -->
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
        开启后将使用AI优化您的描述，生成更专业的英文视频提示词
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
import { computed } from 'vue'
import { durationOptions, aspectRatioOptions, presetImages } from './prompts'

interface Props {
  imageMode: 'single' | 'double'
  uploadedImages: string[]
  videoPrompt: string
  duration: number
  aspectRatio: string
  autoOptimize: boolean
  disabled: boolean
  isUploading: boolean
}

const props = defineProps<Props>()

const maxImages = computed(() => props.imageMode === 'single' ? 1 : 2)

defineEmits<{
  'update:imageMode': [value: 'single' | 'double']
  'update:videoPrompt': [value: string]
  'update:duration': [value: number]
  'update:aspectRatio': [value: string]
  'update:autoOptimize': [value: boolean]
  'upload': [event: Event]
  'remove-image': [index: number]
  'add-preset': [url: string]
  'random-prompt': []
  'generate': []
}>()
</script>
