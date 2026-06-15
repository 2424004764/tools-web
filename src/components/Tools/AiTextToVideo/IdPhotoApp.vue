<template>
  <div class="bg-gradient-to-br from-sky-50 to-cyan-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">👤</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">AI证件照</h2>
        <p class="text-sm text-gray-600">上传照片，AI生成标准证件照</p>
      </div>
    </div>

    <!-- 上传区 -->
    <div class="bg-white rounded-lg p-6 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-3">上传照片</label>

      <div v-if="!photoImage" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-sky-400 transition-colors cursor-pointer" @click="triggerUpload">
        <div class="text-4xl mb-2">📸</div>
        <p class="text-sm text-gray-600 mb-2">点击上传或拖拽照片到这里</p>
        <p class="text-xs text-gray-400">支持 JPG、PNG 格式，建议正面照</p>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />
      </div>

      <div v-else class="relative">
        <img :src="photoImage" class="w-full h-64 object-contain rounded-lg border" />
        <button
          @click="removePhoto"
          class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 配置选项 -->
    <div v-if="photoImage" class="bg-white rounded-lg p-4 mb-4 space-y-4">
      <!-- 背景颜色 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">背景颜色</label>
        <div class="grid grid-cols-4 gap-3">
          <button
            v-for="color in backgroundColors"
            :key="color.value"
            @click="$emit('update:selectedColor', color.value)"
            :class="[
              'p-3 rounded-lg border-2 transition-all text-center',
              selectedColor === color.value
                ? 'border-sky-500 ring-2 ring-sky-200'
                : 'border-gray-200 hover:border-sky-300'
            ]"
          >
            <div :class="['w-full h-12 rounded mb-2', color.bgClass]"></div>
            <div class="text-xs font-medium text-gray-700">{{ color.label }}</div>
          </button>
        </div>
      </div>

      <!-- 尺寸规格 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">尺寸规格</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="size in sizeOptions"
            :key="size.value"
            @click="$emit('update:selectedSize', size.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedSize === size.value
                ? 'bg-sky-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ size.label }}
          </button>
        </div>
      </div>

      <button
        @click="$emit('generate')"
        :disabled="isGenerating"
        class="w-full py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {{ isGenerating ? '生成中...' : '✨ 生成证件照' }}
      </button>
    </div>

    <!-- 生成结果 -->
    <div v-if="generatedPhoto" class="bg-white rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-800">生成结果</h3>
        <button
          @click="$emit('download')"
          class="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm"
        >
          💾 下载照片
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-2">原图</p>
          <img :src="photoImage" class="w-full rounded-lg border" />
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-2">证件照</p>
          <img :src="generatedPhoto" class="w-full rounded-lg border" />
        </div>
      </div>
    </div>

    <!-- 示例 -->
    <div v-if="!photoImage" class="bg-white rounded-lg p-4">
      <p class="text-sm font-medium text-gray-700 mb-3">📋 使用预设示例：</p>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          v-for="(preset, index) in presets"
          :key="index"
          @click="$emit('use-preset', preset.url)"
          class="relative group"
        >
          <img :src="preset.url" class="w-full h-32 object-cover rounded-lg border-2 border-transparent group-hover:border-sky-400 transition-all" />
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center">
            <span class="text-white opacity-0 group-hover:opacity-100 font-medium">使用</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  photoImage: string
  selectedColor: string
  selectedSize: string
  isGenerating: boolean
  generatedPhoto: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:photoImage': [value: string]
  'update:selectedColor': [value: string]
  'update:selectedSize': [value: string]
  'generate': []
  'download': []
  'use-preset': [url: string]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const backgroundColors = [
  { value: 'blue', label: '蓝色', bgClass: 'bg-blue-500' },
  { value: 'red', label: '红色', bgClass: 'bg-red-500' },
  { value: 'white', label: '白色', bgClass: 'bg-white border border-gray-300' },
  { value: 'gray', label: '灰色', bgClass: 'bg-gray-300' }
]

const sizeOptions = [
  { value: '1inch', label: '一寸' },
  { value: '2inch', label: '二寸' },
  { value: 'passport', label: '护照' },
  { value: 'custom', label: '自定义' }
]

const presets = [
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face' },
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face' }
]

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      emit('update:photoImage', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}

const removePhoto = () => {
  emit('update:photoImage', '')
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
