<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '随机点名器'

const STORAGE_KEY = 'roll-call-state-v1'

const DEFAULT_NAMES = ['张伟', '王芳', '李娜', '刘洋', '陈静', '杨帆', '赵磊', '黄敏', '周杰', '吴优'].join('\n')

const namesText = ref(DEFAULT_NAMES)
const pickCount = ref(1)
const rolling = ref(false)
const display = ref('')
const picked = ref<string[]>([])
const history = ref<string[][]>([])
const noRepeat = ref(true)
const rollSpeed = ref(60)
const autoStop = ref(false)
const autoStopSeconds = ref(5)
const countdown = ref(0)

// 名单与配置本地持久化，刷新不丢失；仅在首次访问（无存档）时使用示例名单
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as {
      namesText?: string
      pickCount?: number
      noRepeat?: boolean
      autoStop?: boolean
      autoStopSeconds?: number
      picked?: string[]
      history?: string[][]
    }
    if (typeof saved.namesText === 'string') namesText.value = saved.namesText
    if (typeof saved.pickCount === 'number' && saved.pickCount >= 1) pickCount.value = Math.min(20, Math.round(saved.pickCount))
    if (typeof saved.noRepeat === 'boolean') noRepeat.value = saved.noRepeat
    if (typeof saved.autoStop === 'boolean') autoStop.value = saved.autoStop
    if (typeof saved.autoStopSeconds === 'number' && saved.autoStopSeconds >= 1) autoStopSeconds.value = Math.min(120, Math.round(saved.autoStopSeconds))
    if (Array.isArray(saved.picked)) picked.value = saved.picked.filter((n) => typeof n === 'string')
    if (Array.isArray(saved.history)) {
      history.value = saved.history
        .filter((r) => Array.isArray(r))
        .map((r) => r.filter((n) => typeof n === 'string'))
    }
  }
} catch {
  // 存档损坏时忽略，使用默认值
}

watch(
  [namesText, pickCount, noRepeat, autoStop, autoStopSeconds, picked, history],
  () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          namesText: namesText.value,
          pickCount: pickCount.value,
          noRepeat: noRepeat.value,
          autoStop: autoStop.value,
          autoStopSeconds: autoStopSeconds.value,
          picked: picked.value,
          history: history.value.slice(0, 100),
        }),
      )
    } catch {
      // ignore quota / private mode
    }
  },
  { deep: true },
)

const names = computed(() =>
  namesText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean),
)

const pool = computed(() => {
  if (!noRepeat.value) return names.value
  const chosen = new Set(picked.value)
  const rest = names.value.filter((n) => !chosen.has(n))
  return rest.length >= pickCount.value ? rest : names.value
})

let timer = 0
let stopTimer = 0

const rollOnce = () => {
  const list = pool.value
  const n = Math.min(pickCount.value, list.length)
  const chosen: string[] = []
  const candidates = [...list]
  for (let i = 0; i < n; i++) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const idx = buf[0] % candidates.length
    chosen.push(candidates[idx])
    candidates.splice(idx, 1)
  }
  return chosen
}

const startRoll = () => {
  const list = pool.value
  if (list.length < pickCount.value) {
    ElMessage.warning(`名单人数不足（剩余 ${list.length} 人，需要 ${pickCount.value} 人）`)
    return
  }
  if (rolling.value) return
  rolling.value = true
  const secs = Math.min(120, Math.max(1, Math.round(autoStopSeconds.value || 5)))
  const endAt = autoStop.value ? Date.now() + secs * 1000 : 0
  if (endAt) stopTimer = window.setTimeout(stopRoll, secs * 1000)
  timer = window.setInterval(() => {
    const chosen = rollOnce()
    display.value = chosen.join('、')
    countdown.value = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : 0
  }, rollSpeed.value)
}

const stopRoll = () => {
  if (!rolling.value) return
  window.clearInterval(timer)
  window.clearTimeout(stopTimer)
  rolling.value = false
  countdown.value = 0
  const chosen = rollOnce()
  display.value = chosen.join('、')
  picked.value.push(...chosen)
  history.value.unshift(chosen)
}

onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.clearTimeout(stopTimer)
})

const resetPicked = () => {
  picked.value = []
  history.value = []
  display.value = ''
  ElMessage.success('已重置，所有名字重新进入抽取池')
}

