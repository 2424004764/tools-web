<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'XML 格式化'

const source = ref('')
const result = ref('')
const indentSize = ref(2)
const errorMessage = ref('')

interface Token {
  type: 'tag-open' | 'tag-close' | 'tag-self' | 'pi' | 'doctype' | 'comment' | 'cdata' | 'text'
  value: string
}

// 拆开书写，避免源码中出现 HTML 注释序列（dev 依赖扫描器会把它们误判为注释导致解析错位）
const LT = '<'
const GT = '>'
const COMMENT_OPEN = LT + '!--'
const COMMENT_CLOSE = '--' + GT
const CDATA_OPEN = LT + '![CDATA['
const CDATA_CLOSE = ']]' + GT
const PI_OPEN = LT + '?'
const PI_CLOSE = '?' + GT
const DOCTYPE_OPEN = LT + '!'
const TAG_CLOSE_OPEN = LT + '/'

function tokenize(xml: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = xml.length
  while (i < n) {
    if (xml[i] === LT) {
      if (xml.startsWith(COMMENT_OPEN, i)) {
        const end = xml.indexOf(COMMENT_CLOSE, i + 4)
        if (end < 0) throw new Error('注释未闭合')
        tokens.push({ type: 'comment', value: xml.slice(i, end + 3) })
        i = end + 3
      } else if (xml.startsWith(CDATA_OPEN, i)) {
        const end = xml.indexOf(CDATA_CLOSE, i + 9)
        if (end < 0) throw new Error('CDATA 未闭合')
        tokens.push({ type: 'cdata', value: xml.slice(i, end + 3) })
        i = end + 3
      } else if (xml.startsWith(PI_OPEN, i)) {
        const end = xml.indexOf(PI_CLOSE, i + 2)
        if (end < 0) throw new Error('处理指令未闭合')
        tokens.push({ type: 'pi', value: xml.slice(i, end + 2) })
        i = end + 2
      } else if (xml.startsWith(DOCTYPE_OPEN, i)) {
        // DOCTYPE（不解析内部子集，读到匹配的 > 为止，忽略 [] 内的 >）
        let depth = 0
        let j = i
        for (; j < n; j++) {
          if (xml[j] === '[') depth++
          else if (xml[j] === ']') depth--
          else if (xml[j] === '>' && depth <= 0) break
        }
        if (j >= n) throw new Error('DOCTYPE 未闭合')
        tokens.push({ type: 'doctype', value: xml.slice(i, j + 1) })
        i = j + 1
      } else if (xml.startsWith(TAG_CLOSE_OPEN, i)) {
        const end = xml.indexOf('>', i + 2)
        if (end < 0) throw new Error('结束标签未闭合')
        tokens.push({ type: 'tag-close', value: xml.slice(i, end + 1) })
        i = end + 1
      } else {
        const end = xml.indexOf('>', i + 1)
        if (end < 0) throw new Error('标签未闭合')
        const inner = xml.slice(i + 1, end)
        const selfClosing = inner.endsWith('/')
        tokens.push({
          type: selfClosing ? 'tag-self' : 'tag-open',
          value: selfClosing ? `<${inner.slice(0, -1).trim()}>` : xml.slice(i, end + 1),
        })
        i = end + 1
      }
    } else {
      const next = xml.indexOf('<', i)
      const end = next < 0 ? n : next
      const text = xml.slice(i, end)
      if (text.trim()) tokens.push({ type: 'text', value: text })
      i = end
    }
  }
  return tokens
}

const tagName = (tag: string) => {
  const m = tag.match(/^<\/?\s*([^\s/>]+)/)
  return m ? m[1] : ''
}

function format(xml: string, indent: number): string {
  const tokens = tokenize(xml)
  const pad = ' '.repeat(indent)
  let depth = 0
  const out: string[] = []
  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx]
    if (t.type === 'tag-close') depth = Math.max(0, depth - 1)
    const line = pad.repeat(depth) + t.value
    // 纯文本内容紧跟标签放同一行：<a>text</a> 单行展示
    const isShortText =
      t.type === 'tag-open' &&
      tokens[idx + 1]?.type === 'text' &&
      tokens[idx + 2]?.type === 'tag-close' &&
      tokens[idx + 2].value === `</${tagName(t.value)}>`
    if (isShortText) {
      out.push(line + tokens[idx + 1].value + tokens[idx + 2].value)
      idx += 2
      continue
    }
    out.push(line)
    if (t.type === 'tag-open') depth++
  }
  return out.join('\n')
}

