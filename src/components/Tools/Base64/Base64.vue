<script setup lang="ts">
import { Buffer } from 'buffer'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { decode as decodeBytes, encode as encodeText } from 'iconv-lite'
import { commonCharsets, supportedOtherCharsets } from '@/utils/charsets'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const input = ref('')
const output = ref('')
const encoding = ref('UTF-8')
const filterNonBase64 = ref(true)
const error = ref('')
const skipAutoEncode = ref(false)

const BASE64_RE = /[^A-Za-z0-9+/=]/g

const characterCount = computed(() => Array.from(input.value).length)

const encode = () => {
  try {
    const bytes = encodeText(input.value, encoding.value)
    output.value = Buffer.from(bytes).toString('base64')
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '编码失败'
  }
}

const decode = () => {
  try {
    let raw = input.value
    if (filterNonBase64.value) {
      raw = raw.replace(BASE64_RE, '')
    } else if (BASE64_RE.test(raw.replace(/\s+/g, ''))) {
      throw new Error('内容包含非 Base64 字符，可勾选"解码过滤非 Base64 字符"后重试')
    }
    if (raw.replace(/=/g, '').length % 4 === 1) {
      throw new Error('Base64 长度不合法（去掉填充后长度对 4 取余不能为 1）')
    }
    const buf = Buffer.from(raw, 'base64')
    output.value = decodeBytes(buf, encoding.value)
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '解码失败，请检查输入内容。'
  }
}

watch([input, encoding], () => {
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

const fillExample = () => {
  skipAutoEncode.value = false
  input.value = 'Hello, 一方工具箱!'
  error.value = ''
}
</script>

<template>
  <div class="base64-page flex flex-col mt-3 flex-1">
    <DetailHeader title="Base64编码/解码" />

    <section class="base64-workspace">
      <div class="workspace-toolbar">
        <label class="control-field">
          <span>字符集</span>
          <el-select v-model="encoding" filterable aria-label="字符编码" class="charset-select">
            <el-option-group label="常用">
              <el-option v-for="item in commonCharsets" :key="item.value" :label="item.label" :value="item.value" />
            </el-option-group>
            <el-option-group label="其他">
              <el-option v-for="item in supportedOtherCharsets" :key="item.value" :label="item.label" :value="item.value" />
            </el-option-group>
          </el-select>
        </label>
        <el-checkbox v-model="filterNonBase64">解码过滤非 Base64 字符</el-checkbox>
        <div class="action-group">
          <el-button type="primary" plain @click="decode">解码</el-button>
          <el-button plain @click="swap">交换</el-button>
          <el-button type="danger" plain @click="clear">清空</el-button>
        </div>
      </div>

      <p v-if="error" class="base64-error" role="alert">{{ error }}</p>

      <div class="editor-heading">
        <label for="base64-input">输入内容</label>
        <div class="result-meta">
          <span>{{ characterCount }} 字符</span>
          <el-button text type="primary" size="small" @click="fillExample">填充示例</el-button>
        </div>
      </div>
      <el-input
        id="base64-input"
        v-model="input"
        type="textarea"
        resize="none"
        :rows="6"
        placeholder="输入文本后自动生成 Base64；粘贴 Base64 后点击解码还原文本"
      />

      <div class="editor-heading output-heading">
        <label for="base64-output">Base64 结果</label>
        <el-button text type="primary" :disabled="!output" @click="copyOutput">复制结果</el-button>
      </div>
      <el-input
        id="base64-output"
        v-model="output"
        type="textarea"
        resize="none"
        :rows="6"
        placeholder="Base64 编码结果会显示在这里"
      />
    </section>

    <ToolDetail title="说明">
      <div class="base64-description">
        <p>输入文本后自动按所选字符集编码为 Base64；粘贴 Base64 内容（URL、JSON、日志里混入的其他字符可勾选"解码过滤非 Base64 字符"自动剔除）后点击「解码」还原为文本。「交换」把结果搬回输入框反向处理。</p>
        <p class="mt-2">图片与 Base64 互转请使用「图片、Base64互转」工具；Base64 编码后的文本长度约为原始文本的 4/3 倍。</p>
        <p class="mt-2 font-medium">Base64 字符集（码值 0-63）：</p>
        <ul class="mt-1">
          <li><code>0-25</code>：大写字母 <code>A-Z</code></li>
          <li><code>26-51</code>：小写字母 <code>a-z</code></li>
          <li><code>52-61</code>：数字 <code>0-9</code></li>
          <li><code>62</code>：<code>+</code>，<code>63</code>：<code>/</code>；末尾用 <code>=</code> 做填充</li>
        </ul>
        <p class="mt-2">原理：3 个字节（24 bit）按 6 bit 一组拆成 4 个码值，分别查上表得到 4 个 Base64 字符，这也是编码后长度变为 4/3 倍的原因。</p>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.base64-workspace {
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

.charset-select {
  width: 184px;
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

.base64-error {
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

.result-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.output-heading {
  margin-top: 14px;
}

.base64-description {
  line-height: 1.8;
}

.base64-description code {
  padding: 0 4px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}

@media (max-width: 760px) {
  .base64-workspace {
    padding: 14px;
  }

  .action-group {
    width: 100%;
    margin-left: 0;
  }

  .action-group :deep(.el-button) {
    flex: 1;
  }
}
</style>
