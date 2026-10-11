<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '文本排序'

type SortKey = 'pinyin' | 'gb' | 'length' | 'numeric' | 'reverse' | 'shuffle' | 'none'
type Separator = 'line' | 'comma' | 'space'

const source = ref('')
const result = ref('')
const sortKey = ref<SortKey>('pinyin')
const separator = ref<Separator>('line')
const descending = ref(false)
const unique = ref(false)
const ignoreCase = ref(true)
const trimItems = ref(true)

const splitPattern = computed(() =>
  separator.value === 'line' ? /\r?\n/ : separator.value === 'comma' ? /[,，]/ : /\s+/,
)

const joiner = computed(() => (separator.value === 'line' ? '\n' : separator.value === 'comma' ? ',' : ' '))

const naturalCompare = new Intl.Collator('zh-Hans-CN', { numeric: true }).compare

const doSort = () => {
  if (!source.value.trim()) {
    ElMessage.warning('请输入要排序的文本')
    return
  }
  let items = source.value.split(splitPattern.value)
  if (trimItems.value) items = items.map((s) => s.trim()).filter(Boolean)
  else items = items.filter((s) => s.length > 0)

  if (unique.value) {
    const seen = new Set<string>()
    const key = (s: string) => (ignoreCase.value ? s.toLowerCase() : s)
    items = items.filter((s) => {
      const k = key(s)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  if (sortKey.value === 'shuffle') {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
  } else if (sortKey.value !== 'none') {
    const cmp: Record<Exclude<SortKey, 'shuffle' | 'none' | 'reverse'>, (a: string, b: string) => number> = {
      pinyin: (a, b) => naturalCompare(a, b),
      gb: (a, b) => naturalCompare(a, b),
      length: (a, b) => a.length - b.length || naturalCompare(a, b),
      numeric: (a, b) => {
        const na = parseFloat(a)
        const nb = parseFloat(b)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return naturalCompare(a, b)
      },
    }
    items.sort(cmp[sortKey.value as Exclude<SortKey, 'shuffle' | 'none' | 'reverse'>])
    if (descending.value) items.reverse()
  }

  result.value = items.join(joiner.value)
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const stats = computed(() => {
  const n = result.value ? result.value.split(splitPattern.value).filter((s) => trimItems.value ? s.trim() : s.length).length : 0
  return { count: n }
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">文本排序</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          按拼音、数字、长度等方式对行或列表排序，支持去重、倒序与随机打乱。
        </p>
      </header>

      <div class="tsort-options">
        <div class="tsort-option">
          <label>排序方式</label>
          <el-select v-model="sortKey" class="!w-56">
            <el-option label="拼音排序（zh-CN）" value="pinyin" />
            <el-option label="数字排序（自然数）" value="numeric" />
            <el-option label="按字符长度" value="length" />
            <el-option label="随机打乱" value="shuffle" />
            <el-option label="不排序（仅去重）" value="none" />
          </el-select>
          <el-checkbox v-model="descending" :disabled="sortKey === 'shuffle' || sortKey === 'none'">倒序</el-checkbox>
          <el-checkbox v-model="unique">去重</el-checkbox>
          <el-checkbox v-model="ignoreCase" :disabled="!unique">去重忽略大小写</el-checkbox>
          <el-checkbox v-model="trimItems">去除首尾空白</el-checkbox>
        </div>
        <div class="tsort-option">
          <label>分隔方式</label>
          <el-radio-group v-model="separator">
            <el-radio-button value="line">按行</el-radio-button>
            <el-radio-button value="comma">按逗号</el-radio-button>
            <el-radio-button value="space">按空格</el-radio-button>
          </el-radio-group>
          <el-button type="primary" @click="doSort">排 序</el-button>
          <el-button :disabled="!result" @click="copy">复制结果</el-button>
        </div>
      </div>

      <div class="tsort-layout">
        <div class="tsort-pane">
          <div class="tsort-pane-head"><span>原文</span></div>
          <el-input v-model="source" type="textarea" :rows="14" placeholder="每行一个条目，或使用逗号/空格分隔…" />
        </div>
        <div class="tsort-pane">
          <div class="tsort-pane-head">
            <span>结果</span>
            <span v-if="stats.count" class="text-body-sm text-slate-500">{{ stats.count }} 项</span>
          </div>
          <el-input v-model="result" type="textarea" :rows="14" placeholder="排序结果…" readonly />
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        先选择分隔方式（按行、逗号或空格拆分条目），再选择排序方式：拼音排序使用 zh-CN 本地化规则（支持中文与中英混排的自然顺序）、数字排序按数值大小（非数字条目按字典序排在后面）、字符长度按条目长度；随机打乱可用于抽签。勾选去重后相邻或全局重复的条目只保留一个。所有处理在浏览器本地完成。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.tsort-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.tsort-option {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.tsort-option > label {
  flex-shrink: 0;
  width: 64px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.tsort-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tsort-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tsort-pane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  height: 28px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

@media (max-width: 767px) {
  .tsort-layout {
    grid-template-columns: 1fr;
  }
}
</style>
