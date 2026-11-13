/**
 * 工具开关（tool_features）共享缓存
 *
 * 消费方：
 *  - functions/_middleware.js   页面请求拦截停用工具（302 → /404）
 *  - functions/api/tools.js     公开接口的 disabled 列表
 *
 * 安全设计（针对「为判断开关而逐请求查库」的攻击面）：
 *  1. 成本放大：恶意刷任意页面路径本可让每个请求都产生一次 D1 读。
 *     这里按 isolate 做 TTL 缓存——窗口内最多查一次库，其余请求纯内存
 *     查 Set，刷路径不再放大数据库开销。并发突发同样只查一次：
 *     在途请求共享同一个 promise（否则页面加载时 HTML 与 /api/tools
 *     并发到达，各自都看到空缓存、各自打库，去重就名存实亡）。
 *  2. 挂起兜底：查询与 LOAD_TIMEOUT_MS 竞速——D1 抖动/挂起时页面等待
 *     有硬上限，超时走负缓存退避并放行，不会把共享在途 promise 的
 *     等待者全部拖死（在途共享会把单次挂起放大为整批请求挂起）。
 *  3. 故障退避：失败/超时做短负缓存（NEGATIVE_MS），D1 故障期间不会被
 *     反复打库；一律 fail-open（视为无停用工具，页面照常放行——前端
 *     路由守卫还有一层拦截，真正用户仍会被跳到 404）。
 *  4. 注入面：SQL 为无用户输入的固定语句，仅按 id JOIN，无 bind 参数。
 *  5. 大小写绕过：vue-router 默认大小写不敏感（sensitive:false，路由用
 *     'i' 标志编译正则），/USERINFO/TODOS 同样能渲染工具页；而 DB 里的
 *     url 是小写规范形、SQLite = 区分大小写——两端必须统一按
 *     「去尾斜杠 + 小写」归一后比对，否则大写变体可绕过拦截。
 *
 * 新鲜度：TTL 30s 内管理员刚关掉的工具，服务端 302 最多延迟 30s 生效；
 * 真实浏览器不受影响——页面加载后 /api/tools（无缓存）驱动的前端守卫
 * 会立即把停用工具跳到 /404，TTL 只影响爬虫在窗口内拿到预渲染 HTML。
 */

const TTL_MS = 30_000
const NEGATIVE_MS = 5_000
// D1 正常为个位数毫秒；1.5s 覆盖慢查询仍远低于用户可感知的故障阈值
const LOAD_TIMEOUT_MS = 1_500

// isolate 级缓存：{ at, view } 成功态 | { at, failed: true } 负缓存态
let cache = null
// 在途加载去重：并发调用共享同一次查询
let inflight = null

/** 归一化停用集合的键：去尾斜杠 + 小写（与 DB 小写 url、vue-router 不敏感匹配对齐） */
export function normalizeToolSwitchKey(url) {
  return String(url || '').replace(/\/+$/, '').toLowerCase()
}

// 竞速哨兵（正常结果一定是 view 对象或 ERROR，不会与哨兵混淆）
const TIMEOUT = Symbol('timeout')
const ERROR = Symbol('error')

async function loadView(db) {
  let timer = null
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), LOAD_TIMEOUT_MS)
  })
  // 内部全量吞异常：无论竞速谁先落地，queryPromise 都不会以
  // rejection 结束（超时后迟到失败若无人接住会变成 unhandledrejection）
  const queryPromise = (async () => {
    try {
      const result = await db
        .prepare(
          `SELECT t.url AS url
           FROM tool_features t
           LEFT JOIN tool_categories c ON c.id = t.category_id
           WHERE t.is_enabled = 0 OR COALESCE(c.is_enabled, 1) = 0`,
        )
        .all()
      const urls = (result.results || []).map((r) => r.url).filter(Boolean)
      // 归一后为空的键（如 url='/' 的脏数据）不进集合，防止误拦首页
      const set = new Set(urls.map(normalizeToolSwitchKey).filter(Boolean))
      const view = {
        urls,
        // 传入任意路径形式（含/不含尾斜杠、任意大小写）均按归一键比对
        has: (path) => set.has(normalizeToolSwitchKey(path)),
      }
      cache = { at: Date.now(), view }
      return view
    } catch (e) {
      console.error('[tool-switch] load disabled tools failed:', e)
      return ERROR
    }
  })()

  const winner = await Promise.race([queryPromise, timeoutPromise])
  clearTimeout(timer)
  if (winner === TIMEOUT) {
    // 超时 ≠ 数据库不可用：冷启动首查（worker 编译 + D1 初始化）常超窗。
    // 只对本批等待者 fail-open，不写负缓存——在途查询迟到成功时会自行
    // 写入成功缓存，下一个请求直接命中；负缓存反而会把放行窗口无谓
    // 拉长到 NEGATIVE_MS。也不 cancel 在途查询（结果无害且可复用）。
    console.warn('[tool-switch] load disabled tools timed out, fail-open for this request')
    return null
  }
  if (winner === ERROR) {
    // 明确的数据库错误才退避，避免 D1 故障期间被反复打库
    cache = { at: Date.now(), failed: true }
    return null
  }
  return winner
}

/**
 * 取停用工具视图（带 TTL 缓存 + 在途去重 + 超时兜底）。
 * 返回 { urls: 原始 url 数组, has(path): boolean }；
 * db 未绑定或查询失败/超时返回 null（调用方按 fail-open 处理）。
 */
export async function getToolSwitchView(db) {
  if (!db) return null

  const now = Date.now()
  if (cache) {
    if (cache.failed) {
      if (now - cache.at < NEGATIVE_MS) return null
    } else if (now - cache.at < TTL_MS) {
      return cache.view
    }
  }

  if (!inflight) {
    inflight = loadView(db).finally(() => {
      inflight = null
    })
  }
  return inflight
}
