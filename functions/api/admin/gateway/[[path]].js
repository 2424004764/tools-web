// Admin 统一 AI 网关管理 API（catch-all 路由）
// 鉴权已在 functions/api/admin/_middleware.js 完成（Bearer JWT + is_admin）。
//
// 路由：
//   GET    /api/admin/gateway/providers          厂商列表（key 脱敏）
//   POST   /api/admin/gateway/providers          新增厂商
//   PUT    /api/admin/gateway/providers/:id      更新厂商（api_key 不传=保持不变，传空串=清除）
//   DELETE /api/admin/gateway/providers/:id      删除厂商（有模型引用时 409）
//   GET    /api/admin/gateway/models             模型列表（带厂商 slug/protocol）
//   POST   /api/admin/gateway/models             新增模型
//   PUT    /api/admin/gateway/models/:id         更新模型
//   DELETE /api/admin/gateway/models/:id         删除模型
//   GET    /api/admin/gateway/groups             调度组列表（candidates 展开模型/厂商信息）
//   POST   /api/admin/gateway/groups             新增调度组
//   PUT    /api/admin/gateway/groups/:id         更新调度组
//   DELETE /api/admin/gateway/groups/:id         删除调度组
//   POST   /api/admin/gateway/test               厂商连通性测试 {provider_id, model_id}
//   GET    /api/admin/gateway/logs               最近调用日志

import { PROTOCOLS, MODEL_CAPABILITIES } from '../../_lib/gateway/adapters.js'
import { probeProvider } from '../../_lib/gateway/index.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function ok(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function fail(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const GROUP_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/
const VENDOR_MODEL_ID_PATTERN = /^[\w.:\-\u4e00-\u9fa5/]{1,128}$/

function maskKey(key) {
  if (!key) return { has_key: false, api_key_masked: '' }
  if (key.length <= 8) return { has_key: true, api_key_masked: `${key.slice(0, 2)}****` }
  return { has_key: true, api_key_masked: `${key.slice(0, 4)}****${key.slice(-4)}` }
}

