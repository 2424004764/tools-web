<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

type FortunePeriod = 'today' | 'week' | 'month'

type FortuneDetail = {
  summary: string
  love: string
  career: string
  wealth: string
  health: string
}

const title = '星座运势查询'
const birthDate = ref('')
const fortuneType = ref<FortunePeriod>('today')
const errorMessage = ref('')
const zodiacSign = ref('')
const fortuneResult = ref<FortuneDetail | null>(null)

const zodiacList = [
  { name: '白羊座', start: [3, 21], end: [4, 19] },
  { name: '金牛座', start: [4, 20], end: [5, 20] },
  { name: '双子座', start: [5, 21], end: [6, 21] },
  { name: '巨蟹座', start: [6, 22], end: [7, 22] },
  { name: '狮子座', start: [7, 23], end: [8, 22] },
  { name: '处女座', start: [8, 23], end: [9, 22] },
  { name: '天秤座', start: [9, 23], end: [10, 23] },
  { name: '天蝎座', start: [10, 24], end: [11, 22] },
  { name: '射手座', start: [11, 23], end: [12, 21] },
  { name: '摩羯座', start: [12, 22], end: [1, 19] },
  { name: '水瓶座', start: [1, 20], end: [2, 18] },
  { name: '双鱼座', start: [2, 19], end: [3, 20] },
]

