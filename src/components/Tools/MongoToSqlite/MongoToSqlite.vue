<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { watchDebounced } from '@vueuse/core'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'

type InputFormat = 'jsonArray' | 'ndjson'
type SqliteType = 'TEXT' | 'INTEGER' | 'REAL'

interface ColumnDef {
  name: string
  originalName: string
  type: SqliteType
  isPrimaryKey: boolean
  included: boolean
}

const info = reactive({ title: 'MongoDB JSON 转 SQLite SQL' })

const inputFormat = ref<InputFormat>('jsonArray')
const tableName = ref('data')
const inputJSON = ref('')
const options = reactive({
  flattenObjects: false,
  storeComplexAsJson: true,
  addIdAsPrimaryKey: true,
})

const schemaPreview = ref<ColumnDef[]>([])
const errorMessage = ref('')
const statusMessage = ref('')
const rowStats = ref({ total: 0, columns: 0 })
const outputSQL = ref('')

const allFieldsSelected = computed({
  get: () => schemaPreview.value.length > 0 && schemaPreview.value.every(c => c.included),
  set: (val: boolean) => { schemaPreview.value.forEach(c => c.included = val) },
})

const includedColumns = computed(() => schemaPreview.value.filter(c => c.included))

// --- Parse MongoDB JSON ---
function parseMongoJSON(input: string, format: InputFormat): object[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  if (format === 'jsonArray') {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) throw new Error('JSON 数组格式需要输入一个数组')
    return parsed.filter((doc: any) => doc && typeof doc === 'object' && !Array.isArray(doc))
  }

  const lines = trimmed.split('\n').filter(line => line.trim())
  const docs: object[] = []
  for (let i = 0; i < lines.length; i++) {
    try {
      const doc = JSON.parse(lines[i].trim())
      if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
        docs.push(doc)
      }
    } catch (e: any) {
      throw new Error(`第 ${i + 1} 行解析失败: ${e.message}`)
    }
  }
  return docs
}

// --- Normalize MongoDB Extended JSON ---
function normalizeMongoExtendedJSON(value: any): any {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(normalizeMongoExtendedJSON)

  if (value.$oid) return value.$oid
  if (value.$date) {
    if (typeof value.$date === 'string') return value.$date
    if (value.$date.$numberLong) return new Date(Number(value.$date.$numberLong)).toISOString()
    return String(value.$date)
  }
  if (value.$numberInt) return parseInt(value.$numberInt, 10)
  if (value.$numberLong) return Number(value.$numberLong)
  if (value.$numberDouble) return parseFloat(value.$numberDouble)
  if (value.$numberDecimal) return parseFloat(value.$numberDecimal)
  if (value.$binary) return value.$binary
  if (value.$regex) return value.$regex
  if (value.$timestamp) return String(value.$timestamp)
  if (value.$uuid) return value.$uuid
  if (value.$undefined !== undefined) return null

  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(value)) {
    result[k] = normalizeMongoExtendedJSON(v)
  }
  return result
}

// --- Flatten nested objects ---
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey))
    } else {
      result[newKey] = value
    }
  }
  return result
}

// --- Sanitize column name ---
function sanitizeColumnName(name: string): string {
  let sanitized = name.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '_')
  if (/^\d/.test(sanitized)) sanitized = '_' + sanitized
  return sanitized
}

// --- Escape SQL string ---
function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') return String(value)
  const str = String(value)
  return "'" + str.replace(/'/g, "''") + "'"
}

// --- Infer SQLite schema ---
function inferSchema(docs: object[], opts: { flattenObjects: boolean; addIdAsPrimaryKey: boolean }): ColumnDef[] {
  const columnMap = new Map<string, Set<SqliteType>>()

  for (const doc of docs) {
    const flatDoc = opts.flattenObjects ? flattenObject(doc) : doc
    for (const [key, value] of Object.entries(flatDoc as Record<string, any>)) {
      if (!columnMap.has(key)) columnMap.set(key, new Set())
      const types = columnMap.get(key)!

      if (value === null || value === undefined) continue
      if (typeof value === 'boolean') types.add('INTEGER')
      else if (typeof value === 'number') types.add(Number.isInteger(value) ? 'INTEGER' : 'REAL')
      else if (typeof value === 'string') types.add('TEXT')
      else if (Array.isArray(value)) types.add('TEXT')
      else if (typeof value === 'object') types.add('TEXT')
    }
  }

  const columns: ColumnDef[] = []
  for (const [name, types] of columnMap) {
    let resolvedType: SqliteType = 'TEXT'
    if (types.has('TEXT')) resolvedType = 'TEXT'
    else if (types.has('REAL')) resolvedType = 'REAL'
    else if (types.has('INTEGER')) resolvedType = 'INTEGER'

    columns.push({
      name,
      originalName: name,
      type: resolvedType,
      isPrimaryKey: opts.addIdAsPrimaryKey && name === '_id',
      included: true,
    })
  }

  return columns
}

