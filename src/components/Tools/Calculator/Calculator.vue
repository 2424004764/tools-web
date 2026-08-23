<script setup lang="ts">
/**
 * 在线计算器（科学计算 + 进制转换）
 * --------------------------------------------------------
 * - 科学计算：手写 tokenizer/parser/evaluator（见 src/utils/calc.ts），
 *   支持 + - × ÷ ^ ! 括号、三角/反三角、对数/指数、π/e 常量、度弧度切换、
 *   隐式乘法（如 2pi、3sin(0)）、MC/MR/M+/M-/Ans 记忆、最近 20 条历史。
 * - 进制转换：仅 2/8/10/16 四个常用进制（高进制由 /scaletran/ 工具覆盖）。
 *   全部纯前端运算，不调用任何后端 API。
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { evaluate, formatNumber, type AngleMode } from '@/utils/calc'

// ============================================================
// 模式切换
// ============================================================
const mode = ref<'science' | 'base'>('science')

// ============================================================
// 科学计算状态
// ============================================================
const expression = ref<string>('')   // 用户输入的表达式
const livePreview = ref<string>('')  // 实时预览（输入合法时显示结果）
const errorMsg = ref<string>('')     // 语法错误提示（红色）
const angleMode = ref<AngleMode>('deg')  // 默认 deg，符合中学/大学习惯
const memory = ref<number>(0)
const ans = ref<number>(0)
const history = ref<{ expr: string; result: string }[]>([])

// 监视输入，做实时求值（仅当合法时显示预览，否则清空预览）
watch(
  [expression, angleMode, ans],
  () => {
    if (expression.value.trim() === '') {
      livePreview.value = ''
      errorMsg.value = ''
      return
    }
    const r = evaluate(expression.value, { angleMode: angleMode.value, ans: ans.value })
    if (r.ok) {
      errorMsg.value = ''
      livePreview.value = formatNumber(r.value)
    } else {
      livePreview.value = ''
      errorMsg.value = r.error
    }
  },
)

// 把人类友好符号映射到引擎可识别的字符（按钮点击时使用）
const insertText = (text: string) => {
  // 切换 token 的语义：
  //   "×" → "*"
  //   "÷" → "/"
  //   "−" → "-"
  //   "√(" → "sqrt("
  //   其它原样插入
  let mapped = text
  if (mapped === '×') mapped = '*'
  else if (mapped === '÷') mapped = '/'
  else if (mapped === '−') mapped = '-'
  else if (mapped === '√') mapped = 'sqrt'
  else if (mapped === '∛') mapped = 'cbrt'
  else if (mapped === 'π') mapped = 'pi'
  // 在光标位置插入（简化处理：直接追加，浏览体验足够）
  expression.value += mapped
}

// 等号触发：提交当前结果到 ans + 记录历史
const commit = () => {
  if (expression.value.trim() === '') return
  const r = evaluate(expression.value, { angleMode: angleMode.value, ans: ans.value })
  if (!r.ok) {
    ElMessage.error(r.error)
    return
  }
  const resultStr = formatNumber(r.value)
  ans.value = r.value
  history.value.unshift({ expr: expression.value, result: resultStr })
  if (history.value.length > 20) history.value.length = 20
  // 提交后用结果作为下一行输入，方便继续运算
  expression.value = resultStr
  livePreview.value = ''
}

const clearAll = () => {
  expression.value = ''
  livePreview.value = ''
  errorMsg.value = ''
}

const backspace = () => {
  expression.value = expression.value.slice(0, -1)
}

// +/- 取反：仅在表达式末尾是数字字面量时，把它加上负号
const negateLast = () => {
  const expr = expression.value
  // 找最后一个数字字面量的开始位置
  const m = expr.match(/(.*?)(\d+(\.\d+)?)\s*$/)
  if (m) {
    const head = m[1]
    const num = m[2]
    if (num.startsWith('-')) {
      // 已带负号：去掉
      expression.value = head + num.slice(1)
    } else {
      expression.value = head + '-' + num
    }
  } else {
    // 没数字：单纯追加负号
    expression.value += '-'
  }
}

// 记忆功能
const mc = () => { memory.value = 0 }
const mr = () => { expression.value += formatNumber(memory.value) }
const mPlus = () => {
  const r = evaluate(expression.value, { angleMode: angleMode.value, ans: ans.value })
  if (r.ok) memory.value += r.value
  else ElMessage.error('当前表达式无法加入记忆')
}
const mMinus = () => {
  const r = evaluate(expression.value, { angleMode: angleMode.value, ans: ans.value })
  if (r.ok) memory.value -= r.value
  else ElMessage.error('当前表达式无法加入记忆')
}
const insertAns = () => {
  expression.value += formatNumber(ans.value)
}
const insertPi = () => { expression.value += 'pi' }
const insertE = () => { expression.value += 'e' }
const factorialSuffix = () => { expression.value += '!' }

// 历史点击回填
const useHistory = (item: { expr: string; result: string }) => {
  // 把历史结果作为新一轮输入
  expression.value = item.result
  ans.value = parseFloat(item.result)
}
const clearHistory = () => { history.value = [] }

// 键盘事件
const onKeydown = (e: KeyboardEvent) => {
  // 当焦点在 input/textarea 时不抢键
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return

  const k = e.key
  if (k === 'Enter' || k === '=') { e.preventDefault(); commit(); return }
  if (k === 'Escape') { e.preventDefault(); clearAll(); return }
  if (k === 'Backspace') { e.preventDefault(); backspace(); return }
  if (k === 'Delete') { e.preventDefault(); clearAll(); return }

  // 数字与小数点
  if (/^[0-9.]$/.test(k)) { expression.value += k; return }
  // 运算符
  if (k === '+' || k === '-' || k === '*' || k === '/' || k === '%' || k === '^') {
    expression.value += k
    return
  }
  // 括号
  if (k === '(' || k === ')') { expression.value += k; return }
  // 阶乘
  if (k === '!') { expression.value += '!'; return }
  // p = π, e 不抢（与小写 e 常量冲突，避免误触发）
  if (k === 'p' && (e.ctrlKey || e.metaKey)) { /* ctrl+p 留给浏览器 */ return }
}

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })

// 按钮网格
interface Btn {
  label: string
  onClick: () => void
  variant?: 'op' | 'fn' | 'num' | 'eq' | 'mem' | 'danger'
  colspan?: number
}

const buttons: Btn[] = [
  { label: 'MC', onClick: mc, variant: 'mem' },
  { label: 'MR', onClick: mr, variant: 'mem' },
  { label: 'M+', onClick: mPlus, variant: 'mem' },
  { label: 'M-', onClick: mMinus, variant: 'mem' },
  { label: 'Ans', onClick: insertAns, variant: 'fn' },

  { label: 'sin', onClick: () => insertText('sin('), variant: 'fn' },
  { label: 'cos', onClick: () => insertText('cos('), variant: 'fn' },
  { label: 'tan', onClick: () => insertText('tan('), variant: 'fn' },
  { label: '(', onClick: () => insertText('('), variant: 'op' },
  { label: ')', onClick: () => insertText(')'), variant: 'op' },

  { label: 'asin', onClick: () => insertText('asin('), variant: 'fn' },
  { label: 'acos', onClick: () => insertText('acos('), variant: 'fn' },
  { label: 'atan', onClick: () => insertText('atan('), variant: 'fn' },
  { label: 'π', onClick: insertPi, variant: 'fn' },
  { label: 'e', onClick: insertE, variant: 'fn' },

  { label: 'ln', onClick: () => insertText('ln('), variant: 'fn' },
  { label: 'log₁₀', onClick: () => insertText('log10('), variant: 'fn' },
  { label: '√', onClick: () => insertText('sqrt('), variant: 'fn' },
  { label: '^', onClick: () => insertText('^'), variant: 'op' },
  { label: 'n!', onClick: factorialSuffix, variant: 'fn' },

  { label: '7', onClick: () => insertText('7'), variant: 'num' },
  { label: '8', onClick: () => insertText('8'), variant: 'num' },
  { label: '9', onClick: () => insertText('9'), variant: 'num' },
  { label: '÷', onClick: () => insertText('÷'), variant: 'op' },
  { label: '⌫', onClick: backspace, variant: 'danger' },

  { label: '4', onClick: () => insertText('4'), variant: 'num' },
  { label: '5', onClick: () => insertText('5'), variant: 'num' },
  { label: '6', onClick: () => insertText('6'), variant: 'num' },
  { label: '×', onClick: () => insertText('×'), variant: 'op' },
  { label: '%', onClick: () => insertText('%'), variant: 'op' },

  { label: '1', onClick: () => insertText('1'), variant: 'num' },
  { label: '2', onClick: () => insertText('2'), variant: 'num' },
  { label: '3', onClick: () => insertText('3'), variant: 'num' },
  { label: '−', onClick: () => insertText('-'), variant: 'op' },
  { label: '+', onClick: () => insertText('+'), variant: 'op' },

  { label: '0', onClick: () => insertText('0'), variant: 'num', colspan: 2 },
  { label: '.', onClick: () => insertText('.'), variant: 'num' },
  { label: '±', onClick: negateLast, variant: 'fn' },
  { label: '=', onClick: commit, variant: 'eq' },
]

