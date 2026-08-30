// Admin 数据表统计 API
// GET  /api/admin/db-stats           所有表：注释、总行数、今日/7日/30日新增
// GET  /api/admin/db-stats/trend?table=xxx   单表近 30 天每日新增行数（折线图数据）
//
// 中间件 _middleware.js 已确保调用方为管理员，无需再做权限检查。
//
// 说明：
// - SQLite 没有表注释，注释维护在本文件的 TABLE_META（与 migrations 同步补充）
// - 各表行创建时间列不统一（create_time / created_at / used_at ...），
//   通过 TABLE_META.timeCol + timeKind 生成对应 SQL：
//     text  → DATETIME/ISO 字符串（date(col) 可解析）
//     date  → 'YYYY-MM-DD' 纯日期字符串
//     int   → 秒级时间戳（unixepoch）
//     intms → 毫秒级时间戳
// - 统计口径为 UTC 日界（与 AdminDashboard 的 date('now') 口径一致）

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

/**
 * 表元数据：comment = 中文说明；timeCol/timeKind = 行创建时间列（无则不统计增量）
 * 新增表后在此补一行即可纳入完整统计
 */
const TABLE_META = {
  user:                        { comment: '用户',               timeCol: 'created_at',  timeKind: 'text' },
  user_credits:                { comment: '用户积分',           timeCol: 'created_at',  timeKind: 'text' },
  credit_transactions:         { comment: '积分流水',           timeCol: 'created_at',  timeKind: 'text' },
  credit_redeem_codes:         { comment: '积分兑换码',         timeCol: 'created_at',  timeKind: 'text' },
  credit_redeem_attempts:      { comment: '兑换码尝试（防刷）', timeCol: 'attempt_date', timeKind: 'date' },
  tool_features:               { comment: '工具功能开关',       timeCol: 'created_at',  timeKind: 'text' },
  tool_models:                 { comment: '工具模型配置',       timeCol: 'created_at',  timeKind: 'text' },
  tool_usage_records:          { comment: '工具使用记录',       timeCol: 'used_at',     timeKind: 'int' },
  generation_records:          { comment: 'AI 生成记录',        timeCol: 'created_at',  timeKind: 'text' },
  api_error_logs:              { comment: '接口错误日志',       timeCol: 'created_at',  timeKind: 'text' },
  ai_apps:                     { comment: 'AI 应用',            timeCol: 'create_time', timeKind: 'text' },
  ai_media_works:              { comment: 'AI 媒体作品',        timeCol: 'created_at',  timeKind: 'text' },
  ai_models:                   { comment: 'AI 模型配置',        timeCol: 'create_time', timeKind: 'text' },
  ai_providers:                { comment: 'AI 提供商配置',      timeCol: 'create_time', timeKind: 'text' },
  user_favorite_apps:          { comment: '收藏的 AI 应用',     timeCol: 'create_time', timeKind: 'text' },
  user_favorite_tools:         { comment: '收藏的工具',         timeCol: 'create_time', timeKind: 'text' },
  user_tool_prompts:           { comment: '用户提示词',         timeCol: 'created_at',  timeKind: 'text' },
  user_tool_prompt_groups:     { comment: '用户提示词分组',     timeCol: 'created_at',  timeKind: 'text' },
  bookmarks:                   { comment: '网址收藏',           timeCol: 'create_time', timeKind: 'text' },
  short_links:                 { comment: '短链接',             timeCol: 'create_time', timeKind: 'text' },
  notes:                       { comment: '笔记',               timeCol: 'create_time', timeKind: 'text' },
  note_groups:                 { comment: '笔记分组',           timeCol: 'create_time', timeKind: 'text' },
  todos:                       { comment: '待办事项',           timeCol: 'create_time', timeKind: 'text' },
  letters:                     { comment: '慢递信件',           timeCol: 'createTime',  timeKind: 'intms' },
  food_log:                    { comment: '饮食记录',           timeCol: 'created_at',  timeKind: 'text' },
  flashcards:                  { comment: '单词卡',             timeCol: 'created_at',  timeKind: 'text' },
  flashcard_decks:             { comment: '单词卡组',           timeCol: 'created_at',  timeKind: 'text' },
  flashcard_reviews:           { comment: '单词卡复习记录',     timeCol: 'reviewed_at', timeKind: 'text' },
  height_members:              { comment: '身高记录成员',       timeCol: 'create_time', timeKind: 'text' },
  height_records:              { comment: '身高记录',           timeCol: 'create_time', timeKind: 'text' },
  weight_members:              { comment: '体重记录成员',       timeCol: 'create_time', timeKind: 'text' },
  weight_records:              { comment: '体重记录',           timeCol: 'create_time', timeKind: 'text' },
  salary_members:              { comment: '工资单成员',         timeCol: 'create_time', timeKind: 'text' },
  salary_records:              { comment: '工资记录',           timeCol: 'create_time', timeKind: 'text' },
  fixed_expenses:              { comment: '固定支出',           timeCol: 'create_time', timeKind: 'text' },
  price_comparison_entries:    { comment: '比价记录',           timeCol: 'create_time', timeKind: 'text' },
  price_comparison_items:      { comment: '比价明细',           timeCol: 'create_time', timeKind: 'text' },
  music_playlists:             { comment: '音乐歌单',           timeCol: 'created_at',  timeKind: 'text' },
  music_playlist_songs:        { comment: '音乐歌单歌曲',       timeCol: 'added_at',    timeKind: 'text' },
  music_songs:                 { comment: '音乐歌曲',           timeCol: 'created_at',  timeKind: 'text' },
  music_settings:              { comment: '音乐设置',           timeCol: 'updated_at',  timeKind: 'text' },
  music_user_quota:            { comment: '音乐用户配额',       timeCol: 'updated_at',  timeKind: 'text' },
  travel_maps:                 { comment: '旅行地图',           timeCol: 'created_at',  timeKind: 'text' },
  travel_map_routes:           { comment: '旅行地图路线',       timeCol: 'created_at',  timeKind: 'text' },
  travel_map_points:           { comment: '旅行地图点',         timeCol: 'created_at',  timeKind: 'text' },
  password_entries:            { comment: '密码条目',           timeCol: 'create_time', timeKind: 'text' },
  password_groups:             { comment: '密码分组',           timeCol: 'create_time', timeKind: 'text' },
  oss_credentials:             { comment: 'OSS 配置',           timeCol: 'create_time', timeKind: 'text' },
  mock_schemas:                { comment: 'Mock 方案',          timeCol: 'create_time', timeKind: 'text' },
  life_trajectories:           { comment: '人生轨迹',           timeCol: 'create_time', timeKind: 'text' },
  qa_pages:                    { comment: 'QA 页面',            timeCol: 'create_time', timeKind: 'text' },
  user_season_scenery:         { comment: '四季景色',           timeCol: 'create_time', timeKind: 'text' },
  hotlist_cache:               { comment: '热榜缓存',           timeCol: 'fetched_at',  timeKind: 'text' },
}

