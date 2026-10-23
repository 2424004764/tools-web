<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const input = ref('2026')
const fromBase = ref(10)
const customBase = ref(36)
const fractionDigits = 32

const baseOptions = [2, 8, 10, 16].map(base => ({ base, label: `${base} 进制` }))
const commonBases = [2, 8, 10, 16]

const digitChars = '0123456789abcdefghijklmnopqrstuvwxyz'
const digitValues = new Map<string, bigint>(
  Array.from(digitChars).map((char, index) => [char, BigInt(index)]),
)

const error = ref('')

const parseInBase = (raw: string, base: number) => {
  const text = raw.trim().toLowerCase().replace(/[\s_]/g, '').replace(/^\+/, '')
  if (!text) return null
  const negative = text.startsWith('-')
  const body = negative ? text.slice(1) : text
  const [intPart, fracPart] = body.split('.')
  const valid = new RegExp(`^[0-${digitChars[base - 1]}]*$`)
  if (!intPart || (fracPart !== undefined && !valid.test(intPart + fracPart)) || !valid.test(intPart)) {
    throw new Error(`输入包含不是 ${base} 进制的字符`)
  }
  let int_value = BigInt(0)
  const bigBase = BigInt(base)
  for (const char of intPart) int_value = int_value * bigBase + digitValues.get(char)!
  let numerator = int_value
  let denominator = BigInt(1)
  if (fracPart) {
    for (const char of fracPart) {
      denominator *= bigBase
      numerator = numerator * bigBase + digitValues.get(char)!
    }
  }
  return { negative, numerator, denominator }
}

const formatInBase = (fraction: bigint, denominator: bigint, base: number) => {
  const bigBase = BigInt(base)
  const intPart = fraction / denominator
  let rest = fraction % denominator
  if (rest === BigInt(0)) return intPart.toString(base)
  let frac = ''
  for (let i = 0; i < fractionDigits && rest !== BigInt(0); i++) {
    rest *= bigBase
    const digit = rest / denominator
    frac += digitChars[Number(digit)]
    rest %= denominator
  }
  return `${intPart.toString(base)}.${frac.replace(/0+$/, '')}`
}

const results = computed(() => {
  error.value = ''
  try {
    const parsed = parseInBase(input.value, fromBase.value)
    if (!parsed) return []
    const signed = (n: bigint) => (parsed.negative ? -n : n)
    const list = commonBases
      .filter(base => base !== fromBase.value)
      .map(base => ({
        base,
        label: `${base} 进制`,
        value: formatInBase(signed(parsed.numerator), parsed.denominator, base),
      }))
    if (!commonBases.includes(customBase.value)) {
      list.push({
        base: customBase.value,
        label: `${customBase.value} 进制`,
        value: formatInBase(signed(parsed.numerator), parsed.denominator, customBase.value),
      })
    }
    return list
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '转换失败'
    return []
  }
})

const currentResults = computed(() =>
  results.value.filter(item => item.value !== '' && item.value !== '-'),
)

watch([input, fromBase, customBase], () => {
  if (fromBase.value === customBase.value) {
    customBase.value = commonBases.includes(fromBase.value) ? 36 : 10
  }
})

const copyResult = async (value: string, label: string) => {
  await copy(value)
  ElMessage.success(`${label}结果已复制`)
}

const fillExample = () => {
  input.value = '255.5'
  fromBase.value = 10
}
</script>

<template>
  <div class="radix-page flex flex-col mt-3 flex-1">
    <DetailHeader title="数字进制转换" />

    <section class="radix-workspace">
      <div class="workspace-toolbar">
        <label class="control-field">
          <span>输入进制</span>
          <el-select v-model="fromBase" class="base-select">
            <el-option v-for="item in baseOptions" :key="item.base" :label="item.label" :value="item.base" />
          </el-select>
        </label>
        <label class="control-field">
          <span>自定义输出进制（2-36）</span>
          <el-select v-model="customBase" filterable allow-create class="base-select">
            <el-option v-for="base in Array.from({ length: 35 }, (_, i) => i + 2)" :key="base" :label="`${base} 进制`" :value="base" />
          </el-select>
        </label>
        <div class="action-group">
          <el-button text type="primary" @click="fillExample">填充示例</el-button>
        </div>
      </div>

      <p v-if="error" class="radix-error" role="alert">{{ error }}</p>

      <div class="editor-heading">
        <label for="radix-input">输入数值</label>
        <span class="hint">支持小数与负数，可含空格或下划线分隔</span>
      </div>
      <el-input
        id="radix-input"
        v-model="input"
        size="large"
        placeholder="输入数值后自动转换为其他进制"
      />

      <div class="result-list">
        <div v-for="item in currentResults" :key="item.base" class="result-item">
          <span class="result-label">{{ item.label }}</span>
          <span class="result-value">{{ item.value }}</span>
          <el-button text type="primary" size="small" @click="copyResult(item.value, item.label)">
            复制
          </el-button>
        </div>
      </div>
    </section>

    <ToolDetail title="说明">
      <div class="radix-description">
        <p>输入一个数并选择其进制，实时得到 2/8/10/16 进制及任意 2-36 进制的结果。超过 10 的数码用小写字母表示（<code>a=10</code>、<code>b=11</code>…<code>z=35</code>）。</p>
        <p class="mt-2">支持小数与负数；整数部分使用 BigInt 精确计算，无位数限制，小数部分最多保留 32 位（有限小数自动截去多余的 0）。</p>
        <p class="mt-2">常见场景：<code>0xFF</code> 这类十六进制字面量可直接输入 <code>FF</code> 并选择 16 进制；二进制与十进制互转、IP 子网掩码换算等。</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.radix-workspace {
  padding: 20px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 18px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.control-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.base-select {
  width: 140px;
}

.action-group {
  margin-left: auto;
}

.radix-error {
  margin: 0 0 10px;
  color: var(--el-color-danger);
  font-size: 13px;
}

.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

.editor-heading label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.editor-heading .hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.result-label {
  flex-shrink: 0;
  min-width: 64px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.result-value {
  flex: 1;
  font-family: monospace;
  font-size: 15px;
  word-break: break-all;
  color: var(--el-text-color-primary);
}

.radix-description {
  line-height: 1.8;
}

.radix-description code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

@media (max-width: 760px) {
  .radix-workspace {
    padding: 14px;
  }

  .action-group {
    width: 100%;
    margin-left: 0;
  }
}
</style>
