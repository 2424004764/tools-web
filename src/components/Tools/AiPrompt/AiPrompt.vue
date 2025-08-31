<script setup lang="ts">
import { reactive, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({
  title: "AI提示词仓库",
})

// 提示词分类
const categories = [
  { id: 'writing', name: '写作创作', icon: '✍️' },
  { id: 'programming', name: '编程开发', icon: '💻' },
  { id: 'business', name: '商业分析', icon: '📊' },
  { id: 'creative', name: '创意设计', icon: '🎨' },
  { id: 'education', name: '教育学习', icon: '🎓' },
  { id: 'translation', name: '翻译润色', icon: '🌐' },
  { id: 'research', name: '研究分析', icon: '🔬' },
  { id: 'marketing', name: '营销推广', icon: '📢' }
]

// 精选提示词数据
const prompts = {
  writing: [
    {
      title: '专业文案写手',
      prompt: '我希望你充当专业的文案写手。我会给你一个主题，你需要为这个主题写一篇吸引人的、有创意的文案。文案应该具有以下特点：1. 有吸引力的标题；2. 清晰的结构；3. 生动的语言；4. 强烈的感召力。请确保内容原创且符合目标受众的需求。',
      tags: ['文案', '创意', '营销'],
      difficulty: '中级'
    },
    {
      title: '小说故事创作者',
      prompt: '扮演一位经验丰富的小说作家。我会提供故事的基本元素（如主角、背景、冲突等），你需要创作一个引人入胜的故事开头。故事应该：1. 有鲜明的人物形象；2. 设置悬念或冲突；3. 使用生动的描写；4. 吸引读者继续阅读的兴趣。',
      tags: ['小说', '创意', '故事'],
      difficulty: '高级'
    }
  ],
  programming: [
    {
      title: '代码审查专家',
      prompt: '作为一名资深的代码审查专家，请仔细审查我提供的代码。关注以下几个方面：1. 代码质量和可读性；2. 性能优化建议；3. 安全性问题；4. 最佳实践的遵循情况；5. 潜在的bug或逻辑错误。请提供具体的改进建议和修改后的代码示例。',
      tags: ['代码审查', '优化', '最佳实践'],
      difficulty: '高级'
    },
    {
      title: '算法解释师',
      prompt: '我希望你充当算法导师。当我给你一个算法问题或概念时，请用通俗易懂的语言解释：1. 算法的基本思路和原理；2. 时间和空间复杂度分析；3. 适用场景和局限性；4. 提供清晰的代码实现；5. 举出实际的应用例子。',
      tags: ['算法', '教学', '解释'],
      difficulty: '中级'
    }
  ],
  business: [
    {
      title: '商业策略顾问',
      prompt: '扮演一位资深商业策略顾问。针对我提出的商业问题，请提供专业的分析和建议：1. 市场分析和竞争环境；2. SWOT分析；3. 可行的战略选择；4. 实施计划和时间表；5. 风险评估和应对策略。请确保建议具有可操作性和实用性。',
      tags: ['战略', '分析', '咨询'],
      difficulty: '高级'
    }
  ],
  creative: [
    {
      title: '创意设计师',
      prompt: '作为一名富有创意的设计师，我需要你为我的项目提供设计灵感。请根据我的需求：1. 分析设计目标和受众；2. 提出多个创意概念；3. 描述视觉风格和色彩搭配；4. 解释设计理念和寓意；5. 提供实施建议。让设计既美观又实用。',
      tags: ['设计', '创意', '视觉'],
      difficulty: '中级'
    }
  ],
  education: [
    {
      title: '知识解释专家',
      prompt: '担任一位耐心的教育工作者。当我向你询问任何知识点时，请：1. 用简单易懂的语言解释概念；2. 提供生动的例子或比喻；3. 分步骤说明复杂的过程；4. 提出相关的思考问题；5. 推荐进一步学习的资源。确保解释适合学习者的水平。',
      tags: ['教学', '解释', '学习'],
      difficulty: '中级'
    }
  ],
  translation: [
    {
      title: '翻译润色专家',
      prompt: '作为专业的翻译和语言润色专家，请帮助我处理文本。对于翻译任务：1. 准确传达原文含义；2. 保持语言自然流畅；3. 考虑文化差异和语境；4. 提供多个版本供选择。对于润色任务：1. 改进语言表达；2. 增强文章逻辑；3. 保持原作者的风格和语调。',
      tags: ['翻译', '润色', '语言'],
      difficulty: '高级'
    }
  ],
  research: [
    {
      title: '研究分析师',
      prompt: '扮演一位专业的研究分析师。针对我提出的研究问题：1. 明确研究目标和范围；2. 制定系统的分析框架；3. 收集和整理相关信息；4. 进行深入的分析和推理；5. 得出有依据的结论和建议。确保分析过程客观、严谨、全面。',
      tags: ['研究', '分析', '方法论'],
      difficulty: '高级'
    }
  ],
  marketing: [
    {
      title: '数字营销专家',
      prompt: '作为经验丰富的数字营销专家，请为我的营销活动提供专业建议：1. 分析目标客户群体；2. 制定营销策略和渠道选择；3. 设计吸引人的营销内容；4. 提出效果评估指标；5. 优化建议和改进方案。确保策略既创新又实用。',
      tags: ['数字营销', '策略', '推广'],
      difficulty: '高级'
    }
  ]
}

// 当前选中的分类
const activeCategory = ref('writing')

// 复制提示词
const copyPrompt = async (prompt: string) => {
  copy(prompt)
}

// 获取分类的提示词数量
const getCategoryCount = (categoryId: string) => {
  return prompts[categoryId]?.length || 0
}

// 获取难度等级的颜色
const getDifficultyColor = (difficulty: string) => {
  const colors = {
    '初级': 'success',
    '中级': 'warning', 
    '高级': 'danger'
  }
  return colors[difficulty] || 'primary'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 分类选择 -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-3 text-gray-700">选择分类</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div 
            v-for="category in categories" 
            :key="category.id"
            @click="activeCategory = category.id"
            :class="[
              'p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md',
              activeCategory === category.id 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            ]"
          >
            <div class="text-center">
              <div class="text-2xl mb-1">{{ category.icon }}</div>
              <div class="flex justify-center items-center gap-2">
                <div class="text-sm font-medium">{{ category.name }}</div>
                <div class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{{ getCategoryCount(category.id) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提示词列表 -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-gray-700">
          {{ categories.find(c => c.id === activeCategory)?.name }} 提示词
        </h3>
        
        <div v-if="prompts[activeCategory]" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            v-for="(item, index) in prompts[activeCategory]" 
            :key="index"
            class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
          >
            <!-- 标题和难度 -->
            <div class="flex justify-between items-start mb-3">
              <h4 class="text-lg font-semibold text-gray-800">{{ item.title }}</h4>
              <el-tag :type="getDifficultyColor(item.difficulty)" size="small">
                {{ item.difficulty }}
              </el-tag>
            </div>

            <!-- 标签 -->
            <div class="flex flex-wrap gap-2 mb-3">
              <el-tag 
                v-for="tag in item.tags" 
                :key="tag" 
                size="small" 
                type="info" 
                effect="plain"
              >
                {{ tag }}
              </el-tag>
            </div>

            <!-- 提示词内容 -->
            <div class="bg-gray-50 p-3 rounded-md mb-3">
              <pre class="whitespace-pre-wrap text-sm text-gray-700 font-mono">{{ item.prompt }}</pre>
            </div>

            <!-- 操作按钮 -->
            <div class="flex justify-end">
              <el-button type="primary" size="small" @click="copyPrompt(item.prompt)">
                复制提示词
              </el-button>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-gray-500">
          <p>该分类下的提示词正在整理中，敬请期待...</p>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="功能说明">
      <el-text>
        AI提示词仓库收录了各个领域的顶级提示词，帮助你更好地与AI进行对话。
        <br>• <strong>分类齐全</strong>：涵盖写作、编程、商业、创意等多个领域
        <br>• <strong>质量精选</strong>：每个提示词都经过精心挑选和测试
        <br>• <strong>使用简单</strong>：一键复制，直接使用
        <br>• <strong>持续更新</strong>：定期添加新的优质提示词
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 根据你的需求选择相应的分类
        <br>2. 阅读提示词内容，了解其作用和效果
        <br>3. 复制提示词并根据具体情况进行微调
        <br>4. 在AI对话中粘贴使用，获得更好的回答效果
      </el-text>
    </ToolDetail>

  </div>
</template>

<style scoped>
.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (min-width: 768px) {
  .md\:grid-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  
  .md\:grid-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>