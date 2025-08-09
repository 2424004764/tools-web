<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

type KV = { key: string; value: string; enabled: boolean }

type FormItem = { key: string; type: 'text' | 'file'; value?: string; files?: File[]; enabled: boolean }

const info = reactive({ title: '在线请求调试' })

const method = ref<'GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'>('GET')
const url = ref('')
const params = ref<KV[]>([{ key: '', value: '', enabled: true }])
const headers = ref<KV[]>([{ key: '', value: '', enabled: true }])

const bodyMode = ref<'none'|'json'|'form'|'form-data'|'raw'>('none')
const formItems = ref<FormItem[]>([{ key: '', type: 'text', value: '', enabled: true }])
const bodyText = ref('')

const loading = ref(false)
// 响应相关
const respStatus = ref('')
const respTime = ref<number | null>(null)
const respSize = ref<number | null>(null)
const respHeaders = ref<KV[]>([])
const respBody = ref('')
const respContentType = ref('')
const respPreviewUrl = ref<string | null>(null)

// 新增：cURL 导入弹窗和内容
const showCurlDialog = ref(false)
const curlText = ref('')

function addRow(list: any) { list.value.push({ key: '', value: '', enabled: true }) }
function removeRow(list: any, idx: number) { list.value.splice(idx, 1) }

const builtUrl = computed(() => {
  if (!url.value) return ''
  try {
    const u = new URL(url.value)
    const search = new URLSearchParams(u.search)
    params.value.filter(p => p.enabled && p.key).forEach(p => search.set(p.key, p.value))
    u.search = search.toString()
    return u.toString()
  } catch {
    return url.value
  }
})

function collectHeaders(): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.value.filter(h => h.enabled && h.key).forEach(h => obj[h.key] = h.value)
  return obj
}

function ensureHeader(name: string, value: string) {
  const exists = headers.value.some(h => h.enabled && h.key.toLowerCase() === name.toLowerCase())
  if (!exists) headers.value.push({ key: name, value, enabled: true })
}

function buildBody(): BodyInit | undefined {
  if (method.value === 'GET' || method.value === 'HEAD') return undefined
  if (bodyMode.value === 'none') return undefined
  if (bodyMode.value === 'json') {
    ensureHeader('Content-Type', 'application/json')
    return bodyText.value || ''
  }
  if (bodyMode.value === 'form') {
    ensureHeader('Content-Type', 'application/x-www-form-urlencoded')
    const usp = new URLSearchParams()
    formItems.value.filter(i => i.enabled && i.key && i.type !== 'file').forEach(i => usp.append(i.key, i.value || ''))
    return usp.toString()
  }
  if (bodyMode.value === 'form-data') {
    // multipart form-data：由浏览器自动设置 boundary，不应手动设 Content-Type
    removeHeader('Content-Type')
    const fd = new FormData()
    formItems.value.filter(i => i.enabled && i.key).forEach(i => {
      if (i.type === 'file') {
        (i.files || []).forEach(f => fd.append(i.key, f, f.name))
      } else {
        fd.append(i.key, i.value ?? '')
      }
    })
    return fd
  }
  if (bodyMode.value === 'raw') {
    return bodyText.value
  }
  return undefined
}

async function send() {
  if (!url.value) return
  loading.value = true
  respStatus.value = ''
  respTime.value = null
  respSize.value = null
  respHeaders.value = []
  respBody.value = ''
  if (respPreviewUrl.value) {
    URL.revokeObjectURL(respPreviewUrl.value)
    respPreviewUrl.value = null
  }
  respContentType.value = ''

  const start = performance.now()
  try {
    const init: RequestInit = {
      method: method.value,
      headers: collectHeaders(),
    }
    const body = buildBody()
    if (body !== undefined) (init as any).body = body
    const target = builtUrl.value || url.value
    const res = await fetch(target, init)
    const end = performance.now()
    respTime.value = Math.round(end - start)
    respStatus.value = `${res.status} ${res.statusText}`
    res.headers.forEach((v, k) => respHeaders.value.push({ key: k, value: v, enabled: true }))
    const buf = await res.arrayBuffer()
    respSize.value = buf.byteLength

    const ct = res.headers.get('content-type') || ''
    respContentType.value = ct
    if (ct.startsWith('image/')) {
      const blob = new Blob([buf], { type: ct })
      respPreviewUrl.value = URL.createObjectURL(blob)
      respBody.value = ''
    } else {
      let text = ''
      try { text = new TextDecoder('utf-8').decode(buf) } catch { text = '[二进制内容]' }
      if (ct.includes('application/json')) {
        try { respBody.value = JSON.stringify(JSON.parse(text), null, 2) }
        catch { respBody.value = text }
      } else {
        respBody.value = text
      }
    }
  } catch (e: any) {
    respStatus.value = '请求失败'
    respBody.value = String(e?.message || e)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (respPreviewUrl.value) {
    URL.revokeObjectURL(respPreviewUrl.value)
  }
})

