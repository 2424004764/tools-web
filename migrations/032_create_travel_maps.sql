-- 旅游地图 /travel-map/
-- 用户可创建多张自己的地图，在地图上手动标点（露营地/商店超市/观景点…，海拔手填）
-- 和手绘路线；开启分享后地图公开，并出现在「地图广场」。
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/032_create_travel_maps.sql
--   线上  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/032_create_travel_maps.sql

-- ============ 地图主表 ============
CREATE TABLE IF NOT EXISTS travel_maps (
  id             TEXT PRIMARY KEY,           -- uuid
  uid            TEXT NOT NULL,              -- 关联 user.id（TEXT uuid）
  slug           TEXT NOT NULL UNIQUE,       -- 公开分享短码，8 位 base36
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  center_lng     REAL NOT NULL DEFAULT 116.397428,
  center_lat     REAL NOT NULL DEFAULT 39.90923,
  zoom           INTEGER NOT NULL DEFAULT 12,
  base_layer     TEXT NOT NULL DEFAULT 'vec', -- vec 矢量 / img 影像 / ter 地形
  is_public      INTEGER NOT NULL DEFAULT 0,  -- 1 = 已分享，出现在地图广场
  view_count     INTEGER NOT NULL DEFAULT 0,
  -- 冗余统计：每次全量保存时回写，广场列表据此展示，免去 JOIN 聚合
  point_count    INTEGER NOT NULL DEFAULT 0,
  route_count    INTEGER NOT NULL DEFAULT 0,
  total_distance REAL NOT NULL DEFAULT 0,     -- 所有路线里程之和，单位米
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);


-- ============ 点位表 ============
CREATE TABLE IF NOT EXISTS travel_map_points (
  id         TEXT PRIMARY KEY,
  map_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'other',  -- camp/shop/water/food/toilet/parking/viewpoint/lodging/danger/other
  lng        REAL NOT NULL,
  lat        REAL NOT NULL,
  elevation  REAL,                            -- 海拔（米），手动填写，允许为空
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============ 路线表 ============
CREATE TABLE IF NOT EXISTS travel_map_routes (
  id         TEXT PRIMARY KEY,
  map_id     TEXT NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#2563eb',
  path       TEXT NOT NULL,                   -- JSON 数组：[[lng,lat], ...]
  distance   REAL NOT NULL DEFAULT 0,         -- 米，前端 haversine 算好后提交
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);


-- ============ 工具注册（与 src/components/Tools/tools.ts 双注册）============
-- category_id 取自 tools.ts 中真实的 cateId：7 = 其他工具
-- logo 先留空，等 public/images/logo/ 下放好图片后再 UPDATE
INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('travel-map-2026-08-08', '旅游地图', '/travel-map/', 7, '其他工具',
   '基于天地图的旅游地图：自己规划路线、标注露营地/商店超市/观景点等点位并记录海拔，可创建多张地图并分享到地图广场',
   '', 140, 1, '2026-08-08 00:00:00', '2026-08-08 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
