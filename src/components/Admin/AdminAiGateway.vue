<script setup lang="ts">
// 统一 AI 网关管理页
// 厂商（base_url + key + 出协议）→ 模型注册（厂商侧 model_id + 能力）→ 调度组（候选链容灾）
// 底部调试台直接调 /api/ai-gateway 验证整条链路（含流式/生图/容灾切换）。
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getLocalToken } from '@/utils/user'
import {
  GATEWAY_PROTOCOLS,
  GATEWAY_CAPABILITY_OPTIONS,
  fetchGatewayProviders,
  createGatewayProvider,
  updateGatewayProvider,
  deleteGatewayProvider,
  testGatewayProvider,
  fetchGatewayModels,
  createGatewayModel,
  updateGatewayModel,
  deleteGatewayModel,
  fetchGatewayGroups,
  createGatewayGroup,
  updateGatewayGroup,
  deleteGatewayGroup,
  fetchGatewayLogs,
} from '@/api/admin/gateway'
import type {
  GatewayProvider,
  GatewayModel,
  GatewayGroup,
  GatewayLog,
  GatewayProtocol,
  GatewayCandidate,
  GatewayAttemptDetail,
} from '@/api/admin/gateway'

const activeTab = ref('providers')

const formatTime = (s: string) => {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

// ============ 厂商 ============

const providersLoading = ref(false)
const providers = ref<GatewayProvider[]>([])

const loadProviders = async () => {
  providersLoading.value = true
  try {
    providers.value = await fetchGatewayProviders()
  } catch (err) {
    console.error(err)
  } finally {
    providersLoading.value = false
  }
}

const providerDialog = reactive({
  visible: false,
  editing: null as GatewayProvider | null,
  form: {
    name: '',
    slug: '',
    protocol: 'openai' as GatewayProtocol,
    base_url: '',
    api_key: '',
    remark: '',
    sort_order: 0,
    status: 1 as 0 | 1,
  },
  submitting: false,
})

const openProviderCreate = () => {
  providerDialog.editing = null
  providerDialog.form = { name: '', slug: '', protocol: 'openai', base_url: '', api_key: '', remark: '', sort_order: 0, status: 1 }
  providerDialog.visible = true
}

const openProviderEdit = (row: GatewayProvider) => {
  providerDialog.editing = row
  providerDialog.form = {
    name: row.name,
    slug: row.slug,
    protocol: row.protocol,
    base_url: row.base_url,
    api_key: '',
    remark: row.remark,
    sort_order: row.sort_order,
    status: row.status,
  }
  providerDialog.visible = true
}

const submitProvider = async () => {
  const f = providerDialog.form
  if (!f.name || !f.slug || !f.base_url) {
    ElMessage.warning('名称 / slug / base_url 必填')
    return
  }
  providerDialog.submitting = true
  try {
    if (providerDialog.editing) {
      const payload: Record<string, unknown> = {
        name: f.name, slug: f.slug, protocol: f.protocol, base_url: f.base_url,
        remark: f.remark, sort_order: f.sort_order, status: f.status,
      }
      // api_key 不填 = 保持不变；填了（含清空）才提交
      if (f.api_key !== '') payload.api_key = f.api_key
      await updateGatewayProvider(providerDialog.editing.id, payload)
      ElMessage.success('已更新')
    } else {
      await createGatewayProvider({
        name: f.name, slug: f.slug, protocol: f.protocol, base_url: f.base_url,
        api_key: f.api_key, remark: f.remark, sort_order: f.sort_order, status: f.status,
      })
      ElMessage.success('已新增')
    }
    providerDialog.visible = false
    loadProviders()
  } catch (err) {
    console.error(err)
  } finally {
    providerDialog.submitting = false
  }
}

const removeProvider = async (row: GatewayProvider) => {
  try {
    await ElMessageBox.confirm(`确定删除厂商「${row.name}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteGatewayProvider(row.id)
    ElMessage.success('已删除')
    loadProviders()
  } catch (err) {
    console.error(err)
  }
}

const toggleProvider = async (row: GatewayProvider, value: 0 | 1 | boolean) => {
  const status = value === 1 || value === true ? 1 : 0
  const prev = row.status
  row.status = status
  try {
    await updateGatewayProvider(row.id, { status })
  } catch (err) {
    row.status = prev
    console.error(err)
  }
}

// 测试连接
const testDialog = reactive({
  visible: false,
  provider: null as GatewayProvider | null,
  modelId: '',
  running: false,
  result: null as { ok: boolean; latencyMs: number; reply?: string; status?: number; error?: string } | null,
})

const openTest = (row: GatewayProvider) => {
  testDialog.provider = row
  testDialog.modelId = ''
  testDialog.result = null
  testDialog.visible = true
}

const runTest = async () => {
  if (!testDialog.provider || !testDialog.modelId.trim()) {
    ElMessage.warning('请填写该厂商下任一模型 ID')
    return
  }
  testDialog.running = true
  testDialog.result = null
  try {
    testDialog.result = await testGatewayProvider(testDialog.provider.id, testDialog.modelId.trim())
  } catch (err) {
    console.error(err)
  } finally {
    testDialog.running = false
  }
}

const protocolLabel = (p: string) => GATEWAY_PROTOCOLS.find((x) => x.value === p)?.label || p

// ============ 模型 ============

const modelsLoading = ref(false)
const models = ref<GatewayModel[]>([])

const loadModels = async () => {
  modelsLoading.value = true
  try {
    models.value = await fetchGatewayModels()
  } catch (err) {
    console.error(err)
  } finally {
    modelsLoading.value = false
  }
}

const modelDialog = reactive({
  visible: false,
  editing: null as GatewayModel | null,
  form: {
    provider_id: '' as number | '',
    model_id: '',
    name: '',
    capabilities: ['chat'] as string[],
    remark: '',
    status: 1 as 0 | 1,
  },
  submitting: false,
})

const openModelCreate = () => {
  modelDialog.editing = null
  modelDialog.form = {
    provider_id: providers.value[0]?.id ?? ('' as number | ''),
    model_id: '', name: '', capabilities: ['chat'], remark: '', status: 1,
  }
  modelDialog.visible = true
}

const openModelEdit = (row: GatewayModel) => {
  modelDialog.editing = row
  modelDialog.form = {
    provider_id: row.provider_id,
    model_id: row.model_id,
    name: row.name,
    capabilities: [...row.capabilities],
    remark: row.remark,
    status: row.status,
  }
  modelDialog.visible = true
}

const submitModel = async () => {
  const f = modelDialog.form
  if (!f.provider_id || !f.model_id || !f.capabilities.length) {
    ElMessage.warning('厂商 / model_id / 能力 必填')
    return
  }
  modelDialog.submitting = true
  try {
    if (modelDialog.editing) {
      await updateGatewayModel(modelDialog.editing.id, {
        provider_id: Number(f.provider_id), model_id: f.model_id, name: f.name,
        capabilities: f.capabilities, remark: f.remark, status: f.status,
      })
      ElMessage.success('已更新')
    } else {
      await createGatewayModel({
        provider_id: Number(f.provider_id), model_id: f.model_id, name: f.name,
        capabilities: f.capabilities, remark: f.remark, status: f.status,
      })
      ElMessage.success('已新增')
    }
    modelDialog.visible = false
    loadModels()
  } catch (err) {
    console.error(err)
  } finally {
    modelDialog.submitting = false
  }
}

const removeModel = async (row: GatewayModel) => {
  try {
    await ElMessageBox.confirm(`确定删除模型「${row.model_id}」？引用它的调度组候选会显示为已删除。`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteGatewayModel(row.id)
    ElMessage.success('已删除')
    loadModels()
    loadGroups()
  } catch (err) {
    console.error(err)
  }
}

const toggleModel = async (row: GatewayModel, value: 0 | 1 | boolean) => {
  const status = value === 1 || value === true ? 1 : 0
  const prev = row.status
  row.status = status
  try {
    await updateGatewayModel(row.id, { status })
  } catch (err) {
    row.status = prev
    console.error(err)
  }
}

// ============ 调度组 ============

const groupsLoading = ref(false)
const groups = ref<GatewayGroup[]>([])

const loadGroups = async () => {
  groupsLoading.value = true
  try {
    groups.value = await fetchGatewayGroups()
  } catch (err) {
    console.error(err)
  } finally {
    groupsLoading.value = false
  }
}

const groupDialog = reactive({
  visible: false,
  editing: null as GatewayGroup | null,
  group_key: '',
  name: '',
  remark: '',
  status: 1 as 0 | 1,
  candidates: [] as GatewayCandidate[],
  submitting: false,
})

const openGroupCreate = () => {
  groupDialog.editing = null
  groupDialog.group_key = ''
  groupDialog.name = ''
  groupDialog.remark = ''
  groupDialog.status = 1
  groupDialog.candidates = []
  groupDialog.visible = true
}

const openGroupEdit = (row: GatewayGroup) => {
  groupDialog.editing = row
  groupDialog.group_key = row.group_key
  groupDialog.name = row.name
  groupDialog.remark = row.remark
  groupDialog.status = row.status
  groupDialog.candidates = (row.candidates || []).map((c) => ({ model: c.model, priority: c.priority }))
  groupDialog.visible = true
}

const addCandidate = () => {
  groupDialog.candidates.push({ model: models.value[0]?.id ?? 0, priority: (groupDialog.candidates.length + 1) * 10 })
}

const removeCandidate = (i: number) => groupDialog.candidates.splice(i, 1)

const moveCandidate = (i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= groupDialog.candidates.length) return
  const arr = groupDialog.candidates
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}

const modelOptions = computed(() =>
  models.value.map((m) => ({
    value: m.id,
    label: `#${m.id} ${m.provider_slug || '?'}/${m.model_id}${m.capabilities.length ? ` (${m.capabilities.join(',')})` : ''}`,
  })),
)