function parseJsonArray(str) {
  try {
    const v = JSON.parse(str)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const db = env.DB
  if (!db) return fail('数据库未配置', 500)

  const seg = (context.params.path || []).map((s) => decodeURIComponent(s || ''))
  const [resource, idSeg] = seg
  const id = Number(idSeg)
  const hasId = Number.isInteger(id) && id > 0

  try {
    // ============ 厂商 ============
    if (resource === 'providers') {
      if (request.method === 'GET' && !idSeg) {
        const res = await db
          .prepare(
            `SELECT id, name, slug, protocol, base_url, api_key, status, remark, sort_order, created_at, updated_at
             FROM gateway_providers ORDER BY sort_order ASC, id ASC`,
          )
          .all()
        const list = (res.results || []).map((r) => {
          const { api_key, ...rest } = r
          return { ...rest, ...maskKey(api_key) }
        })
        return ok({ list })
      }

      if (request.method === 'POST' && !idSeg) {
        const body = await request.json().catch(() => ({}))
        const name = String(body.name || '').trim()
        const slug = String(body.slug || '').trim().toLowerCase()
        const protocol = String(body.protocol || '').trim()
        const baseUrl = String(body.base_url || '').trim().replace(/\/+$/, '')
        const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''
        const remark = String(body.remark || '').slice(0, 500)
        const sortOrder = Number.isInteger(body.sort_order) ? body.sort_order : 0
        const status = body.status === 0 || body.status === false ? 0 : 1

        if (!name || name.length > 100) return fail('name 必填（≤100 字符）')
        if (!SLUG_PATTERN.test(slug)) return fail('slug 需 1~64 位小写字母/数字/-/_，字母或数字开头')
        if (!PROTOCOLS.includes(protocol)) return fail(`protocol 只能是 ${PROTOCOLS.join(' / ')}`)
        if (!/^https?:\/\//i.test(baseUrl)) return fail('base_url 必须以 http(s):// 开头')
        if (apiKey.length > 500) return fail('api_key 过长')

        try {
          const res = await db
            .prepare(
              `INSERT INTO gateway_providers (name, slug, protocol, base_url, api_key, status, remark, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(name, slug, protocol, baseUrl, apiKey, status, remark, sortOrder, nowSql(), nowSql())
            .run()
          const row = await loadProvider(db, res.meta?.last_row_id)
          return ok({ ...row, ...maskKey(row?.api_key), api_key: undefined }, 201)
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(`slug 已存在: ${slug}`, 409)
          throw err
        }
      }

      if (request.method === 'PUT' && hasId) {
        const body = await request.json().catch(() => ({}))
        const cur = await loadProvider(db, id)
        if (!cur) return fail('厂商不存在', 404)

        const fields = []
        const args = []
        const set = (col, val) => {
          fields.push(`${col} = ?`)
          args.push(val)
        }

        if (body.name !== undefined) {
          const name = String(body.name || '').trim()
          if (!name || name.length > 100) return fail('name 必填（≤100 字符）')
          set('name', name)
        }
        if (body.slug !== undefined) {
          const slug = String(body.slug || '').trim().toLowerCase()
          if (!SLUG_PATTERN.test(slug)) return fail('slug 格式非法')
          set('slug', slug)
        }
        if (body.protocol !== undefined) {
          const protocol = String(body.protocol || '').trim()
          if (!PROTOCOLS.includes(protocol)) return fail(`protocol 只能是 ${PROTOCOLS.join(' / ')}`)
          set('protocol', protocol)
        }
        if (body.base_url !== undefined) {
          const baseUrl = String(body.base_url || '').trim().replace(/\/+$/, '')
          if (!/^https?:\/\//i.test(baseUrl)) return fail('base_url 必须以 http(s):// 开头')
          set('base_url', baseUrl)
        }
        // api_key：undefined=保持；''=清除；非空=更新
        if (body.api_key !== undefined) {
          const apiKey = String(body.api_key || '').trim()
          if (apiKey.length > 500) return fail('api_key 过长')
          set('api_key', apiKey)
        }
        if (body.remark !== undefined) set('remark', String(body.remark || '').slice(0, 500))
        if (body.sort_order !== undefined) {
          if (!Number.isInteger(body.sort_order)) return fail('sort_order 需为整数')
          set('sort_order', body.sort_order)
        }
        if (body.status !== undefined) set('status', body.status === 0 || body.status === false ? 0 : 1)

        if (fields.length) {
          fields.push('updated_at = ?')
          args.push(nowSql())
          try {
            await db.prepare(`UPDATE gateway_providers SET ${fields.join(', ')} WHERE id = ?`).bind(...args, id).run()
          } catch (err) {
            if (/UNIQUE/i.test(String(err))) return fail('slug 已存在', 409)
            throw err
          }
        }
        const row = await loadProvider(db, id)
        return ok({ ...row, ...maskKey(row?.api_key), api_key: undefined })
      }

      if (request.method === 'DELETE' && hasId) {
        const used = await db
          .prepare('SELECT COUNT(*) AS n FROM gateway_models WHERE provider_id = ?')
          .bind(id)
          .first()
        if ((used?.n || 0) > 0) return fail(`该厂商下还有 ${used.n} 个模型，请先删除模型`, 409)
        await db.prepare('DELETE FROM gateway_providers WHERE id = ?').bind(id).run()
        return ok({ id, deleted: 1 })
      }
    }

    // ============ 模型 ============
    if (resource === 'models') {
      if (request.method === 'GET' && !idSeg) {
        const res = await db
          .prepare(
            `SELECT m.id, m.provider_id, m.model_id, m.name, m.capabilities, m.status, m.remark, m.created_at, m.updated_at,
                    p.slug AS provider_slug, p.name AS provider_name, p.protocol, p.status AS provider_status
             FROM gateway_models m LEFT JOIN gateway_providers p ON p.id = m.provider_id
             ORDER BY m.provider_id ASC, m.id ASC`,
          )
          .all()
        const list = (res.results || []).map((r) => ({ ...r, capabilities: parseJsonArray(r.capabilities) }))
        return ok({ list })
      }

      const validateModelBody = async (body) => {
        const out = {}
        if (body.provider_id !== undefined) {
          const pid = Number(body.provider_id)
          if (!Number.isInteger(pid) || pid <= 0) return { error: 'provider_id 非法' }
          const p = await db.prepare('SELECT id FROM gateway_providers WHERE id = ?').bind(pid).first()
          if (!p) return { error: `厂商不存在: ${pid}` }
          out.provider_id = pid
        }
        if (body.model_id !== undefined) {
          const mid = String(body.model_id || '').trim()
          if (!VENDOR_MODEL_ID_PATTERN.test(mid)) return { error: `model_id 格式非法: ${mid}` }
          out.model_id = mid
        }
        if (body.name !== undefined) out.name = String(body.name || '').trim().slice(0, 200)
        if (body.capabilities !== undefined) {
          if (!Array.isArray(body.capabilities) || body.capabilities.length === 0) return { error: 'capabilities 必须是非空数组' }
          for (const c of body.capabilities) {
            if (!MODEL_CAPABILITIES.includes(c)) return { error: `能力非法: ${c}（可选 ${MODEL_CAPABILITIES.join(' / ')}）` }
          }
          out.capabilities = JSON.stringify([...new Set(body.capabilities)])
        }
        if (body.remark !== undefined) out.remark = String(body.remark || '').slice(0, 500)
        if (body.status !== undefined) out.status = body.status === 0 || body.status === false ? 0 : 1
        return { value: out }
      }

      if (request.method === 'POST' && !idSeg) {
        const body = await request.json().catch(() => ({}))
        if (body.provider_id === undefined || body.model_id === undefined || body.capabilities === undefined) {
          return fail('provider_id / model_id / capabilities 必填')
        }
        const v = await validateModelBody(body)
        if (v.error) return fail(v.error)
        const { provider_id, model_id } = v.value
        const name = v.value.name || model_id
        const caps = v.value.capabilities
        const remark = v.value.remark || ''
        const status = v.value.status ?? 1
        try {
          const res = await db
            .prepare(
              `INSERT INTO gateway_models (provider_id, model_id, name, capabilities, status, remark, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(provider_id, model_id, name, caps, status, remark, nowSql(), nowSql())
            .run()
          return ok(await loadModel(db, res.meta?.last_row_id), 201)
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(`该厂商下已存在模型: ${model_id}`, 409)
          throw err
        }
      }

      if (request.method === 'PUT' && hasId) {
        const body = await request.json().catch(() => ({}))
        const cur = await loadModel(db, id)
        if (!cur) return fail('模型不存在', 404)
        const v = await validateModelBody(body)
        if (v.error) return fail(v.error)

        const merged = {
          provider_id: v.value.provider_id ?? cur.provider_id,
          model_id: v.value.model_id ?? cur.model_id,
          name: v.value.name !== undefined ? v.value.name : cur.name,
          capabilities: v.value.capabilities ?? cur.capabilities,
          status: v.value.status ?? cur.status,
          remark: v.value.remark !== undefined ? v.value.remark : cur.remark,
        }
        try {
          await db
            .prepare(
              `UPDATE gateway_models SET provider_id = ?, model_id = ?, name = ?, capabilities = ?, status = ?, remark = ?, updated_at = ?
               WHERE id = ?`,
            )
            .bind(
              merged.provider_id,
              merged.model_id,
              merged.name || merged.model_id,
              typeof merged.capabilities === 'string' ? merged.capabilities : JSON.stringify(parseJsonArray(merged.capabilities)),
              merged.status,
              merged.remark,
              nowSql(),
              id,
            )
            .run()
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(`该厂商下已存在模型: ${merged.model_id}`, 409)
          throw err
        }
        return ok(await loadModel(db, id))
      }

      if (request.method === 'DELETE' && hasId) {
        await db.prepare('DELETE FROM gateway_models WHERE id = ?').bind(id).run()
        return ok({ id, deleted: 1 })
      }
    }

    // ============ 调度组 ============
    if (resource === 'groups') {
      if (request.method === 'GET' && !idSeg) {
        const res = await db
          .prepare(
            `SELECT id, group_key, name, candidates, status, remark, created_at, updated_at
             FROM gateway_groups ORDER BY id ASC`,
          )
          .all()
        const groups = (res.results || []).map((g) => ({ ...g, candidates: parseJsonArray(g.candidates) }))

        // 展开候选引用的模型/厂商信息（UI 直接可渲染）
        const allModelIds = [...new Set(groups.flatMap((g) => g.candidates.map((c) => Number(c?.model)).filter(Number.isInteger)))]
        let modelMap = new Map()
        if (allModelIds.length) {
          const mres = await db
            .prepare(
              `SELECT m.id, m.model_id, m.name, m.capabilities, m.status, p.slug AS provider_slug, p.protocol, p.status AS provider_status
               FROM gateway_models m LEFT JOIN gateway_providers p ON p.id = m.provider_id
               WHERE m.id IN (${allModelIds.map(() => '?').join(',')})`,
            )
            .bind(...allModelIds)
            .all()
          modelMap = new Map((mres.results || []).map((m) => [m.id, m]))
        }
        for (const g of groups) {
          g.candidates_expanded = g.candidates.map((c) => {
            const m = modelMap.get(Number(c?.model))
            return {
              model: Number(c?.model),
              priority: Number(c?.priority ?? 100),
              exists: !!m,
              model_id: m?.model_id || '(模型已删除)',
              name: m?.name || '',
              capabilities: m ? parseJsonArray(m.capabilities) : [],
              provider_slug: m?.provider_slug || '',
              protocol: m?.protocol || '',
              status: m?.status ?? 0,
              provider_status: m?.provider_status ?? 0,
            }
          })
        }
        return ok({ list: groups })
      }

      const validateGroupBody = async (body) => {
        const out = {}
        if (body.group_key !== undefined) {
          const key = String(body.group_key || '').trim().toLowerCase()
          if (!GROUP_KEY_PATTERN.test(key)) return { error: 'group_key 需 2~64 位小写字母/数字/-/_' }
          out.group_key = key
        }
        if (body.name !== undefined) out.name = String(body.name || '').trim().slice(0, 100)
        if (body.remark !== undefined) out.remark = String(body.remark || '').slice(0, 500)
        if (body.status !== undefined) out.status = body.status === 0 || body.status === false ? 0 : 1
        if (body.candidates !== undefined) {
          if (!Array.isArray(body.candidates) || body.candidates.length === 0) return { error: 'candidates 必须是非空数组' }
          if (body.candidates.length > 10) return { error: 'candidates 最多 10 项' }
          const normalized = []
          for (const c of body.candidates) {
            const model = Number(c?.model)
            const priority = Number(c?.priority ?? 100)
            if (!Number.isInteger(model) || model <= 0) return { error: 'candidates 每项需含正整数 model（gateway_models.id）' }
            if (!Number.isInteger(priority) || priority < 1 || priority > 9999) return { error: 'priority 需为 1~9999 整数' }
            normalized.push({ model, priority })
          }
          const ids = normalized.map((c) => c.model)
          const res = await db
            .prepare(`SELECT id FROM gateway_models WHERE id IN (${ids.map(() => '?').join(',')})`)
            .bind(...ids)
            .all()
          const found = new Set((res.results || []).map((r) => r.id))
          for (const i of ids) {
            if (!found.has(i)) return { error: `候选模型不存在: ${i}` }
          }
          // 去重（同模型只保留优先级最高一项）
          const seen = new Map()
          for (const c of normalized) {
            if (!seen.has(c.model)) seen.set(c.model, c)
          }
          out.candidates = JSON.stringify([...seen.values()])
        }
        return { value: out }
      }

      if (request.method === 'POST' && !idSeg) {
        const body = await request.json().catch(() => ({}))
        if (body.group_key === undefined || body.candidates === undefined) return fail('group_key / candidates 必填')
        const v = await validateGroupBody(body)
        if (v.error) return fail(v.error)
        try {
          const res = await db
            .prepare(
              `INSERT INTO gateway_groups (group_key, name, candidates, status, remark, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              v.value.group_key,
              v.value.name || v.value.group_key,
              v.value.candidates,
              v.value.status ?? 1,
              v.value.remark || '',
              nowSql(),
              nowSql(),
            )
            .run()
          return ok(await loadGroup(db, res.meta?.last_row_id), 201)
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(`group_key 已存在: ${v.value.group_key}`, 409)
          throw err
        }
      }

      if (request.method === 'PUT' && hasId) {
        const body = await request.json().catch(() => ({}))
        const cur = await db.prepare('SELECT * FROM gateway_groups WHERE id = ?').bind(id).first()
        if (!cur) return fail('调度组不存在', 404)
        const v = await validateGroupBody(body)
        if (v.error) return fail(v.error)
        const merged = {
          group_key: v.value.group_key ?? cur.group_key,
          name: v.value.name !== undefined ? v.value.name : cur.name,
          candidates: v.value.candidates ?? cur.candidates,
          status: v.value.status ?? cur.status,
          remark: v.value.remark !== undefined ? v.value.remark : cur.remark,
        }
        try {
          await db
            .prepare(
              `UPDATE gateway_groups SET group_key = ?, name = ?, candidates = ?, status = ?, remark = ?, updated_at = ? WHERE id = ?`,
            )
            .bind(merged.group_key, merged.name, merged.candidates, merged.status, merged.remark, nowSql(), id)
            .run()
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(`group_key 已存在: ${merged.group_key}`, 409)
          throw err
        }
        return ok(await loadGroup(db, id))
      }

      if (request.method === 'DELETE' && hasId) {
        await db.prepare('DELETE FROM gateway_groups WHERE id = ?').bind(id).run()
        return ok({ id, deleted: 1 })
      }
    }

    // ============ 厂商连通性测试 ============
    if (resource === 'test' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const providerId = Number(body.provider_id)
      const modelId = String(body.model_id || '').trim()
      if (!Number.isInteger(providerId) || providerId <= 0) return fail('provider_id 必填')
      if (!modelId) return fail('model_id 必填（该厂商下任一模型 ID，用于发一条最小测试消息）')
      const result = await probeProvider(db, { providerId, modelId })
      return ok(result)
    }

    // ============ 调用日志 ============
    if (resource === 'logs' && request.method === 'GET') {
      const url = new URL(request.url)
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      const groupKey = (url.searchParams.get('group_key') || '').trim()
      const providerSlug = (url.searchParams.get('provider_slug') || '').trim()

      const where = []
      const args = []
      if (groupKey) {
        where.push('group_key = ?')
        args.push(groupKey)
      }
      if (providerSlug) {
        where.push('provider_slug = ?')
        args.push(providerSlug)
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const res = await db
        .prepare(`SELECT * FROM gateway_logs ${whereSql} ORDER BY id DESC LIMIT ?`)
        .bind(...args, limit)
        .all()
      return ok({ list: res.results || [] })
    }

    return fail('不存在的网关资源路径', 404)
  } catch (error) {
    console.error('admin/gateway error:', error)
    return fail(error.message || '服务器错误', 500)
  }
}

// ============ 加载器 ============

async function loadProvider(db, id) {
  if (!id) return null
  return db
    .prepare(
      `SELECT id, name, slug, protocol, base_url, api_key, status, remark, sort_order, created_at, updated_at
       FROM gateway_providers WHERE id = ?`,
    )
    .bind(id)
    .first()
}

async function loadModel(db, id) {
  if (!id) return null
  const row = await db
    .prepare(
      `SELECT m.id, m.provider_id, m.model_id, m.name, m.capabilities, m.status, m.remark, m.created_at, m.updated_at,
              p.slug AS provider_slug, p.name AS provider_name, p.protocol
       FROM gateway_models m LEFT JOIN gateway_providers p ON p.id = m.provider_id
       WHERE m.id = ?`,
    )
    .bind(id)
    .first()
  if (!row) return null
  return { ...row, capabilities: parseJsonArray(row.capabilities) }
}

async function loadGroup(db, id) {
  if (!id) return null
  const row = await db.prepare('SELECT * FROM gateway_groups WHERE id = ?').bind(id).first()
  if (!row) return null
  return { ...row, candidates: parseJsonArray(row.candidates) }
}
