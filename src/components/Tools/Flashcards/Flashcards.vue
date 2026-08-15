<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'
import {
  fetchDecks,
  createDeck,
  deleteDeck,
  type FlashcardDeck,
} from '@/api/flashcards'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const decks = ref<FlashcardDeck[]>([])
const showCreate = ref(false)
const creating = ref(false)
const form = ref({
  name: '',
  description: '',
  daily_new_limit: 20,
})

async function load() {
  if (!userStore.getLoginStatus) return
  loading.value = true
  try {
    decks.value = await fetchDecks()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!userStore.getLoginStatus) {
    ElMessage.warning('请先登录')
    return
  }
  form.value = { name: '', description: '', daily_new_limit: 20 }
  showCreate.value = true
}

async function onCreate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入卡组名')
    return
  }
  creating.value = true
  try {
    await createDeck({
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      daily_new_limit: form.value.daily_new_limit,
    })
    ElMessage.success('创建成功')
    showCreate.value = false
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function onDelete(deck: FlashcardDeck) {
  try {
    await ElMessageBox.confirm(
      `确认删除卡组「${deck.name}」？该卡组下所有卡片与复习记录将被一并删除，且不可恢复。`,
      '删除卡组',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await deleteDeck(deck.id)
    ElMessage.success('已删除')
    await load()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '删除失败')
  }
}

function gotoManage(deck: FlashcardDeck) {
  router.push(`/flashcards/deck/${deck.id}/`)
}

function gotoStudy(deck: FlashcardDeck) {
  router.push(`/flashcards/deck/${deck.id}/study/`)
}

onMounted(() => {
  userStore.initUserState()
  load()
})
</script>

<template>
  <div>

      <DetailHeader title="关于间隔重复" class="mt-4">
      <div class="space-y-2 text-sm leading-relaxed text-text-secondary">
        <div><b class="text-text-primary">SM-2 算法：</b>每张卡片维护 ease_factor（难度系数）与复习间隔。评级「良好」按当前难度推进，「简单」拉长间隔并提高难度，「困难 / 忘记」则缩短或重置间隔。</div>
        <div><b class="text-text-primary">最佳实践：</b>每日打开复习队列优先做到期卡片，控制在 15–30 分钟内。避免一次塞入过多新卡，建议从每日 10–20 张起步。</div>
        <div><b class="text-text-primary">正面 / 背面：</b>支持 Markdown 语法（**加粗**、*斜体*、`代码`、- 列表、# 标题、链接等），背面试着尽量简洁、关键词化。</div>
      </div>
    </DetailHeader>

    <ToolDetail title="闪卡复习" id="flashcards">
      <template #default>
        <div class="text-sm leading-relaxed text-text-secondary">
          基于间隔重复（SRS / SM-2 算法）的闪卡复习系统：你录入卡片，系统按遗忘曲线智能调度复习节奏。
          每次复习后给出四档评级（忘记 / 困难 / 良好 / 简单），系统据此推算下次到期时间。
          坚持每日复习可以显著提升长期记忆效率。
        </div>

        <div v-if="!userStore.getLoginStatus" class="mt-4 text-sm text-amber-600">
          请先登录后再使用闪卡复习功能（数据保存在云端）。
        </div>

        <div class="mt-4 flex items-center justify-between">
          <div class="text-base font-medium">我的卡组（{{ decks.length }}）</div>
          <el-button type="primary" size="small" :disabled="!userStore.getLoginStatus" @click="openCreate">
            + 新建卡组
          </el-button>
        </div>

        <div v-if="loading" class="py-10 text-center text-text-secondary">加载中...</div>

        <div
          v-else-if="userStore.getLoginStatus && decks.length === 0"
          class="py-12 text-center text-text-secondary"
        >
          <div class="text-base">还没有卡组</div>
          <div class="mt-1 text-sm">点击「新建卡组」开始你的第一份闪卡</div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="rounded-xl border border-border-subtle bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="truncate text-base font-medium text-text-primary">{{ deck.name }}</div>
                <div v-if="deck.description" class="mt-1 line-clamp-2 text-xs text-text-secondary">
                  {{ deck.description }}
                </div>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div class="rounded-md bg-slate-50 py-2">
                <div class="text-lg font-semibold text-text-primary">{{ deck.total_cards }}</div>
                <div class="text-text-secondary">总卡数</div>
              </div>
              <div class="rounded-md bg-amber-50 py-2">
                <div class="text-lg font-semibold text-amber-700">{{ deck.new_cards }}</div>
                <div class="text-text-secondary">新卡</div>
              </div>
              <div class="rounded-md bg-primary-50 py-2">
                <div class="text-lg font-semibold text-primary-600">{{ deck.due_today }}</div>
                <div class="text-text-secondary">今日到期</div>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <el-button
                type="primary"
                size="small"
                class="flex-1"
                :disabled="deck.total_cards === 0"
                @click="gotoStudy(deck)"
              >
                开始复习
              </el-button>
              <el-button size="small" class="flex-1" @click="gotoManage(deck)">管理卡片</el-button>
              <el-button size="small" type="danger" plain @click="onDelete(deck)">删除</el-button>
            </div>
          </div>
        </div>
      </template>
    </ToolDetail>

    <el-dialog v-model="showCreate" title="新建卡组" width="420px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="卡组名" required>
          <el-input v-model="form.name" maxlength="60" placeholder="例如：英语单词 / 考研政治..." />
        </el-form-item>
        <el-form-item label="描述（可选）">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" placeholder="卡组简介" />
        </el-form-item>
        <el-form-item label="每日新卡上限">
          <el-input-number v-model="form.daily_new_limit" :min="0" :max="999" />
          <span class="ml-2 text-xs text-text-secondary">0 = 不学习新卡，只复习到期卡</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>