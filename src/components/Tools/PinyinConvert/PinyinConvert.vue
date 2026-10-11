<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = '汉字转拼音'

type ToneType = 'symbol' | 'num' | 'none'
type OutputMode = 'pinyin' | 'annotated' | 'initial'

const source = ref('床前明月光，疑是地上霜。')
const result = ref('')
const resultHtml = ref('')
const converting = ref(false)
const toneType = ref<ToneType>('symbol')
const outputMode = ref<OutputMode>('annotated')
const keepSeparator = ref(' ')

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const PINYIN_INITIALS = [
  'zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
]

const splitSyllable = (syl: string): [string, string] => {
  const two = syl.slice(0, 2)
  if (PINYIN_INITIALS.includes(two)) return [two, syl.slice(2)]
  const one = syl.slice(0, 1)
  if (PINYIN_INITIALS.includes(one)) return [one, syl.slice(1)]
  return ['', syl]
}

const isHan = (ch: string) => /[\u4e00-\u9fff]/.test(ch)

// 识字卡片式注音：声母标红、韵母黑色，标注在汉字上方
// pinyin() 的数组结果中，非中文段落也会各占一个元素，需同步消费以保持对齐
const buildAnnotated = (escaped: string, syllables: string[]) => {
  let out = ''
  let i = 0
  for (let idx = 0; idx < escaped.length; idx++) {
    const ch = escaped[idx]
    if (!isHan(ch)) {
      let seg = ch
      while (idx + 1 < escaped.length && !isHan(escaped[idx + 1])) {
        seg += escaped[++idx]
      }
      out += seg
      i++
      continue
    }
    const [ini, fin] = splitSyllable(syllables[i++] ?? '')
    out += `<ruby class="py-item">${ch}<rt>${
      ini ? `<i class="py-ini">${ini}</i>` : ''
    }<i class="py-fin">${fin}</i></rt></ruby>`
  }
  return out
}

const convert = async () => {
  if (!source.value.trim()) {
    ElMessage.warning('请输入要转换的中文文本')
    return
  }
  converting.value = true
  try {
    const { pinyin } = await import('pinyin-pro')
    if (outputMode.value === 'initial') {
      resultHtml.value = ''
      result.value = pinyin(source.value, {
        pattern: 'first',
        toneType: 'none',
        type: 'string',
        separator: keepSeparator.value,
        nonZh: 'consecutive',
      })
    } else {
      const base = {
        pattern: 'pinyin',
        toneType: toneType.value,
        separator: keepSeparator.value,
        nonZh: 'consecutive',
      } as const
      result.value = pinyin(source.value, { ...base, type: 'string' })
      resultHtml.value =
        outputMode.value === 'annotated'
          ? buildAnnotated(
              escapeHtml(source.value),
              pinyin(escapeHtml(source.value), { ...base, type: 'array' }),
            )
          : ''
    }
  } catch (e) {
    console.error('拼音转换失败:', e)
    ElMessage.error('转换失败，请重试')
  } finally {
    converting.value = false
  }
}

watch([outputMode, toneType, keepSeparator], () => {
  if (result.value || resultHtml.value) convert()
})

let sourceTimer: ReturnType<typeof setTimeout> | undefined
watch(source, () => {
  clearTimeout(sourceTimer)
  sourceTimer = setTimeout(() => {
    if (!source.value.trim()) {
      result.value = ''
      resultHtml.value = ''
      return
    }
    convert()
  }, 500)
})

onMounted(() => {
  if (source.value.trim()) convert()
})

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
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
        <h1 class="text-h2 font-semibold">汉字转拼音</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          汉字转拼音工具，拼音直接标注在汉字上方（识字卡片式，声母标红），支持声调符号/数字/无声调与首字母模式，准确处理多音字。
        </p>
      </header>

      <div class="pinyin-options">
        <div class="pinyin-option">
          <label>声调样式</label>
          <el-radio-group v-model="toneType">
            <el-radio-button value="symbol">拼音声调（nǐ hǎo）</el-radio-button>
            <el-radio-button value="num">数字声调（ni3）</el-radio-button>
            <el-radio-button value="none">不带声调（ni hao）</el-radio-button>
          </el-radio-group>
        </div>
        <div class="pinyin-option">
          <label>输出模式</label>
          <el-radio-group v-model="outputMode">
            <el-radio-button value="pinyin">完整拼音</el-radio-button>
            <el-radio-button value="annotated">注音对照</el-radio-button>
            <el-radio-button value="initial">首字母</el-radio-button>
          </el-radio-group>
        </div>
        <div class="pinyin-option">
          <label>分隔符</label>
          <el-radio-group v-model="keepSeparator">
            <el-radio-button value=" ">空格</el-radio-button>
            <el-radio-button value="">无分隔</el-radio-button>
            <el-radio-button value=",">逗号</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div class="pinyin-layout">
        <div class="pinyin-pane">
          <div class="pinyin-pane-head"><span>中文文本</span><span class="text-body-sm text-slate-500">{{ source.length.toLocaleString() }} 字符</span></div>
          <el-input
            v-model="source"
            type="textarea"
            :rows="12"
            placeholder="输入汉字，实时支持长文本…"
            maxlength="20000"
          />
        </div>
        <div class="pinyin-pane">
          <div class="pinyin-pane-head"><span>{{ outputMode === 'annotated' ? '注音对照' : '拼音结果' }}</span></div>
          <div v-if="outputMode === 'annotated'" class="pinyin-annotated">
            <span v-if="!resultHtml" class="pinyin-annotated-placeholder">点击「转换」后，拼音将标注在每个汉字上方…</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span v-else v-html="resultHtml"></span>
          </div>
          <el-input
            v-else
            v-model="result"
            type="textarea"
            :rows="12"
            placeholder="点击「转换」后显示拼音…"
            readonly
          />
        </div>
      </div>

      <div class="pinyin-actions">
        <el-button type="primary" :loading="converting" @click="convert">转 换</el-button>
        <el-button :disabled="!result" @click="copy">复制结果</el-button>
        <el-button @click="clear">清空</el-button>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        基于 pinyin-pro 词库转换，内置多音字词组识别（如「重庆→chóng qìng」「银行→yín háng」）。默认以注音对照方式展示：拼音标注在每个汉字上方，声母标红、韵母黑色，类似识字卡片；声调支持符号（nǐ）、数字（ni3）和无声调三种样式；首字母模式输出每个字的拼音首字母，适合做缩写。输入后自动实时转换，切换选项立即生效。非中文字符原样保留。转换在浏览器本地完成，首次转换需加载词库。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.pinyin-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.pinyin-option {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.pinyin-option > label {
  flex-shrink: 0;
  width: 64px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.pinyin-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.pinyin-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pinyin-pane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  height: 28px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pinyin-annotated {
  min-height: 264px;
  max-height: 520px;
  overflow-y: auto;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: var(--el-fill-color-blank);
  font-size: 26px;
  line-height: 3;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-primary);
}

.pinyin-annotated :deep(ruby) {
  margin: 0 5px;
  ruby-align: center;
}

.pinyin-annotated :deep(rt) {
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 2px;
  user-select: none;
  letter-spacing: 1px;
}

.pinyin-annotated :deep(rt i) {
  font-style: normal;
}

.pinyin-annotated :deep(rt .py-ini) {
  color: var(--el-color-danger);
}

.pinyin-annotated-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.pinyin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 767px) {
  .pinyin-layout {
    grid-template-columns: 1fr;
  }
}
</style>