const fortuneMap: Record<string, Record<FortunePeriod, FortuneDetail>> = {
  '白羊座': {
    today: { summary: '今天行动力强，适合快速推进目标。', love: '感情直率，沟通更能加深默契。', career: '职场效率高，抓住重要机会。', wealth: '财务稳定，注意避免冲动消费。', health: '能量满格，适合适度运动。' },
    week: { summary: '本周你会感觉节奏更稳，适合做计划。', love: '关系更亲密，适合主动表达情感。', career: '工作进度顺利，适合攻克难题。', wealth: '收支平衡，适合整理预算。', health: '保持规律作息，精神状态良好。' },
    month: { summary: '本月适合稳步前进，长期目标更明确。', love: '感情稳定发展，适合共同制定计划。', career: '事业上有持续进展，耐心会带来回报。', wealth: '财运平稳，可适当储蓄。', health: '注意饮食平衡，增强体质。' },
  },
  '金牛座': {
    today: { summary: '今天适合专注细节，做好时间管理。', love: '情感关系更踏实，适合温柔陪伴。', career: '工作稳健，适合完善现有方案。', wealth: '支出谨慎，有机会找到性价比优选。', health: '适度放松，缓解压力更重要。' },
    week: { summary: '本周节奏平和，适合推动稳定发展。', love: '感情沟通顺畅，适合分享日常。', career: '职场稳步前进，保持耐心会见成效。', wealth: '理财保守，适合审视长期计划。', health: '多喝水，多活动，提升精神状态。' },
    month: { summary: '本月适合积累能量，稳扎稳打。', love: '感情基础牢固，适合共同规划未来。', career: '事业稳定发展，细节处理成效明显。', wealth: '预算明确，储蓄计划更容易执行。', health: '规律生活帮助你保持良好体能。' },
  },
  '双子座': {
    today: { summary: '今天思维敏捷，适合快速交流与学习。', love: '感情互动活跃，新话题带来惊喜。', career: '创意点子多，适合分享给团队。', wealth: '花费灵活，避免多余消费。', health: '保持好奇心，心情会更轻松。' },
    week: { summary: '本周适合沟通与扩展人脉。', love: '往来频繁，适合制造浪漫小惊喜。', career: '信息资源丰富，适合整合再行动。', wealth: '注意记录支出，避免乱花。', health: '控制信息输入量，避免过度疲劳。' },
    month: { summary: '本月适合学习与成长，探索新方向。', love: '感情交流增加，适合深化了解。', career: '职业机会增多，选择时要以实际为先。', wealth: '收入有望提升，避免冲动开销。', health: '多散步、多换气，保持轻松。' },
  },
  '巨蟹座': {
    today: { summary: '今天情感敏感，适合照顾自己与身边的人。', love: '适合表达关心，感情温暖。', career: '工作中适合处理细节与人际事务。', wealth: '财务稳健，适合规划家庭开支。', health: '注意情绪调节，给自己留一段休憩时间。' },
    week: { summary: '本周你的关怀力会为你带来好人缘。', love: '家庭情感和谐，适合共度温馨时光。', career: '适合处理合作与沟通相关事务。', wealth: '守住支出，适合家庭理财安排。', health: '保持情绪稳定，适合轻柔运动。' },
    month: { summary: '本月适合照顾内心与生活细节。', love: '感情基础稳固，可深化信任。', career: '事业方向稳中有进，适合慢慢推动。', wealth: '合理规划，适合制定长期预算。', health: '规律作息让你更有安全感。' },
  },
  '狮子座': {
    today: { summary: '今天气场强，适合亮相和承担责任。', love: '魅力十足，适合主动表达。', career: '适合争取舞台机会，展示能力。', wealth: '自信消费，注意不必过度铺张。', health: '热情满格，记得适度休息。' },
    week: { summary: '本周能量旺盛，适合带领团队。', love: '感情互动热烈，适合制造惊喜。', career: '工作表现突出，适合承担重要任务。', wealth: '收入可观，保持理性最优。', health: '运动效果好，适合挑战自我。' },
    month: { summary: '本月适合发挥领导力与魅力。', love: '关系有提升空间，适合积极投入。', career: '事业机会增加，勇于展现自己。', wealth: '财运向好，注意稳健规划。', health: '保持活力同时避免过度劳累。' },
  },
  '处女座': {
    today: { summary: '今天适合认真整理，追求高质量结果。', love: '细心关注伴侣需求，感情更细腻。', career: '工作效率高，适合优化方案。', wealth: '注意账目明细，避免小额遗漏。', health: '关注健康细节，保持好习惯。' },
    week: { summary: '本周适合完善计划与巩固成果。', love: '沟通细致，适合共享计划。', career: '事业进展扎实，适合检查细节。', wealth: '理财条理清晰，可稳步积累。', health: '按计划行动，身体状况良好。' },
    month: { summary: '本月适合不断打磨，提升专业度。', love: '关系稳固，可共同制定长期安排。', career: '事业上细节处理带来成效。', wealth: '稳健为主，适合稳步投资。', health: '持续关注健康，收获稳定能量。' },
  },
  '天秤座': {
    today: { summary: '今天适合寻求平衡，处理人际关系顺畅。', love: '情感互动和谐，适合一起做决策。', career: '合作氛围好，适合协调资源。', wealth: '适合审视开支，保持收支平衡。', health: '适当放松，保持身心平衡。' },
    week: { summary: '本周会更注重美感与和谐。', love: '相处温柔，适合制造浪漫。', career: '工作中协调顺利，适合团队合作。', wealth: '花费适量，适合理性购物。', health: '静心与美好事物会带来好状态。' },
    month: { summary: '本月适合打造更优质的生活节奏。', love: '感情稳定发展，适合创造温馨氛围。', career: '事业上你会更加注重平衡与策略。', wealth: '稳稳向好，适合合理支出。', health: '保持舒适节奏，提升整体满意度。' },
  },
  '天蝎座': {
    today: { summary: '今天直觉强，适合深度思考与突破。', love: '感情热烈，适合真诚交流。', career: '适合处理复杂事务，深度投入效果好。', wealth: '注意保护隐私，避免冲动投资。', health: '情绪波动时适合释放压力。' },
    week: { summary: '本周你会更有洞察力，看清关键问题。', love: '感情深度增强，适合真诚沟通。', career: '事业上有突破机会，适合集中精力。', wealth: '收益稳健，注意风险控制。', health: '保持情绪稳定，安排放松时间。' },
    month: { summary: '本月适合深耕核心目标。', love: '关系深刻，可建立更强信任。', career: '事业上你可迈向更高层次。', wealth: '财务表现稳健，避免过度冒险。', health: '保持平衡与恢复，能量更稳定。' },
  },
  '射手座': {
    today: { summary: '今天适合拓展视野，尝试新鲜事物。', love: '感情轻松愉快，适合一起出行。', career: '工作上适合寻找新思路。', wealth: '财运活跃，适合适度尝试。', health: '多运动会让你心情更好。' },
    week: { summary: '本周活力充沛，适合拓展与探索。', love: '关系自由洒脱，适合一起冒险。', career: '适合拓宽专业边界，接触新领域。', wealth: '收入波动，适合合理分配。', health: '保持运动习惯，精力更充沛。' },
    month: { summary: '本月适合开阔格局与计划未来。', love: '感情轻松愉悦，适合共同出行。', career: '事业机会多，适合积极把握。', wealth: '财运有亮点，注意合理分配。', health: '保持活力，避免过度劳累。' },
  },
  '摩羯座': {
    today: { summary: '今天适合稳步推进，踏实完成任务。', love: '感情诚恳，适合用行动表达。', career: '工作效率高，适合踏实攻坚。', wealth: '财务谨慎，适合稳健规划。', health: '适合规律生活，保持耐心。' },
    week: { summary: '本周适合稳扎稳打，固守职责。', love: '关系更踏实，可一起制定计划。', career: '事业上有实质进展，适合专注细节。', wealth: '理财稳健，适合调整预算。', health: '按部就班会让你更安心。' },
    month: { summary: '本月适合积累实力，稳步提升。', love: '感情稳固，适合务实经营关系。', career: '事业方向清晰，适合努力耕耘。', wealth: '财运稳定，可继续储蓄。', health: '坚持好习惯，收获长期效果。' },
  },
  '水瓶座': {
    today: { summary: '今天思路清晰，适合创新与交流。', love: '感情交流顺畅，适合分享新想法。', career: '适合提出创新方案，获得认可。', wealth: '支出有选择性，适合理性判断。', health: '保持好奇心，心情更轻松。' },
    week: { summary: '本周适合连接资源，构建新机会。', love: '关系富有新鲜感，适合探索共同兴趣。', career: '职业机会多，适合调整角色定位。', wealth: '灵活安排，适合小额尝试。', health: '保持开放心态，减少紧张。' },
    month: { summary: '本月适合探索与实践新方向。', love: '感情富有变化，适合主动沟通。', career: '事业上可拓展人脉与项目。', wealth: '财运平稳，适合合理规划。', health: '保持新鲜感，避免过度焦虑。' },
  },
  '双鱼座': {
    today: { summary: '今天适合倾听内心，关注情感体验。', love: '感情温柔，适合表达柔软一面。', career: '适合创意输出与情绪管理。', wealth: '保持温和谨慎，避免冲动。', health: '多关注心理状态，适度放松。' },
    week: { summary: '本周适合感性思考，表达自己的需求。', love: '感情更细腻，适合浪漫交流。', career: '适合发挥想象力完成任务。', wealth: '注意合理支配，避免盲目投资。', health: '放松心情，保持和缓节奏。' },
    month: { summary: '本月适合沉淀感悟，建立内在力量。', love: '关系更温柔，适合彼此支持。', career: '适合稳步推进创意项目。', wealth: '财务状况平稳，适合保持耐心。', health: '静心休息，有助恢复状态。' },
  },
}

