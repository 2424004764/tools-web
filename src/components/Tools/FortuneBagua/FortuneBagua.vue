<script setup lang="ts">
import { ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

type FortuneResult = {
  zodiac: string
  zodiacDesc: string
  bagua: string
  baguaDesc: string
  element: string
  luckyColor: string
  luckyDirection: string
  advice: string
}

const title = '命理八卦工具'
const birthDate = ref('')
const gender = ref<'male' | 'female'>('male')
const errorMessage = ref('')
const fortuneResult = ref<FortuneResult | null>(null)

const zodiacList = [
  { name: '鼠', element: '水', desc: '机敏灵活，具有良好的适应力和直觉判断。' },
  { name: '牛', element: '土', desc: '稳重可靠，勤奋踏实，适合扎实耕耘和守成。' },
  { name: '虎', element: '木', desc: '勇猛果敢，充满活力，擅长开拓与迎接挑战。' },
  { name: '兔', element: '木', desc: '温柔细腻，心思细腻，适合用心经营人际关系。' },
  { name: '龙', element: '土', desc: '气场强大，自信大方，适合承担重要任务与目标。' },
  { name: '蛇', element: '火', desc: '沉稳睿智，洞察力强，擅长深度思考与谋划。' },
  { name: '马', element: '火', desc: '热情奔放，行动力强，适合追求自由与快速进展。' },
  { name: '羊', element: '土', desc: '温和包容，富于同理心，适合营造稳定的情感氛围。' },
  { name: '猴', element: '金', desc: '机智灵活，善于变通，适合解决复杂问题与创新。' },
  { name: '鸡', element: '金', desc: '细致谨慎，追求完美，适合计划与执行细节工作。' },
  { name: '狗', element: '土', desc: '忠诚务实，责任感强，适合稳定合作与长期发展。' },
  { name: '猪', element: '水', desc: '坦诚宽厚，心态平和，适合人际和谐与积累福气。' },
]

const baguaList = [
  {
    name: '乾',
    desc: '乾为天，象征自强不息与开拓精神。适合担当、创新与领袖角色。',
    luckyColor: '金色',
    luckyDirection: '西北'
  },
  {
    name: '坤',
    desc: '坤为地，象征厚德载物与稳健守成。适合积蓄能量、稳步推进与照顾他人。',
    luckyColor: '黄色',
    luckyDirection: '西南'
  },
  {
    name: '震',
    desc: '震为雷，象征行动力与快速变化。适合主动出击与打破僵局。',
    luckyColor: '绿色',
    luckyDirection: '东方'
  },
  {
    name: '巽',
    desc: '巽为风，象征沟通与灵活应变。适合拓展关系、传播影响与创造机会。',
    luckyColor: '青色',
    luckyDirection: '东南'
  },
  {
    name: '坎',
    desc: '坎为水，象征智慧与应对风险。适合沉着应对挑战、稳健转机。',
    luckyColor: '黑色',
    luckyDirection: '北方'
  },
  {
    name: '离',
    desc: '离为火，象征热情与表达力。适合展示自我、激发创意与追求光明目标。',
    luckyColor: '红色',
    luckyDirection: '南方'
  },
  {
    name: '艮',
    desc: '艮为山，象征静止与守望。适合沉淀修身、磨练意志与做好内在准备。',
    luckyColor: '棕色',
    luckyDirection: '东北'
  },
  {
    name: '兑',
    desc: '兑为泽，象征喜悦与人际。适合协调关系、享受轻松氛围与传播欢乐。',
    luckyColor: '白色',
    luckyDirection: '西方'
  },
]

const getChineseZodiac = (year: number) => {
  const index = (year - 4) % 12
  return zodiacList[index < 0 ? index + 12 : index]
}

const getBagua = (year: number, month: number, day: number) => {
  const index = (year + month + day) % baguaList.length
  return baguaList[index]
}

const queryFortune = () => {
  if (!birthDate.value) {
    errorMessage.value = '请先选择出生日期。'
    fortuneResult.value = null
    return
  }

  const date = new Date(birthDate.value)
  if (Number.isNaN(date.getTime())) {
    errorMessage.value = '出生日期格式不正确，请重新选择。'
    fortuneResult.value = null
    return
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const zodiac = getChineseZodiac(year)
  const bagua = getBagua(year, month, day)

  fortuneResult.value = {
    zodiac: `${year}年（${zodiac.name}）`,
    zodiacDesc: zodiac.desc,
    bagua: bagua.name,
    baguaDesc: bagua.desc,
    element: zodiac.element,
    luckyColor: bagua.luckyColor,
    luckyDirection: bagua.luckyDirection,
    advice: `你的八字命理适合稳中求进，建议结合${zodiac.name}生肖的${zodiac.element}属性，结合${bagua.name}卦的特质来制定计划和调整作息。`
  }
  errorMessage.value = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="mb-4">
        <div class="text-2xl font-semibold">命理八卦工具</div>
        <div class="mt-1 text-sm text-slate-500">输入出生日期，系统会根据生肖与八卦生成命理结果，给出性格、五行与运势建议。</div>
      </div>

      <div class="space-y-4">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="出生日期">
              <el-date-picker v-model="birthDate" type="date" placeholder="请选择出生日期" value-format="YYYY-MM-DD" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="性别（可选）">
              <el-radio-group v-model="gender" class="flex gap-4">
                <el-radio label="male">男</el-radio>
                <el-radio label="female">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="flex flex-wrap gap-3 items-center">
          <el-button type="primary" @click="queryFortune">生成命理结果</el-button>
          <span class="text-sm text-slate-500">根据出生年月日生成生肖命理和八卦卦象，提供吉祥色与吉位方向参考。</span>
        </div>

        <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon />

        <div v-if="fortuneResult" class="space-y-4">
          <el-card class="border border-slate-200">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div class="text-sm text-slate-500">生肖命理</div>
                <div class="text-xl font-semibold">{{ fortuneResult.zodiac }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">八卦卦象</div>
                <div class="text-xl font-semibold">{{ fortuneResult.bagua }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">五行属性</div>
                <div class="text-xl font-semibold">{{ fortuneResult.element }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">吉祥颜色</div>
                <div class="text-xl font-semibold">{{ fortuneResult.luckyColor }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">吉位方向</div>
                <div class="text-xl font-semibold">{{ fortuneResult.luckyDirection }}</div>
              </div>
            </div>
          </el-card>

          <el-card class="border border-slate-200">
            <div class="text-sm text-slate-500">命理解析</div>
            <div class="mt-3 space-y-4 text-base text-slate-700">
              <div>{{ fortuneResult.zodiacDesc }}</div>
              <div>{{ fortuneResult.baguaDesc }}</div>
              <div>{{ fortuneResult.advice }}</div>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        命理八卦工具基于出生日期自动生成生肖和八卦卦象，输出五行属性、吉祥颜色、吉位方向和命理建议。适合用于快速了解个人性格趋势与日常运势参考。
      </el-text>
    </ToolDetail>
  </div>
</template>