function minify(xml: string): string {
  const tokens = tokenize(xml)
  return tokens
    .filter((t) => t.type !== 'text' || t.value.trim())
    .map((t) => (t.type === 'text' ? t.value.trim() : t.value))
    .join('')
}

const doFormat = () => {
  errorMessage.value = ''
  if (!source.value.trim()) {
    ElMessage.warning('请输入 XML 内容')
    return
  }
  try {
    result.value = format(source.value, indentSize.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    ElMessage.error('XML 解析失败：' + errorMessage.value)
  }
}

const doMinify = () => {
  errorMessage.value = ''
  if (!source.value.trim()) {
    ElMessage.warning('请输入 XML 内容')
    return
  }
  try {
    result.value = minify(source.value)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    ElMessage.error('XML 解析失败：' + errorMessage.value)
  }
}

const copy = async () => {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

const sample = [
  PI_OPEN + 'xml version="1.0" encoding="UTF-8"' + PI_CLOSE,
  '<note id="1"><to>张三</to><from>李四</from><message>你好，<b>世界</b></message>',
  COMMENT_OPEN + ' 注释 ' + COMMENT_CLOSE,
  '<extra flag="true"/></note>',
].join('')
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="mb-4">
        <h1 class="text-h2 font-semibold">XML 格式化</h1>
        <p class="mt-1 text-body-sm text-slate-500">
          XML 在线格式化与压缩，支持缩进设置、注释/CDATA/DOCTYPE 保留与语法错误提示。
        </p>
      </header>

      <div class="xml-toolbar">
        <div class="flex items-center gap-3">
          <span class="text-body-sm text-slate-500">缩进</span>
          <el-radio-group v-model="indentSize">
            <el-radio-button :value="2">2 空格</el-radio-button>
            <el-radio-button :value="4">4 空格</el-radio-button>
          </el-radio-group>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-button type="primary" @click="doFormat">格式化</el-button>
          <el-button @click="doMinify">压缩</el-button>
          <el-button :disabled="!result" @click="copy">复制结果</el-button>
          <el-button @click="source = sample; result = ''">示例</el-button>
          <el-button @click="source = ''; result = ''; errorMessage = ''">清空</el-button>
        </div>
      </div>

      <el-alert v-if="errorMessage" type="error" :title="errorMessage" :closable="false" class="mb-3" show-icon />

      <div class="xml-layout">
        <div class="xml-pane">
          <div class="xml-pane-head"><span>输入</span><span class="text-body-sm text-slate-500">{{ source.length.toLocaleString() }} 字符</span></div>
          <el-input v-model="source" type="textarea" :rows="16" placeholder="粘贴 XML 内容…" spellcheck="false" />
        </div>
        <div class="xml-pane">
          <div class="xml-pane-head"><span>输出</span><span class="text-body-sm text-slate-500">{{ result.length.toLocaleString() }} 字符</span></div>
          <el-input v-model="result" type="textarea" :rows="16" readonly placeholder="格式化结果…" spellcheck="false" />
        </div>
      </div>
    </section>

    <ToolDetail title="使用说明">
      <el-text>
        粘贴 XML 后点击「格式化」按选定缩进重新排版，短文本节点（如 &lt;a&gt;text&lt;/a&gt;）会保持在同一行；「压缩」移除标签间空白得到单行 XML。注释、CDATA、处理指令与 DOCTYPE 均会原样保留；标签未闭合、注释未闭合等语法问题会在上方给出提示。格式化基于内置解析器完成，内容不会上传服务器。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.xml-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.xml-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.xml-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.xml-pane-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  height: 28px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.xml-pane :deep(textarea) {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
}

@media (max-width: 767px) {
  .xml-layout {
    grid-template-columns: 1fr;
  }
}
</style>