// 新增：移除指定 Header（处理 form-data 不允许手设 Content-Type）
function removeHeader(name: string) {
  headers.value = headers.value.filter(h => !(h.enabled && h.key && h.key.toLowerCase() === name.toLowerCase()))
}

// 新增：文件选择
function onFileChange(idx: number, e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  formItems.value[idx].files = files
}

// 新增：添加 form 表单项（默认文本）
function addFormItem() {
  formItems.value.push({ key: '', type: 'text', value: '', enabled: true })
}

// 新增：shell 单引号转义
function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

// 新增：导出 cURL（复制到剪贴板）
function exportCurl() {
  const target = builtUrl.value || url.value
  if (!target) return
  const parts: string[] = ['curl', shellQuote(target)]
  if (method.value && method.value !== 'GET') {
    parts.push('-X', method.value)
  }
  headers.value.filter(h => h.enabled && h.key).forEach(h => {
    parts.push('-H', shellQuote(`${h.key}: ${h.value || ''}`))
  })

  if (method.value !== 'GET' && bodyMode.value !== 'none') {
    if (bodyMode.value === 'json') {
      // 若未显式设置，则补充 JSON 头
      const hasCT = headers.value.some(h => h.enabled && h.key?.toLowerCase() === 'content-type')
      if (!hasCT) parts.push('-H', shellQuote('Content-Type: application/json'))
      parts.push('--data-raw', shellQuote(bodyText.value))
    } else if (bodyMode.value === 'form') {
      const usp = new URLSearchParams()
      formItems.value.filter(i => i.enabled && i.key && i.type !== 'file').forEach(i => usp.append(i.key, i.value || ''))
      const data = usp.toString()
      const hasCT = headers.value.some(h => h.enabled && h.key?.toLowerCase() === 'content-type')
      if (!hasCT) parts.push('-H', shellQuote('Content-Type: application/x-www-form-urlencoded'))
      parts.push('--data-raw', shellQuote(data))
    } else if (bodyMode.value === 'form-data') {
      formItems.value.filter(i => i.enabled && i.key).forEach(i => {
        if (i.type === 'file') {
          const names = (i.files || []).map(f => f.name)
          if (names.length === 0) {
            // 未选择文件时导出占位
            parts.push('-F', shellQuote(`${i.key}=@<选择文件路径>`))
          } else {
            names.forEach(n => parts.push('-F', shellQuote(`${i.key}=@./${n}`)))
          }
        } else {
          parts.push('-F', shellQuote(`${i.key}=${i.value ?? ''}`))
        }
      })
    } else if (bodyMode.value === 'raw') {
      parts.push('--data-raw', shellQuote(bodyText.value))
    }
  }
  copy(parts.join(' '))
}

// 新增：解析 cURL（导入）
function confirmImportCurl() {
  parseCurl(curlText.value || '')
  showCurlDialog.value = false
  curlText.value = ''
}