// ============================================================
// 进制转换
// ============================================================
type Base = 2 | 8 | 10 | 16
const srcBase = ref<Base>(10)
const srcInput = ref<string>('')

const BASES: { value: Base; label: string; placeholder: string; pattern: RegExp }[] = [
  { value: 2,  label: 'BIN', placeholder: '0/1，如 1010',      pattern: /^[01]+$/ },
  { value: 8,  label: 'OCT', placeholder: '0-7，如 777',       pattern: /^[0-7]+$/ },
  { value: 10, label: 'DEC', placeholder: '0-9，如 255',       pattern: /^[0-9]+$/ },
  { value: 16, label: 'HEX', placeholder: '0-9 A-F，如 FF',    pattern: /^[0-9a-fA-F]+$/ },
]

// 把当前 srcBase 的输入解析为 10 进制整数（带 NaN 校验）
const decimalValue = computed<number | null>(() => {
  const s = srcInput.value.trim()
  if (s === '') return null
  const cfg = BASES.find(b => b.value === srcBase.value)!
  if (!cfg.pattern.test(s)) return null
  const n = parseInt(s, srcBase.value)
  if (!isFinite(n)) return null
  return n
})

const conversions = computed(() => {
  const dec = decimalValue.value
  if (dec === null) {
    return BASES.map(b => ({ base: b.value, label: b.label, value: '', valid: srcInput.value.trim() === '' || BASES.find(x => x.value === b.value)!.pattern.test(srcInput.value) }))
  }
  // 注意：这里只把源进制数字（视为无符号整数）转换；负数 / 小数不在支持范围内
  const unsigned = dec >>> 0  // 转成 32 位无符号
  return BASES.map(b => ({
    base: b.value,
    label: b.label,
    value: unsigned.toString(b.value).toUpperCase(),
    valid: true,
  }))
})

const copyConv = (val: string) => {
  if (!val) return
  copy(val)
  ElMessage.success(`已复制：${val}`)
}

