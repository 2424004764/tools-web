<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type UnicodeMode =
  | 'u' | 'uWide' | 'uBrace' | 'uPlus' | 'entity' | 'entityDec' | 'percent' | 'css'
  | 'bin' | 'oct' | 'dec' | 'hex'
type SepMode = 'none' | 'space' | 'comma' | 'custom'

const input = ref('')
const output = ref('')
const mode = ref<UnicodeMode>('u')
const separator = ref<SepMode>('space')
const customSeparator = ref('-')
const ignoreAscii = ref(true)
const error = ref('')

// 转义类模式（带前缀/包裹结构，解码只替换转义序列）；裸进制模式编码时用分隔符连接
const modeOptions: { label: string; value: UnicodeMode }[] = [
  { label: 'Unicode 默认模式 \\uXXXX', value: 'u' },
  { label: 'Unicode 宽字符模式 \\uXXXXXX', value: 'uWide' },
  { label: 'Unicode 宽字符(带大括号) \\u{XXXX}', value: 'uBrace' },
  { label: '码点表示法 U+XXXX', value: 'uPlus' },
  { label: 'HTML 实体(16进制) &#xXXXX;', value: 'entity' },
  { label: 'HTML 实体(10进制) &#NNNN;', value: 'entityDec' },
  { label: 'CSS 实体(16进制) \\XXXX', value: 'css' },
  { label: '旧式 URL 转义 %uXXXX', value: 'percent' },
  { label: '十六进制（裸）', value: 'hex' },
  { label: '十进制', value: 'dec' },
  { label: '八进制', value: 'oct' },
  { label: '二进制', value: 'bin' },
]

const ESCAPED_MODES: UnicodeMode[] = [
  'u', 'uWide', 'uBrace', 'uPlus', 'entity', 'entityDec', 'percent', 'css',
]
// 支持完整码点（含增补平面，用 fromCodePoint 不拆代理对）的模式
const CODEPOINT_MODES: UnicodeMode[] = ['uWide', 'uBrace', 'uPlus', 'entityDec', 'css']

const separatorOptions: { label: string; value: SepMode }[] = [
  { label: '无', value: 'none' },
  { label: '空格', value: 'space' },
  { label: '逗号', value: 'comma' },
  { label: '自定义', value: 'custom' },
]

const sepText = computed(() => {
  switch (separator.value) {
    case 'space':
      return ' '
    case 'comma':
      return ','
    case 'custom':
      return customSeparator.value
    default:
      return ''
  }
})

const characterCount = computed(() => Array.from(input.value).length)

const formatCode = (code: number) => {
  switch (mode.value) {
    case 'uWide':
      // 宽字符模式 4-6 位可变长度，不补零（与 Python/Java 风格一致）
      return `\\u${code.toString(16)}`
    case 'uBrace':
      return `\\u{${code.toString(16)}}`
    case 'uPlus':
      return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`
    case 'css':
      // CSS 转义按惯例最少 4 位（\4e2d），后跟空格结束定界
      return `\\${code.toString(16).padStart(4, '0')} `
    case 'entityDec':
      return `&#${code};`
    case 'entity':
      return `&#x${code.toString(16).padStart(4, '0')};`
    case 'percent':
      return `%u${code.toString(16).padStart(4, '0')}`
    case 'u':
      return `\\u${code.toString(16).padStart(4, '0')}`
    case 'hex':
      return code.toString(16).padStart(4, '0')
    case 'dec':
      return String(code)
    case 'oct':
      // 16 位码值的八进制最长 6 位，定长补零才能无分隔符解码
      return code.toString(8).padStart(6, '0')
    case 'bin':
      // 同理按 16 位定长补零
      return code.toString(2).padStart(16, '0')
  }
}

