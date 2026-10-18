<script setup lang="ts">
import { Buffer } from 'buffer'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { decode as decodeBytes, encode as encodeText } from 'iconv-lite'
import { commonCharsets, supportedOtherCharsets } from '@/utils/charsets'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type ByteFormat = 'hex' | 'decimal'
type Delimiter = 'none' | 'space' | 'comma' | 'newline' | 'custom'

const input = ref('')
const output = ref('')
const encoding = ref('UTF-8')
const format = ref<ByteFormat>('hex')
const delimiter = ref<Delimiter>('none')
const customDelimiter = ref(',0x')
const error = ref('')

const separatorOptions: { label: string; value: Delimiter }[] = [
  { label: '无', value: 'none' },
  { label: '空格', value: 'space' },
  { label: '逗号', value: 'comma' },
  { label: '换行', value: 'newline' },
  { label: '自定义', value: 'custom' },
]

const separator = computed(() => ({
  none: '',
  space: ' ',
  comma: ',',
  newline: '\n',
  custom: customDelimiter.value,
})[delimiter.value])

const characterCount = computed(() => Array.from(input.value).length)
const outputCount = computed(() => Array.from(output.value).length)
const skipAutoEncode = ref(false)

const ensureDelimiter = () => {
  if (delimiter.value === 'custom' && !customDelimiter.value) {
    throw new Error('请输入自定义分隔符')
  }
}

const encode = () => {
  try {
    ensureDelimiter()
    const bytes = encodeText(input.value, encoding.value)
    output.value = Array.from(bytes, byte => (
      format.value === 'hex' ? byte.toString(16).padStart(2, '0').toUpperCase() : String(byte)
    )).join(separator.value)
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '编码失败'
  }
}

const splitBytes = (value: string, currentFormat: ByteFormat) => {
  ensureDelimiter()
  const delimiterValue = separator.value
  let tokens: string[]

  if (delimiterValue) {
    tokens = value.split(delimiterValue).map(token => token.trim()).filter(Boolean)
  } else if (currentFormat === 'hex') {
    const compact = value.replace(/\s+/g, '').replace(/0x/gi, '')
    if (!/^[\da-f]*$/i.test(compact)) throw new Error('十六进制内容包含无效字符')
    if (compact.length % 2 !== 0) throw new Error('十六进制内容需要由完整的字节组成')
    tokens = compact.match(/.{2}/g) || []
  } else {
    if (currentFormat === 'decimal' && /[\s,]/.test(value)) {
      throw new Error('十进制内容需要选择对应的分隔符')
    }
    tokens = value.trim() ? [value.trim()] : []
  }

  return tokens.map(token => {
    const normalized = token.replace(/^0x/i, '')
    if (currentFormat === 'hex' && !/^[\da-f]{1,2}$/i.test(normalized)) {
      throw new Error(`无效的十六进制字节：${token}`)
    }
    if (currentFormat === 'decimal' && !/^-?\d+$/.test(normalized)) {
      throw new Error(`无效的十进制字节：${token}`)
    }
    const byte = currentFormat === 'hex' ? Number.parseInt(normalized, 16) : Number(normalized)
    if (!Number.isInteger(byte) || byte < (currentFormat === 'decimal' ? -128 : 0) || byte > 0xff) {
      throw new Error(`无效的${currentFormat === 'hex' ? '十六进制' : '十进制'}字节：${token}`)
    }
    return byte < 0 ? byte + 256 : byte
  })
}

const decode = () => {
  try {
    if (delimiter.value === 'none' && format.value === 'decimal' && input.value.includes(',')) {
      throw new Error('十进制内容无法在无分隔符时可靠解析，请选择逗号或空格分隔符')
    }
    const bytes = splitBytes(input.value, format.value)
    output.value = decodeBytes(Buffer.from(bytes), encoding.value)
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '解码失败，请检查输入格式和分隔符。'
  }
}

watch([input, encoding, format, delimiter, customDelimiter], () => {
  if (skipAutoEncode.value) {
    skipAutoEncode.value = false
    return
  }
  encode()
})

const swap = () => {
  const nextInput = output.value
  if (input.value === nextInput) {
    output.value = ''
    error.value = ''
    return
  }
  skipAutoEncode.value = true
  input.value = nextInput
  output.value = ''
  error.value = ''
}

const clear = () => {
  skipAutoEncode.value = false
  input.value = ''
  output.value = ''
  error.value = ''
}

const copyOutput = async () => {
  if (!output.value) return
  await copy(output.value)
  ElMessage.success('处理结果已复制')
}

const examples = [
  {
    label: 'API 响应',
    encoding: 'UTF-8',
    format: 'hex' as ByteFormat,
    delimiter: 'space' as Delimiter,
    text: '{"ok":true,"items":3}',
  },
  {
    label: '物流扫描',
    encoding: 'GBK',
    format: 'hex' as ByteFormat,
    delimiter: 'comma' as Delimiter,
    text: '包裹已到达分拨中心',
  },
  {
    label: '日文通知',
    encoding: 'UTF-16LE',
    format: 'hex' as ByteFormat,
    delimiter: 'space' as Delimiter,
    text: '発送が完了しました',
  },
]

