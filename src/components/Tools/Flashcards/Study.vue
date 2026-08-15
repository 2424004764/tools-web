<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'
import {
  fetchDueQueue,
  reviewCard,
  type Flashcard,
  type DueQueueResponse,
  type FlashcardReviewResponse,
} from '@/api/flashcards'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const deckId = computed(() => String(route.params.id || ''))
const loading = ref(true)
const queueInfo = ref<DueQueueResponse | null>(null)
const queue = ref<Flashcard[]>([])
const currentIdx = ref(0)
const flipped = ref(false)
const submitting = ref(false)

// 当次复习小结
const sessionStart = ref<number>(0)
const sessionStats = ref({
  reviewed: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
  ms: 0,
})

// 复习后的预览（来自后端 response.preview）
const preview = ref<FlashcardReviewResponse['preview'] | null>(null)
const lastGrade = ref<number | null>(null)

const current = computed<Flashcard | undefined>(() => queue.value[currentIdx.value])

const progress = computed(() => {
  if (!queue.value.length) return { done: 0, total: 0, pct: 0 }
  const total = queue.value.length
  const done = currentIdx.value
  return { done, total, pct: Math.round((done / total) * 100) }
})

const finished = computed(() => queueInfo.value !== null && queue.value.length > 0 && currentIdx.value >= queue.value.length)

async function load() {
  if (!userStore.getLoginStatus) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const data = await fetchDueQueue(deckId.value, 200)
    queueInfo.value = data
    queue.value = data.queue
    sessionStart.value = Date.now()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function flip() {
  if (!current.value) return
  flipped.value = !flipped.value
}

async function grade(g: 0 | 3 | 4 | 5) {
  if (!current.value || submitting.value) return
  submitting.value = true
  lastGrade.value = g
  try {
    const res = await reviewCard(current.value.id, g)
    // 累计本次小结
    sessionStats.value.reviewed += 1
    if (g === 0) sessionStats.value.again += 1
    else if (g === 3) sessionStats.value.hard += 1
    else if (g === 4) sessionStats.value.good += 1
    else if (g === 5) sessionStats.value.easy += 1

    preview.value = res.preview

    // 短暂停顿展示上次反馈 → 进入下一张
    setTimeout(() => {
      preview.value = null
      lastGrade.value = null
      currentIdx.value += 1
      flipped.value = false
      submitting.value = false
    }, 280)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '提交失败')
    submitting.value = false
  }
}

function endSession() {
  sessionStats.value.ms = Date.now() - sessionStart.value
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  return `${m} 分 ${s % 60} 秒`
}

function reload() {
  currentIdx.value = 0
  flipped.value = false
  sessionStats.value = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0, ms: 0 }
  load()
}

function backToManage() {
  router.push(`/flashcards/deck/${deckId.value}/`)
}

function onKey(e: KeyboardEvent) {
  if (finished.value || loading.value || !current.value) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space') {
    e.preventDefault()
    flip()
  } else if (e.code === 'Digit1' || e.key === '1') {
    grade(0)
  } else if (e.code === 'Digit2' || e.key === '2') {
    grade(3)
  } else if (e.code === 'Digit3' || e.key === '3') {
    grade(4)
  } else if (e.code === 'Digit4' || e.key === '4') {
    grade(5)
  }
}

onMounted(() => {
  userStore.initUserState()
  load()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})

// 监听 finished 触发一次小结时间统计
import { watch } from 'vue'
watch(finished, (v) => {
  if (v) endSession()
})
</script>