const encodeToUnicode = () => {
  // 十六/十进制裸码值无定长结构，多个码值必须靠分隔符定界；二/八进制已定长补零，可无分隔符
  if ((mode.value === 'hex' || mode.value === 'dec') && !sepText.value && Array.from(input.value).length > 1) {
    throw new Error('十六/十进制裸码值无定长结构，多个码值需要分隔符，请选择空格/逗号/自定义')
  }
  const parts: string[] = []
  for (const ch of input.value) {
    const code = ch.codePointAt(0) ?? 0
    // 码点表示类模式支持完整码点（含增补平面，emoji 等）；\u 默认模式按代理对逐码元，
    // 与常见 JSON/JS 序列化行为一致
    if (ignoreAscii.value && code < 128) {
      parts.push(ch)
    } else if (code > 0xffff && !CODEPOINT_MODES.includes(mode.value)) {
      for (const unit of ch) parts.push(formatCode(unit.charCodeAt(0)))
    } else {
      parts.push(formatCode(code))
    }
  }
  if (ESCAPED_MODES.includes(mode.value)) return parts.join('')
  return parts.filter(p => p !== '').join(sepText.value)
}

const DECODE_RE: Partial<Record<UnicodeMode, RegExp>> = {
  u: /\\u([0-9a-fA-F]{4})/g,
  uWide: /\\u([0-9a-fA-F]{4,6})/g,
  uBrace: /\\u\{([0-9a-fA-F]{4,6})\}/g,
  uPlus: /U\+([0-9a-fA-F]{4,6})/g,
  entity: /&#x([0-9a-fA-F]{1,6});?/g,
  entityDec: /&#([0-9]{1,7});?/g,
  css: /\\([0-9a-fA-F]{4,6})\s?/g,
  percent: /%u([0-9a-fA-F]{4})/g,
}

const RADIX: Partial<Record<UnicodeMode, number>> = { hex: 16, dec: 10, oct: 8, bin: 2 }

// 各转义模式的码值进制；HTML 十进制实体是 10，其余均为 16
const ESCAPE_RADIX: Partial<Record<UnicodeMode, number>> = { entityDec: 10 }

const decodeToChinese = () => {
  const escapedRe = DECODE_RE[mode.value]
  if (escapedRe) {
    const radix = ESCAPE_RADIX[mode.value] ?? 16
    return input.value.replace(escapedRe, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, radix)),
    )
  }
  // 裸进制解码：按分隔符拆出码值序列；二进制定长 8 位时也允许无分隔符连续串
  const radix = RADIX[mode.value]!
  const sep = sepText.value
  let tokens: string[]
  if (sep) {
    tokens = input.value.split(sep).map(t => t.trim()).filter(Boolean)
  } else if (mode.value === 'bin') {
    tokens = input.value.replace(/\s+/g, '').match(/[01]{16}/g) || []
  } else if (mode.value === 'oct') {
    tokens = input.value.replace(/\s+/g, '').match(/[0-7]{6}/g) || []
  } else {
    throw new Error('无分隔符时无法可靠拆分码值，请选择分隔符（二进制/八进制支持定长连续串）')
  }
  return tokens
    .map(t => String.fromCharCode(Number.parseInt(t, radix)))
    .join('')
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
          <span>进制</span>
          <el-select v-model="mode" aria-label="Unicode 进制" class="mode-select">
            <el-option v-for="item in modeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label v-if="!ESCAPED_MODES.includes(mode)" class="control-field">
          <span>分隔符</span>
          <el-select v-model="separator" aria-label="分隔符" class="sep-select">
            <el-option v-for="item in separatorOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <el-input
          v-if="!ESCAPED_MODES.includes(mode) && separator === 'custom'"
          v-model="customSeparator"
          class="custom-sep"
          aria-label="自定义分隔符"
          placeholder="自定义分隔符"
        />
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
          <li><strong>进制</strong>：<code>\uXXXX</code> 是 JS/JSON 默认形式；<code>\u{XXXX}</code> 是 ES6 宽字符（支持 emoji 等增补平面字符不拆代理对）；<code>U+XXXX</code> 是码点表示法；<code>&amp;#xXXXX;/&amp;#NNNN;</code> 是 HTML 十六/十进制实体；<code>\XXXX</code> 是 CSS content 里的转义；<code>%uXXXX</code> 是旧式 URL 转义；也可输出为裸的十六/十/八/二进制码值。</li>
          <li><strong>分隔符</strong>：裸进制模式下多个码值用它连接；解码时按同样的分隔符拆分（二进制按 16 位、八进制按 6 位定长补零，也支持无分隔符连续串；十进制必须带分隔符）。</li>
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

.sep-select {
  width: 110px;
}

.custom-sep {
  width: 110px;
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