const periodLabel = {
  today: '今日运势',
  week: '本周运势',
  month: '本月运势'
}

const signRangeLabel = (sign: string) => {
  const zodiac = zodiacList.find(item => item.name === sign)
  if (!zodiac) return ''
  const format = (month: number, day: number) => `${month}月${day}日`
  return `${format(zodiac.start[0], zodiac.start[1])} - ${format(zodiac.end[0], zodiac.end[1])}`
}

const getSign = (dateString: string) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const month = date.getMonth() + 1
  const day = date.getDate()

  for (const sign of zodiacList) {
    const [startMonth, startDay] = sign.start
    const [endMonth, endDay] = sign.end

    if (startMonth === endMonth) {
      if (month === startMonth && day >= startDay && day <= endDay) {
        return sign.name
      }
    } else if (startMonth < endMonth) {
      if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
        return sign.name
      }
    } else {
      if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay) || (month > startMonth) || (month < endMonth)) {
        return sign.name
      }
    }
  }
  return ''
}

const queryFortune = () => {
  if (!birthDate.value) {
    errorMessage.value = '请先选择出生日期。'
    fortuneResult.value = null
    zodiacSign.value = ''
    return
  }

  const sign = getSign(birthDate.value)
  if (!sign) {
    errorMessage.value = '无法识别星座，请检查出生日期。'
    fortuneResult.value = null
    zodiacSign.value = ''
    return
  }

  zodiacSign.value = sign
  fortuneResult.value = fortuneMap[sign][fortuneType.value]
  errorMessage.value = ''
}