const sourceValid = computed(() => {
  const s = srcInput.value.trim()
  if (s === '') return true
  return BASES.find(b => b.value === srcBase.value)!.pattern.test(s)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="在线计算器" />

    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200">
      <el-tabs v-model="mode" class="calc-tabs">
        <!-- ============================== -->
        <!-- 科学计算 -->
        <!-- ============================== -->
        <el-tab-pane label="科学计算" name="science">
          <div class="grid gap-4 lg:grid-cols-[1fr_280px]">
            <!-- 主区域：显示屏 + 按钮 -->
            <div class="space-y-4">
              <!-- 显示屏 -->
              <div class="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                <div class="flex items-center justify-between text-caption text-slate-500 mb-2">
                  <div class="flex items-center gap-3">
                    <span>角度</span>
                    <el-radio-group v-model="angleMode" size="small">
                      <el-radio-button label="deg">DEG</el-radio-button>
                      <el-radio-button label="rad">RAD</el-radio-button>
                    </el-radio-group>
                  </div>
                  <div class="flex items-center gap-3">
                    <span>记忆 M = <b class="font-mono">{{ formatNumber(memory) }}</b></span>
                  </div>
                </div>

                <!-- 输入框（实时跟随 expression） -->
                <el-input
                  v-model="expression"
                  size="large"
                  placeholder="输入表达式，如 sin(pi/2) + 2^10"
                  class="font-mono"
                >
                  <template #append>
                    <el-button-group>
                      <el-button @click="backspace">⌫</el-button>
                      <el-button type="danger" plain @click="clearAll">AC</el-button>
                    </el-button-group>
                  </template>
                </el-input>

                <!-- 实时预览 / 错误 -->
                <div class="mt-3 flex items-end justify-between gap-3 min-h-[44px]">
                  <div class="flex-1 min-w-0">
                    <div v-if="errorMsg" class="text-body-sm text-red-500 truncate" :title="errorMsg">
                      ⚠ {{ errorMsg }}
                    </div>
                    <div v-else-if="livePreview" class="flex items-baseline gap-2">
                      <span class="text-body-sm text-slate-400">=</span>
                      <span class="text-3xl font-bold text-indigo-600 truncate font-mono">{{ livePreview }}</span>
                    </div>
                    <div v-else class="text-body-sm text-slate-300">输入表达式以预览结果，回车提交</div>
                  </div>
                  <el-button type="primary" size="large" @click="commit">=</el-button>
                </div>
              </div>

              <!-- 按钮网格 -->
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="b in buttons"
                  :key="b.label"
                  class="calc-btn"
                  :class="[
                    b.variant === 'op' && 'calc-btn-op',
                    b.variant === 'fn' && 'calc-btn-fn',
                    b.variant === 'num' && 'calc-btn-num',
                    b.variant === 'eq' && 'calc-btn-eq',
                    b.variant === 'mem' && 'calc-btn-mem',
                    b.variant === 'danger' && 'calc-btn-danger',
                  ]"
                  :style="b.colspan ? { gridColumn: `span ${b.colspan} / span ${b.colspan}` } : undefined"
                  @click="b.onClick"
                >{{ b.label }}</button>
              </div>
            </div>

            <!-- 历史侧栏 -->
            <div class="p-4 rounded-xl bg-white border border-slate-200 lg:max-h-[640px] flex flex-col">
              <div class="flex items-center justify-between mb-2">
                <div class="text-body font-semibold text-slate-700">历史记录</div>
                <el-button v-if="history.length" size="small" type="danger" plain @click="clearHistory">清空</el-button>
              </div>
              <div v-if="!history.length" class="text-caption text-slate-400 text-center py-8">
                还没有计算记录
              </div>
              <div v-else class="space-y-1.5 overflow-y-auto flex-1">
                <div
                  v-for="(h, i) in history"
                  :key="i"
                  class="p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors"
                  @click="useHistory(h)"
                >
                  <div class="text-caption text-slate-500 truncate font-mono">{{ h.expr }} =</div>
                  <div class="text-body font-semibold text-indigo-600 font-mono">{{ h.result }}</div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- ============================== -->
        <!-- 进制转换 -->
        <!-- ============================== -->
        <el-tab-pane label="进制转换" name="base">
          <div class="space-y-4">
            <div class="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
              <div class="flex flex-wrap items-center gap-3 mb-3">
                <span class="text-body-sm text-slate-600">源进制：</span>
                <el-radio-group v-model="srcBase" size="default">
                  <el-radio-button :value="2">BIN 二进制</el-radio-button>
                  <el-radio-button :value="8">OCT 八进制</el-radio-button>
                  <el-radio-button :value="10">DEC 十进制</el-radio-button>
                  <el-radio-button :value="16">HEX 十六进制</el-radio-button>
                </el-radio-group>
              </div>
              <el-input
                v-model="srcInput"
                size="large"
                :placeholder="BASES.find(b => b.value === srcBase)?.placeholder"
                class="font-mono"
              >
                <template #prepend>
                  <span class="font-mono font-semibold w-12 text-center">{{ BASES.find(b => b.value === srcBase)?.label }}</span>
                </template>
              </el-input>
              <div v-if="!sourceValid" class="mt-2 text-body-sm text-red-500">
                ⚠ 输入包含当前进制不允许的字符（{{ srcBase === 2 ? '只能 0/1' : srcBase === 8 ? '只能 0-7' : srcBase === 16 ? '只能 0-9 A-F' : '只能 0-9' }}）
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="c in conversions"
                :key="c.base"
                class="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-body-sm font-semibold text-slate-700">{{ c.label }} <span class="text-slate-400 text-caption">({{ c.base }} 进制)</span></span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :disabled="!c.value"
                    @click="copyConv(c.value)"
                  >复制</el-button>
                </div>
                <div
                  class="font-mono text-h2 break-all"
                  :class="c.value ? 'text-indigo-600' : 'text-slate-300'"
                >{{ c.value || '—' }}</div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <ToolDetail title="使用说明">
      <el-text>
        在线计算器集成了 <b>科学计算</b> 与 <b>常用进制转换</b> 两种模式（顶部 Tab 切换），全部在浏览器本地完成，不会上传任何数据。
        <br /><br />
        <b>科学计算：</b>
        支持四则运算 + 括号 + 一元负号，三角函数（sin/cos/tan 与反三角 asin/acos/atan）、双曲函数（sinh/cosh/tanh），
        对数与指数（ln/log10/log₂/√/∛/e^x/2^x/10^x）、n! 阶乘、|x| 绝对值、x²/x³/x^y，常量 π 与 e，支持隐式乘法（如 <code>2pi</code>、<code>2(3+4)</code>、<code>3sin(0)</code>）。
        顶部可切换 <b>DEG / RAD</b> 度弧度（默认 DEG，更贴合中学与日常使用）。
        MC/MR/M+/M- 是记忆键，<b>Ans</b> 自动填入上一条结果，历史记录最多保留 20 条，点击历史项可快速复用结果。
        <br /><br />
        <b>键盘快捷键：</b>数字/运算符/括号可直接键入，回车（Enter）求值，Backspace 删除一位，Esc 或 Delete 清空，<code>!</code> 输入阶乘。
        <br /><br />
        <b>进制转换：</b>仅支持常用的 2 / 8 / 10 / 16 进制互转（无符号整数）。如需 32 / 58 / 62 / 64 等高进制，请使用
        <a href="/scaletran/" class="text-indigo-500 underline">常用进制转换</a> 工具。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 按钮基础样式 */
.calc-btn {
  height: 48px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 16px;
  border: 1px solid theme('colors.slate.200');
  background: #fff;
  color: theme('colors.slate.700');
  cursor: pointer;
  transition: all 120ms ease;
  user-select: none;
}
.calc-btn:hover { background: theme('colors.slate.50'); border-color: theme('colors.slate.300'); }
.calc-btn:active { transform: scale(0.97); }

.calc-btn-num { background: #fff; }
.calc-btn-op {
  background: theme('colors.indigo.50');
  color: theme('colors.indigo.700');
  border-color: theme('colors.indigo.200');
}
.calc-btn-op:hover { background: theme('colors.indigo.100'); }
.calc-btn-fn {
  background: theme('colors.slate.100');
  color: theme('colors.slate.700');
  font-size: 14px;
}
.calc-btn-fn:hover { background: theme('colors.slate.200'); }
.calc-btn-mem {
  background: theme('colors.amber.50');
  color: theme('colors.amber.700');
  border-color: theme('colors.amber.200');
  font-size: 14px;
}
.calc-btn-mem:hover { background: theme('colors.amber.100'); }
.calc-btn-eq {
  background: theme('colors.indigo.500');
  color: #fff;
  border-color: theme('colors.indigo.500');
  font-size: 22px;
}
.calc-btn-eq:hover { background: theme('colors.indigo.600'); }
.calc-btn-danger {
  background: theme('colors.rose.50');
  color: theme('colors.rose.600');
  border-color: theme('colors.rose.200');
}
.calc-btn-danger:hover { background: theme('colors.rose.100'); }

/* Tabs 间距 */
.calc-tabs :deep(.el-tabs__nav-wrap::after) { background: theme('colors.slate.100'); }
.calc-tabs :deep(.el-tabs__item) { font-weight: 500; }
</style>