const submitGroup = async () => {
  if (!groupDialog.group_key || !groupDialog.candidates.length) {
    ElMessage.warning('group_key 与候选链必填')
    return
  }
  groupDialog.submitting = true
  try {
    if (groupDialog.editing) {
      await updateGatewayGroup(groupDialog.editing.id, {
        group_key: groupDialog.group_key, name: groupDialog.name, remark: groupDialog.remark,
        status: groupDialog.status, candidates: groupDialog.candidates,
      })
      ElMessage.success('已更新')
    } else {
      await createGatewayGroup({
        group_key: groupDialog.group_key, name: groupDialog.name, remark: groupDialog.remark,
        status: groupDialog.status, candidates: groupDialog.candidates,
      })
      ElMessage.success('已新增')
    }
    groupDialog.visible = false
    loadGroups()
  } catch (err) {
    console.error(err)
  } finally {
    groupDialog.submitting = false
  }
}

const removeGroup = async (row: GatewayGroup) => {
  try {
    await ElMessageBox.confirm(`确定删除调度组「${row.group_key}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteGatewayGroup(row.id)
    ElMessage.success('已删除')
    loadGroups()
  } catch (err) {
    console.error(err)
  }
}

const toggleGroup = async (row: GatewayGroup, value: 0 | 1 | boolean) => {
  const status = value === 1 || value === true ? 1 : 0
  const prev = row.status
  row.status = status
  try {
    await updateGatewayGroup(row.id, { status })
  } catch (err) {
    row.status = prev
    console.error(err)
  }
}

// ============ 调用日志 ============

const logsLoading = ref(false)
const logs = ref<GatewayLog[]>([])
const logsFilter = reactive({ group_key: '' })

const loadLogs = async () => {
  logsLoading.value = true
  try {
    logs.value = await fetchGatewayLogs({ limit: 100, group_key: logsFilter.group_key || undefined })
  } catch (err) {
    console.error(err)
  } finally {
    logsLoading.value = false
  }
}

// 日志详情弹窗：入参 / 出参 / 容灾尝试链 / 错误
const logDetail = reactive({
  visible: false,
  row: null as GatewayLog | null,
})

const prettyJson = (s: string) => {
  if (!s) return ''
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

const logAttempts = computed<GatewayAttemptDetail[]>(() => {
  if (!logDetail.row?.attempts_detail) return []
  try {
    const v = JSON.parse(logDetail.row.attempts_detail)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
})

const openLogDetail = (row: GatewayLog) => {
  logDetail.row = row
  logDetail.visible = true
}

// ============ 调试台 ============

const pg = reactive({
  capability: 'chat_stream' as 'chat' | 'chat_stream' | 'image_gen',
  groupKey: '',
  systemPrompt: '',
  prompt: '用一句话介绍你自己',
  size: '1024x1024',
  maxTokens: 512 as number | '',
  running: false,
  content: '',
  reasoning: '',
  imageUrl: '',
  meta: null as { provider?: string; model?: string; group?: string; duration_ms?: number; attempts?: Array<{ provider: string; model_id: string; status: number; durationMs: number; error?: string }> } | null,
  error: '',
  /** 本次实际发出的请求体（发送时冻结，供排障比对） */
  requestBody: '',
  /** 失败时的原始响应文本（非 JSON 时也能看到 CDN/代理返回了什么） */
  rawResponse: '',
  httpStatus: 0,
})

/** 调试台请求预览：随表单实时变化，发送前就能看到将要发出的完整报文 */
const pgRequestUrl = `${window.location.origin}/api/ai-gateway`
const requestBodyPreview = computed(() =>
  JSON.stringify({ capability: pg.capability, group: pg.groupKey || '(未选择调度组)', payload: pgPayload() }, null, 2),
)
const curlPreview = computed(
  () =>
    `curl -N -X POST '${pgRequestUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer <登录JWT>' \\\n  --data '${JSON.stringify({ capability: pg.capability, group: pg.groupKey || '(未选择调度组)', payload: pgPayload() })}'`,
)

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

const pgPayload = () => {
  if (pg.capability === 'image_gen') {
    return { prompt: pg.prompt, size: pg.size }
  }
  const messages: Array<{ role: string; content: string }> = []
  if (pg.systemPrompt.trim()) messages.push({ role: 'system', content: pg.systemPrompt.trim() })
  messages.push({ role: 'user', content: pg.prompt })
  return { messages, ...(pg.maxTokens ? { max_tokens: Number(pg.maxTokens) } : {}) }
}

const renderAttempts = (meta: NonNullable<typeof pg.meta>) => {
  if (!meta?.attempts?.length) return ''
  return meta.attempts
    .map((a) => `${a.provider}/${a.model_id} → ${a.status || 'network'}${a.error ? `（${a.error.slice(0, 60)}）` : ''} ${a.durationMs}ms`)
    .join(' | ')
}

const runPlayground = async () => {
  if (!pg.groupKey) {
    ElMessage.warning('请选择调度组')
    return
  }
  if (!pg.prompt.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  pg.running = true
  pg.content = ''
  pg.reasoning = ''
  pg.imageUrl = ''
  pg.meta = null
  pg.error = ''
  pg.rawResponse = ''
  pg.httpStatus = 0

  const token = getLocalToken()
  const bodyToSend = {
    capability: pg.capability,
    group: pg.groupKey,
    payload: pgPayload(),
  }
  // 冻结本次实际请求体（之后改表单也不影响排障比对）
  pg.requestBody = JSON.stringify(bodyToSend, null, 2)
  try {
    const res = await fetch('/api/ai-gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(bodyToSend),
    })
    pg.httpStatus = res.status

    if (pg.capability === 'chat_stream') {
      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        let err: { error?: string } = {}
        try {
          err = JSON.parse(raw)
        } catch {
          /* 非 JSON（CDN/代理错误页等），原文展示在 rawResponse */
        }
        pg.error = err.error || `调用失败: ${res.status}（响应非 JSON，见下方原始响应）`
        pg.rawResponse = raw.slice(0, 1500)
        return
      }
      const provider = res.headers.get('X-Gateway-Provider') || ''
      const model = res.headers.get('X-Gateway-Model') || ''
      const reader = res.body?.getReader()
      if (!reader) {
        pg.error = '无法获取响应流'
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const ev = JSON.parse(data)
            if (ev.delta) pg.content += ev.delta
            if (ev.reasoning) pg.reasoning += ev.reasoning
            if (ev.error) pg.error = ev.error
          } catch {
            /* 忽略 */
          }
        }
      }
      pg.meta = { provider, model, group: pg.groupKey }
      return
    }

    const raw = await res.text().catch(() => '')
    let body: { ok?: boolean; error?: string; data?: { content?: string; image_url?: string }; meta?: typeof pg.meta } = {}
    try {
      body = JSON.parse(raw)
    } catch {
      /* 非 JSON，原文展示在 rawResponse */
    }
    if (!res.ok || !body.ok) {
      pg.error = body.error || `调用失败: ${res.status}（响应非 JSON，见下方原始响应）`
      pg.rawResponse = raw.slice(0, 1500)
      return
    }
    if (pg.capability === 'image_gen') {
      pg.imageUrl = body.data?.image_url || ''
    } else {
      pg.content = body.data?.content || ''
    }
    pg.meta = body.meta || null
  } catch (err: unknown) {
    pg.error = err instanceof Error ? err.message : '网络错误'
    pg.rawResponse = String(err)
  } finally {
    pg.running = false
  }
}

// ============ 初始化 ============

onMounted(() => {
  loadProviders()
  loadModels()
  loadGroups()
  loadLogs()
})

const onTabChange = (name: string | number) => {
  if (name === 'logs') loadLogs()
  if (name === 'models') loadModels()
  if (name === 'groups') loadGroups()
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end gap-3 mb-4">
      <h2 class="text-xl font-semibold text-ink-900 mr-auto">AI 网关</h2>
      <span class="text-xs text-ink-400">
        统一接入各厂商 AI（openai / anthropic / gemini 协议），调度组自动容灾切换；子站统一走 /api/ai-gateway
      </span>
    </div>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- ============ 厂商 ============ -->
      <el-tab-pane label="厂商" name="providers">
        <div class="flex items-center gap-2 mb-3">
          <el-button type="primary" @click="openProviderCreate">新增厂商</el-button>
          <el-button @click="loadProviders">刷新</el-button>
          <span class="text-xs text-ink-400">protocol 决定出协议：openai 兼容一切中转，anthropic / gemini 为官方原生</span>
        </div>
        <el-table v-loading="providersLoading" :data="providers" size="small" border>
          <el-table-column prop="name" label="名称" min-width="110" />
          <el-table-column prop="slug" label="slug" min-width="100" />
          <el-table-column label="协议" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="row.protocol === 'openai' ? 'primary' : row.protocol === 'anthropic' ? 'warning' : 'success'">
                {{ protocolLabel(row.protocol) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="base_url" label="base_url" min-width="200" show-overflow-tooltip />
          <el-table-column label="API Key" width="130">
            <template #default="{ row }">
              <span v-if="row.has_key" class="text-xs text-ink-500">{{ row.api_key_masked }}</span>
              <el-tag v-else size="small" type="danger">未配置</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="70">
            <template #default="{ row }">
              <el-switch :model-value="row.status === 1" @change="(v: any) => toggleProvider(row, v)" />
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click="openTest(row)">测试</el-button>
              <el-button size="small" link @click="openProviderEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="removeProvider(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ============ 模型 ============ -->
      <el-tab-pane label="模型" name="models">
        <div class="flex items-center gap-2 mb-3">
          <el-button type="primary" @click="openModelCreate">新增模型</el-button>
          <el-button @click="loadModels">刷新</el-button>
          <span class="text-xs text-ink-400">model_id 为厂商侧真实 ID；能力决定可被哪类 capability 调度</span>
        </div>
        <el-table v-loading="modelsLoading" :data="models" size="small" border>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column label="厂商" min-width="120">
            <template #default="{ row }">
              <span>{{ row.provider_slug || '?' }}</span>
              <el-tag v-if="row.provider_status === 0" size="small" type="danger" class="ml-1">厂商停用</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="model_id" label="model_id（厂商侧）" min-width="200" show-overflow-tooltip />
          <el-table-column prop="name" label="展示名" min-width="120" show-overflow-tooltip />
          <el-table-column label="能力" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="c in row.capabilities" :key="c" size="small" class="mr-1">{{ c }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="70">
            <template #default="{ row }">
              <el-switch :model-value="row.status === 1" @change="(v: any) => toggleModel(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link @click="openModelEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="removeModel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ============ 调度组 ============ -->
      <el-tab-pane label="调度组" name="groups">
        <div class="flex items-center gap-2 mb-3">
          <el-button type="primary" @click="openGroupCreate">新增调度组</el-button>
          <el-button @click="loadGroups">刷新</el-button>
          <span class="text-xs text-ink-400">调用方只认 group_key；候选按 priority 升序尝试，失败自动切下一家</span>
        </div>
        <el-table v-loading="groupsLoading" :data="groups" size="small" border>
          <el-table-column prop="group_key" label="group_key" min-width="140">
            <template #default="{ row }">
              <code class="text-xs">{{ row.group_key }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="110" show-overflow-tooltip />
          <el-table-column label="候选链（priority 升序）" min-width="380">
            <template #default="{ row }">
              <div v-for="(c, i) in row.candidates_expanded || []" :key="c.model" class="text-xs leading-5">
                <span class="text-ink-400 mr-1">{{ i + 1 }}.</span>
                <code>{{ c.provider_slug || '?' }}/{{ c.model_id }}</code>
                <el-tag size="small" class="ml-1" type="info">p{{ c.priority }}</el-tag>
                <el-tag v-if="!c.exists || c.status === 0 || c.provider_status === 0" size="small" type="danger" class="ml-1">不可用</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="70">
            <template #default="{ row }">
              <el-switch :model-value="row.status === 1" @change="(v: any) => toggleGroup(row, v)" />
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link @click="openGroupEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" link @click="removeGroup(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ============ 调用日志 ============ -->
      <el-tab-pane label="调用日志" name="logs">
        <div class="flex items-center gap-2 mb-3">
          <el-input v-model="logsFilter.group_key" placeholder="按 group_key 过滤" clearable class="!w-56" @keyup.enter="loadLogs" @clear="loadLogs" />
          <el-button @click="loadLogs">刷新</el-button>
        </div>
        <el-table v-loading="logsLoading" :data="logs" size="small" border>
          <el-table-column label="时间" width="160">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column prop="uid" label="uid" min-width="110" show-overflow-tooltip />
          <el-table-column prop="capability" label="能力" width="105" />
          <el-table-column prop="group_key" label="group" min-width="110" show-overflow-tooltip />
          <el-table-column prop="provider_slug" label="命中厂商" min-width="95" show-overflow-tooltip />
          <el-table-column prop="model_id" label="模型" min-width="150" show-overflow-tooltip />
          <el-table-column label="结果" width="64">
            <template #default="{ row }">
              <el-tag :type="row.ok ? 'success' : 'danger'" size="small">{{ row.ok ? '成功' : '失败' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态码" width="72">
            <template #default="{ row }">{{ row.http_status || '-' }}</template>
          </el-table-column>
          <el-table-column label="首字(ms)" width="85">
            <template #default="{ row }">{{ row.ttft_ms ? row.ttft_ms : '-' }}</template>
          </el-table-column>
          <el-table-column label="耗时(ms)" width="88">
            <template #default="{ row }">{{ row.duration_ms }}</template>
          </el-table-column>
          <el-table-column label="tokens(in/out)" width="120">
            <template #default="{ row }">
              <span v-if="row.input_tokens || row.output_tokens">{{ row.input_tokens }} / {{ row.output_tokens }}</span>
              <span v-else class="text-ink-300">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="attempts" label="尝试" width="56" />
          <el-table-column label="结束" width="92">
            <template #default="{ row }">
              <span v-if="row.finish_reason" class="text-xs">{{ row.finish_reason }}</span>
              <span v-else class="text-ink-300">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openLogDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ============ 调试台 ============ -->
      <el-tab-pane label="调试台" name="playground">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <el-card shadow="never">
            <template #header><span class="text-sm font-medium">请求</span></template>
            <el-form label-width="90px" label-position="left">
              <el-form-item label="capability">
                <el-radio-group v-model="pg.capability">
                  <el-radio-button value="chat_stream">chat_stream</el-radio-button>
                  <el-radio-button value="chat">chat</el-radio-button>
                  <el-radio-button value="image_gen">image_gen</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="调度组">
                <el-select v-model="pg.groupKey" placeholder="选择调度组" class="!w-full">
                  <el-option v-for="g in groups.filter((x) => x.status === 1)" :key="g.id" :label="`${g.group_key}（${g.name}）`" :value="g.group_key" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="pg.capability !== 'image_gen'" label="system">
                <el-input v-model="pg.systemPrompt" type="textarea" :rows="2" placeholder="可选 system prompt" />
              </el-form-item>
              <el-form-item label="内容">
                <el-input v-model="pg.prompt" type="textarea" :rows="5" />
              </el-form-item>
              <el-form-item v-if="pg.capability === 'image_gen'" label="尺寸">
                <el-select v-model="pg.size" class="!w-44">
                  <el-option v-for="s in ['1024x1024', '1792x1024', '1024x1792']" :key="s" :label="s" :value="s" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="pg.capability !== 'image_gen'" label="max_tokens">
                <el-input-number v-model="pg.maxTokens" :min="1" :max="200000" class="!w-44" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="pg.running" @click="runPlayground">发送</el-button>
              </el-form-item>
            </el-form>

            <!-- 请求预览：随表单实时变化，出错时可比对实际发出的完整报文 -->
            <div class="mt-2 pt-3 border-t border-[rgb(var(--border))]">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-xs font-medium text-ink-500">请求预览</span>
                <el-button size="small" link type="primary" @click="copyText(curlPreview)">复制 curl</el-button>
                <el-button size="small" link @click="copyText(requestBodyPreview)">复制 body</el-button>
              </div>
              <div class="text-[11px] text-ink-400 mb-1 font-mono">POST {{ pgRequestUrl }}</div>
              <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0">{{ requestBodyPreview }}</pre>
            </div>
          </el-card>

          <el-card shadow="never">
            <template #header><span class="text-sm font-medium">响应</span></template>
            <div v-if="pg.error" class="text-sm text-red-500 mb-2 whitespace-pre-wrap">{{ pg.error }}</div>
            <div v-if="pg.rawResponse" class="mb-2">
              <div class="text-xs text-red-400 mb-1">
                原始响应<span v-if="pg.httpStatus"> · HTTP {{ pg.httpStatus }}</span>（前 1500 字符）
              </div>
              <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0">{{ pg.rawResponse }}</pre>
            </div>
            <div v-if="pg.requestBody" class="mb-2">
              <div class="text-xs text-ink-400 mb-1">本次实际请求体</div>
              <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0">{{ pg.requestBody }}</pre>
            </div>
            <div v-if="pg.reasoning" class="text-xs text-ink-400 mb-2 whitespace-pre-wrap max-h-40 overflow-y-auto">[思考] {{ pg.reasoning }}</div>
            <div v-if="pg.content" class="text-sm text-ink-800 whitespace-pre-wrap">{{ pg.content }}</div>
            <img v-if="pg.imageUrl" :src="pg.imageUrl" alt="生成结果" class="mt-2 max-w-full rounded-lg border" />
            <div v-if="pg.meta" class="mt-3 pt-3 border-t text-xs text-ink-400 space-y-1">
              <div>
                命中：<el-tag size="small" type="success">{{ pg.meta.provider }}/{{ pg.meta.model }}</el-tag>
                <span v-if="pg.meta.duration_ms" class="ml-2">{{ pg.meta.duration_ms }}ms</span>
              </div>
              <div v-if="renderAttempts(pg.meta)" class="break-all">尝试链：{{ renderAttempts(pg.meta) }}</div>
            </div>
            <div v-if="!pg.content && !pg.imageUrl && !pg.error && !pg.meta" class="text-xs text-ink-400">发送请求后此处显示结果（流式增量渲染）</div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 厂商编辑弹窗 ============ -->
    <el-dialog v-model="providerDialog.visible" :title="providerDialog.editing ? '编辑厂商' : '新增厂商'" width="520">
      <el-form label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="providerDialog.form.name" placeholder="如：硅基流动" />
        </el-form-item>
        <el-form-item label="slug" required>
          <el-input v-model="providerDialog.form.slug" placeholder="小写字母/数字/-/_，如 siliconflow" :disabled="!!providerDialog.editing" />
        </el-form-item>
        <el-form-item label="协议" required>
          <el-select v-model="providerDialog.form.protocol" class="!w-full">
            <el-option v-for="p in GATEWAY_PROTOCOLS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="base_url" required>
          <el-input v-model="providerDialog.form.base_url" placeholder="https://api.example.com（带不带 /v1 均可）" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="providerDialog.form.api_key"
            type="password"
            show-password
            :placeholder="providerDialog.editing ? '不填保持不变，清空输入后提交可删除' : 'sk-...'"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="providerDialog.form.remark" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="providerDialog.form.sort_order" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="providerDialog.form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="providerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="providerDialog.submitting" @click="submitProvider">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 测试连接弹窗 ============ -->
    <el-dialog v-model="testDialog.visible" :title="`测试连接 - ${testDialog.provider?.name || ''}`" width="480">
      <el-form label-width="90px">
        <el-form-item label="模型 ID" required>
          <el-input v-model="testDialog.modelId" :placeholder="`该厂商下任一模型，如 ${testDialog.provider?.protocol === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini'}`" @keyup.enter="runTest" />
        </el-form-item>
      </el-form>
      <div v-if="testDialog.result" class="text-sm mt-2 p-3 rounded-lg bg-[rgb(var(--surface-2))]">
        <template v-if="testDialog.result.ok">
          <div class="text-green-600 font-medium mb-1">连接成功（{{ testDialog.result.latencyMs }}ms）</div>
          <div class="text-ink-700 break-all">回复：{{ testDialog.result.reply }}</div>
        </template>
        <template v-else>
          <div class="text-red-500 font-medium mb-1">连接失败（{{ testDialog.result.latencyMs }}ms）</div>
          <div class="text-ink-600 break-all">{{ testDialog.result.error }}</div>
        </template>
      </div>
      <template #footer>
        <el-button @click="testDialog.visible = false">关闭</el-button>
        <el-button type="primary" :loading="testDialog.running" @click="runTest">发送测试</el-button>
      </template>
    </el-dialog>

    <!-- ============ 模型编辑弹窗 ============ -->
    <el-dialog v-model="modelDialog.visible" :title="modelDialog.editing ? '编辑模型' : '新增模型'" width="520">
      <el-form label-width="90px">
        <el-form-item label="厂商" required>
          <el-select v-model="modelDialog.form.provider_id" class="!w-full" placeholder="选择厂商">
            <el-option v-for="p in providers" :key="p.id" :label="`${p.name}（${p.slug} / ${p.protocol}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="model_id" required>
          <el-input v-model="modelDialog.form.model_id" placeholder="厂商侧真实模型 ID，如 gemini-2.5-flash" />
        </el-form-item>
        <el-form-item label="展示名">
          <el-input v-model="modelDialog.form.name" placeholder="默认同 model_id" />
        </el-form-item>
        <el-form-item label="能力" required>
          <el-checkbox-group v-model="modelDialog.form.capabilities">
            <el-checkbox v-for="c in GATEWAY_CAPABILITY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="modelDialog.form.remark" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="modelDialog.form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modelDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="modelDialog.submitting" @click="submitModel">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 日志详情弹窗 ============ -->
    <el-dialog v-model="logDetail.visible" :title="`调用详情 #${logDetail.row?.id || ''}`" width="720" top="6vh">
      <template v-if="logDetail.row">
        <div class="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-ink-500 mb-3">
          <span>时间：{{ formatTime(logDetail.row.created_at) }}</span>
          <span>uid：<code>{{ logDetail.row.uid || '-' }}</code></span>
          <span>能力：{{ logDetail.row.capability }}</span>
          <span>group：<code>{{ logDetail.row.group_key }}</code></span>
          <span>命中：<code>{{ logDetail.row.provider_slug }}/{{ logDetail.row.model_id }}</code></span>
          <span :class="logDetail.row.ok ? 'text-green-600' : 'text-red-500'">
            {{ logDetail.row.ok ? '成功' : '失败' }}（HTTP {{ logDetail.row.http_status || '-' }}）
          </span>
          <span>首字：{{ logDetail.row.ttft_ms ? logDetail.row.ttft_ms + 'ms' : '-' }}</span>
          <span>总耗时：{{ logDetail.row.duration_ms }}ms</span>
          <span>tokens：{{ logDetail.row.input_tokens || 0 }} in / {{ logDetail.row.output_tokens || 0 }} out</span>
          <span v-if="logDetail.row.finish_reason">结束：{{ logDetail.row.finish_reason }}</span>
        </div>

        <div v-if="logAttempts.length" class="mb-3">
          <div class="text-xs text-ink-400 mb-1">容灾尝试链（按尝试顺序）</div>
          <div
            v-for="(a, i) in logAttempts"
            :key="i"
            class="text-xs leading-6"
            :class="a.error ? 'text-red-500' : 'text-ink-600'"
          >
            {{ i + 1 }}. <code>{{ a.provider }}/{{ a.model_id }}</code>
            → {{ a.status || 'network' }} · {{ a.durationMs }}ms<span v-if="a.error"> · {{ a.error }}</span>
          </div>
        </div>

        <div v-if="logDetail.row.error" class="mb-3">
          <div class="text-xs text-red-400 mb-1">错误</div>
          <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0">{{ logDetail.row.error }}</pre>
        </div>

        <div class="mb-3">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-ink-400">请求入参（data URL 已脱敏）</span>
            <el-button size="small" link @click="copyText(prettyJson(logDetail.row?.request_body || ''))">复制</el-button>
          </div>
          <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0 max-h-56 overflow-y-auto">{{ prettyJson(logDetail.row.request_body) || '(空)' }}</pre>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-ink-400">响应出参</span>
            <el-button size="small" link @click="copyText(prettyJson(logDetail.row?.response_body || ''))">复制</el-button>
          </div>
          <pre class="text-xs leading-5 bg-[rgb(var(--surface-2))] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all m-0 max-h-56 overflow-y-auto">{{ prettyJson(logDetail.row.response_body) || '(空)' }}</pre>
        </div>
      </template>
    </el-dialog>

    <!-- ============ 调度组编辑弹窗 ============ -->
    <el-dialog v-model="groupDialog.visible" :title="groupDialog.editing ? '编辑调度组' : '新增调度组'" width="640">
      <el-form label-width="90px">
        <el-form-item label="group_key" required>
          <el-input v-model="groupDialog.group_key" placeholder="小写字母/数字/-/_，如 text-default" :disabled="!!groupDialog.editing" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="groupDialog.name" placeholder="如：默认文字生成" />
        </el-form-item>
        <el-form-item label="候选链" required>
          <div class="w-full space-y-2">
            <div v-for="(c, i) in groupDialog.candidates" :key="i" class="flex items-center gap-2">
              <span class="text-xs text-ink-400 w-4">{{ i + 1 }}</span>
              <el-select v-model="c.model" filterable class="flex-1" placeholder="选择模型">
                <el-option v-for="m in modelOptions" :key="m.value" :label="m.label" :value="m.value" />
              </el-select>
              <el-input-number v-model="c.priority" :min="1" :max="9999" controls-position="right" class="!w-28" />
              <el-button size="small" link :disabled="i === 0" @click="moveCandidate(i, -1)">↑</el-button>
              <el-button size="small" link :disabled="i === groupDialog.candidates.length - 1" @click="moveCandidate(i, 1)">↓</el-button>
              <el-button size="small" type="danger" link @click="removeCandidate(i)">删</el-button>
            </div>
            <el-button size="small" @click="addCandidate">+ 添加候选</el-button>
            <div class="text-xs text-ink-400">priority 越小越先被调度；失败自动切换下一候选</div>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="groupDialog.remark" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="groupDialog.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="groupDialog.submitting" @click="submitGroup">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