const hasResult = computed(() => fortuneResult.value !== null)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <div class="mb-4">
        <div class="text-2xl font-semibold">星座运势查询</div>
        <div class="mt-1 text-sm text-slate-500">选择出生日期，查看今日、本周或本月的星座运势与恋爱、事业、财富、健康建议。</div>
      </div>

      <div class="space-y-4">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="出生日期">
              <el-date-picker v-model="birthDate" type="date" placeholder="请选择出生日期" value-format="YYYY-MM-DD" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="运势周期">
              <el-select v-model="fortuneType" class="w-full">
                <el-option label="今日运势" value="today" />
                <el-option label="本周运势" value="week" />
                <el-option label="本月运势" value="month" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="flex flex-wrap gap-3 items-center">
          <el-button type="primary" @click="queryFortune">查询运势</el-button>
          <span class="text-sm text-slate-500">根据出生日期自动判断星座，并显示对应运势内容。</span>
        </div>

        <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon />

        <div v-if="hasResult" class="space-y-4">
          <el-card class="border border-slate-200">
            <div class="flex flex-wrap justify-between gap-3">
              <div>
                <div class="text-sm text-slate-500">星座</div>
                <div class="text-xl font-semibold">{{ zodiacSign }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">运势周期</div>
                <div class="text-xl font-semibold">{{ periodLabel[fortuneType] }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">星座日期</div>
                <div class="text-xl font-semibold">{{ signRangeLabel(zodiacSign) }}</div>
              </div>
            </div>
          </el-card>

          <div v-if="fortuneResult" class="grid gap-4 sm:grid-cols-2">
            <el-card class="border border-slate-200">
              <div class="text-sm text-slate-500">运势概述</div>
              <div class="mt-2 text-base text-slate-700">{{ fortuneResult.summary }}</div>
            </el-card>
            <el-card class="border border-slate-200">
              <div class="text-sm text-slate-500">爱情运</div>
              <div class="mt-2 text-base text-slate-700">{{ fortuneResult.love }}</div>
            </el-card>
            <el-card class="border border-slate-200">
              <div class="text-sm text-slate-500">事业运</div>
              <div class="mt-2 text-base text-slate-700">{{ fortuneResult.career }}</div>
            </el-card>
            <el-card class="border border-slate-200">
              <div class="text-sm text-slate-500">财富运</div>
              <div class="mt-2 text-base text-slate-700">{{ fortuneResult.wealth }}</div>
            </el-card>
            <el-card class="border border-slate-200 sm:col-span-2">
              <div class="text-sm text-slate-500">健康运</div>
              <div class="mt-2 text-base text-slate-700">{{ fortuneResult.health }}</div>
            </el-card>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        星座运势查询工具会根据出生日期自动判断星座，并输出今日/本周/本月的综合运势。你可以查看爱情、事业、财富和健康四大方向的建议，帮助你更好地规划日常节奏。
      </el-text>
    </ToolDetail>
  </div>
</template>
