<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '年龄计算器'

const birthDate = ref('1995-06-15')
const targetDate = ref(new Date().toISOString().slice(0, 10))

const parse = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

const SIGNS: { name: string; start: [number, number] }[] = [
  { name: '摩羯座', start: [1, 1] },
  { name: '水瓶座', start: [1, 20] },
  { name: '双鱼座', start: [2, 19] },
  { name: '白羊座', start: [3, 21] },
  { name: '金牛座', start: [4, 20] },
  { name: '双子座', start: [5, 21] },
  { name: '巨蟹座', start: [6, 22] },
  { name: '狮子座', start: [7, 23] },
  { name: '处女座', start: [8, 23] },
  { name: '天秤座', start: [9, 23] },
  { name: '天蝎座', start: [10, 24] },
  { name: '射手座', start: [11, 23] },
  { name: '摩羯座', start: [12, 22] },
]

const getSign = (m: number, d: number) => {
  let sign = SIGNS[0].name
  for (const s of SIGNS) {
    if (m > s.start[0] || (m === s.start[0] && d >= s.start[1])) sign = s.name
  }
  return sign
}

const result = computed(() => {
  const birth = parse(birthDate.value)
  const target = parse(targetDate.value)
  if (!birth || !target || birth > target) return null

  let ageYears = target.getFullYear() - birth.getFullYear()
  let ageMonths = target.getMonth() - birth.getMonth()
  let ageDays = target.getDate() - birth.getDate()
  if (ageDays < 0) {
    ageMonths--
    ageDays += new Date(target.getFullYear(), target.getMonth(), 0).getDate()
  }
  if (ageMonths < 0) {
    ageYears--
    ageMonths += 12
  }

  // 虚岁：出生即 1 岁，每过一个农历新年加一岁（近似按公历春节前后的立春简化为出生年 + 经历年数）
  const nominalAge = target.getFullYear() - birth.getFullYear() + 1

  const totalDays = Math.floor((target.getTime() - birth.getTime()) / 86400000)
  const totalWeeks = Math.floor(totalDays / 7)
  const totalMonths = ageYears * 12 + ageMonths

  // 生肖按公历年近似（严格以立春为界的差异只影响春节前后出生者）
  const animal = ZODIACS[(birth.getFullYear() - 1900) % 12]
  const sign = getSign(birth.getMonth() + 1, birth.getDate())

  // 下一个生日
  let next = new Date(target.getFullYear(), birth.getMonth(), birth.getDate())
  if (next < target) next = new Date(target.getFullYear() + 1, birth.getMonth(), birth.getDate())
  const daysToBirthday = Math.ceil((next.getTime() - target.getTime()) / 86400000)
  const isBirthdayToday = target.getMonth() === birth.getMonth() && target.getDate() === birth.getDate()

  const milestones = [
    { label: '出生', date: birth },
    { label: '10000 天', date: new Date(birth.getTime() + 10000 * 86400000) },
    { label: '20 岁', date: new Date(birth.getFullYear() + 20, birth.getMonth(), birth.getDate()) },
    { label: '15000 天', date: new Date(birth.getTime() + 15000 * 86400000) },
    { label: '30 岁', date: new Date(birth.getFullYear() + 30, birth.getMonth(), birth.getDate()) },
    { label: '20000 天', date: new Date(birth.getTime() + 20000 * 86400000) },
    { label: '60 岁', date: new Date(birth.getFullYear() + 60, birth.getMonth(), birth.getDate()) },
    { label: '25000 天', date: new Date(birth.getTime() + 25000 * 86400000) },
    { label: '80 岁', date: new Date(birth.getFullYear() + 80, birth.getMonth(), birth.getDate()) },
  ].map((m) => ({
    ...m,
    dateStr: `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}-${String(m.date.getDate()).padStart(2, '0')}`,
    passed: m.date <= target,
  }))

  return {
    ageYears,
    ageMonths,
    ageDays,
    nominalAge,
    totalDays,
    totalWeeks,
    totalMonths,
    totalHours: totalDays * 24,
    animal,
    sign,
    daysToBirthday,
    isBirthdayToday,
    milestones,
  }
})