const fillExample = (example: typeof examples[number]) => {
  input.value = example.text
  skipAutoEncode.value = false
  encoding.value = example.encoding
  format.value = example.format
  delimiter.value = example.delimiter
  error.value = ''
}
</script>

<template>
  <div class="charset-page flex flex-col mt-3 flex-1">
    <DetailHeader title="字符编码/解码" />

    <section class="charset-workspace">
      <div class="workspace-toolbar">
        <label class="control-field charset-field">
          <span>字符集</span>
          <el-select v-model="encoding" filterable aria-label="字符编码">
            <el-option-group label="常用">
              <el-option v-for="item in commonCharsets" :key="item.value" :label="item.label" :value="item.value" />
            </el-option-group>
            <el-option-group label="其他">
              <el-option v-for="item in supportedOtherCharsets" :key="item.value" :label="item.label" :value="item.value" />
            </el-option-group>
          </el-select>
        </label>
        <label class="control-field format-field">
          <span>输出格式</span>
          <el-select v-model="format" aria-label="字节格式">
            <el-option label="十六进制" value="hex" />
            <el-option label="十进制" value="decimal" />
          </el-select>
        </label>
        <label class="control-field separator-field">
          <span>分隔符</span>
          <el-select v-model="delimiter" aria-label="分隔符">
            <el-option v-for="item in separatorOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <el-input
          v-if="delimiter === 'custom'"
          v-model="customDelimiter"
          class="custom-separator"
          aria-label="自定义分隔符"
          placeholder="自定义分隔符"
        />
        <div class="action-group">
          <el-button type="primary" plain @click="decode">解码</el-button>
          <el-button plain @click="swap">交换</el-button>
          <el-button type="danger" plain @click="clear">清空</el-button>
        </div>
      </div>

      <p v-if="error" class="charset-error" role="alert">{{ error }}</p>

      <div class="editor-grid">
        <section class="editor-panel input-panel">
          <div class="editor-heading">
            <label for="charset-input">输入内容</label>
            <span>{{ characterCount }} 字符</span>
          </div>
          <el-input
            id="charset-input"
            v-model="input"
            class="charset-editor"
            type="textarea"
            resize="none"
            :rows="14"
            placeholder="输入文本后会自动生成编码结果；输入字节序列时点击解码"
          />
        </section>

        <section class="editor-panel output-panel">
          <div class="editor-heading">
            <label for="charset-output">处理结果</label>
            <div class="result-meta">
              <span>{{ outputCount }} 字符</span>
              <el-button text type="primary" :disabled="!output" @click="copyOutput">复制结果</el-button>
            </div>
          </div>
          <el-input
            id="charset-output"
            v-model="output"
            class="charset-editor charset-result"
            type="textarea"
            resize="none"
            :rows="14"
            placeholder="编码或解码后的内容会显示在这里"
          />
        </section>
      </div>

      <div class="examples-row">
        <span class="examples-label">试试这些内容</span>
        <el-button
          v-for="example in examples"
          :key="example.label"
          class="example-button"
          plain
          @click="fillExample(example)"
        >
          {{ example.label }}
        </el-button>
      </div>
    </section>

    <ToolDetail title="说明">
      <div class="charset-description">
        <p>输入文本后自动生成字节序列，调整字符集、输出格式或分隔符时结果会同步更新。切换到十六进制或十进制字节后，点击“解码”可还原文本。</p>
        <ul>
          <li>支持 UTF-8、UTF-16LE/BE、UTF-32LE/BE、GBK、GB18030、Big5 及多种 ISO、Windows 与 IBM 字符集。</li>
          <li>输出分隔符可选择无、空格、逗号、换行或自定义；连续十六进制字节也可直接输入后解码。</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.charset-workspace {
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
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  padding-top: 18px;
}

.editor-panel {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.input-panel {
  border-top: 2px solid var(--el-color-primary);
}

.output-panel {
  background: var(--el-fill-color-light);
}

.editor-heading,
.result-meta,
.control-field,
.action-group,
.examples-row {
  display: flex;
  align-items: center;
}

.editor-heading {
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.editor-heading label {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.editor-heading > span,
.result-meta > span {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.result-meta {
  gap: 10px;
}

.control-field {
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.charset-field .el-select {
  width: 184px;
}

.format-field .el-select,
.separator-field .el-select {
  width: 116px;
}

.custom-separator {
  width: 120px;
}

.action-group {
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 980px) {
  .workspace-toolbar {
    align-items: flex-start;
  }

  .action-group {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 760px) {
  .charset-workspace {
    padding: 14px;
  }

  .workspace-toolbar {
    gap: 10px 12px;
  }

  .control-field {
    flex: 1 1 calc(50% - 12px);
    justify-content: space-between;
  }

  .charset-field .el-select,
  .format-field .el-select,
  .separator-field .el-select {
    width: min(100%, 176px);
  }

  .editor-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    padding-top: 14px;
  }

  .charset-editor :deep(textarea) {
    min-height: 220px;
  }

  .action-group .el-button {
    flex: 1;
    padding-right: 10px;
    padding-left: 10px;
  }
}
</style>
