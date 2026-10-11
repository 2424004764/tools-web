<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '假文生成器'

type Lang = 'zh' | 'latin'

const lang = ref<Lang>('zh')
const paragraphCount = ref(3)
const sentencesPerParagraph = ref(5)
const result = ref('')

// 中文假文词库：常见双字/三字词，随机组合成通顺感较强的句子
const zhWords = [
  '系统', '数据', '用户', '平台', '设计', '开发', '功能', '体验', '服务', '内容',
  '产品', '需求', '方案', '结构', '流程', '效率', '质量', '安全', '稳定', '灵活',
  '核心', '基础', '目标', '价值', '优势', '特点', '方式', '方法', '逻辑', '模型',
  '信息', '网络', '技术', '资源', '管理', '运营', '支持', '保障', '优化', '提升',
  '分析', '处理', '应用', '场景', '行业', '市场', '团队', '协作', '沟通', '决策',
  '简单', '高效', '智能', '便捷', '丰富', '完善', '强大', '专业', '可靠', '领先',
]

const zhEndings = ['。', '。', '。', '！', '？']

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(arr: T[]) => arr[rand(arr.length)]

const makeZhSentence = () => {
  const len = 6 + rand(10)
  let s = ''
  for (let i = 0; i < len; i++) s += pick(zhWords)
  return s + pick(zhEndings)
}

const LATIN_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

const makeLatinSentence = () => {
  const len = 8 + rand(10)
  const words: string[] = []
  for (let i = 0; i < len; i++) words.push(LATIN_WORDS[rand(LATIN_WORDS.length)])
  const s = words.join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

const generate = () => {
  const paragraphs: string[] = []
  for (let p = 0; p < paragraphCount.value; p++) {
    const sentences: string[] = []
    for (let s = 0; s < sentencesPerParagraph.value; s++) {
      sentences.push(lang.value === 'zh' ? makeZhSentence() : makeLatinSentence())
    }
    paragraphs.push(sentences.join(lang.value === 'zh' ? '' : ' '))
  }
  result.value = paragraphs.join('\n\n')
}
generate()

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const regenerate = () => {
  generate()
  ElMessage.success('已重新生成')
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">假文生成器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          生成中文假文或经典 Lorem Ipsum 占位文本，用于原型设计、排版演示与测试填充。
        </p>
      </header>

      <div class="lorem-options">
        <div class="lorem-option">
          <label>语言</label>
          <el-radio-group v-model="lang">
            <el-radio-button value="zh">中文假文</el-radio-button>
            <el-radio-button value="latin">Lorem Ipsum</el-radio-button>
          </el-radio-group>
        </div>
        <div class="lorem-option">
          <label>段落数</label>
          <el-input-number v-model="paragraphCount" :min="1" :max="50" />
        </div>
        <div class="lorem-option">
          <label>每段句数</label>
          <el-input-number v-model="sentencesPerParagraph" :min="1" :max="20" />
        </div>
        <div class="lorem-option">
          <label>&nbsp;</label>
          <el-button type="primary" @click="regenerate">重新生成</el-button>
          <el-button @click="copy">复制</el-button>
        </div>
      </div>

      <el-input
        v-model="result"
        type="textarea"
        :rows="18"
        readonly
        class="lorem-output"
        placeholder="点击「重新生成」产出占位文本…"
      />
      <p class="text-body-sm text-slate-500 mt-2">{{ result.length.toLocaleString() }} 字符</p>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        选择中文或拉丁文（Lorem Ipsum），设定段落数与每段句数后生成占位文本。中文假文由常用词汇随机组成，观感接近真实文章，适合给国内客户演示设计稿；Lorem Ipsum 是国际通用的印刷排版占位文。每次点击「重新生成」都会产出全新随机文本，点击「复制」即可粘贴到设计工具或编辑器中。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.lorem-options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 16px;
}

.lorem-option {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lorem-option > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}
</style>
