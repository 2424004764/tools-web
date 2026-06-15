<template>
  <div class="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">🐱</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">宠物头像制作</h2>
        <p class="text-sm text-gray-600">上传宠物照片，AI生成动漫风格头像</p>
      </div>
    </div>

    <!-- 上传区 -->
    <div class="bg-white rounded-lg p-6 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-3">上传宠物照片</label>

      <div v-if="!petImage" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-pink-400 transition-colors cursor-pointer" @click="triggerUpload">
        <div class="text-4xl mb-2">📸</div>
        <p class="text-sm text-gray-600 mb-2">点击上传或拖拽照片到这里</p>
        <p class="text-xs text-gray-400">支持 JPG、PNG 格式</p>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        />
      </div>

      <div v-else class="relative">
        <img :src="petImage" class="w-full h-64 object-contain rounded-lg border" />
        <button
          @click="removePetImage"
          class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 风格选择 -->
    <div v-if="petImage" class="bg-white rounded-lg p-4 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-3">选择动漫风格</label>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          v-for="style in styles"
          :key="style.value"
          @click="$emit('update:selectedStyle', style.value)"
          :class="[
            'p-3 rounded-lg border-2 transition-all text-center',
            selectedStyle === style.value
              ? 'border-pink-500 bg-pink-50'
              : 'border-gray-200 hover:border-pink-300'
          ]"
        >
          <div class="text-2xl mb-1">{{ style.emoji }}</div>
          <div class="text-xs font-medium text-gray-700">{{ style.label }}</div>
        </button>
      </div>

      <button
        @click="$emit('generate')"
        :disabled="isGenerating"
        class="mt-4 w-full py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {{ isGenerating ? '生成中...' : '✨ 生成动漫头像' }}
      </button>
    </div>

    <!-- 生成结果 -->
    <div v-if="generatedImage" class="bg-white rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-gray-800">生成结果</h3>
        <button
          @click="$emit('download')"
          class="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm"
        >
          💾 下载头像
        </button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-600 mb-2">原图</p>
          <img :src="petImage" class="w-full rounded-lg border" />
        </div>
        <div>
          <p class="text-sm text-gray-600 mb-2">生成头像</p>
          <img :src="generatedImage" class="w-full rounded-lg border" />
        </div>
      </div>
    </div>

    <!-- 示例 -->
    <div v-if="!petImage" class="bg-white rounded-lg p-4">
      <p class="text-sm font-medium text-gray-700 mb-3">📋 使用预设示例：</p>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <button
          v-for="(preset, index) in presets"
          :key="index"
          @click="$emit('use-preset', preset.url)"
          class="relative group"
        >
          <img :src="preset.url" class="w-full h-32 object-cover rounded-lg border-2 border-transparent group-hover:border-pink-400 transition-all" />
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
  petImage: string
  selectedStyle: string
  isGenerating: boolean
  generatedImage: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:petImage': [value: string]
  'update:selectedStyle': [value: string]
  'generate': []
  'download': []
  'use-preset': [url: string]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const styles = [
  { value: 'anime', label: '日系动漫', emoji: '🎌' },
  { value: 'cartoon', label: '卡通', emoji: '🎨' },
  { value: 'pixel', label: '像素风', emoji: '🎮' },
  { value: 'watercolor', label: '水彩', emoji: '🖌️' }
]

const presets = [
  { url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=400&fit=crop' },
  { url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop' },
  { url: 'https://images.unsplash.com/photo-1541599468348-e96984315921?w=400&h=400&fit=crop' },
  { url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop' },
  { url: 'https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=400&h=400&fit=crop' },
  { url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&h=400&fit=crop' }
]

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      emit('update:petImage', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}

const removePetImage = () => {
  emit('update:petImage', '')
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
