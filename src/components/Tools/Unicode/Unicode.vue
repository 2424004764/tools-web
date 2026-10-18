<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type UnicodeMode = 'u' | 'entity' | 'percent'

const input = ref('')
const output = ref('')
const mode = ref<UnicodeMode>('u')
const ignoreAscii = ref(true)
const error = ref('')

const modeOptions: { label: string; value: UnicodeMode }[] = [
  { label: 'Unicode 默认模式 \\uXXXX', value: 'u' },
  { label: 'HTML 实体 &#xXXXX;', value: 'entity' },
  { label: '旧式 URL 转义 %uXXXX', value: 'percent' },
]

const characterCount = computed(() => Array.from(input.value).length)

// 各模式的转义前缀；正则按前缀 + 4 位十六进制匹配，解码时只替换转义序列，其余字符原样保留
const encodeChar = (code: number) => {
  const hex = code.toString(16).padStart(4, '0')
  switch (mode.value) {
    case 'entity':
      return `&#x${hex};`
    case 'percent':
      return `%u${hex}`
    default:
      return `\\u${hex}`
  }
}

const encodeToUnicode = () => {
  let out = ''
  for (const ch of input.value) {
    const code = ch.codePointAt(0) ?? 0
    // 码点超出 BMP 时按代理对逐码元编码，与常见 JSON/JS 序列化行为一致
    if (ignoreAscii.value && code < 128) {
      out += ch
    } else if (code > 0xffff) {
      for (const unit of ch) {
        out += encodeChar(unit.charCodeAt(0))
      }
    } else {
      out += encodeChar(code)
    }
  }
  return out
}

const DECODE_RE: Record<UnicodeMode, RegExp> = {
  u: /\\u([0-9a-fA-F]{4})/g,
  entity: /&#x([0-9a-fA-F]{4});?/g,
  percent: /%u([0-9a-fA-F]{4})/g,
}

const decodeToChinese = () => {
  return input.value.replace(DECODE_RE[mode.value], (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
}

const encode = () => {
  try {
    output.value = encodeToUnicode()
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '编码失败'
  }
}

const decode = () => {
  output.value = decodeToChinese()
  error.value = ''
}

const swap = () => {
  input.value = output.value
  output.value = ''
  error.value = ''
}

const clear = () => {
  input.value = ''
  output.value = ''
  error.value = ''
}

const copyOutput = async () => {
  if (!output.value) return
  await copy(output.value)
  ElMessage.success('处理结果已复制')
}

const fillDecodeExample = () => {
  input.value = 'abc\\u4e2d\\u56fdabc'
  error.value = ''
}
</script>

<template>
  <div class="unicode-page flex flex-col mt-3 flex-1">
    <DetailHeader title="Unicode转中文" />

    <section class="unicode-workspace">
      <div class="workspace-toolbar">
        <label class="control-field">
          <span>模式</span>
          <el-select v-model="mode" aria-label="Unicode 模式" class="mode-select">
            <el-option v-for="item in modeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <el-checkbox v-model="ignoreAscii">编码忽略 Ascii 字符</el-checkbox>
        <div class="action-group">
          <el-button plain @click="fillDecodeExample">解码示例</el-button>
          <el-button type="primary" plain @click="decode">解码成 中文</el-button>
          <el-button type="primary" @click="encode">编码成 Unicode</el-button>
          <el-button plain @click="swap">交换</el-button>
          <el-button type="danger" plain @click="clear">清空</el-button>
        </div>
      </div>

      <p v-if="error" class="unicode-error" role="alert">{{ error }}</p>

      <div class="editor-heading">
        <label for="unicode-input">输入内容</label>
        <span>{{ characterCount }} 字符</span>
      </div>
      <el-input
        id="unicode-input"
        v-model="input"
        type="textarea"
        resize="none"
        :rows="6"
        placeholder="输入中文或 Unicode 转义序列，混合文本只会转换其中的转义序列"
      />

      <div class="editor-heading output-heading">
        <label for="unicode-output">处理结果</label>
        <el-button text type="primary" :disabled="!output" @click="copyOutput">复制结果</el-button>
      </div>
      <el-input
        id="unicode-output"
        v-model="output"
        type="textarea"
        resize="none"
        :rows="6"
        placeholder="编码或解码结果会显示在这里"
      />
    </section>

    <ToolDetail title="说明">
      <div class="unicode-description">
        <p>在 Unicode 转义序列和中文之间相互转换。当文本中不只含有 Unicode 转义时，只会转换转义部分，其他字符保持不变，例如 <code>abc\u4e2d\u56fdabc</code> 解码结果是 <code>abc中国abc</code>。</p>
        <ul class="mt-2">
          <li><strong>编码忽略 Ascii 字符</strong>：勾选后英文、数字、半角符号保持原样，只编码中文等非 ASCII 字符（JSON、JS 字符串的常见形态）；取消则全部字符编码。</li>
          <li><strong>模式</strong>：<code>\uXXXX</code> 是 JS/JSON 默认形式；<code>&amp;#xXXXX;</code> 是 HTML 十六进制实体；<code>%uXXXX</code> 是旧式 URL 转义。</li>
          <li><strong>解码示例</strong>：一键填入 <code>abc\u4e2d\u56fdabc</code>，点「解码成 中文」体验混合文本转换。</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.unicode-workspace {
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

.mode-select {
  width: 220px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.action-group :deep(.el-button + .el-button) {
  margin-left: 0;
}

.unicode-error {
  margin: 0 0 10px;
  color: var(--el-color-danger);
  font-size: 13px;
}

.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 6px;
  font-size: 13px;
}

.editor-heading label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.editor-heading > span {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.output-heading {
  margin-top: 14px;
}

.unicode-description {
  line-height: 1.8;
}

.unicode-description code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

@media (max-width: 760px) {
  .unicode-workspace {
    padding: 14px;
  }

  .action-group {
    width: 100%;
    margin-left: 0;
  }

  .action-group :deep(.el-button) {
    flex: 1;
    padding-right: 10px;
    padding-left: 10px;
  }
}
</style>
