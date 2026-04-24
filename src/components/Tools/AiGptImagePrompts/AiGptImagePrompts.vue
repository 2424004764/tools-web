<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

const info = reactive({
  title: "GPT-Image-2 提示词仓库",
})

// 主要类别
const categories = [
  {
    id: 'portrait',
    name: '人像与摄影案例',
    icon: '📸',
    count: 8,
    description: '包含便利店霓虹人像、电影感极简人像、日式温泉旅馆人像等高质量提示词'
  },
  {
    id: 'poster',
    name: '海报与插画案例',
    icon: '🎨',
    count: 9,
    description: '涵盖城市海报、旅行海报、美食地图插画、中式极简海报等创意设计'
  },
  {
    id: 'character',
    name: '角色设计案例',
    icon: '👤',
    count: 6,
    description: '包括动漫转换、Persona5角色卡、Galgame角色介绍页、设定表等'
  },
  {
    id: 'ui',
    name: 'UI 与社交媒体截图案例',
    icon: '📱',
    count: 8,
    description: '展示UI设计、iPhone发布会、笔记本照片、社交媒体动态等截图生成'
  },
  {
    id: 'comparison',
    name: '模型对比与社区案例',
    icon: '⚖️',
    count: 21,
    description: 'GPT-Image-2与其他模型的对比测试、社区分享的优秀案例和使用技巧'
  }
]

// 复制提示词
const copyPrompt = (prompt: string) => {
  copy(prompt)
  ElMessage.success('提示词已复制到剪贴板')
}

// 访问仓库
const visitRepo = () => {
  window.open('https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts/blob/main/README_zh-CN.md', '_blank')
}
</script>

<template>
  <div class="flex flex-col mt-3">
    <DetailHeader :title="info.title" />

    <!-- 简介 -->
    <div class="p-4 rounded-2xl bg-white mb-4">
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-2">🤗 欢迎来到 awesome-gpt-image-2-prompts</h2>
        <p class="text-gray-600 mb-4">
          我们收录了 GPT-Image-2 在人像、海报、角色设计、UI 原型及社区实验等场景下的高质量提示词与图像案例。
        </p>
        <div class="flex justify-center gap-4">
          <el-button type="primary" @click="visitRepo" icon="Link">
            访问 GitHub 仓库
          </el-button>
          <el-button type="success" @click="visitRepo" icon="Star">
            在 Evolink 上体验 GPT-Image-2
          </el-button>
        </div>
      </div>

      <!-- 类别网格 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="category in categories"
          :key="category.id"
          class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          @click="visitRepo"
        >
          <div class="flex items-center mb-2">
            <span class="text-2xl mr-2">{{ category.icon }}</span>
            <h3 class="text-lg font-semibold text-gray-800">{{ category.name }}</h3>
            <span class="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {{ category.count }} 个案例
            </span>
          </div>
          <p class="text-gray-600 text-sm">{{ category.description }}</p>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-4">
        <div>
          <h4 class="font-semibold text-gray-800 mb-2">📖 仓库内容</h4>
          <p class="text-gray-600">
            本仓库专注于 GPT-Image-2 的可复用提示词模板、参考案例与任务专项示例。大多数案例来源于 X/Twitter 上的创作者社区、公开演示及分享实验。
          </p>
        </div>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2">🎯 主要特色</h4>
          <ul class="text-gray-600 space-y-1">
            <li>• 人像摄影：35mm 胶片风格、电影感构图、专业灯光设置</li>
            <li>• 海报设计：城市宣传海报、旅行海报、美食地图插画</li>
            <li>• 角色设计：动漫风格转换、游戏角色设定表、官方资料卡</li>
            <li>• UI/UX：手机截图、社交媒体界面、发布会场景</li>
            <li>• 模型对比：与其他 AI 图像模型的详细对比测试</li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-gray-800 mb-2">💡 使用建议</h4>
          <ul class="text-gray-600 space-y-1">
            <li>• 点击上方类别卡片访问完整的 GitHub 仓库查看详细提示词</li>
            <li>• 每个案例都包含完整的提示词文本和效果预览</li>
            <li>• 可以直接复制提示词用于自己的创作</li>
            <li>• 建议在 Evolink 平台上体验 GPT-Image-2 的强大功能</li>
          </ul>
        </div>
      </div>
    </ToolDetail>

    <!-- 示例提示词 -->
    <ToolDetail title="示例提示词">
      <div class="space-y-4">
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="font-semibold text-gray-800 mb-2">🎭 电影感极简人像</h4>
          <p class="text-gray-600 text-sm mb-3">
            生成一个电影感极简人像的提示词示例：
          </p>
          <div class="bg-white p-3 rounded border font-mono text-sm">
            Generate a cinematic minimal portrait of a solitary man standing in an intense orange to red gradient environment, strong silhouette lighting, deep shadow contrast, reflective glossy floor, symmetrical composition, minimal
          </div>
          <el-button
            size="small"
            type="primary"
            class="mt-2"
            @click="copyPrompt('Generate a cinematic minimal portrait of a solitary man standing in an intense orange to red gradient environment, strong silhouette lighting, deep shadow contrast, reflective glossy floor, symmetrical composition, minimal')"
          >
            复制提示词
          </el-button>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="font-semibold text-gray-800 mb-2">🏙️ 城市海报设计</h4>
          <p class="text-gray-600 text-sm mb-3">
            2026 波士顿春季城市海报的提示词片段：
          </p>
          <div class="bg-white p-3 rounded border font-mono text-sm">
            A striking Spring 2026 city poster for Boston with an elegant celebratory mood and a bold contemporary design. On a clean off-white textured background with large areas of negative space...
          </div>
          <el-button
            size="small"
            type="primary"
            class="mt-2"
            @click="copyPrompt('A striking Spring 2026 city poster for Boston with an elegant celebratory mood and a bold contemporary design. On a clean off-white textured background with large areas of negative space...')"
          >
            复制提示词
          </el-button>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义样式 */
</style>