function parseCurl(raw: string) {
  if (!raw.trim()) return
  // reset
  method.value = 'GET'
  params.value = [{ key: '', value: '', enabled: true }]
  headers.value = [{ key: '', value: '', enabled: true }]
  bodyMode.value = 'none'
  formItems.value = [{ key: '', type: 'text', value: '', enabled: true }]
  bodyText.value = ''
  url.value = ''

  const s = raw.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim()

  // method
  const m = s.match(/-X\s+([A-Z]+)/)
  if (m) method.value = m[1] as any

  // url
  const urlM = s.match(/--url\s+(['"])(.*?)\1/)
  if (urlM) {
    url.value = urlM[2]
  } else {
    const u2 = s.match(/https?:\/\/[^\s'"]+/)
    if (u2) url.value = u2[0]
  }

  // headers
  const hRe = /(?:-H|--header)\s+(['"])(.*?)\1/g
  let hm: RegExpExecArray | null
  headers.value = []
  while ((hm = hRe.exec(s))) {
    const pair = hm[2]
    const idx = pair.indexOf(':')
    if (idx > -1) {
      const k = pair.slice(0, idx).trim()
      const v = pair.slice(idx + 1).trim()
      headers.value.push({ key: k, value: v, enabled: true })
    }
  }
  if (headers.value.length === 0) headers.value = [{ key: '', value: '', enabled: true }]

  // form-data (-F)
  const fRe = /(?:-F|--form)\s+(['"])(.*?)\1/g
  const formItemsTmp: FormItem[] = []
  let fm: RegExpExecArray | null
  while ((fm = fRe.exec(s))) {
    const p = fm[2]
    const eq = p.indexOf('=')
    if (eq > -1) {
      const k = p.slice(0, eq)
      const v = p.slice(eq + 1)
      if (v.startsWith('@')) {
        formItemsTmp.push({ key: k, type: 'file', files: [], enabled: true })
      } else {
        formItemsTmp.push({ key: k, type: 'text', value: v, enabled: true })
      }
    }
  }

  if (formItemsTmp.length > 0) {
    bodyMode.value = 'form-data'
    formItems.value = formItemsTmp
    return
  }

  // data (-d/--data/--data-raw/--data-binary)
  const dRe = /(?:--data(?:-raw|-binary)?|-d)\s+(['"])([\s\S]*?)\1/g
  const ds: string[] = []
  let dm: RegExpExecArray | null
  while ((dm = dRe.exec(s))) ds.push(dm[2])
  if (ds.length > 0) {
    const dataStr = ds[ds.length - 1]
    bodyText.value = dataStr
    const ct = headers.value.find(h => h.enabled && h.key?.toLowerCase() === 'content-type')?.value?.toLowerCase() || ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      bodyMode.value = 'form'
      // 尝试拆分为表单键值
      const usp = new URLSearchParams(dataStr)
      formItems.value = []
      usp.forEach((v, k) => formItems.value.push({ key: k, type: 'text', value: v, enabled: true }))
      if (formItems.value.length === 0) formItems.value = [{ key: '', type: 'text', value: '', enabled: true }]
    } else if (ct.includes('application/json')) {
      bodyMode.value = 'json'
    } else {
      bodyMode.value = 'raw'
    }
    if (!m && method.value === 'GET') method.value = 'POST'
  }
}

// 新增：响应 JSON 格式化
function formatRespJson() {
  if (!respBody.value) return
  try {
    const obj = JSON.parse(respBody.value)
    respBody.value = JSON.stringify(obj, null, 2)
  } catch {
    // 非严格 JSON，忽略
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <div class="flex items-center gap-2">
        <el-select v-model="method" style="width: 130px">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
          <el-option label="PATCH" value="PATCH" />
          <el-option label="HEAD" value="HEAD" />
          <el-option label="OPTIONS" value="OPTIONS" />
        </el-select>
        <el-input v-model="url" placeholder="https://api.example.com/path" />
        <el-button type="primary" :loading="loading" @click="send">发送</el-button>
        <el-button text @click="showCurlDialog = true">导入 cURL</el-button>
        <el-button text @click="exportCurl">复制 cURL</el-button>
      </div>

      <div v-if="builtUrl && builtUrl !== url" class="text-xs text-gray-500">最终请求: {{ builtUrl }}</div>

      <el-tabs type="border-card">
        <el-tab-pane label="Params">
          <div class="space-y-2">
            <div v-for="(p, i) in params" :key="i" class="flex items-center gap-2">
              <el-checkbox v-model="p.enabled" />
              <el-input v-model="p.key" placeholder="key" style="width: 220px" />
              <el-input v-model="p.value" placeholder="value" />
              <el-button text type="danger" @click="removeRow(params, i)">删除</el-button>
            </div>
            <el-button text type="primary" @click="addRow(params)">添加参数</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Headers">
          <div class="space-y-2">
            <div v-for="(h, i) in headers" :key="i" class="flex items-center gap-2">
              <el-checkbox v-model="h.enabled" />
              <el-input v-model="h.key" placeholder="Header" style="width: 260px" />
              <el-input v-model="h.value" placeholder="Value" />
              <el-button text type="danger" @click="removeRow(headers, i)">删除</el-button>
            </div>
            <el-button text type="primary" @click="addRow(headers)">添加Header</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Body">
          <div class="space-y-3">
            <el-radio-group v-model="bodyMode">
              <el-radio label="none">none</el-radio>
              <el-radio label="json">JSON</el-radio>
              <el-radio label="form">x-www-form-urlencoded</el-radio>
              <el-radio label="form-data">form-data</el-radio>
              <el-radio label="raw">Raw</el-radio>
            </el-radio-group>

            <div v-if="bodyMode === 'json' || bodyMode === 'raw'">
              <el-input v-model="bodyText" type="textarea" :rows="8" placeholder='JSON 或任意文本。JSON示例: {"a":1}' />
            </div>

            <div v-if="bodyMode === 'form'" class="space-y-2">
              <div v-for="(f, i) in formItems" :key="'f-'+i" v-show="f.type !== 'file'" class="flex items-center gap-2">
                <el-checkbox v-model="f.enabled" />
                <el-input v-model="f.key" placeholder="key" style="width: 220px" />
                <el-input v-model="f.value" placeholder="value" />
                <el-button text type="danger" @click="removeRow(formItems, i)">删除</el-button>
              </div>
              <el-button text type="primary" @click="addFormItem">添加字段</el-button>
            </div>

            <div v-if="bodyMode === 'form-data'" class="space-y-2">
              <div v-for="(f, i) in formItems" :key="'fd-'+i" class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <el-checkbox v-model="f.enabled" />
                  <el-input v-model="f.key" placeholder="key" style="width: 220px" />
                  <el-select v-model="f.type" style="width: 120px">
                    <el-option label="文本" value="text" />
                    <el-option label="文件" value="file" />
                  </el-select>
                  <template v-if="f.type === 'text'">
                    <el-input v-model="f.value" placeholder="value" />
                  </template>
                  <template v-else>
                    <input type="file" multiple @change="onFileChange(i, $event)" />
                  </template>
                  <el-button text type="danger" @click="removeRow(formItems, i)">删除</el-button>
                </div>
                <div v-if="f.type === 'file' && f.files?.length" class="text-xs text-gray-500">
                  已选: {{ f.files.map(ff => ff.name).join(', ') }}
                </div>
              </div>
              <el-button text type="primary" @click="addFormItem">添加字段</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <ToolDetail title="响应">
      <div class="space-y-2">
        <div class="text-sm">
          状态: {{ respStatus }}
          <span v-if="respTime !== null"> | 时间: {{ respTime }}ms</span>
          <span v-if="respSize !== null"> | 大小: {{ (respSize/1024).toFixed(2) }} KB</span>
        </div>
        <el-tabs>
          <el-tab-pane label="Body">
            <div v-if="respContentType.startsWith('image/')">
              <img :src="respPreviewUrl || ''" alt="响应图片" style="max-width:100%;max-height:60vh;" />
            </div>
            <div v-else>
              <div class="mb-2 flex items-center gap-2">
                <el-button size="small" @click="formatRespJson" v-if="respBody">美化 JSON</el-button>
                <el-button size="small" @click="copy(respBody)" v-if="respBody">复制响应</el-button>
              </div>
              <el-input type="textarea" :rows="12" v-model="respBody" />
            </div>
          </el-tab-pane>
          <el-tab-pane label="Headers">
            <el-table :data="respHeaders" size="small">
              <el-table-column prop="key" label="Header" width="260" />
              <el-table-column prop="value" label="Value" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </ToolDetail>

    <ToolDetail title="说明">
      <el-text>
        仅支持目标接口已开启 CORS 或同源的请求；如需跨域访问，可在服务端增加通用代理后再使用。
      </el-text>
    </ToolDetail>

    <el-dialog v-model="showCurlDialog" title="导入 cURL" width="600px">
      <el-input v-model="curlText" type="textarea" :rows="10" placeholder="粘贴 curl 命令，例如：curl 'https://api.example.com' -X POST -H 'Content-Type: application/json'" />
      <template #footer>
        <el-button @click="showCurlDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmImportCurl">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.space-y-2 > * + * { margin-top: .5rem; }
.space-y-3 > * + * { margin-top: .75rem; }
</style>