const clearAll = () => {
  if (!namesText.value && !history.value.length && !picked.value.length) return
  ElMessageBox.confirm(
    '将清空名单、点名记录，并删除浏览器中本地保存的数据，确定清空吗？',
    '清空名单',
    { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' },
  )
    .then(() => {
      namesText.value = ''
      picked.value = []
      history.value = []
      display.value = ''
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      ElMessage.success('已清空名单与本地保存的数据')
    })
    .catch(() => {})
}

const stats = computed(() => ({
  total: names.value.length,
  remaining: pool.value.length,
  pickedCount: picked.value.length,
}))

const pickedSummary = computed(() => picked.value.join('、'))
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">随机点名器</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          导入名单随机点名，滚动动画抽取，支持一次抽多人、不重复模式、定时自动停止与点名记录，名单本地自动保存，适合课堂提问和活动抽奖。
        </p>
      </header>

      <div class="roll-layout">
        <aside class="roll-side">
          <div class="roll-field">
            <div class="roll-field-head">
              <label>名单（每行一个）</label>
              <div class="roll-field-head-right">
                <span class="text-body-sm text-slate-500">{{ stats.total }} 人</span>
                <el-button text type="danger" size="small" @click="clearAll">清空</el-button>
              </div>
            </div>
            <el-input
              v-model="namesText"
              type="textarea"
              :rows="12"
              placeholder="每行一个名字，也可粘贴整段用换行分隔"
            />
          </div>

          <div class="roll-option">
            <span class="text-body-sm text-slate-500">一次抽取</span>
            <el-input-number v-model="pickCount" :min="1" :max="20" />
          </div>
          <div class="roll-option">
            <span class="text-body-sm text-slate-500">自动停止</span>
            <div class="roll-option-auto">
              <el-switch v-model="autoStop" />
              <el-input-number v-model="autoStopSeconds" :min="1" :max="120" :disabled="!autoStop" />
              <span class="text-body-sm text-slate-500">秒</span>
            </div>
          </div>
          <el-checkbox v-model="noRepeat">不重复抽取（抽过的人不再进入候选）</el-checkbox>
          <el-button text type="danger" @click="resetPicked">重置抽取记录</el-button>
        </aside>

        <div class="roll-main">
          <div class="roll-display" :class="{ 'roll-display-rolling': rolling }">
            <template v-if="display">{{ display }}</template>
            <template v-else>点击「开始点名」</template>
          </div>

          <div class="roll-actions">
            <el-button v-if="!rolling" type="primary" size="large" @click="startRoll">开始点名</el-button>
            <el-button v-else type="danger" size="large" @click="stopRoll">停 止</el-button>
            <span v-if="rolling && autoStop" class="roll-countdown">{{ countdown }} 秒后自动停止</span>
            <span class="text-body-sm text-slate-500">
              共 {{ stats.total }} 人 · 候选 {{ stats.remaining }} 人 · 已抽 {{ stats.pickedCount }} 人
            </span>
          </div>

          <div v-if="history.length" class="roll-history">
            <div class="roll-history-head">
              <span>点名记录（{{ history.length }} 次）</span>
              <span v-if="pickedSummary" class="roll-history-picked">已抽到：{{ pickedSummary }}</span>
            </div>
            <div class="roll-history-list">
              <div v-for="(round, i) in history.slice(0, 30)" :key="i" class="roll-history-row">
                <span class="roll-history-index">第 {{ history.length - i }} 次</span>
                <span class="roll-history-names">{{ round.join('、') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        在左侧粘贴名单（每行一个名字），设置一次抽取的人数后点击「开始点名」，名字会快速滚动，点击「停止」选出结果。开启「自动停止」并设定秒数（1-120 秒）后，滚动会在倒计时结束时自动停止并公布结果，滚动过程中也会显示剩余秒数，随时仍可手动停止。默认开启「不重复抽取」：抽过的人自动移出候选池，全部抽完会自动回到完整名单并提示；关闭后每次都从全名单抽取。右侧展示每轮点名记录与累计已抽名单。名单与点名记录自动保存在本浏览器中（localStorage），刷新或下次打开不会丢失，也不会上传到服务器。如名单含敏感信息，可点击名单右上角「清空」一键删除名单、记录及本地保存的数据。随机数来自浏览器 crypto 接口，公平且全部本地运行。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.roll-layout {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.5fr);
  gap: 24px;
  align-items: start;
}

.roll-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.roll-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.roll-field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.roll-field-head-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.roll-field-head label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.roll-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.roll-option-auto {
  display: flex;
  align-items: center;
  gap: 8px;
}

.roll-countdown {
  font-size: 13px;
  color: var(--el-color-danger);
  font-variant-numeric: tabular-nums;
}

.roll-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.roll-display {
  display: flex;
  min-height: 130px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  font-size: 40px;
  font-weight: 700;
  color: var(--el-color-primary);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
}

.roll-display-rolling {
  color: var(--el-text-color-secondary);
  font-size: 30px;
}

.roll-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.roll-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.roll-history-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.roll-history-picked {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.roll-history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.roll-history-row {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}

.roll-history-index {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.roll-history-names {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

@media (max-width: 1023px) {
  .roll-layout {
    grid-template-columns: 1fr;
  }

  .roll-display {
    font-size: 30px;
    min-height: 100px;
  }
}
</style>
