// 旅游地图 —— 全部 D1 读写集中在这里
// 表结构见 migrations/032_create_travel_maps.sql

const MAX_POINTS = 200
const MAX_ROUTES = 20
const MAX_ROUTE_NODES = 500
const MAX_TITLE = 60
const MAX_DESC = 500
const MAX_NOTE = 500
const MAX_NAME = 60

// 与前端 src/components/Tools/TravelMap/constants.ts 保持一致
const POINT_CATEGORIES = new Set([
  'camp', 'shop', 'water', 'food', 'toilet',
  'parking', 'viewpoint', 'lodging', 'danger', 'other',
])
const BASE_LAYERS = new Set(['vec', 'img', 'ter'])
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

// 单条 INSERT 一次塞多少行（每行 9 列，40 行 = 360 个绑定参数，远低于 SQLite 上限）
const INSERT_CHUNK = 40

class ValidationError extends Error {}

const now = () => new Date().toISOString()

function str(value, max, fallback = '') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, max)
}

function finiteNum(value) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function requireLngLat(lng, lat, label) {
  const x = finiteNum(lng)
  const y = finiteNum(lat)
  if (x === null || y === null || x < -180 || x > 180 || y < -90 || y > 90) {
    throw new ValidationError(`${label}的经纬度不合法`)
  }
  return [x, y]
}

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// 折线里程（米）。前端也算一份用于实时预览，但落库的以服务端为准：
// 里程会展示在公开的地图广场上，不能由客户端随意声明。
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371008.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function pathDistance(path) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += haversine(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
  }
  return total
}

// ============ 出参整形（统一 camelCase，前端 types.ts 与之对应）============

function mapMetaFromRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || '',
    center: { lng: row.center_lng, lat: row.center_lat },
    zoom: row.zoom,
    baseLayer: row.base_layer,
    isPublic: row.is_public === 1,
    viewCount: row.view_count,
    pointCount: row.point_count,
    routeCount: row.route_count,
    totalDistance: row.total_distance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function pointFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    lng: row.lng,
    lat: row.lat,
    elevation: row.elevation === null || row.elevation === undefined ? null : row.elevation,
    note: row.note || '',
  }
}

function routeFromRow(row) {
  let path = []
  try {
    const parsed = JSON.parse(row.path)
    if (Array.isArray(parsed)) path = parsed
  } catch {
    // 脏数据兜底：当作空路线，不让整张地图打不开
    path = []
  }
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    path,
    distance: row.distance,
    note: row.note || '',
    // 老数据没 kind 字段时默认 'straight'。新数据由前端在保存时传过来。
    kind: row.kind === 'road' ? 'road' : 'straight',
  }
}

// ============ 入参校验 ============

function normalizePoints(rawPoints) {
  if (!Array.isArray(rawPoints)) return []
  if (rawPoints.length > MAX_POINTS) {
    throw new ValidationError(`单张地图最多 ${MAX_POINTS} 个点位，当前 ${rawPoints.length} 个`)
  }
  return rawPoints.map((p, index) => {
    const [lng, lat] = requireLngLat(p?.lng, p?.lat, `第 ${index + 1} 个点位`)
    const category = POINT_CATEGORIES.has(p?.category) ? p.category : 'other'
    const elevation = p?.elevation === null || p?.elevation === undefined || p?.elevation === ''
      ? null
      : finiteNum(p.elevation)
    return {
      id: crypto.randomUUID(),
      name: str(p?.name, MAX_NAME, '未命名点位'),
      category,
      lng,
      lat,
      elevation,
      note: str(p?.note, MAX_NOTE),
      sortOrder: index,
    }
  })
}

function normalizeRoutes(rawRoutes) {
  if (!Array.isArray(rawRoutes)) return []
  if (rawRoutes.length > MAX_ROUTES) {
    throw new ValidationError(`单张地图最多 ${MAX_ROUTES} 条路线，当前 ${rawRoutes.length} 条`)
  }
  return rawRoutes.map((r, index) => {
    const rawPath = Array.isArray(r?.path) ? r.path : []
    if (rawPath.length > MAX_ROUTE_NODES) {
      throw new ValidationError(`单条路线最多 ${MAX_ROUTE_NODES} 个节点，第 ${index + 1} 条有 ${rawPath.length} 个`)
    }
    const path = rawPath.map((node, nodeIndex) => {
      // 兼容 [lng, lat] 与 { lng, lat } 两种写法
      const lng = Array.isArray(node) ? node[0] : node?.lng
      const lat = Array.isArray(node) ? node[1] : node?.lat
      return requireLngLat(lng, lat, `第 ${index + 1} 条路线的第 ${nodeIndex + 1} 个节点`)
    })
    return {
      id: crypto.randomUUID(),
      name: str(r?.name, MAX_NAME, '未命名路线'),
      color: HEX_COLOR.test(r?.color) ? r.color : '#2563eb',
      path,
      // 忽略客户端提交的 distance，按落库的 path 重算
      distance: pathDistance(path),
      note: str(r?.note, MAX_NOTE),
      // 'straight' = 用户手点直线路线（route / route-from-points）
      // 'road'     = 沿道路画路线（route-osrm，调 OSRM）
      // 客户端必须明确传一个，未传或非法值都按 'straight' 兜底，
      // 避免把 OSRM 路线错标成直线路线影响后续功能（比如未来按类型筛选）。
      kind: r?.kind === 'road' ? 'road' : 'straight',
      sortOrder: index,
    }
  })
}

