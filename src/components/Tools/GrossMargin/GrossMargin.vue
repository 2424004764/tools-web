<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '毛利率计算器'

// —— 1. 毛利率：毛利率 = (售价 − 成本) ÷ 售价 × 100% ——
const cost = ref(100)
const price = ref(140)

const profit = computed(() => price.value - cost.value)
const margin = computed(() => {
  if (price.value <= 0) return null
  return (profit.value / price.value) * 100
})
// 加价率 = (售价 − 成本) ÷ 成本，常被误当成毛利率
const markup = computed(() => {
  if (cost.value <= 0) return null
  return (profit.value / cost.value) * 100
})

// —— 2. 目标毛利率定价：售价 = 成本 ÷ (1 − 毛利率) ——
const targetMargin = ref(40)
const targetPrice = computed(() => {
  if (targetMargin.value < 0 || targetMargin.value >= 100) return null
  if (cost.value <= 0) return null
  return cost.value / (1 - targetMargin.value / 100)
})

// —— 3. 盈亏平衡营业额 = 固定费用总和 ÷ 毛利率 ——
const rent = ref(20000)
const labor = ref(50000)
const utilities = ref(5000)
const misc = ref(5000)
const breakevenMargin = ref(40)

const fixedTotal = computed(() => rent.value + labor.value + utilities.value + misc.value)
const breakevenRevenue = computed(() => {
  if (breakevenMargin.value <= 0) return null
  return fixedTotal.value / (breakevenMargin.value / 100)
})
const dailyRevenue = computed(() => {
  if (breakevenRevenue.value === null) return null
  return breakevenRevenue.value / 30
})

