<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '个税计算器'

const salary = ref(15000)
const socialInsurance = ref(2000)
const specialDeduction = ref(1000)
const threshold = ref(5000)
const bonusMonths = ref(0)

interface Bracket {
  limit: number
  rate: number
  quickDeduction: number
}

// 年度综合所得税率表（累计预扣预缴）
const brackets: Bracket[] = [
  { limit: 36000, rate: 0.03, quickDeduction: 0 },
  { limit: 144000, rate: 0.1, quickDeduction: 2520 },
  { limit: 300000, rate: 0.2, quickDeduction: 16920 },
  { limit: 420000, rate: 0.25, quickDeduction: 31920 },
  { limit: 660000, rate: 0.3, quickDeduction: 52920 },
  { limit: 960000, rate: 0.35, quickDeduction: 85920 },
  { limit: Infinity, rate: 0.45, quickDeduction: 181920 },
]

interface MonthRow {
  month: number
  income: number
  cumulativeTaxable: number
  rate: number
  tax: number
  afterTax: number
}

const monthlyRows = computed<MonthRow[]>(() => {
  const months = bonusMonths.value > 0 ? bonusMonths.value : 12
  const rows: MonthRow[] = []
  let cumulativeTaxable = 0
  for (let m = 1; m <= months; m++) {
    cumulativeTaxable += salary.value - socialInsurance.value - specialDeduction.value - threshold.value
    const taxable = Math.max(0, cumulativeTaxable)
    const bracket = brackets.find((b) => taxable <= b.limit) || brackets[brackets.length - 1]
    const cumulativeTax = taxable * bracket.rate - bracket.quickDeduction
    const prevTax = rows.reduce((s, r) => s + r.tax, 0)
    const tax = Math.max(0, cumulativeTax - prevTax)
    rows.push({
      month: m,
      income: salary.value,
      cumulativeTaxable,
      rate: bracket.rate,
      tax,
      afterTax: salary.value - socialInsurance.value - tax,
    })
  }
  return rows
})

const yearTax = computed(() => monthlyRows.value.reduce((s, r) => s + r.tax, 0))
const yearAfterTax = computed(() =>
  monthlyRows.value.reduce((s, r) => s + r.afterTax, 0),
)
const avgMonthlyTax = computed(() => yearTax.value / monthlyRows.value.length)
const effectiveRate = computed(() => {
  const annual = salary.value * monthlyRows.value.length
  return annual > 0 ? (yearTax.value / annual) * 100 : 0
})

const fmt = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">个税计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          按累计预扣预缴法计算每月个人所得税，展示税率跳档、逐月税额与全年汇总。
        </p>
      </header>

      <div class="tax-layout">
        <div class="tax-form">
          <div class="tax-field">
            <label>每月税前工资（元）</label>
            <el-input-number v-model="salary" :min="0" :max="10000000" :step="500" class="w-full" />
          </div>
          <div class="tax-field">
            <label>每月五险一金（个人部分，元）</label>
            <el-input-number v-model="socialInsurance" :min="0" :max="100000" :step="100" class="w-full" />
          </div>
          <div class="tax-field">
            <label>每月专项附加扣除合计（元）</label>
            <el-input-number v-model="specialDeduction" :min="0" :max="100000" :step="100" class="w-full" />
            <p class="text-body-sm text-slate-500 mt-1">子女教育、房贷利息、赡养老人、租房等专项附加扣除</p>
          </div>
          <div class="tax-field">
            <label>计税月数</label>
            <el-input-number v-model="bonusMonths" :min="0" :max="12" :step="1" class="w-full" />
            <p class="text-body-sm text-slate-500 mt-1">0 表示全年 12 个月；年中入职可填实际在职月数</p>
          </div>
        </div>

        <div class="tax-result">
          <div class="tax-cards">
            <div class="tax-card tax-card-main">
              <span class="tax-card-label">每月应缴个税（首月）</span>
              <span class="tax-card-value">{{ fmt(monthlyRows[0]?.tax || 0) }}<small> 元</small></span>
            </div>
            <div class="tax-card">
              <span class="tax-card-label">全年个税总额</span>
              <span class="tax-card-value">{{ fmt(yearTax) }}<small> 元</small></span>
            </div>
            <div class="tax-card">
              <span class="tax-card-label">全年税后到手</span>
              <span class="tax-card-value">{{ fmt(yearAfterTax) }}<small> 元</small></span>
            </div>
            <div class="tax-card">
              <span class="tax-card-label">平均月缴税</span>
              <span class="tax-card-value">{{ fmt(avgMonthlyTax) }}<small> 元</small></span>
            </div>
            <div class="tax-card">
              <span class="tax-card-label">实际税率</span>
              <span class="tax-card-value">{{ effectiveRate.toFixed(2) }}<small> %</small></span>
            </div>
          </div>

          <el-table :data="monthlyRows" size="small" max-height="440" class="mt-4">
            <el-table-column label="月份" width="64">
              <template #default="{ row }">{{ row.month }} 月</template>
            </el-table-column>
            <el-table-column label="累计应纳税所得额（元）">
              <template #default="{ row }">
                <span :class="{ 'tax-negative': row.cumulativeTaxable < 0 }">{{ fmt(row.cumulativeTaxable) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="税率" width="80">
              <template #default="{ row }">{{ (row.rate * 100).toFixed(0) }}%</template>
            </el-table-column>
            <el-table-column label="本月缴税（元）">
              <template #default="{ row }">{{ fmt(row.tax) }}</template>
            </el-table-column>
            <el-table-column label="本月到手（元）">
              <template #default="{ row }">{{ fmt(row.afterTax) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        采用与工资单一致的累计预扣预缴法：每月应纳税所得额 = 累计税前工资 − 累计五险一金 − 累计专项附加扣除 − 5000 元起征点，再按年度税率表（3%~45%）计算累计应缴税额，减去已缴部分即为本月个税。税率随累计所得升高而跳档，因此年中月缴税可能增加。所有计算在浏览器本地完成，不上传任何数据。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.tax-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.6fr);
  gap: 24px;
  align-items: start;
}

.tax-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tax-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tax-field > label {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.tax-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.tax-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.tax-card-main {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.tax-card-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tax-card-value {
  color: var(--el-color-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-all;
}

.tax-card small {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-regular);
}

.tax-negative {
  color: var(--el-text-color-placeholder);
}

@media (max-width: 1200px) {
  .tax-cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  .tax-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 639px) {
  .tax-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