export class TravelMapsService {
  constructor(db) {
    this.db = db
  }

  // ---------- slug ----------

  async generateUniqueSlug() {
    // 8 位 base36，与 lettersService.generateSlug 同款；查重最多重试 5 次
    for (let i = 0; i < 5; i++) {
      const slug = Math.random().toString(36).substring(2, 10)
      const existing = await this.db
        .prepare('SELECT id FROM travel_maps WHERE slug = ?')
        .bind(slug)
        .first()
      if (!existing) return slug
    }
    throw new ValidationError('生成分享短码失败，请重试')
  }

  // ---------- 我的地图 ----------

  async listMyMaps(uid, page, pageSize) {
    const offset = (page - 1) * pageSize
    const countRow = await this.db
      .prepare('SELECT COUNT(*) AS total FROM travel_maps WHERE uid = ?')
      .bind(uid)
      .first()
    const { results } = await this.db
      .prepare(
        `SELECT * FROM travel_maps WHERE uid = ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      )
      .bind(uid, pageSize, offset)
      .all()
    return {
      list: (results || []).map(mapMetaFromRow),
      total: countRow?.total ?? 0,
    }
  }

  async createMap(uid, payload) {
    const title = str(payload?.title, MAX_TITLE, '我的旅游地图')
    const [centerLng, centerLat] = payload?.center
      ? requireLngLat(payload.center.lng, payload.center.lat, '地图中心')
      : [116.397428, 39.90923]
    const zoom = Math.min(18, Math.max(1, Math.round(finiteNum(payload?.zoom) ?? 12)))
    const baseLayer = BASE_LAYERS.has(payload?.baseLayer) ? payload.baseLayer : 'vec'

    const id = crypto.randomUUID()
    const slug = await this.generateUniqueSlug()
    const ts = now()

    await this.db
      .prepare(
        `INSERT INTO travel_maps
           (id, uid, slug, title, description, center_lng, center_lat, zoom, base_layer,
            is_public, view_count, point_count, route_count, total_distance, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)`
      )
      .bind(id, uid, slug, title, str(payload?.description, MAX_DESC),
        centerLng, centerLat, zoom, baseLayer, ts, ts)
      .run()

    return this.getMapForOwner(id, uid)
  }

  // 归属校验：返回 null 表示不存在或不属于该用户（对外统一按 404 处理，不泄露存在性）
  async findOwnedRow(id, uid) {
    return await this.db
      .prepare('SELECT * FROM travel_maps WHERE id = ? AND uid = ?')
      .bind(id, uid)
      .first()
  }

  async loadContent(mapId) {
    const [pointsRes, routesRes] = await Promise.all([
      this.db
        .prepare('SELECT * FROM travel_map_points WHERE map_id = ? ORDER BY sort_order ASC')
        .bind(mapId)
        .all(),
      this.db
        .prepare('SELECT * FROM travel_map_routes WHERE map_id = ? ORDER BY sort_order ASC')
        .bind(mapId)
        .all(),
    ])
    return {
      points: (pointsRes.results || []).map(pointFromRow),
      routes: (routesRes.results || []).map(routeFromRow),
    }
  }

  async getMapForOwner(id, uid) {
    const row = await this.findOwnedRow(id, uid)
    if (!row) return null
    const content = await this.loadContent(id)
    return { ...mapMetaFromRow(row), ...content }
  }

  // 全量保存：元信息 + 点位 + 路线，一次 batch 内完成（D1 batch 隐式事务）
  async saveMap(id, uid, payload) {
    const row = await this.findOwnedRow(id, uid)
    if (!row) return null

    const points = normalizePoints(payload?.points)
    const routes = normalizeRoutes(payload?.routes)

    const title = str(payload?.title, MAX_TITLE, row.title)
    const description = str(payload?.description, MAX_DESC)
    const [centerLng, centerLat] = payload?.center
      ? requireLngLat(payload.center.lng, payload.center.lat, '地图中心')
      : [row.center_lng, row.center_lat]
    const zoom = Math.min(18, Math.max(1, Math.round(finiteNum(payload?.zoom) ?? row.zoom)))
    const baseLayer = BASE_LAYERS.has(payload?.baseLayer) ? payload.baseLayer : row.base_layer
    const isPublic = typeof payload?.isPublic === 'boolean' ? Number(payload.isPublic) : row.is_public
    const totalDistance = routes.reduce((sum, r) => sum + r.distance, 0)
    const ts = now()

    const statements = [
      this.db
        .prepare(
          `UPDATE travel_maps SET
             title = ?, description = ?, center_lng = ?, center_lat = ?, zoom = ?, base_layer = ?,
             is_public = ?, point_count = ?, route_count = ?, total_distance = ?, updated_at = ?
           WHERE id = ? AND uid = ?`
        )
        .bind(title, description, centerLng, centerLat, zoom, baseLayer, isPublic,
          points.length, routes.length, totalDistance, ts, id, uid),
      this.db.prepare('DELETE FROM travel_map_points WHERE map_id = ?').bind(id),
      this.db.prepare('DELETE FROM travel_map_routes WHERE map_id = ?').bind(id),
    ]

    for (const group of chunk(points, INSERT_CHUNK)) {
      const placeholders = group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      const binds = []
      for (const p of group) {
        binds.push(p.id, id, p.name, p.category, p.lng, p.lat, p.elevation, p.note, p.sortOrder, ts)
      }
      statements.push(
        this.db
          .prepare(
            `INSERT INTO travel_map_points
               (id, map_id, name, category, lng, lat, elevation, note, sort_order, created_at)
             VALUES ${placeholders}`
          )
          .bind(...binds)
      )
    }

    for (const group of chunk(routes, INSERT_CHUNK)) {
      const placeholders = group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      const binds = []
      for (const r of group) {
        binds.push(r.id, id, r.name, r.color, JSON.stringify(r.path), r.distance, r.note, r.kind, r.sortOrder, ts)
      }
      statements.push(
        this.db
          .prepare(
            `INSERT INTO travel_map_routes
               (id, map_id, name, color, path, distance, note, kind, sort_order, created_at)
             VALUES ${placeholders}`
          )
          .bind(...binds)
      )
    }

    await this.db.batch(statements)
    return this.getMapForOwner(id, uid)
  }

  async deleteMap(id, uid) {
    const row = await this.findOwnedRow(id, uid)
    if (!row) return false
    await this.db.batch([
      this.db.prepare('DELETE FROM travel_map_points WHERE map_id = ?').bind(id),
      this.db.prepare('DELETE FROM travel_map_routes WHERE map_id = ?').bind(id),
      this.db.prepare('DELETE FROM travel_maps WHERE id = ? AND uid = ?').bind(id, uid),
    ])
    return true
  }

  // ---------- 地图广场 / 公开访问 ----------

  async listPlaza(page, pageSize) {
    const offset = (page - 1) * pageSize
    const countRow = await this.db
      .prepare('SELECT COUNT(*) AS total FROM travel_maps WHERE is_public = 1')
      .first()
    const { results } = await this.db
      .prepare(
        `SELECT m.*, u.username AS author_name, u.avatar AS author_avatar
         FROM travel_maps m
         LEFT JOIN user u ON u.id = m.uid
         WHERE m.is_public = 1
         ORDER BY m.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(pageSize, offset)
      .all()

    const list = (results || []).map((row) => ({
      // 广场是公开列表，只暴露 slug，不暴露内部 id / uid
      slug: row.slug,
      title: row.title,
      description: row.description || '',
      baseLayer: row.base_layer,
      center: { lng: row.center_lng, lat: row.center_lat },
      zoom: row.zoom,
      viewCount: row.view_count,
      pointCount: row.point_count,
      routeCount: row.route_count,
      totalDistance: row.total_distance,
      updatedAt: row.updated_at,
      author: {
        name: row.author_name || '匿名用户',
        avatar: row.author_avatar || '',
      },
    }))
    return { list, total: countRow?.total ?? 0 }
  }

  async getPublicBySlug(slug) {
    const row = await this.db
      .prepare(
        `SELECT m.*, u.username AS author_name, u.avatar AS author_avatar
         FROM travel_maps m
         LEFT JOIN user u ON u.id = m.uid
         WHERE m.slug = ? AND m.is_public = 1`
      )
      .bind(slug)
      .first()
    if (!row) return null

    const content = await this.loadContent(row.id)
    // 浏览量自增，失败不影响正文返回
    try {
      await this.db
        .prepare('UPDATE travel_maps SET view_count = view_count + 1 WHERE id = ?')
        .bind(row.id)
        .run()
    } catch (error) {
      console.error('travel map view_count update failed:', error)
    }

    const meta = mapMetaFromRow(row)
    delete meta.id // 公开页不需要内部 id
    return {
      ...meta,
      viewCount: meta.viewCount + 1,
      author: {
        name: row.author_name || '匿名用户',
        avatar: row.author_avatar || '',
      },
      ...content,
    }
  }
}

export { ValidationError, MAX_POINTS, MAX_ROUTES, MAX_ROUTE_NODES }
