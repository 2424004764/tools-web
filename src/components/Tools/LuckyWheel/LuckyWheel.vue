<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '抽奖转盘'

const entriesText = ref(
  ['一等奖', '二等奖', '三等奖', '谢谢参与', '再来一次', '谢谢参与'].join('\n'),
)
const spinning = ref(false)
const rotation = ref(0)
const result = ref('')
const history = ref<string[]>([])
const removeWinner = ref(false)

const entries = computed(() =>
  entriesText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12),
)

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6',
]

const canvasRef = ref<HTMLCanvasElement>()
const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = CENTER - 6

const drawWheel = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = SIZE * dpr
  canvas.height = SIZE * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, SIZE, SIZE)

  const list = entries.value
  const n = list.length
  const startAngle = -Math.PI / 2 // 指针在正上方

  if (n === 0) {
    ctx.beginPath()
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = '#f1f5f9'
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('请先添加奖项', CENTER, CENTER)
    return
  }

  const arc = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const from = startAngle + i * arc
    ctx.beginPath()
    ctx.moveTo(CENTER, CENTER)
    ctx.arc(CENTER, CENTER, RADIUS, from, from + arc)
    ctx.closePath()
    ctx.fillStyle = COLORS[i % COLORS.length]
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.stroke()

    // 文字沿扇区中线绘制
    const mid = from + arc / 2
    ctx.save()
    ctx.translate(CENTER + Math.cos(mid) * RADIUS * 0.62, CENTER + Math.sin(mid) * RADIUS * 0.62)
    ctx.rotate(mid + Math.PI / 2)
    // 左半边的文字旋转 180°，保持头朝外可读
    if (Math.cos(mid) < 0) ctx.rotate(Math.PI)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = list[i].length > 6 ? list[i].slice(0, 6) + '…' : list[i]
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }

  // 中心圆（GO 按钮由 HTML 层提供，不画在 canvas 上，避免旋转时透出重影）
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, 34, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 3
  ctx.stroke()
}

watch(entries, () => drawWheel(), { flush: 'post' })

onMounted(() => drawWheel())

let rafId = 0
let watchdogId = 0

const spin = () => {
  const list = entries.value
  if (list.length < 2) {
    ElMessage.warning('至少需要 2 个选项')
    return
  }
  if (spinning.value) return
  spinning.value = true
  result.value = ''

  // crypto 级随机决定中奖扇区
  const randBuf = new Uint32Array(1)
  crypto.getRandomValues(randBuf)
  const index = randBuf[0] % list.length
  const n = list.length
  const arc = 360 / n
  // 转盘坐标系：扇区 i 中心位于 -90° + (i+0.5)*arc；指针固定在正上方 -90°，
  // 因此需要 rotation ≡ -(index+0.5)*arc (mod 360)，jitter 让停点不完全居中
  const jitter = (Math.random() - 0.5) * arc * 0.7
  const targetMod = (-(index + 0.5) * arc - jitter) % 360
  const current = rotation.value
  const currentMod = ((current % 360) + 360) % 360
  let delta = ((targetMod - currentMod) % 360 + 360) % 360
  const total = delta + 360 * 6 // 额外转 6 圈

  const duration = 4200
  const startTime = performance.now()
  const from = current
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(rafId)
    window.clearTimeout(watchdogId)
    rotation.value = from + total
    spinning.value = false
    const winner = list[index]
    result.value = winner
    history.value.unshift(winner)
    if (removeWinner.value && list.length > 2) {
      entriesText.value = list.filter((_, i) => i !== index).join('\n')
    }
  }

  // 标签页在后台时 requestAnimationFrame 会被暂停，watchdog 保证结果一定产出
  watchdogId = window.setTimeout(finish, duration + 800)

  const animate = (now: number) => {
    if (finished) return
    const t = Math.min(1, (now - startTime) / duration)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3)
    rotation.value = from + total * eased
    if (t < 1) {
      rafId = requestAnimationFrame(animate)
    } else {
      finish()
    }
  }
  rafId = requestAnimationFrame(animate)
}

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.clearTimeout(watchdogId)
})

const reset = () => {
  history.value = []
  result.value = ''
  rotation.value = 0
}