// --- Generate SQL statements ---
function generateSQL(
  docs: object[],
  tblName: string,
  columns: ColumnDef[],
  opts: { flattenObjects: boolean; storeComplexAsJson: boolean }
): string {
  const safeTableName = tblName.replace(/[^a-zA-Z0-9_]/g, '_') || 'data'
  const lines: string[] = []

  // CREATE TABLE
  const colDefs = columns.map(c => {
    const colName = sanitizeColumnName(c.name)
    const pk = c.isPrimaryKey ? ' PRIMARY KEY' : ''
    return `  "${colName}" ${c.type}${pk}`
  }).join(',\n')
  lines.push(`CREATE TABLE IF NOT EXISTS "${safeTableName}" (\n${colDefs}\n);`)
  lines.push('')

  // INSERT statements
  const colNames = columns.map(c => `"${sanitizeColumnName(c.name)}"`).join(', ')
  for (const doc of docs) {
    const flatDoc = opts.flattenObjects ? flattenObject(doc) : doc
    const values = columns.map(col => {
      let value = (flatDoc as Record<string, any>)[col.originalName]
      value = normalizeMongoExtendedJSON(value)

      if (value === null || value === undefined) return 'NULL'
      if (typeof value === 'boolean') return value ? '1' : '0'
      if (typeof value === 'number') return String(value)
      if (Array.isArray(value)) {
        const str = opts.storeComplexAsJson ? JSON.stringify(value) : String(value)
        return escapeSQL(str)
      }
      if (typeof value === 'object') {
        const str = opts.storeComplexAsJson ? JSON.stringify(value) : String(value)
        return escapeSQL(str)
      }
      return escapeSQL(value)
    }).join(', ')
    lines.push(`INSERT INTO "${safeTableName}" (${colNames}) VALUES (${values});`)
  }

  return lines.join('\n')
}

// --- Update schema preview ---
function updateSchemaPreview() {
  if (!inputJSON.value.trim()) {
    schemaPreview.value = []
    rowStats.value = { total: 0, columns: 0 }
    errorMessage.value = ''
    return
  }
  try {
    const docs = parseMongoJSON(inputJSON.value, inputFormat.value)
    const normalized = docs.map(d => normalizeMongoExtendedJSON(d))
    const cols = inferSchema(normalized, {
      flattenObjects: options.flattenObjects,
      addIdAsPrimaryKey: options.addIdAsPrimaryKey,
    })
    schemaPreview.value = cols
    rowStats.value = { total: docs.length, columns: cols.length }
    errorMessage.value = ''
  } catch (e: any) {
    errorMessage.value = e.message
    schemaPreview.value = []
    rowStats.value = { total: 0, columns: 0 }
  }
}

// --- Schema preview (debounced) ---
watchDebounced(
  [inputJSON, inputFormat],
  () => updateSchemaPreview(),
  { debounce: 500 }
)

watchDebounced(
  [() => options.flattenObjects, () => options.addIdAsPrimaryKey],
  () => updateSchemaPreview(),
  { debounce: 300 }
)

// --- Main convert ---
function convert() {
  if (!inputJSON.value.trim()) {
    ElMessage.warning('请输入 MongoDB JSON 数据')
    return
  }

  const selectedCols = includedColumns.value
  if (selectedCols.length === 0) {
    ElMessage.warning('请至少选择一个字段')
    return
  }

  try {
    const docs = parseMongoJSON(inputJSON.value, inputFormat.value)
    if (docs.length === 0) {
      ElMessage.warning('未解析到有效数据')
      return
    }

    const normalized = docs.map(d => normalizeMongoExtendedJSON(d))
    const sql = generateSQL(normalized, tableName.value, selectedCols, options)
    outputSQL.value = sql
    statusMessage.value = `已生成 SQL：CREATE TABLE + ${docs.length} 条 INSERT 语句`
    ElMessage.success(`成功转换 ${docs.length} 条记录`)
  } catch (e: any) {
    errorMessage.value = e.message || '转换失败'
    ElMessage.error(errorMessage.value)
  }
}

