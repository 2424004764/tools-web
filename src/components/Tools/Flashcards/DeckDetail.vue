<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'
import {
  fetchDeck,
  fetchCards,
  fetchStats,
  createCard,
  updateCard,
  deleteCard,
  updateDeck,
  type Flashcard,
  type FlashcardDeck,
  type FlashcardStats,
} from '@/api/flashcards'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const deckId = computed(() => String(route.params.id || ''))
const deck = ref<FlashcardDeck | null>(null)
const cards = ref<Flashcard[]>([])
const stats = ref<FlashcardStats | null>(null)
const loading = ref(false)
const activeTab = ref('cards')

// 编辑卡组
const showDeckEdit = ref(false)
const deckForm = ref({ name: '', description: '', daily_new_limit: 20 })
const savingDeck = ref(false)

// 新建卡片
const showCreate = ref(false)
const creating = ref(false)
const cardForm = ref({ front: '', back: '' })

// 编辑卡片
const editingCard = ref<Flashcard | null>(null)
const editForm = ref({ front: '', back: '', is_suspended: false })
const savingEdit = ref(false)

async function loadAll() {
  if (!userStore.getLoginStatus || !deckId.value) return
  loading.value = true
  try {
    const [d, c, s] = await Promise.all([
      fetchDeck(deckId.value),
      fetchCards(deckId.value),
      fetchStats(deckId.value).catch(() => null),
    ])
    deck.value = d
    cards.value = c
    stats.value = s
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openDeckEdit() {
  if (!deck.value) return
  deckForm.value = {
    name: deck.value.name,
    description: deck.value.description,
    daily_new_limit: deck.value.daily_new_limit,
  }
  showDeckEdit.value = true
}

async function onSaveDeck() {
  savingDeck.value = true
  try {
    await updateDeck(deckId.value, {
      name: deckForm.value.name.trim(),
      description: deckForm.value.description.trim(),
      daily_new_limit: deckForm.value.daily_new_limit,
    })
    ElMessage.success('已保存')
    showDeckEdit.value = false
    await loadAll()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  } finally {
    savingDeck.value = false
  }
}

function openCreateCard() {
  cardForm.value = { front: '', back: '' }
  showCreate.value = true
}

async function onCreateCard() {
  if (!cardForm.value.front.trim() || !cardForm.value.back.trim()) {
    ElMessage.warning('正面与背面均不能为空')
    return
  }
  creating.value = true
  try {
    await createCard(deckId.value, {
      front: cardForm.value.front.trim(),
      back: cardForm.value.back.trim(),
    })
    ElMessage.success('已添加')
    showCreate.value = false
    await loadAll()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '添加失败')
  } finally {
    creating.value = false
  }
}

function openEditCard(card: Flashcard) {
  editingCard.value = card
  editForm.value = {
    front: card.front,
    back: card.back,
    is_suspended: card.is_suspended === 1,
  }
}

async function onSaveCard() {
  if (!editingCard.value) return
  if (!editForm.value.front.trim() || !editForm.value.back.trim()) {
    ElMessage.warning('正面与背面均不能为空')
    return
  }
  savingEdit.value = true
  try {
    await updateCard(editingCard.value.id, {
      front: editForm.value.front.trim(),
      back: editForm.value.back.trim(),
      is_suspended: editForm.value.is_suspended,
    })
    ElMessage.success('已保存')
    editingCard.value = null
    await loadAll()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  } finally {
    savingEdit.value = false
  }
}

async function onDeleteCard(card: Flashcard) {
  try {
    await ElMessageBox.confirm('确认删除该卡片？复习记录会一并删除。', '删除卡片', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteCard(card.id)
    ElMessage.success('已删除')
    await loadAll()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

function gotoStudy() {
  router.push(`/flashcards/deck/${deckId.value}/study/`)
}

function fmtDate(ts: number) {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('zh-CN')
}

function relativeDays(ts: number) {
  const diff = ts - Date.now()
  const days = Math.round(diff / (24 * 60 * 60 * 1000))
  if (days <= 0) return '今日到期'
  if (days === 1) return '明天到期'
  return `${days} 天后到期`
}

const statsMax = computed(() => {
  if (!stats.value) return 1
  return Math.max(1, ...stats.value.reviews_30d.map((r) => r.count))
})

onMounted(() => {
  userStore.initUserState()
  loadAll()
})
</script>

<template>
  <div>

    <DetailHeader title="使用提示" class="mt-4">
      <div class="space-y-2 text-sm leading-relaxed text-text-secondary">
        <div>• <b>正面</b>写问题 / 关键词，<b>背面</b>写答案 / 解释。尽量简洁、可独立理解。</div>
        <div>• 支持 Markdown：`**加粗**`、`*斜体*`、`` `代码` ``、`- 列表`、`# 标题`、链接等。</div>
        <div>• 单卡编辑后请用「保存」按钮；暂停卡片不会出现在复习队列中。</div>
        <div>• 数据按用户隔离，仅自己可见；删除卡组会级联清空所有卡片与复习记录。</div>
      </div>
    </DetailHeader>

    <ToolDetail :title="deck ? `卡组：${deck.name}` : '卡组详情'" id="flashcards-detail">
      <template #default>
        <div v-if="loading" class="py-10 text-center text-text-secondary">加载中...</div>
        <div v-else-if="!deck" class="py-10 text-center text-text-secondary">卡组不存在或已被删除</div>
        <div v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-base font-medium text-text-primary">{{ deck.name }}</div>
              <div v-if="deck.description" class="mt-1 text-xs text-text-secondary">{{ deck.description }}</div>
              <div class="mt-1 text-xs text-text-secondary">
                共 {{ deck.total_cards }} 张 · 每日新卡上限 {{ deck.daily_new_limit }} · 今日到期 {{ deck.due_today }}
              </div>
            </div>
            <div class="flex shrink-0 gap-2">
              <el-button size="small" @click="openDeckEdit">编辑卡组</el-button>
              <el-button size="small" type="primary" :disabled="deck.total_cards === 0" @click="gotoStudy">开始复习</el-button>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="mt-4">
            <!-- ============ 卡片管理 ============ -->
            <el-tab-pane label="卡片管理" name="cards">
              <div class="mb-3 flex items-center justify-between">
                <div class="text-sm text-text-secondary">共 {{ cards.length }} 张</div>
                <el-button type="primary" size="small" @click="openCreateCard">+ 添加卡片</el-button>
              </div>

              <div v-if="cards.length === 0" class="py-10 text-center text-text-secondary">
                <div>还没有卡片</div>
                <div class="mt-1 text-xs">点击「添加卡片」录入第一张</div>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(card, idx) in cards"
                  :key="card.id"
                  class="rounded-xl border border-border-subtle bg-white p-3"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 text-xs text-text-secondary">
                        <span>#{{ idx + 1 }}</span>
                        <span
                          v-if="card.is_suspended === 1"
                          class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
                        >已暂停</span>
                        <span v-else>{{ relativeDays(card.due_at) }}</span>
                        <span>间隔 {{ card.interval_days }} 天</span>
                        <span>rep {{ card.repetitions }}</span>
                        <span>ease {{ Number(card.ease_factor).toFixed(2) }}</span>
                      </div>
                      <div class="mt-1.5 text-sm text-text-primary whitespace-pre-wrap break-words">{{ card.front }}</div>
                      <div class="mt-1 text-sm text-text-secondary whitespace-pre-wrap break-words border-l-2 border-border-subtle pl-2">
                        {{ card.back }}
                      </div>
                    </div>
                    <div class="flex shrink-0 flex-col gap-1">
                      <el-button size="small" plain @click="openEditCard(card)">编辑</el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteCard(card)">删除</el-button>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- ============ 统计 ============ -->
            <el-tab-pane label="学习统计" name="stats">
              <div v-if="!stats" class="py-10 text-center text-text-secondary">暂无数据</div>
              <div v-else>
                <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div class="rounded-lg bg-slate-50 p-3 text-center">
                    <div class="text-2xl font-semibold">{{ stats.total_cards }}</div>
                    <div class="text-xs text-text-secondary">总卡数</div>
                  </div>
                  <div class="rounded-lg bg-amber-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-amber-700">{{ stats.new_cards }}</div>
                    <div class="text-xs text-text-secondary">新卡</div>
                  </div>
                  <div class="rounded-lg bg-blue-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-blue-700">{{ stats.learning_cards }}</div>
                    <div class="text-xs text-text-secondary">学习中</div>
                  </div>
                  <div class="rounded-lg bg-emerald-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-emerald-700">{{ stats.mature_cards }}</div>
                    <div class="text-xs text-text-secondary">已掌握</div>
                  </div>
                  <div class="rounded-lg bg-primary-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-primary-700">{{ stats.due_today }}</div>
                    <div class="text-xs text-text-secondary">今日到期</div>
                  </div>
                  <div class="rounded-lg bg-violet-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-violet-700">{{ stats.reviews_today }}</div>
                    <div class="text-xs text-text-secondary">今日复习</div>
                  </div>
                  <div class="rounded-lg bg-rose-50 p-3 text-center">
                    <div class="text-2xl font-semibold text-rose-700">{{ stats.streak_days }}</div>
                    <div class="text-xs text-text-secondary">连续天数</div>
                  </div>
                  <div class="rounded-lg bg-slate-50 p-3 text-center">
                    <div class="text-2xl font-semibold">{{ stats.reviews_total }}</div>
                    <div class="text-xs text-text-secondary">累计复习</div>
                  </div>
                </div>

                <div class="mt-4 rounded-lg border border-border-subtle p-3">
                  <div class="mb-2 text-sm font-medium">最近 30 天复习活动</div>
                  <div class="flex h-24 items-end gap-0.5">
                    <div
                      v-for="d in stats.reviews_30d"
                      :key="d.day"
                      class="flex-1 rounded-t bg-primary-500/80 transition hover:bg-primary-600"
                      :style="{ height: `${(d.count / statsMax) * 100}%`, minHeight: '2px' }"
                      :title="`${fmtDate(d.day)}: ${d.count} 次`"
                    />
                  </div>
                  <div class="mt-1 flex justify-between text-xs text-text-secondary">
                    <span>{{ stats.reviews_30d[0] ? fmtDate(stats.reviews_30d[0].day) : '' }}</span>
                    <span>今天</span>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </ToolDetail>

    <!-- 编辑卡组 -->
    <el-dialog v-model="showDeckEdit" title="编辑卡组" width="420px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="卡组名" required>
          <el-input v-model="deckForm.name" maxlength="60" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deckForm.description" type="textarea" :rows="3" maxlength="500" />
        </el-form-item>
        <el-form-item label="每日新卡上限">
          <el-input-number v-model="deckForm.daily_new_limit" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDeckEdit = false">取消</el-button>
        <el-button type="primary" :loading="savingDeck" @click="onSaveDeck">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新建卡片 -->
    <el-dialog v-model="showCreate" title="添加卡片" width="560px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="正面（问题）" required>
          <el-input v-model="cardForm.front" type="textarea" :rows="3" maxlength="5000" placeholder="例如：ephemeral" />
        </el-form-item>
        <el-form-item label="背面（答案）" required>
          <el-input v-model="cardForm.back" type="textarea" :rows="4" maxlength="5000" placeholder="例如：adj. 短暂的；瞬息的" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreateCard">添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑卡片 -->
    <el-dialog
      :model-value="editingCard !== null"
      title="编辑卡片"
      width="560px"
      :close-on-click-modal="false"
      @update:model-value="(v: boolean) => { if (!v) editingCard = null }"
      @close="editingCard = null"
    >
      <el-form label-position="top">
        <el-form-item label="正面（问题）" required>
          <el-input v-model="editForm.front" type="textarea" :rows="3" maxlength="5000" />
        </el-form-item>
        <el-form-item label="背面（答案）" required>
          <el-input v-model="editForm.back" type="textarea" :rows="4" maxlength="5000" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="editForm.is_suspended">暂停（不进入复习队列）</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editingCard = null">取消</el-button>
        <el-button type="primary" :loading="savingEdit" @click="onSaveCard">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>