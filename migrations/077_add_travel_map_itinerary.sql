-- 旅游地图日程扩展：每天的安排、点位停留时间和备选路线
-- 兼容已有地图：旧点位与路线统一归入第 1 天。

CREATE TABLE IF NOT EXISTS travel_map_days (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  start_location TEXT NOT NULL DEFAULT '',
  lodging_point_id TEXT NOT NULL DEFAULT '',
  lodging_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

ALTER TABLE travel_map_points ADD COLUMN day_id TEXT NOT NULL DEFAULT '';
ALTER TABLE travel_map_points ADD COLUMN stay_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE travel_map_routes ADD COLUMN day_id TEXT NOT NULL DEFAULT '';
ALTER TABLE travel_map_routes ADD COLUMN alternative_group TEXT NOT NULL DEFAULT '';
ALTER TABLE travel_map_routes ADD COLUMN profile TEXT NOT NULL DEFAULT '';
ALTER TABLE travel_map_routes ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;

INSERT INTO travel_map_days (id, map_id, day_number, title, sort_order, created_at)
SELECT lower(hex(randomblob(16))), id, 1, '第 1 天', 0, updated_at
FROM travel_maps m
WHERE NOT EXISTS (SELECT 1 FROM travel_map_days d WHERE d.map_id = m.id);

UPDATE travel_map_points
SET day_id = (
  SELECT d.id FROM travel_map_days d
  WHERE d.map_id = travel_map_points.map_id
  ORDER BY d.sort_order LIMIT 1
)
WHERE day_id = '';

UPDATE travel_map_routes
SET day_id = (
  SELECT d.id FROM travel_map_days d
  WHERE d.map_id = travel_map_routes.map_id
  ORDER BY d.sort_order LIMIT 1
)
WHERE day_id = '';
