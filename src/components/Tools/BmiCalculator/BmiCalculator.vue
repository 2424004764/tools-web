<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'BMI 计算器'

const height = ref(170)
const weight = ref(65)

const bmi = computed(() => {
  const h = height.value / 100
  if (h <= 0 || weight.value <= 0) return null
  return weight.value / (h * h)
})

const level = computed(() => {
  const v = bmi.value
  if (v === null) return null
  // 中国成人 BMI 标准（WS/T 428-2013）
  if (v < 18.5) return { label: '偏瘦', color: '#409EFF', advice: '体重偏低，建议适当增加营养摄入并进行力量训练。' }
  if (v < 24) return { label: '正常', color: '#67C23A', advice: '体重正常，继续保持均衡饮食和规律运动。' }
  if (v < 28) return { label: '偏胖', color: '#E6A23C', advice: '超重，建议控制饮食热量并增加有氧运动。' }
  return { label: '肥胖', color: '#F56C6C', advice: '肥胖，建议咨询医生或营养师制定减重计划。' }
})

const healthyWeightRange = computed(() => {
  const h = height.value / 100
  if (h <= 0) return null
  return { min: 18.5 * h * h, max: 23.9 * h * h }
})

// 仪表条位置：BMI 14~36 映射到 0~100%
const scalePos = computed(() => {
  const v = bmi.value
  if (v === null) return 0
  return Math.min(100, Math.max(0, ((v - 14) / 22) * 100))
})

const fmt = (n: number) => n.toFixed(1)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">BMI 计算器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          身体质量指数（BMI）计算，按中国成人标准评估体重健康状况。
        </p>
      </header>

      <div class="bmi-layout">
        <div class="bmi-form">
          <div class="bmi-field">
            <div class="bmi-field-head">
              <label>身高</label>
              <span>{{ height }} cm</span>
            </div>
            <el-slider v-model="height" :min="80" :max="230" :step="1" show-input :show-input-controls="false" />
          </div>
          <div class="bmi-field">
            <div class="bmi-field-head">
              <label>体重</label>
              <span>{{ weight }} kg</span>
            </div>
            <el-slider v-model="weight" :min="20" :max="200" :step="0.5" show-input :show-input-controls="false" />
          </div>
        </div>

        <div v-if="bmi !== null && level" class="bmi-result">
          <div class="bmi-score">
            <span class="bmi-score-value" :style="{ color: level.color }">{{ fmt(bmi) }}</span>
            <span class="bmi-score-level" :style="{ background: level.color }">{{ level.label }}</span>
          </div>

          <div class="bmi-scale">
            <div class="bmi-scale-bar">
              <span class="bmi-scale-seg bmi-seg-thin" />
              <span class="bmi-scale-seg bmi-seg-normal" />
              <span class="bmi-scale-seg bmi-seg-over" />
              <span class="bmi-scale-seg bmi-seg-obese" />
              <span class="bmi-scale-pointer" :style="{ left: `${scalePos}%` }" />
            </div>
            <div class="bmi-scale-labels">
              <span>14</span>
              <span>18.5</span>
              <span>24</span>
              <span>28</span>
              <span>36+</span>
            </div>
          </div>

          <p class="bmi-advice">{{ level.advice }}</p>

          <div v-if="healthyWeightRange" class="bmi-healthy">
            你的健康体重范围：<strong>{{ fmt(healthyWeightRange.min) }} ~ {{ fmt(healthyWeightRange.max) }}</strong> kg
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        BMI = 体重(kg) ÷ 身高²(m²)。本工具采用中国成人标准：18.5 以下偏瘦、18.5~24 正常、24~28 偏胖、28 及以上肥胖。拖动滑块即可实时计算，并给出对应的健康体重范围。BMI 未区分肌肉与脂肪比例，运动员等肌肉量大人群可能被高估，孕妇、儿童和老年人请参考专业医学评估。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.bmi-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(0, 1.4fr);
  gap: 32px;
  align-items: start;
}

.bmi-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bmi-field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.bmi-field-head label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.bmi-field-head span {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.bmi-score {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bmi-score-value {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.bmi-score-level {
  padding: 4px 14px;
  border-radius: 999px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.bmi-scale {
  margin-top: 24px;
}

.bmi-scale-bar {
  position: relative;
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: visible;
}

.bmi-scale-seg {
  display: block;
  height: 100%;
}

.bmi-seg-thin {
  width: calc((18.5 - 14) / 22 * 100%);
  border-radius: 999px 0 0 999px;
  background: #79bbff;
}

.bmi-seg-normal {
  width: calc((24 - 18.5) / 22 * 100%);
  background: #95d475;
}

.bmi-seg-over {
  width: calc((28 - 24) / 22 * 100%);
  background: #eebe77;
}

.bmi-seg-obese {
  flex: 1;
  border-radius: 0 999px 999px 0;
  background: #f89898;
}

.bmi-scale-pointer {
  position: absolute;
  top: -5px;
  width: 4px;
  height: 22px;
  border-radius: 2px;
  background: var(--el-text-color-primary);
  transform: translateX(-50%);
  transition: left 0.2s;
}

.bmi-scale-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.bmi-advice {
  margin-top: 16px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.6;
}

.bmi-healthy {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
  font-size: 14px;
}

@media (max-width: 1023px) {
  .bmi-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
