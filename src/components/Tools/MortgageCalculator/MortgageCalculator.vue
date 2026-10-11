<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '房贷计算器'

type RepayMethod = 'interest' | 'principal'

const totalWan = ref(100)
const years = ref(30)
const rate = ref(3.6)
const method = ref<RepayMethod>('interest')

const total = computed(() => totalWan.value * 10000)
const months = computed(() => Math.max(1, Math.round(years.value * 12)))
const monthRate = computed(() => rate.value / 100 / 12)

interface MonthRow {
  month: number
  payment: number
  principal: number
  interest: number
  remaining: number
}

const schedule = computed<MonthRow[]>(() => {
  const P = total.value
  const r = monthRate.value
  const n = months.value
  if (P <= 0 || r < 0) return []
  const rows: MonthRow[] = []
  if (method.value === 'interest') {
    const pow = Math.pow(1 + r, n)
    const payment = r === 0 ? P / n : (P * r * pow) / (pow - 1)
    let remaining = P
    for (let k = 1; k <= n; k++) {
      const interest = remaining * r
      const principal = payment - interest
      remaining = Math.max(0, remaining - principal)
      rows.push({ month: k, payment, principal, interest, remaining })
    }
  } else {
    const principalPart = P / n
    let remaining = P
    for (let k = 1; k <= n; k++) {
      const interest = remaining * r
      const payment = principalPart + interest
      remaining = Math.max(0, remaining - principalPart)
      rows.push({ month: k, payment, principal: principalPart, interest, remaining })
    }
  }
  return rows
})

const totalInterest = computed(() => schedule.value.reduce((s, r) => s + r.interest, 0))
const totalPayment = computed(() => total.value + totalInterest.value)

const summary = computed(() => {
  const rows = schedule.value
  if (!rows.length) return null
  if (method.value === 'interest') {
    return { label: '每月月供', value: rows[0].payment, tail: `共 ${months.value} 期，每期固定` }
  }
  const first = rows[0].payment
  const last = rows[rows.length - 1].payment
  const step = rows.length > 1 ? rows[0].payment - rows[1].payment : 0
  return {
    label: '首月月供',
    value: first,
    tail: `逐月递减约 ${fmt(step)} 元，末月 ${fmt(last)} 元`,
  }
})

const yearlyRows = computed(() => {
  const rows = schedule.value
  const out: { year: number; payment: number; interest: number; remaining: number }[] = []
  for (let i = 0; i < rows.length; i += 12) {
    const chunk = rows.slice(i, i + 12)
    out.push({
      year: i / 12 + 1,
      payment: chunk.reduce((s, r) => s + r.payment, 0),
      interest: chunk.reduce((s, r) => s + r.interest, 0),
      remaining: chunk[chunk.length - 1].remaining,
    })
  }
  return out
})

const fmt = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (n: number) =>
  n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })

const ratePresets = [
  { label: '公积金 2.6%', value: 2.6 },
  { label: '公积金 3.1%', value: 3.1 },
  { label: '商贷 3.0%', value: 3.0 },
  { label: '商贷 3.6%', value: 3.6 },
  { label: '商贷 4.2%', value: 4.2 },
]
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">房贷计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          支持等额本息、等额本金两种还款方式，实时计算月供、利息总额与逐年还款明细。
        </p>
      </header>

      <div class="mortgage-layout">
        <div class="mortgage-form">
          <div class="mortgage-field">
            <label>贷款总额（万元）</label>
            <el-input-number v-model="totalWan" :min="1" :max="100000" :step="10" class="w-full" />
          </div>
          <div class="mortgage-field">
            <label>贷款年限</label>
            <el-select v-model="years">
              <el-option v-for="y in [1, 3, 5, 10, 15, 20, 25, 30]" :key="y" :label="`${y} 年（${y * 12} 期）`" :value="y" />
            </el-select>
          </div>
          <div class="mortgage-field">
            <label>年利率（%）</label>
            <el-input-number v-model="rate" :min="0.01" :max="24" :step="0.05" :precision="2" class="w-full" />
            <div class="mortgage-presets">
              <el-button v-for="p in ratePresets" :key="p.value" size="small" text @click="rate = p.value">
                {{ p.label }}
              </el-button>
            </div>
          </div>
          <div class="mortgage-field">
            <label>还款方式</label>
            <el-radio-group v-model="method">
              <el-radio-button value="interest">等额本息</el-radio-button>
              <el-radio-button value="principal">等额本金</el-radio-button>
            </el-radio-group>
            <p class="text-body-sm text-slate-500 mt-1">
              {{ method === 'interest' ? '每月还款额固定，前期利息占比高' : '月供逐月递减，总利息更少，前期压力大' }}
            </p>
          </div>
        </div>

        <div v-if="summary" class="mortgage-result">
          <div class="mortgage-cards">
            <div class="mortgage-card mortgage-card-main">
              <span class="mortgage-card-label">{{ summary.label }}</span>
              <span class="mortgage-card-value">{{ fmt(summary.value) }}<small> 元</small></span>
              <span class="mortgage-card-tail">{{ summary.tail }}</span>
            </div>
            <div class="mortgage-card">
              <span class="mortgage-card-label">利息总额</span>
              <span class="mortgage-card-value">{{ fmtShort(totalInterest) }}<small> 元</small></span>
            </div>
            <div class="mortgage-card">
              <span class="mortgage-card-label">还款总额</span>
              <span class="mortgage-card-value">{{ fmtShort(totalPayment) }}<small> 元</small></span>
            </div>
          </div>

          <el-table :data="yearlyRows" size="small" max-height="420" class="mt-4">
            <el-table-column label="年份" width="80">
              <template #default="{ row }">第 {{ row.year }} 年</template>
            </el-table-column>
            <el-table-column label="年还款额（元）">
              <template #default="{ row }">{{ fmt(row.payment) }}</template>
            </el-table-column>
            <el-table-column label="其中利息（元）">
              <template #default="{ row }">{{ fmt(row.interest) }}</template>
            </el-table-column>
            <el-table-column label="年末剩余本金（元）">
              <template #default="{ row }">{{ fmt(row.remaining) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        输入贷款总额、年限、年利率并选择还款方式，右侧实时给出月供、利息总额、还款总额以及逐年还款明细。等额本息每月还款固定便于规划；等额本金首月最高、逐月递减，利息更省。利率可点击常用档位快速填入，计算全部在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.mortgage-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.6fr);
  gap: 24px;
  align-items: start;
}

.mortgage-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mortgage-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mortgage-field > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.mortgage-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mortgage-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.mortgage-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.mortgage-card-main {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.mortgage-card-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.mortgage-card-value {
  color: var(--el-color-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.mortgage-card small {
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.mortgage-card-tail {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 1023px) {
  .mortgage-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 639px) {
  .mortgage-cards {
    grid-template-columns: 1fr;
  }
}
</style>
