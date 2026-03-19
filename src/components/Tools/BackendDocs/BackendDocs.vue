<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { getAvailableTechStacks } from './techDocs'

const router = useRouter()

// 获取可用的技术栈
const availableTechStacks = getAvailableTechStacks()

// 技术栈列表
const techStacks = ref([
  {
    id: 'mongodb',
    name: 'MongoDB',
    icon: '',
    desc: '高性能、无模式的文档型数据库，适合存储半结构化数据',
    color: 'from-green-400 to-green-600',
    status: availableTechStacks.includes('mongodb') ? 'completed' : 'coming'
  },
  {
    id: 'mysql',
    name: 'MySQL',
    icon: '',
    desc: '最流行的开源关系型数据库，支持 ACID 事务和复杂查询',
    color: 'from-blue-400 to-blue-600',
    status: availableTechStacks.includes('mysql') ? 'completed' : 'coming'
  },
  {
    id: 'docker',
    name: 'Docker',
    icon: '',
    desc: '容器化技术，实现应用与环境的快速部署和迁移',
    color: 'from-blue-400 to-blue-600',
    status: availableTechStacks.includes('docker') ? 'completed' : 'coming'
  },
  {
    id: 'go',
    name: 'Go',
    icon: '',
    desc: 'Google 开发的高性能编程语言，适合构建后端服务和微服务',
    color: 'from-cyan-400 to-cyan-600',
    status: availableTechStacks.includes('go') ? 'completed' : 'coming'
  },
  {
    id: 'redis',
    name: 'Redis',
    icon: '',
    desc: '高性能内存数据库，支持多种数据结构，用于缓存和消息队列',
    color: 'from-red-400 to-red-600',
    status: availableTechStacks.includes('redis') ? 'completed' : 'coming'
  },
  {
    id: 'nginx',
    name: 'Nginx',
    icon: '',
    desc: '高性能 Web 服务器和反向代理服务器',
    color: 'from-emerald-400 to-emerald-600',
    status: availableTechStacks.includes('nginx') ? 'completed' : 'coming'
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: '',
    desc: '强大的开源关系型数据库，支持高级 SQL 特性',
    color: 'from-indigo-400 to-indigo-600',
    status: availableTechStacks.includes('postgresql') ? 'completed' : 'coming'
  }
])

// 检测是否为移动端
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(async () => {
  await nextTick()
  window.requestAnimationFrame(() => {
    checkMobile()
  })
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 跳转到技术栈详情页
const goToTechDetail = (techId: string) => {
  if (techStacks.value.find(t => t.id === techId)?.status === 'completed') {
    router.push(`/backend-docs/${techId}`)
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  return status === 'completed' ? '开始学习' : '敬请期待'
}

// 获取状态颜色
const getStatusColor = (status: string) => {
  return status === 'completed' ? 'success' : 'info'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="后端技能文档"></DetailHeader>

    <!-- 主内容区 -->
    <div class="bg-white rounded-2xl p-6">
      <!-- 介绍 -->
      <div class="mb-8 text-center">
        <h2 class="text-2xl font-bold text-gray-800 mb-3">后端开发技术栈文档</h2>
        <p class="text-gray-600">精选后端开发必备技术，从基础到实战，系统化学习路径</p>
      </div>

      <!-- 技术栈卡片网格 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="tech in techStacks"
          :key="tech.id"
          :class="[
            'relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer group',
            tech.status === 'completed'
              ? 'border-gray-200 hover:border-green-400 hover:shadow-xl'
              : 'border-gray-100 opacity-75 cursor-not-allowed'
          ]"
          @click="goToTechDetail(tech.id)"
        >
          <!-- 渐变背景 -->
          <div :class="['absolute inset-0 bg-gradient-to-br ' + tech.color + ' opacity-10']"></div>

          <!-- 内容 -->
          <div class="relative p-6">
            <!-- 图标/首字母 -->
            <div :class="['w-16 h-16 rounded-xl bg-gradient-to-br ' + tech.color + ' flex items-center justify-center mb-4 shadow-lg']">
              <span class="text-2xl font-bold text-white">{{ tech.name.charAt(0) }}</span>
            </div>

            <!-- 名称 -->
            <h3 class="text-xl font-bold text-gray-800 mb-2">{{ tech.name }}</h3>

            <!-- 描述 -->
            <p class="text-gray-600 text-sm mb-4">{{ tech.desc }}</p>

            <!-- 状态标签 -->
            <div class="flex items-center justify-between">
              <el-tag :type="getStatusColor(tech.status)" size="small">
                {{ getStatusText(tech.status) }}
              </el-tag>
              <el-icon v-if="tech.status === 'completed'" class="text-gray-400 group-hover:text-green-500 transition-colors">
                <ArrowRight />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明" class="mt-4">
      <el-text>
        <strong>后端技能文档</strong>提供系统化的后端技术学习资料。
        <br><br>
        <strong>功能特点：</strong>
        <br>• <strong>系统化学习</strong>：每个技术栈包含完整的知识体系，从基础概念到实战应用
        <br>• <strong>对比讲解</strong>：通过与其他技术对比，帮助理解技术选型
        <br>• <strong>关键技术点</strong>：提炼核心技术要点，聚焦实战
        <br>• <strong>持续更新</strong>：不断添加新的技术栈内容
        <br><br>
        <strong>如何使用：</strong>
        <br>1. 选择感兴趣的技术栈卡片
        <br>2. 点击进入详细文档页面
        <br>3. 通过左侧目录导航，按章节学习
        <br>4. 标记为"敬请期待"的技术正在编写中
      </el-text>
    </ToolDetail>
  </div>
</template>

<script lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
export default {
  components: { ArrowRight }
}
</script>

<style scoped>
/* 卡片悬停效果 */
.group:hover .group-hover\:text-green-500 {
  color: rgb(34 197 94);
}
</style>
