<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

type Mode = 'csv2json' | 'json2csv'
type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe' | 'custom'

const info = reactive({ title: 'CSV/TSV ↔ JSON 互转' })

const mode = ref<Mode>('csv2json')
const csvInput = ref('')
const jsonInput = ref('')
const result = ref('')

const opts = reactive({
  delimKey: 'comma' as DelimKey,
  customDelim: '',
  // CSV -> JSON
  hasHeader: true, // 第一行是列头
  // JSON -> CSV
  includeHeader: true, // 输出包含列头
})

const delim = computed(() => {
  switch (opts.delimKey) {
    case 'comma': return ','
    case 'tab': return '\t'
    case 'semicolon': return ';'
    case 'pipe': return '|'
    case 'custom': return opts.customDelim || ','
  }
})

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const s = input.replace(/\r\n/g, '\n') // 统一换行
  const len = s.length
  for (let i = 0; i < len; i++) {
    const ch = s[i]
    if (ch === '"') {
      if (inQuotes && s[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      row.push(field); field = ''
    } else if (ch === '\n' && !inQuotes) {
      row.push(field); rows.push(row)
      row = []; field = ''
    } else {
      field += ch
    }
  }
  // last cell
  row.push(field); rows.push(row)
  // 去除末尾可能的空行
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop()
  }
  return rows
}