function downloadSQL() {
  if (!outputSQL.value) {
    ElMessage.warning('请先转换生成 SQL')
    return
  }
  const blob = new Blob([outputSQL.value], { type: 'text/sql;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tableName.value || 'data'}.sql`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function copyResult() {
  if (!outputSQL.value) {
    ElMessage.warning('请先转换生成 SQL')
    return
  }
  copy(outputSQL.value)
}

// --- Example data ---
const exampleJSONArray = `[
  {"_id": {"$oid": "6507a1f8e4b0a1"}, "name": "Alice", "age": 30, "address": {"city": "Beijing", "district": "Haidian"}, "tags": ["engineer", "golang"], "score": 95.5, "active": true},
  {"_id": {"$oid": "6507a1f8e4b0a2"}, "name": "Bob", "age": 25, "address": {"city": "Shanghai", "district": "Pudong"}, "tags": ["designer"], "score": 88.0, "active": false},
  {"_id": {"$oid": "6507a1f8e4b0a3"}, "name": "Charlie", "age": 35, "address": {"city": "Shenzhen"}, "score": 92.3, "active": true}
]`

const exampleNDJSON = `{"_id": {"$oid": "6507a1f8e4b0b1"}, "name": "Alice", "age": 30, "address": {"city": "Beijing", "district": "Haidian"}, "tags": ["engineer", "golang"], "score": 95.5, "active": true}
{"_id": {"$oid": "6507a1f8e4b0b2"}, "name": "Bob", "age": 25, "address": {"city": "Shanghai", "district": "Pudong"}, "tags": ["designer"], "score": 88.0, "active": false}
{"_id": {"$oid": "6507a1f8e4b0b3"}, "name": "Charlie", "age": 35, "address": {"city": "Shenzhen"}, "score": 92.3, "active": true}`

function loadExample(format: InputFormat) {
  inputFormat.value = format
  inputJSON.value = format === 'jsonArray' ? exampleJSONArray : exampleNDJSON
}

function clearAll() {
  inputJSON.value = ''
  outputSQL.value = ''
  schemaPreview.value = []
  rowStats.value = { total: 0, columns: 0 }
  errorMessage.value = ''
  statusMessage.value = ''
}

function autoDetectFormat(input: string): InputFormat {
  const trimmed = input.trim()
  if (trimmed.startsWith('[')) return 'jsonArray'
  const firstLine = trimmed.split('\n')[0]?.trim()
  if (firstLine?.startsWith('{')) return 'ndjson'
  return 'jsonArray'
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  if (text.trim()) {
    inputFormat.value = autoDetectFormat(text)
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <!-- Top controls -->
      <div class="flex flex-wrap items-center gap-3">
        <el-radio-group v-model="inputFormat">
          <el-radio-button label="jsonArray">JSON 数组</el-radio-button>
          <el-radio-button label="ndjson">NDJSON (每行一个)</el-radio-button>
        </el-radio-group>

        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">表名：</span>
          <el-input v-model="tableName" placeholder="data" style="width: 160px" />
        </div>

        <el-button type="primary" @click="convert">转换</el-button>
        <el-button @click="copyResult" :disabled="!outputSQL">复制 SQL</el-button>
        <el-button @click="downloadSQL" :disabled="!outputSQL">下载 .sql</el-button>
        <el-button @click="clearAll">清空</el-button>
      </div>

      <!-- Options -->
      <div class="flex flex-wrap items-center gap-4 mt-3">
        <el-switch v-model="options.flattenObjects" active-text="展开嵌套对象" inactive-text="嵌套对象存为JSON" />
        <el-switch v-model="options.storeComplexAsJson" active-text="数组/对象存为JSON" inactive-text="数组/对象转字符串" />
        <el-switch v-model="options.addIdAsPrimaryKey" active-text="_id 为主键" inactive-text="无主键" />
      </div>

      <!-- Example links -->
      <div class="mt-3 text-sm text-gray-500">
        示例：
        <el-link type="primary" @click="loadExample('jsonArray')">JSON 数组</el-link>
        <span class="mx-1">/</span>
        <el-link type="primary" @click="loadExample('ndjson')">NDJSON</el-link>
      </div>

      <!-- Input & Schema Preview -->
      <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Left: Input -->
        <div>
          <div class="mb-2 text-sm text-gray-600">
            MongoDB JSON 输入
            <span v-if="rowStats.total > 0" class="ml-2 text-green-600">
              ({{ rowStats.total }} 条记录)
            </span>
          </div>
          <el-input
            type="textarea"
            :rows="16"
            v-model="inputJSON"
            placeholder='粘贴 MongoDB 导出的 JSON 数据，如：[{"name": "Alice"}, {"name": "Bob"}]'
            class="font-mono text-sm"
            @paste="onPaste"
          />
        </div>

        <!-- Right: Schema Preview with field selection -->
        <div>
          <div class="mb-2 flex items-center justify-between">
            <div class="text-sm text-gray-600">
              字段选择 & 表结构预览
              <span v-if="schemaPreview.length > 0" class="ml-2 text-green-600">
                (已选 {{ includedColumns.length }}/{{ schemaPreview.length }})
              </span>
            </div>
            <el-checkbox
              v-if="schemaPreview.length > 0"
              v-model="allFieldsSelected"
              size="small"
              class="!mr-0"
            >全选</el-checkbox>
          </div>
          <div class="border rounded-lg p-3 bg-gray-50 font-mono text-sm h-[356px] overflow-auto">
            <div v-if="schemaPreview.length === 0 && !errorMessage" class="text-gray-400">
              输入 JSON 数据后自动预览表结构，可勾选需要导出的字段...
            </div>
            <div v-if="errorMessage" class="text-red-500">{{ errorMessage }}</div>
            <div v-if="schemaPreview.length > 0">
              <div class="text-xs text-gray-500 mb-2">
                CREATE TABLE "{{ tableName || 'data' }}" (
              </div>
              <div v-for="(col, i) in schemaPreview" :key="col.originalName" class="ml-2 flex items-center gap-1">
                <el-checkbox v-model="col.included" size="small" class="!mr-0" />
                <span class="text-gray-500">"</span>
                <el-input
                  v-model="col.name"
                  size="small"
                  :class="['inline-edit', col.included ? 'text-blue-600' : 'text-gray-400']"
                />
                <span class="text-gray-500">"</span>
                <span :class="col.included ? 'text-orange-600' : 'text-gray-400'">{{ col.type }}</span>
                <span v-if="col.isPrimaryKey" class="text-red-600 ml-1">PRIMARY KEY</span>
                <span v-if="i < schemaPreview.length - 1" :class="col.included ? '' : 'text-gray-300'">,</span>
              </div>
              <div class="text-xs text-gray-500 mt-2">);</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SQL Output -->
      <div v-if="outputSQL" class="mt-4">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-sm text-gray-600">
            生成的 SQL 语句
            <span class="ml-2 text-green-600">{{ statusMessage }}</span>
          </div>
        </div>
        <el-input
          type="textarea"
          :rows="12"
          v-model="outputSQL"
          class="font-mono text-sm"
          readonly
        />
      </div>
    </div>

    <!-- Description -->
    <ToolDetail title="功能说明">
      <div class="space-y-2 text-sm leading-7">
        <p class="font-bold">功能说明</p>
        <p>将 MongoDB 导出的 JSON 数据转换为 SQLite SQL 语句（CREATE TABLE + INSERT），纯浏览器端处理，数据不上传服务器。生成的 SQL 可直接在 SQLite 中执行。</p>
        <ul class="list-disc ml-5">
          <li><strong>JSON 数组格式</strong>：支持 mongoexport --jsonArray 导出的 JSON 数组</li>
          <li><strong>NDJSON 格式</strong>：支持 mongoexport 默认导出的每行一个 JSON 格式</li>
          <li><strong>自动推断表结构</strong>：根据数据自动推断字段类型（TEXT / INTEGER / REAL）</li>
          <li><strong>字段选择</strong>：可勾选需要导出的字段，排除不需要的字段</li>
          <li><strong>MongoDB 扩展 JSON</strong>：支持 $oid、$date、$numberInt 等扩展类型的自动转换</li>
          <li><strong>嵌套对象展开</strong>：可将嵌套对象展开为扁平列（如 address_city）</li>
          <li><strong>复杂类型处理</strong>：数组和嵌套对象可存为 JSON 文本</li>
          <li><strong>自定义表名</strong>：可指定生成的 SQLite 表名</li>
          <li><strong>自动检测格式</strong>：粘贴数据时自动识别 JSON 数组或 NDJSON 格式</li>
          <li><strong>导出方式</strong>：支持复制 SQL 到剪贴板或下载为 .sql 文件</li>
        </ul>
        <br />
        <p class="font-bold">使用场景</p>
        <ul class="list-disc ml-5">
          <li>将 MongoDB 数据导出为 SQLite SQL 脚本，方便导入到任何 SQLite 环境</li>
          <li>数据迁移：从 MongoDB 迁移数据到 SQLite</li>
          <li>数据备份：生成 SQL 脚本备份 MongoDB 数据</li>
          <li>数据分析：在 SQLite 工具中执行 SQL 脚本查询 MongoDB 数据</li>
        </ul>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
.inline-edit {
  display: inline-flex;
  width: auto;
  min-width: 60px;
  max-width: 260px;
  vertical-align: baseline;
}
.inline-edit :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  padding: 0 2px;
  border-bottom: 1px dashed #c0c4cc;
  border-radius: 0;
}
.inline-edit :deep(.el-input__wrapper:hover) {
  border-bottom-color: #409eff;
}
.inline-edit :deep(.el-input__wrapper.is-focus) {
  border-bottom-color: #409eff;
}
.inline-edit :deep(.el-input__inner) {
  font-family: inherit;
  font-size: inherit;
  padding: 0;
  height: 24px;
  line-height: 24px;
}
</style>
