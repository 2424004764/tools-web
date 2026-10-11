<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '简繁体转换'

type Direction = 's2t' | 's2tw' | 's2hk' | 't2s'

const source = ref('')
const result = ref('')
const direction = ref<Direction>('s2t')
const converting = ref(false)

const directionOptions: { value: Direction; label: string }[] = [
  { value: 's2t', label: '简 → 繁（通用）' },
  { value: 's2tw', label: '简 → 繁（台湾正体）' },
  { value: 's2hk', label: '简 → 繁（香港繁体）' },
  { value: 't2s', label: '繁 → 简（大陆简体）' },
]

// opencc-js 词典较大，动态引入单独分包
let converterCache: Partial<Record<Direction, (text: string) => string>> = {}

async function getConverter(dir: Direction) {
  const cached = converterCache[dir]
  if (cached) return cached
  const OpenCC = (await import('opencc-js')).default
  const conf: Record<Direction, { from: string; to: string }> = {
    s2t: { from: 'cn', to: 't' },
    s2tw: { from: 'cn', to: 'twp' },
    s2hk: { from: 'cn', to: 'hk' },
    t2s: { from: 't', to: 'cn' },
  }
  const conv = OpenCC.Converter(conf[dir])
  converterCache[dir] = conv
  return conv
}

const convert = async () => {
  if (!source.value.trim()) {
    ElMessage.warning('请输入要转换的文本')
    return
  }
  converting.value = true
  try {
    const conv = await getConverter(direction.value)
    result.value = conv(source.value)
  } catch (e) {
    console.error('简繁转换失败:', e)
    ElMessage.error('转换失败，请重试')
  } finally {
    converting.value = false
  }
}

const swap = () => {
  if (result.value) {
    source.value = result.value
    result.value = ''
  }
  direction.value = direction.value === 't2s' ? 's2t' : 't2s'
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const download = () => {
  const blob = new Blob([result.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'converted.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

const clear = () => {
  source.value = ''
  result.value = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">简繁体转换</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          基于 OpenCC 词库的中文简繁转换，支持大陆简体、台湾正体、香港繁体互转，词汇级精准转换。
        </p>
      </header>

      <div class="cc-toolbar">
        <el-radio-group v-model="direction">
          <el-radio-button v-for="opt in directionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button text type="primary" @click="swap">⇄ 交换</el-button>
      </div>

      <div class="cc-layout">
        <div class="cc-pane">
          <div class="cc-pane-head">
            <span>原文</span>
            <span class="text-body-sm text-slate-500">{{ source.length.toLocaleString() }} 字符</span>
          </div>
          <el-input
            v-model="source"
            type="textarea"
            :rows="14"
            placeholder="在此输入或粘贴简体/繁体中文文本…"
            maxlength="50000"
          />
        </div>
        <div class="cc-pane">
          <div class="cc-pane-head">
            <span>转换结果</span>
            <span class="text-body-sm text-slate-500">{{ result.length.toLocaleString() }} 字符</span>
          </div>
          <el-input
            v-model="result"
            type="textarea"
            :rows="14"
            placeholder="点击「开始转换」后显示结果…"
            readonly
          />
        </div>
      </div>

      <div class="cc-actions">
        <el-button type="primary" :loading="converting" @click="convert">开始转换</el-button>
        <el-button :disabled="!result" @click="copy">复制结果</el-button>
        <el-button :disabled="!result" @click="download">下载 TXT</el-button>
        <el-button @click="clear">清空</el-button>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        转换基于 OpenCC 开源词库，属于词汇级转换而非简单字对字替换：例如「互联网→互聯網」「头发→頭髮」「皇后」保持不变。四种方向：通用繁体、台湾正体（含台湾用语习惯，如「软件→軟體」）、香港繁体，以及繁体转大陆简体。首次转换需加载词库会稍慢，之后即时转换。文本不会上传服务器，全部在浏览器本地处理。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.cc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.cc-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cc-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cc-pane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  height: 28px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 767px) {
  .cc-layout {
    grid-template-columns: 1fr;
  }
}
</style>