const wrapStyle = computed(() => ({ transform: `rotate(${rotation.value}deg)` }))
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">抽奖转盘</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          输入选项生成大转盘，点击 GO 旋转抽奖，支持结果记录与中奖自动移除，适合团建、课堂抽奖。
        </p>
      </header>

      <div class="wheel-layout">
        <div class="wheel-stage">
          <div class="wheel-box">
            <div class="wheel-pointer" />
            <div class="wheel-wrap" :style="wrapStyle">
              <canvas ref="canvasRef" :style="{ width: SIZE + 'px', height: SIZE + 'px' }" />
            </div>
            <button
              type="button"
              class="wheel-go"
              :class="{ 'is-spinning': spinning }"
              :disabled="spinning || entries.length < 2"
              @click="spin"
            >
              <span v-if="spinning" class="wheel-spinner" />
              <template v-else>GO</template>
            </button>
          </div>

          <div class="wheel-result">
            <template v-if="spinning">正在旋转…</template>
            <template v-else-if="result">🎉 恭喜抽中：<strong>{{ result }}</strong></template>
            <template v-else>点击 GO 开始抽奖</template>
          </div>
        </div>

        <aside class="wheel-side">
          <div class="wheel-field">
            <div class="wheel-field-head">
              <label>奖项列表（每行一个，最多 12 个）</label>
              <span class="text-body-sm text-slate-500">{{ entries.length }} 项</span>
            </div>
            <el-input
              v-model="entriesText"
              type="textarea"
              :rows="9"
              placeholder="每行一个选项，例如：&#10;一等奖&#10;二等奖&#10;谢谢参与"
            />
          </div>
          <el-checkbox v-model="removeWinner">抽中后自动移除该选项</el-checkbox>

          <div class="wheel-history">
            <div class="wheel-history-head">
              <span>抽奖记录</span>
              <el-button size="small" text type="danger" :disabled="!history.length" @click="reset">清空重来</el-button>
            </div>
            <div v-if="history.length" class="wheel-history-list">
              <el-tag v-for="(h, i) in history.slice(0, 20)" :key="i" class="wheel-history-tag" type="info">
                {{ i + 1 }}. {{ h }}
              </el-tag>
            </div>
            <p v-else class="text-body-sm text-slate-400">暂无记录</p>
          </div>
        </aside>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        在右侧输入奖项（每行一个，2~12 个），转盘会实时重绘。点击 GO 后转盘旋转约 4 秒并随机停在某个扇区，结果与历史记录在下方展示；勾选「抽中后自动移除」适合多人轮流抽奖（如吃饭点名）。中奖结果由浏览器 crypto 随机数产生，公平公正，全部在本地运行。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.wheel-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 24px;
  align-items: start;
}

.wheel-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wheel-box {
  position: relative;
}

.wheel-wrap {
  position: relative;
  transition: none;
}

.wheel-pointer {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 24px solid #334155;
  z-index: 3;
  filter: drop-shadow(0 2px 2px rgb(0 0 0 / 25%));
}

.wheel-go {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  box-shadow: 0 2px 10px rgb(0 0 0 / 20%);
  transition: transform 0.15s;
}

.wheel-go:hover:not(:disabled) {
  transform: translate(-50%, -50%) scale(1.08);
}

.wheel-go:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 旋转中保持不透明，避免透出转盘中心 */
.wheel-go.is-spinning {
  opacity: 1;
}

.wheel-spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 3px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  animation: wheel-spin 0.8s linear infinite;
}

@keyframes wheel-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ⚠️ prefers-reduced-motion 例外：系统开启「减弱动态效果」（如 Windows 关闭动画效果）时，
   tailwind.css 的全局媒体查询会把所有 CSS 动画冻结成 0.01ms 单次。
   loading 指示器不动，用户就感知不到「正在旋转」——这里单独放行这一个加载动画，
   与 AiImageEdit、LedDisplay 的处理方式一致。 */
@media (prefers-reduced-motion: reduce) {
  .wheel-spinner {
    animation-duration: 0.8s !important;
    animation-iteration-count: infinite !important;
  }
}

.wheel-result {
  margin-top: 16px;
  min-height: 28px;
  font-size: 16px;
  color: var(--el-text-color-primary);
  text-align: center;
}

.wheel-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.wheel-field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.wheel-field-head label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.wheel-history {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wheel-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.wheel-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

@media (max-width: 1023px) {
  .wheel-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 639px) {
  .wheel-wrap canvas {
    width: 280px !important;
    height: 280px !important;
  }
}
</style>
