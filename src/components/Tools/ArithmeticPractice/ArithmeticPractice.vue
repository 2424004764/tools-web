<script setup lang="ts">
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

interface Question {
  left: number
  right: number
  op: '+' | '-'
  answer: number
  userAnswer: string
  correct: boolean | null
  invalid: boolean
}

const info = reactive({
  title: '小学加减法练习',
  questionCount: 10,
  maxOperand: 20,
  mode: 'both',
  questions: [] as Question[],
  checked: false,
})

const generateRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const generateQuestions = () => {
  info.questions = []
  info.checked = false
  for (let i = 0; i < info.questionCount; i++) {
    const left = generateRandom(0, info.maxOperand)
    const right = generateRandom(0, info.maxOperand)
    const op = info.mode === 'both'
      ? (Math.random() < 0.5 ? '+' : '-')
      : info.mode === 'add'
        ? '+'
        : '-'

    const [a, b] = op === '-' && left < right ? [right, left] : [left, right]
    const answer = op === '+' ? a + b : a - b

    info.questions.push({
      left: a,
      right: b,
      op,
      answer,
      userAnswer: '',
      correct: null,
      invalid: false,
    })
  }
}

const checkAnswers = () => {
  if (!info.questions.length) {
    ElMessage.warning('请先生成练习题后再批改答案。')
    return
  }

  const unanswered = info.questions.filter(item => !String(item.userAnswer).trim())
  if (unanswered.length > 0) {
    info.questions.forEach(item => {
      item.invalid = !String(item.userAnswer).trim()
    })
    ElMessage.warning('请先填写所有题目的答案，再点击批改。')
    return
  }

  info.questions.forEach(item => {
    item.invalid = false
    item.correct = Number(item.userAnswer) === item.answer
  })
  info.checked = true
}

const correctCount = computed(() => info.questions.filter(item => item.correct).length)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="mb-4 text-slate-800">
        <div class="text-2xl font-semibold">小学加减法练习</div>
        <div class="mt-1 text-sm text-slate-500">为小学阶段提供清晰舒适的题目展示与在线批改体验。</div>
      </div>

      <el-form label-position="top" label-width="120px" class="space-y-4">
        <el-row :gutter="24">
          <el-col :xs="24" :sm="24" :md="8">
            <el-form-item label="题目数量">
              <el-input-number v-model="info.questionCount" :min="5" :max="50" :step="1" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="24" :md="8">
            <el-form-item label="最大数值">
              <el-input-number v-model="info.maxOperand" :min="5" :max="100" :step="1" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="24" :md="8">
            <el-form-item label="题型选择">
              <el-radio-group v-model="info.mode" class="w-full">
                <el-radio-button label="add">加法</el-radio-button>
                <el-radio-button label="subtract">减法</el-radio-button>
                <el-radio-button label="both">加减混合</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="flex flex-wrap gap-3 items-center">
          <el-button type="primary" @click="generateQuestions">生成练习题</el-button>
          <el-button type="success" @click="checkAnswers">批改答案</el-button>
          <el-button @click="info.questions = []; info.checked = false">清空</el-button>
          <span class="text-sm text-slate-500">可一次生成最多 50 题，适合课堂练习与家庭作业。</span>
        </div>
      </el-form>

      <el-divider />

      <div v-if="info.questions.length" class="space-y-4">
        <el-alert
          title="请填写每题答案后点击“批改答案”，批改结果会在题目下方即时显示。"
          type="info"
          :closable="false"
        />

        <div class="grid gap-4 lg:grid-cols-3">
          <el-card
            v-for="(question, index) in info.questions"
            :key="index"
            :class="['overflow-hidden w-full border border-slate-200 shadow-sm', question.invalid ? 'question-invalid-card' : '']"
          >
            <div class="flex flex-row flex-wrap justify-between items-center gap-3">
              <div class="text-lg font-semibold text-slate-800 break-words">
                {{ index + 1 }}. {{ question.left }} {{ question.op }} {{ question.right }} =
              </div>
              <el-input
                size="small"
                v-model="question.userAnswer"
                placeholder="输入答案"
                :class="question.invalid ? 'invalid-answer-input' : ''"
                style="width: 120px"
              />
            </div>
            <div v-if="info.checked" class="mt-2 text-sm text-slate-600">
              <span v-if="question.correct" class="text-green-600">正确：答案 {{ question.answer }}</span>
              <span v-else class="text-red-600">错误：正确答案 {{ question.answer }}</span>
            </div>
          </el-card>
        </div>

        <div v-if="info.checked" class="mt-4">
          <el-tag type="success">答对 {{ correctCount }} / {{ info.questions.length }} 题</el-tag>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        这是一个面向小学加减法练习的工具，支持加法、减法和加减混合题型。
        选择题目数量、最大数值后点击“生成练习题”，填写答案后点击“批改答案”，可以快速得到批改结果。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.el-form-item {
  margin-bottom: 0;
}
.invalid-answer-input ::v-deep .el-input__inner {
  border-color: #f56c6c !important;
  box-shadow: 0 0 0 1px rgba(245, 108, 108, 0.25) !important;
}
.question-invalid-card {
  border-color: #f56c6c !important;
  box-shadow: 0 0 0 1px rgba(245, 108, 108, 0.25) !important;
}
</style>
