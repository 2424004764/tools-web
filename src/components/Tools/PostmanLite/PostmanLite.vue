<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

type KV = { key: string; value: string; enabled: boolean }

const info = reactive({ title: '在线请求调试' })

const method = ref<'GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'>('GET')
const url = ref('')
const params = ref<KV[]>([{ key: '', value: '', enabled: true }])
const headers = ref<KV[]>([{ key: '', value: '', enabled: true }])

const bodyMode = ref<'none'|'json'|'form'|'raw'>('none')
const formItems = ref<KV[]>([{ key: '', value: '', enabled: true }])
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
    formItems.value.filter(i => i.enabled && i.key).forEach(i => usp.append(i.key, i.value))
    return usp.toString()
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
              <el-radio label="raw">Raw</el-radio>
            </el-radio-group>

            <div v-if="bodyMode === 'json' || bodyMode === 'raw'">
              <el-input v-model="bodyText" type="textarea" :rows="8" placeholder='JSON 或任意文本。JSON示例: {"a":1}' />
            </div>

            <div v-if="bodyMode === 'form'" class="space-y-2">
              <div v-for="(f, i) in formItems" :key="i" class="flex items-center gap-2">
                <el-checkbox v-model="f.enabled" />
                <el-input v-model="f.key" placeholder="key" style="width: 220px" />
                <el-input v-model="f.value" placeholder="value" />
                <el-button text type="danger" @click="removeRow(formItems, i)">删除</el-button>
              </div>
              <el-button text type="primary" @click="addRow(formItems)">添加字段</el-button>
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
            <el-input v-else type="textarea" :rows="12" v-model="respBody" />
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
  </div>
</template>

<style scoped>
.space-y-2 > * + * { margin-top: .5rem; }
.space-y-3 > * + * { margin-top: .75rem; }
</style>