function toJSON() {
  try {
    const rows = parseDelimited(csvInput.value || '', delim.value)
    if (!rows.length) { result.value = '[]'; return }
    let headers: string[] = []
    let dataRows: string[][] = []
    if (opts.hasHeader) {
      headers = rows[0].map((h, i) => (h ?? '').toString().trim() || `col_${i + 1}`)
      dataRows = rows.slice(1)
    } else {
      const maxCols = Math.max(...rows.map(r => r.length))
      headers = Array.from({ length: maxCols }, (_, i) => `col_${i + 1}`)
      dataRows = rows
    }
    const out = dataRows.map(r => {
      const o: Record<string, any> = {}
      headers.forEach((h, i) => { o[h] = r[i] ?? '' })
      return o
    })
    result.value = JSON.stringify(out, null, 2)
    ElMessage.success('转换成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '转换失败')
  }
}

function toCSV() {
  try {
    const data = JSON.parse(jsonInput.value || '[]')
    const arr = Array.isArray(data) ? data : [data]
    if (!arr.length) { result.value = ''; return }

    // 计算列头：合并所有对象键；若是数组项则使用 col_i
    let headers: string[] = []
    if (opts.includeHeader) {
      if (typeof arr[0] === 'object' && !Array.isArray(arr[0])) {
        const set = new Set<string>()
        for (const it of arr) {
          if (it && typeof it === 'object' && !Array.isArray(it)) {
            Object.keys(it).forEach(k => set.add(k))
          }
        }
        headers = Array.from(set)
      } else if (Array.isArray(arr[0])) {
        const maxCols = Math.max(...arr.map((r: any) => (Array.isArray(r) ? r.length : 0)))
        headers = Array.from({ length: maxCols }, (_, i) => `col_${i + 1}`)
      }
    }

    const escapeCell = (v: any): string => {
      const s = v == null ? '' : String(v)
      const d = delim.value
      const needQuote = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(d)
      const esc = s.replace(/"/g, '""')
      return needQuote ? `"${esc}"` : esc
    }

    const lines: string[] = []
    if (opts.includeHeader && headers.length) {
      lines.push(headers.map(escapeCell).join(delim.value))
    }

    for (const it of arr) {
      if (Array.isArray(it)) {
        lines.push(it.map(escapeCell).join(delim.value))
      } else if (it && typeof it === 'object') {
        const row = (headers.length ? headers : Object.keys(it)).map(h => escapeCell((it as any)[h]))
        lines.push(row.join(delim.value))
      } else {
        // 基本类型
        lines.push(escapeCell(it))
      }
    }

    result.value = lines.join('\r\n')
    ElMessage.success('转换成功')
  } catch (e: any) {
    ElMessage.error(e?.message || '转换失败，请检查 JSON 是否有效')
  }
}

function convert() {
  if (mode.value === 'csv2json') toJSON()
  else toCSV()
}

function clearAll() {
  csvInput.value = ''
  jsonInput.value = ''
  result.value = ''
}

function copyResult() { copy(result.value) }

function fillCsvExample() {
  csvInput.value = 'name,age,city\nAlice,30,Beijing\nBob,25,Shanghai'
}

function fillTsvExample() {
  opts.delimKey = 'tab'
  csvInput.value = 'name\tage\tcity\nAlice\t30\tBeijing\nBob\t25\tShanghai'
}

function fillJsonExample() {
  jsonInput.value = JSON.stringify([
    { name: 'Alice', age: 30, city: 'Beijing' },
    { name: 'Bob', age: 25, city: 'Shanghai' }
  ], null, 2)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="flex flex-wrap items-center gap-3">
        <el-radio-group v-model="mode">
          <el-radio-button label="csv2json">CSV/TSV → JSON</el-radio-button>
          <el-radio-button label="json2csv">JSON → CSV/TSV</el-radio-button>
        </el-radio-group>

        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">分隔符：</span>
          <el-select v-model="opts.delimKey" style="width: 160px">
            <el-option label="逗号 (,)" value="comma" />
            <el-option label="制表符 (Tab)" value="tab" />
            <el-option label="分号 (;)" value="semicolon" />
            <el-option label="竖线 (|)" value="pipe" />
            <el-option label="自定义" value="custom" />
          </el-select>
          <el-input
            v-if="opts.delimKey==='custom'"
            v-model="opts.customDelim"
            placeholder="自定义分隔符"
            style="width: 140px"
            maxlength="3"
          />
        </div>

        <el-switch
          v-if="mode==='csv2json'"
          v-model="opts.hasHeader"
          active-text="首行是列头"
          inactive-text="自动生成列头"
        />
        <el-switch
          v-else
          v-model="opts.includeHeader"
          active-text="输出包含列头"
          inactive-text="不包含列头"
        />

        <el-button type="primary" @click="convert">转换</el-button>
        <el-button @click="copyResult">复制结果</el-button>
        <el-button type="danger" @click="clearAll">清空</el-button>
      </div>

      <div class="mt-3 text-sm text-gray-500">
        示例：
        <el-link type="primary" @click="fillCsvExample">CSV</el-link>
        <span class="mx-1">/</span>
        <el-link type="primary" @click="fillTsvExample">TSV</el-link>
        <span class="mx-1">/</span>
        <el-link type="primary" @click="fillJsonExample">JSON</el-link>
      </div>

      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div v-if="mode==='csv2json'" class="lg:col-span-1">
          <div class="mb-2 text-sm text-gray-600">CSV/TSV 输入</div>
          <el-input type="textarea" :rows="16" v-model="csvInput" placeholder="粘贴 CSV/TSV 内容" />
        </div>
        <div v-if="mode==='json2csv'" class="lg:col-span-1">
          <div class="mb-2 text-sm text-gray-600">JSON 输入（数组）</div>
          <el-input type="textarea" :rows="16" v-model="jsonInput" placeholder='如：[{"a":1},{"a":2}]' />
        </div>

        <div :class="mode==='csv2json' ? 'lg:col-span-2' : 'lg:col-span-2'">
          <div class="mb-2 text-sm text-gray-600">结果</div>
          <el-input type="textarea" :rows="16" v-model="result" placeholder="转换结果" />
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        - 支持分隔符选择（逗号/制表符/分号/竖线/自定义）与列头推断。<br />
        - CSV→JSON：可指定首行是否列头；若否，将自动生成 col_1...。<br />
        - JSON→CSV：自动合并对象键为列头；支持选择是否输出列头。<br />
        - 支持复制、清空与示例填充。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
</style>