const fmtMoney = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const fmtPct = (n: number) => n.toFixed(2)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">毛利率计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          毛利率怎么算、按目标毛利率如何定价、营业额达到多少才能盈利，一次算清。
        </p>
      </header>

      <!-- 1. 毛利率 -->
      <div class="gm-card">
        <div class="gm-card-head">
          <span class="gm-badge">1</span>
          <div>
            <h2 class="gm-card-title">毛利率计算</h2>
            <p class="gm-card-sub">毛利率 = (售价 − 成本) ÷ 售价 × 100%</p>
          </div>
        </div>
        <div class="gm-grid">
          <div class="gm-form">
            <div class="gm-field">
              <label>进货成本（元）</label>
              <el-input-number v-model="cost" :min="0" :step="10" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>卖出售价（元）</label>
              <el-input-number v-model="price" :min="0" :step="10" :precision="2" controls-position="right" class="gm-input" />
            </div>
          </div>
          <div class="gm-result">
            <template v-if="margin !== null">
              <div class="gm-metric">
                <span class="gm-metric-value" :class="{ 'gm-neg': margin < 0 }">{{ fmtPct(margin) }}%</span>
                <span class="gm-metric-label">毛利率</span>
              </div>
              <div class="gm-sub">
                <span>毛利额：<strong :class="{ 'gm-neg': profit < 0 }">{{ fmtMoney(profit) }}</strong> 元</span>
                <span>加价率：<strong>{{ markup !== null ? fmtPct(markup) + '%' : '--' }}</strong></span>
              </div>
              <p class="gm-formula">({{ fmtMoney(price) }} − {{ fmtMoney(cost) }}) ÷ {{ fmtMoney(price) }} = {{ fmtPct(margin) }}%</p>
              <p v-if="margin < 0" class="gm-danger">售价低于成本，每卖一件亏 {{ fmtMoney(-profit) }} 元。</p>
              <p v-else class="gm-tip">加价率 ≠ 毛利率：100 元进货卖 140 元，加价率 40%，毛利率只有 28.57%。</p>
            </template>
            <p v-else class="gm-empty">请输入大于 0 的售价</p>
          </div>
        </div>
      </div>

      <!-- 2. 目标毛利率定价 -->
      <div class="gm-card">
        <div class="gm-card-head">
          <span class="gm-badge">2</span>
          <div>
            <h2 class="gm-card-title">目标毛利率定价</h2>
            <p class="gm-card-sub">售价 = 成本 ÷ (1 − 毛利率)</p>
          </div>
        </div>
        <div class="gm-grid">
          <div class="gm-form">
            <div class="gm-field">
              <label>进货成本（元）</label>
              <el-input-number v-model="cost" :min="0" :step="10" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>目标毛利率（%）</label>
              <el-input-number v-model="targetMargin" :min="0" :max="99.99" :step="1" :precision="2" controls-position="right" class="gm-input" />
            </div>
          </div>
          <div class="gm-result">
            <template v-if="targetPrice !== null">
              <div class="gm-metric">
                <span class="gm-metric-value">{{ fmtMoney(targetPrice) }}</span>
                <span class="gm-metric-label">应卖售价（元）</span>
              </div>
              <p class="gm-formula">{{ fmtMoney(cost) }} ÷ (1 − {{ fmtPct(targetMargin) }}%) = {{ fmtMoney(targetPrice) }} 元</p>
              <p class="gm-tip">想要 40% 毛利率，100 元的货要卖 100 ÷ (1 − 40%) ≈ 166.67 元，而不是 140 元。</p>
            </template>
            <p v-else class="gm-empty">毛利率需在 0 ~ 100% 之间</p>
          </div>
        </div>
      </div>

      <!-- 3. 盈亏平衡营业额 -->
      <div class="gm-card">
        <div class="gm-card-head">
          <span class="gm-badge">3</span>
          <div>
            <h2 class="gm-card-title">盈亏平衡营业额</h2>
            <p class="gm-card-sub">盈亏平衡营业额 = 固定费用总和 ÷ 毛利率</p>
          </div>
        </div>
        <div class="gm-grid">
          <div class="gm-form">
            <div class="gm-field">
              <label>房租（元/月）</label>
              <el-input-number v-model="rent" :min="0" :step="1000" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>人工（元/月）</label>
              <el-input-number v-model="labor" :min="0" :step="1000" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>水电（元/月）</label>
              <el-input-number v-model="utilities" :min="0" :step="500" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>其他杂费（元/月）</label>
              <el-input-number v-model="misc" :min="0" :step="500" :precision="2" controls-position="right" class="gm-input" />
            </div>
            <div class="gm-field">
              <label>毛利率（%）</label>
              <el-input-number v-model="breakevenMargin" :min="0" :max="100" :step="1" :precision="2" controls-position="right" class="gm-input" />
            </div>
          </div>
          <div class="gm-result">
            <template v-if="breakevenRevenue !== null">
              <div class="gm-metric">
                <span class="gm-metric-value">{{ fmtMoney(breakevenRevenue) }}</span>
                <span class="gm-metric-label">盈亏平衡月营业额（元）</span>
              </div>
              <div class="gm-sub">
                <span>固定费用合计：<strong>{{ fmtMoney(fixedTotal) }}</strong> 元/月</span>
                <span v-if="dailyRevenue !== null">日均营业额需达：<strong>{{ fmtMoney(dailyRevenue) }}</strong> 元</span>
              </div>
              <p class="gm-formula">({{ fmtMoney(rent) }} + {{ fmtMoney(labor) }} + {{ fmtMoney(utilities) }} + {{ fmtMoney(misc) }}) ÷ {{ fmtPct(breakevenMargin) }}% = {{ fmtMoney(breakevenRevenue) }} 元</p>
              <div class="gm-warning">
                <p>经营参考：月营业额低于 <strong>{{ fmtMoney(breakevenRevenue) }}</strong> 元就会亏损！</p>
                <p>大于 <strong>{{ fmtMoney(breakevenRevenue) }}</strong> 元，才能盈利。</p>
              </div>
            </template>
            <p v-else class="gm-empty">毛利率需大于 0</p>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        毛利率 = (售价 − 成本) ÷ 售价 × 100%，注意不是 (售价 − 成本) ÷ 成本——后者是加价率。100 元进货卖 140 元，加价率是 40%，毛利率只有 28.57%。若想达到 40% 毛利率，应按 售价 = 成本 ÷ (1 − 毛利率) 定价，即 100 ÷ 60% ≈ 166.67 元。已知房租、人工、水电等每月固定费用与毛利率时，盈亏平衡营业额 = 固定费用总和 ÷ 毛利率，例如每月固定开销 8 万、毛利率 40%，月营业额需达到 20 万才不亏本，超过 20 万才能盈利。所有计算在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.gm-card {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.gm-card + .gm-card {
  margin-top: 20px;
}

.gm-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.gm-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.gm-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.gm-card-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.gm-grid {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}

.gm-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px 16px;
}

.gm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gm-field label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.gm-input {
  width: 100%;
}

.gm-result {
  padding: 16px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.gm-metric {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.gm-metric-value {
  font-size: 38px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--el-color-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

.gm-metric-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.gm-sub {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.gm-formula {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.gm-tip {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-color-warning-dark-2);
}

.gm-danger {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-danger);
}

.gm-warning {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--el-color-danger-light-9);
}

.gm-warning p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-color-danger);
}

.gm-neg {
  color: var(--el-color-danger);
}

.gm-empty {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 1023px) {
  .gm-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