const fmt = (n: number) => n.toLocaleString('zh-CN')
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">年龄计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          精确计算周岁、虚岁、生肖星座、已活天数，以及距离下一个生日还有多少天。
        </p>
      </header>

      <div class="age-inputs">
        <div class="age-field">
          <label>出生日期</label>
          <el-date-picker v-model="birthDate" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </div>
        <div class="age-field">
          <label>计算至</label>
          <el-date-picker v-model="targetDate" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </div>
      </div>

      <div v-if="result" class="age-result">
        <div class="age-hero">
          <div class="age-hero-main">
            <span class="age-hero-value">{{ result.ageYears }}</span>
            <span class="age-hero-unit">周岁</span>
          </div>
          <div class="age-hero-sub">
            {{ result.ageYears }} 岁 {{ result.ageMonths }} 个月 {{ result.ageDays }} 天
            <template v-if="result.isBirthdayToday"> · 🎂 今天是生日！</template>
            <template v-else> · 距下个生日 {{ result.daysToBirthday }} 天</template>
          </div>
        </div>

        <div class="age-cards">
          <div class="age-card"><span class="age-card-label">虚岁</span><span class="age-card-value">{{ result.nominalAge }} 岁</span></div>
          <div class="age-card"><span class="age-card-label">生肖</span><span class="age-card-value">{{ result.animal }}</span></div>
          <div class="age-card"><span class="age-card-label">星座</span><span class="age-card-value">{{ result.sign }}</span></div>
          <div class="age-card"><span class="age-card-label">已活天数</span><span class="age-card-value">{{ fmt(result.totalDays) }} 天</span></div>
          <div class="age-card"><span class="age-card-label">已活小时</span><span class="age-card-value">{{ fmt(result.totalHours) }} 小时</span></div>
          <div class="age-card"><span class="age-card-label">生活周数</span><span class="age-card-value">{{ fmt(result.totalWeeks) }} 周</span></div>
          <div class="age-card"><span class="age-card-label">生活月数</span><span class="age-card-value">{{ fmt(result.totalMonths) }} 月</span></div>
        </div>

        <div class="age-milestones">
          <h3 class="age-milestones-title">人生里程碑</h3>
          <div class="age-milestones-grid">
            <div v-for="m in result.milestones" :key="m.label" class="age-milestone" :class="{ 'age-milestone-passed': m.passed }">
              <span class="age-milestone-label">{{ m.label }}</span>
              <span class="age-milestone-date">{{ m.dateStr }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-alert v-else type="warning" :closable="false" title="出生日期无效或晚于计算日期，请检查输入" class="mt-4" />
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        输入出生日期即可精确计算到目标日期的周岁（X 岁 X 月 X 天）、虚岁、生肖、星座，以及按天、周、月、小时累计的生活时长，并展示 10000 天、30 岁等人生里程碑的具体日期。生肖与虚岁按公历年近似计算，春节前后出生者可能存在一天以内的差异。全部计算在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.age-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 260px));
  gap: 16px;
}

.age-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.age-field > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.age-result {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.age-hero {
  padding: 20px 24px;
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.age-hero-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.age-hero-value {
  font-size: 52px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-color-primary);
}

.age-hero-unit {
  font-size: 18px;
  color: var(--el-text-color-regular);
}

.age-hero-sub {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.age-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.age-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.age-card-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.age-card-value {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 600;
}

.age-milestones-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.age-milestones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.age-milestone {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px dashed var(--el-border-color);
  color: var(--el-text-color-placeholder);
}

.age-milestone-passed {
  border-style: solid;
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}

.age-milestone-label {
  font-size: 12px;
}

.age-milestone-date {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