// 统计口径阈值：今日 / 近7日 / 近30日（含当天）
function sinceExpr(timeKind, daysAgo) {
  const d = daysAgo === 0 ? "date('now')" : `date('now', '-${daysAgo} days')`
  switch (timeKind) {
    case 'int':   return `strftime('%s', ${d})`
    case 'intms': return `strftime('%s', ${d}) * 1000`
    default:      return d // text / date：date(col) 与 date('now') 均为 'YYYY-MM-DD'
  }
}

function geExpr(timeCol, timeKind, daysAgo) {
  const since = sinceExpr(timeKind, daysAgo)
  if (timeKind === 'text') return `date(${timeCol}) >= ${since}`
  return `${timeCol} >= ${since}`
}

// 单表四指标一次查询
function statsSql(table, meta) {
  if (!meta.timeCol) {
    return `SELECT COUNT(*) AS total, 0 AS today, 0 AS last7, 0 AS last30 FROM ${table}`
  }
  const c = meta.timeCol
  return `SELECT COUNT(*) AS total,
    SUM(CASE WHEN ${geExpr(c, meta.timeKind, 0)}  THEN 1 ELSE 0 END) AS today,
    SUM(CASE WHEN ${geExpr(c, meta.timeKind, 6)}  THEN 1 ELSE 0 END) AS last7,
    SUM(CASE WHEN ${geExpr(c, meta.timeKind, 29)} THEN 1 ELSE 0 END) AS last30
  FROM ${table}`
}

// 表名合法性（全部来自 sqlite_master，双保险）
const SAFE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const url = new URL(request.url)

  try {
    // ============ 趋势：单表近 30 天每日新增 ============
    const trendTable = url.searchParams.get('table')
    if (trendTable) {
      if (!SAFE_NAME.test(trendTable)) return jsonError('表名不合法', 400)
      const meta = TABLE_META[trendTable]
      if (!meta || !meta.timeCol) return jsonError('该表不支持增量趋势统计', 400)

      const c = meta.timeCol
      const where30 = meta.timeKind === 'text'
        ? `date(${c}) >= date('now', '-29 days')`
        : `${c} >= ${sinceExpr(meta.timeKind, 29)}`
      const groupExpr = meta.timeKind === 'int'
        ? `date(${c}, 'unixepoch')`
        : meta.timeKind === 'intms'
          ? `date(${c} / 1000, 'unixepoch')`
          : `date(${c})`

      const result = await db
        .prepare(`SELECT ${groupExpr} AS d, COUNT(*) AS c FROM ${trendTable} WHERE ${where30} GROUP BY d ORDER BY d`)
        .all()
      return json({
        table: trendTable,
        points: (result.results || []).map((r) => ({ date: r.d, count: Number(r.c || 0) })),
      })
    }

    // ============ 全表清单统计 ============
    const tablesResult = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite\\_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
      )
      .all()
    const tableNames = (tablesResult.results || []).map((r) => r.name).filter((n) => SAFE_NAME.test(n))

    // 分批 batch（每批 20 条），单表一条聚合 SQL
    const stats = []
    const CHUNK = 20
    for (let i = 0; i < tableNames.length; i += CHUNK) {
      const chunk = tableNames.slice(i, i + CHUNK)
      const statements = chunk.map((name) => db.prepare(statsSql(name, TABLE_META[name] || {})))
      const results = await db.batch(statements)
      results.forEach((res, idx) => {
        const name = chunk[idx]
        const meta = TABLE_META[name]
        const row = res.results?.[0] || {}
        stats.push({
          name,
          comment: meta?.comment || '未登记表',
          tracked: !!meta?.timeCol,
          total: Number(row.total || 0),
          today: Number(row.today || 0),
          last7: Number(row.last7 || 0),
          last30: Number(row.last30 || 0),
        })
      })
    }

    // 有时间列的在前，组内按总数降序，便于前端默认选中
    stats.sort((a, b) => (b.tracked - a.tracked) || (b.total - a.total) || a.name.localeCompare(b.name))

    return json({ tables: stats, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('DbStats API错误:', error)
    return jsonError(error.message || '服务器错误')
  }
}