<template>
  <div>
    <ToolDetail title="闪卡复习 - 学习模式" id="flashcards-study">
      <template #default>
        <div v-if="loading" class="py-12 text-center text-text-secondary">加载复习队列中...</div>

        <div v-else-if="!queueInfo || queue.length === 0" class="py-12 text-center">
          <div class="text-base">🎉 今日复习已完成</div>
          <div class="mt-1 text-sm text-text-secondary">
            该卡组暂无到期卡片。<span v-if="queueInfo?.deck">（{{ queueInfo.deck.name }}）</span>
          </div>
          <el-button class="mt-4" @click="backToManage">返回卡组</el-button>
        </div>

        <div v-else-if="finished">
          <!-- 复习完成小结 -->
          <div class="rounded-2xl border border-border-subtle bg-white p-6">
            <div class="text-center text-lg font-medium">🎉 本次复习已完成</div>
            <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div class="rounded-lg bg-slate-50 p-3 text-center">
                <div class="text-2xl font-semibold">{{ sessionStats.reviewed }}</div>
                <div class="text-xs text-text-secondary">复习总数</div>
              </div>
              <div class="rounded-lg bg-primary-50 p-3 text-center">
                <div class="text-2xl font-semibold text-primary-700">{{ fmtDuration(sessionStats.ms) }}</div>
                <div class="text-xs text-text-secondary">耗时</div>
              </div>
              <div class="rounded-lg bg-rose-50 p-3 text-center">
                <div class="text-2xl font-semibold text-rose-700">{{ sessionStats.again }}</div>
                <div class="text-xs text-text-secondary">忘记</div>
              </div>
              <div class="rounded-lg bg-emerald-50 p-3 text-center">
                <div class="text-2xl font-semibold text-emerald-700">
                  {{ sessionStats.good + sessionStats.easy }}
                </div>
                <div class="text-xs text-text-secondary">良好 + 简单</div>
              </div>
            </div>
            <div class="mt-4 flex justify-center gap-2">
              <el-button @click="backToManage">返回卡组</el-button>
              <el-button type="primary" @click="reload">再刷一次</el-button>
            </div>
          </div>
        </div>

        <div v-else>
          <!-- 进度条 -->
          <div class="mb-3 flex items-center gap-3 text-xs text-text-secondary">
            <span>{{ progress.done + 1 }} / {{ progress.total }}</span>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full bg-primary-500 transition-all" :style="{ width: `${progress.pct}%` }" />
            </div>
            <span>到期 {{ queueInfo?.review_count }} · 新卡 {{ queueInfo?.new_count }}</span>
          </div>

          <!-- 卡片 -->
          <div
            class="min-h-[260px] cursor-pointer rounded-2xl border border-border-subtle bg-white p-6 transition hover:border-primary-300"
            @click="flip"
          >
            <div class="mb-2 flex items-center justify-between text-xs text-text-secondary">
              <span>{{ flipped ? '点击翻转 / 空格' : '点击或按空格查看答案' }}</span>
              <span v-if="current?.repetitions === 0" class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">新卡</span>
              <span v-else>间隔 {{ current?.interval_days }} 天 · rep {{ current?.repetitions }} · ease {{ Number(current?.ease_factor || 0).toFixed(2) }}</span>
            </div>

            <div class="my-4 whitespace-pre-wrap break-words text-lg leading-relaxed text-text-primary">
              {{ flipped ? current?.back : current?.front }}
            </div>

            <div v-if="preview && lastGrade !== null" class="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs">
              <div class="font-medium text-primary-700">
                已记录为
                <span v-if="lastGrade === 0">忘记</span>
                <span v-else-if="lastGrade === 3">困难</span>
                <span v-else-if="lastGrade === 4">良好</span>
                <span v-else-if="lastGrade === 5">简单</span>
                · 新间隔 {{ preview.find((p) => p.grade === lastGrade)?.label }}
              </div>
            </div>
          </div>

          <!-- 评级按钮 -->
          <div v-if="flipped" class="mt-4 grid grid-cols-4 gap-2">
            <button
              class="rounded-xl border-2 border-rose-300 bg-rose-50 px-3 py-3 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              :disabled="submitting"
              @click="grade(0)"
            >
              <div class="text-sm font-semibold">忘记</div>
              <div class="mt-1 text-xs">1 · 立即</div>
            </button>
            <button
              class="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-3 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
              :disabled="submitting"
              @click="grade(3)"
            >
              <div class="text-sm font-semibold">困难</div>
              <div class="mt-1 text-xs">2 · 间隔缩短</div>
            </button>
            <button
              class="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-3 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              :disabled="submitting"
              @click="grade(4)"
            >
              <div class="text-sm font-semibold">良好</div>
              <div class="mt-1 text-xs">3 · 正常推进</div>
            </button>
            <button
              class="rounded-xl border-2 border-blue-300 bg-blue-50 px-3 py-3 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              :disabled="submitting"
              @click="grade(5)"
            >
              <div class="text-sm font-semibold">简单</div>
              <div class="mt-1 text-xs">4 · 间隔拉长</div>
            </button>
          </div>

          <div v-else class="mt-4 text-center text-xs text-text-secondary">
            看完问题后点击卡片 / 按空格键查看答案
          </div>

          <div class="mt-3 text-center text-xs text-text-secondary">
            快捷键：<b>空格</b> 翻转 · <b>1</b> 忘记 · <b>2</b> 困难 · <b>3</b> 良好 · <b>4</b> 简单
          </div>
        </div>
      </template>
    </ToolDetail>
  </div>
</template>