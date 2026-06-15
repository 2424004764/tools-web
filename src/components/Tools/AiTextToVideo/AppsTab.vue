<template>
  <div class="space-y-4">
    <!-- 应用列表 -->
    <div v-if="!currentApp">
      <h2 class="text-xl font-bold text-gray-800">AI应用中心</h2>

      <!-- 应用网格 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <!-- 解梦应用 -->
        <div
          @click="$emit('select-app', 'dream-analysis')"
          class="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-transparent hover:border-purple-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">🌙</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">AI解梦</h3>
          <p class="text-sm text-gray-600">弗洛伊德+周公双体系解析，探索潜意识的奥秘</p>
        </div>

        <!-- 城市指南 -->
        <div
          @click="$emit('select-app', 'city-guide')"
          class="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-transparent hover:border-green-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">🏛️</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">城市指南</h3>
          <p class="text-sm text-gray-600">深度了解城市历史文化，发现必去景点</p>
        </div>

        <!-- 宠物头像制作 -->
        <div
          @click="$emit('select-app', 'pet-avatar')"
          class="p-6 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-transparent hover:border-pink-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">🐱</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">宠物头像制作</h3>
          <p class="text-sm text-gray-600">上传宠物照片，AI生成动漫风格头像</p>
        </div>

        <!-- 祝福语生成器 -->
        <div
          @click="$emit('select-app', 'blessings-generator')"
          class="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border-2 border-transparent hover:border-red-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">💝</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">祝福语生成器</h3>
          <p class="text-sm text-gray-600">为不同场合和对象，生成温馨真挚的祝福</p>
        </div>

        <!-- 智能文案助手 -->
        <div
          @click="$emit('select-app', 'copywriting-assistant')"
          class="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-transparent hover:border-blue-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">📧</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">智能文案助手</h3>
          <p class="text-sm text-gray-600">为营销、社交媒体生成吸引人的文案</p>
        </div>

        <!-- AI证件照 -->
        <div
          @click="$emit('select-app', 'id-photo')"
          class="p-6 bg-gradient-to-br from-sky-50 to-cyan-50 rounded-xl border-2 border-transparent hover:border-sky-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">👤</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">AI证件照</h3>
          <p class="text-sm text-gray-600">上传照片，AI生成标准证件照</p>
        </div>

        <!-- 添加剂危害查询 -->
        <div
          @click="$emit('select-app', 'additive-hazard')"
          class="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-transparent hover:border-orange-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">⚠️</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">添加剂危害查询</h3>
          <p class="text-sm text-gray-600">查询食品添加剂的危害、成分和使用信息</p>
        </div>

        <!-- 药品说明书解读 -->
        <div
          @click="$emit('select-app', 'medicine-guide')"
          class="p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border-2 border-transparent hover:border-green-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">💊</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">药品说明书解读</h3>
          <p class="text-sm text-gray-600">拍照上传或输入，通俗易懂的用药指导</p>
        </div>

        <!-- 合同风险检测 -->
        <div
          @click="$emit('select-app', 'contract-risk')"
          class="p-6 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border-2 border-transparent hover:border-red-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">🔍</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">合同风险检测</h3>
          <p class="text-sm text-gray-600">识别合同中的风险条款和不平等内容</p>
        </div>

        <!-- 食物热量识别 -->
        <div
          @click="$emit('select-app', 'food-calorie')"
          class="p-6 bg-gradient-to-br from-yellow-50 to-lime-50 rounded-xl border-2 border-transparent hover:border-yellow-400 cursor-pointer transition-all hover:shadow-lg"
        >
          <div class="text-4xl mb-3">🍽️</div>
          <h3 class="text-lg font-bold text-gray-800 mb-2">食物热量识别</h3>
          <p class="text-sm text-gray-600">查询食物热量、营养成分和健康建议</p>
        </div>
      </div>
    </div>

    <!-- 当前应用内容 -->
    <div v-else>
      <button
        @click="$emit('back-to-list')"
        class="mb-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
      >
        <span>←</span>
        <span>返回应用列表</span>
      </button>

      <slot :app="currentApp"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentApp: string | null
}

defineProps<Props>()

defineEmits<{
  'select-app': [app: string]
  'back-to-list': []
}>()
</script>
