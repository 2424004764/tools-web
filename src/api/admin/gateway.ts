// Admin 统一 AI 网关 CRUD API 封装
// 对应后端 functions/api/admin/gateway/[[path]].js
import { functionsRequest } from '@/utils/functionsRequest'

// ============ 类型 ============

export type GatewayProtocol = 'openai' | 'anthropic' | 'gemini'

export const GATEWAY_PROTOCOLS: { value: GatewayProtocol; label: string }[] = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic 原生' },
  { value: 'gemini', label: 'Gemini 原生' },
]

export const GATEWAY_CAPABILITY_OPTIONS = [
  { value: 'chat', label: '生文 chat' },
  { value: 'image_gen', label: '生图 image_gen' },
  { value: 'image_edit', label: '图生图 image_edit（P2）' },
  { value: 'video', label: '生视频 video（P2）' },
]

export interface GatewayProvider {
  id: number
  name: string
  slug: string
  protocol: GatewayProtocol
  base_url: string
  status: 0 | 1
  remark: string
  sort_order: number
  has_key: boolean
  api_key_masked: string
  created_at: string
  updated_at: string
}

export interface GatewayModel {
  id: number
  provider_id: number
  model_id: string
  name: string
  capabilities: string[]
  status: 0 | 1
  remark: string
  provider_slug: string
  provider_name: string
  protocol: GatewayProtocol
  provider_status: number
  created_at: string
  updated_at: string
}

export interface GatewayCandidate {
  model: number
  priority: number
}

export interface GatewayCandidateExpanded extends GatewayCandidate {
  exists: boolean
  model_id: string
  name: string
  capabilities: string[]
  provider_slug: string
  protocol: string
  status: number
  provider_status: number
}

export interface GatewayGroup {
  id: number
  group_key: string
  name: string
  candidates: GatewayCandidate[]
  candidates_expanded?: GatewayCandidateExpanded[]
  status: 0 | 1
  remark: string
  created_at: string
  updated_at: string
}

export interface GatewayLog {
  id: number
  uid: string
  capability: string
  group_key: string
  provider_slug: string
  model_id: string
  ok: number
  http_status: number
  duration_ms: number
  attempts: number
  error: string
  /** 请求入参快照（data URL 已脱敏，超长已截断） */
  request_body: string
  /** 响应出参快照（流式=累计全文；图片=占位摘要） */
  response_body: string
  /** 首字时间 ms（非流式=总耗时） */
  ttft_ms: number
  input_tokens: number
  output_tokens: number
  finish_reason: string
  /** 容灾尝试链明细 JSON：[{provider, model_id, status, durationMs, error?}] */
  attempts_detail: string
  created_at: string
}

export interface GatewayAttemptDetail {
  provider: string
  model_id: string
  status: number
  durationMs: number
  error?: string
}

// ============ 厂商 ============

export async function fetchGatewayProviders(): Promise<GatewayProvider[]> {
  const res = await functionsRequest.get('/api/admin/gateway/providers')
  return res.data.data?.list || []
}

export interface ProviderPayload {
  name?: string
  slug?: string
  protocol?: GatewayProtocol
  base_url?: string
  /** 不传=保持不变；传空串=清除 */
  api_key?: string
  remark?: string
  sort_order?: number
  status?: 0 | 1
}

export async function createGatewayProvider(payload: ProviderPayload & { name: string; slug: string; protocol: GatewayProtocol; base_url: string }): Promise<GatewayProvider> {
  const res = await functionsRequest.post('/api/admin/gateway/providers', payload)
  return res.data.data
}

export async function updateGatewayProvider(id: number, payload: ProviderPayload): Promise<GatewayProvider> {
  const res = await functionsRequest.put(`/api/admin/gateway/providers/${id}`, payload)
  return res.data.data
}

export async function deleteGatewayProvider(id: number): Promise<{ deleted: number }> {
  const res = await functionsRequest.delete(`/api/admin/gateway/providers/${id}`)
  return res.data.data
}

export async function testGatewayProvider(providerId: number, modelId: string): Promise<{ ok: boolean; latencyMs: number; reply?: string; status?: number; error?: string }> {
  const res = await functionsRequest.post('/api/admin/gateway/test', { provider_id: providerId, model_id: modelId })
  return res.data.data
}

// ============ 模型 ============

export async function fetchGatewayModels(): Promise<GatewayModel[]> {
  const res = await functionsRequest.get('/api/admin/gateway/models')
  return res.data.data?.list || []
}

export interface ModelPayload {
  provider_id?: number
  model_id?: string
  name?: string
  capabilities?: string[]
  remark?: string
  status?: 0 | 1
}

export async function createGatewayModel(payload: ModelPayload & { provider_id: number; model_id: string; capabilities: string[] }): Promise<GatewayModel> {
  const res = await functionsRequest.post('/api/admin/gateway/models', payload)
  return res.data.data
}

export async function updateGatewayModel(id: number, payload: ModelPayload): Promise<GatewayModel> {
  const res = await functionsRequest.put(`/api/admin/gateway/models/${id}`, payload)
  return res.data.data
}

export async function deleteGatewayModel(id: number): Promise<{ deleted: number }> {
  const res = await functionsRequest.delete(`/api/admin/gateway/models/${id}`)
  return res.data.data
}

// ============ 调度组 ============

export async function fetchGatewayGroups(): Promise<GatewayGroup[]> {
  const res = await functionsRequest.get('/api/admin/gateway/groups')
  return res.data.data?.list || []
}

export interface GroupPayload {
  group_key?: string
  name?: string
  candidates?: GatewayCandidate[]
  remark?: string
  status?: 0 | 1
}

export async function createGatewayGroup(payload: GroupPayload & { group_key: string; candidates: GatewayCandidate[] }): Promise<GatewayGroup> {
  const res = await functionsRequest.post('/api/admin/gateway/groups', payload)
  return res.data.data
}

export async function updateGatewayGroup(id: number, payload: GroupPayload): Promise<GatewayGroup> {
  const res = await functionsRequest.put(`/api/admin/gateway/groups/${id}`, payload)
  return res.data.data
}

export async function deleteGatewayGroup(id: number): Promise<{ deleted: number }> {
  const res = await functionsRequest.delete(`/api/admin/gateway/groups/${id}`)
  return res.data.data
}

// ============ 日志 ============

export async function fetchGatewayLogs(params?: { limit?: number; group_key?: string; provider_slug?: string }): Promise<GatewayLog[]> {
  const res = await functionsRequest.get('/api/admin/gateway/logs', { params })
  return res.data.data?.list || []
}
