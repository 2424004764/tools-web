// 食物记录 API
// GET    /api/food-log?startAt=&endAt=&meal=     列出当前用户某时间范围内的食物记录
// POST   /api/food-log                          body: { name, meal?, category?, quantity?, calories?, note?, eatenAt? }
// PUT    /api/food-log?id=xxx                   body: { name?, meal?, category?, quantity?, calories?, note?, eatenAt? }
// DELETE /api/food-log?id=xxx                   删除单条
//
// 鉴权：与 user-tool-prompts.js 相同，强制要求登录。
// 数据隔离：每个登录用户各自一份，按 uid 过滤；PUT/DELETE 强校验 uid 防止越权。

import { extractUidFromRequest } from '../_lib/model-resolver.js'
import { ApiResponse, initDatabase, FoodLogModel, QueryBuilder } from '../../utils/db.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const ALLOWED_MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const ALLOWED_CATEGORIES = new Set([
  'staple', 'meat', 'vegetable', 'fruit', 'dairy', 'drink', 'dessert', 'snack', 'other',
])

/** 校验创建/更新输入。返回 { errors, data }；data 是清洗后的字段 */
function validateInput(body, { isUpdate = false } = {}) {
  const errors = []
  const data = {}

  if (!isUpdate) {
    // 创建时 name / meal 必填
    const name = (body?.name ?? '').toString().trim()
    if (!name) errors.push('食物名称不能为空')
    else if (name.length > 50) errors.push('食物名称不能超过 50 字符')
    data.name = name
  } else {
    if (body?.name !== undefined) {
      const name = body.name.toString().trim()
      if (!name) errors.push('食物名称不能为空')
      else if (name.length > 50) errors.push('食物名称不能超过 50 字符')
      data.name = name
    }
  }

  if (body?.meal !== undefined) {
    const meal = body.meal.toString().trim()
    if (!ALLOWED_MEALS.has(meal)) errors.push('meal 必须是 breakfast/lunch/dinner/snack 之一')
    data.meal = meal
  } else if (!isUpdate) {
    data.meal = 'snack' // 默认加餐
  }

  if (body?.category !== undefined) {
    const cat = body.category.toString().trim() || 'other'
    if (!ALLOWED_CATEGORIES.has(cat)) errors.push('category 不在白名单内')
    data.category = cat
  } else if (!isUpdate) {
    data.category = 'other'
  }

  if (body?.quantity !== undefined) {
    const q = body.quantity == null ? null : body.quantity.toString().trim()
    if (q && q.length > 30) errors.push('数量描述不能超过 30 字符')
    data.quantity = q || null
  }

  if (body?.calories !== undefined && body?.calories !== null) {
    const c = Number(body.calories)
    if (!Number.isInteger(c) || c < 0 || c > 100000) {
      errors.push('卡路里必须是非负整数（≤ 100000）')
    }
    data.calories = c
  } else if (body?.calories === null) {
    data.calories = null
  }

  if (body?.note !== undefined) {
    const n = body.note == null ? null : body.note.toString().trim()
    if (n && n.length > 200) errors.push('备注不能超过 200 字符')
    data.note = n || null
  }

  if (body?.eatenAt !== undefined) {
    const t = Number(body.eatenAt)
    if (!Number.isInteger(t) || t < 0) {
      errors.push('eatenAt 必须是秒级时间戳')
    }
    // 简单合理性校验：不接受 > 1 天后 或 < 1970
    const now = Math.floor(Date.now() / 1000)
    if (t > now + 86400) errors.push('eatenAt 不能超过当前时间 + 1 天')
    if (t < 0) errors.push('eatenAt 不能为负数')
    data.eatenAt = t
  } else if (!isUpdate) {
    data.eatenAt = Math.floor(Date.now() / 1000)
  }

  return { errors, data }
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const dbInit = initDatabase(env)
  if (!dbInit.success) {
    return new Response(JSON.stringify({ success: false, error: '数据库未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const uid = await extractUidFromRequest(request, env).catch(() => '')
  if (!uid) {
    return new Response(
      JSON.stringify({ success: false, error: '请先登录' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }

  const url = new URL(request.url)
  const model = new FoodLogModel(dbInit.db)

  try {
    // ============ GET: 列出某时间范围内（默认今天）的所有食物记录 ============
    if (request.method === 'GET') {
      const startAtParam = url.searchParams.get('startAt')
      const endAtParam = url.searchParams.get('endAt')
      const mealParam = url.searchParams.get('meal')

      // 默认「今天」(本地 UTC+8 00:00 ~ 明天 00:00)
      const nowSec = Math.floor(Date.now() / 1000)
      const nowDate = new Date()
      const today0 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime() / 1000
      const tomorrow0 = today0 + 86400

      const startAt = startAtParam ? parseInt(startAtParam, 10) : today0
      const endAt = endAtParam ? parseInt(endAtParam, 10) : tomorrow0

      if (!Number.isInteger(startAt) || !Number.isInteger(endAt)) {
        return new Response(
          JSON.stringify({ success: false, error: 'startAt/endAt 必须是整数时间戳' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      const qb = new QueryBuilder()
        .where('uid', '=', uid)
        .where('eatenAt', '>=', startAt)
        .where('eatenAt', '<', endAt)
        .orderBy('eatenAt', 'DESC')

      if (mealParam && ALLOWED_MEALS.has(mealParam)) {
        qb.where('meal', '=', mealParam)
      }

      const items = await model.findAll(qb)

      // 同步返回「今日汇总」统计：总条数 + 总卡路里 + 按时段分布
      const summary = {
        count: items.length,
        totalCalories: items.reduce((s, x) => s + (x.calories || 0), 0),
        byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
        rangeStart: startAt,
        rangeEnd: endAt,
      }
      for (const it of items) {
        if (it.meal && summary.byMeal[it.meal] !== undefined) {
          summary.byMeal[it.meal]++
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { items, summary } }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // ============ POST: 新增一条 ============
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const { errors, data } = validateInput(body, { isUpdate: false })
      if (errors.length) {
        return new Response(
          JSON.stringify({ success: false, error: errors.join('；') }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      const id = crypto.randomUUID()
      const now = nowSql()
      // 把 createdAt 一起塞进 create() 的 INSERT,避免 SQLite NOT NULL 报错
      // （原本 INSERT 不写这一列,后续 UPDATE 根本走不到）
      await model.create({ id, uid, ...data, createdAt: now })

      return new Response(
        JSON.stringify({
          success: true,
          data: { id, uid, ...data, createdAt: now },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // ============ PUT: 更新一条（必须属于当前用户） ============
    if (request.method === 'PUT') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少 id 参数' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      const body = await request.json().catch(() => ({}))
      const { errors, data } = validateInput(body, { isUpdate: true })
      if (errors.length) {
        return new Response(
          JSON.stringify({ success: false, error: errors.join('；') }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      if (Object.keys(data).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: '没有可更新的字段' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      // Model.update 自带 updated_at 字段；我们的 schema 没有 update_time，
      // 所以用 raw SQL 走 WHERE uid 强校验归属
      const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ')
      const params = [...Object.values(data), id, uid]
      const result = await dbInit.db
        .prepare(`UPDATE food_log SET ${sets} WHERE id = ? AND uid = ?`)
        .bind(...params)
        .run()
      const changes = result?.meta?.changes ?? result?.changes ?? 0
      if (changes === 0) {
        const exists = await dbInit.db
          .prepare('SELECT uid FROM food_log WHERE id = ?')
          .bind(id)
          .first()
        if (!exists) {
          return new Response(
            JSON.stringify({ success: false, error: '记录不存在' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
          )
        }
        return new Response(
          JSON.stringify({ success: false, error: '无权操作该记录' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // ============ DELETE: 删除一条（必须属于当前用户） ============
    if (request.method === 'DELETE') {
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少 id 参数' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }

      const result = await dbInit.db
        .prepare('DELETE FROM food_log WHERE id = ? AND uid = ?')
        .bind(id, uid)
        .run()
      const changes = result?.meta?.changes ?? result?.changes ?? 0
      if (changes === 0) {
        const exists = await dbInit.db
          .prepare('SELECT uid FROM food_log WHERE id = ?')
          .bind(id)
          .first()
        if (!exists) {
          return new Response(
            JSON.stringify({ success: false, error: '记录不存在' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
          )
        }
        return new Response(
          JSON.stringify({ success: false, error: '无权操作该记录' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        )
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: '不支持的请求方法' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    console.error('[food-log] 错误:', err)
    return new Response(
      JSON.stringify({ success: false, error: err?.message || '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  }
}