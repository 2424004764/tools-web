-- 旅游地图点位「已到达」状态：0 = 未到达，1 = 已到达
ALTER TABLE travel_map_points ADD COLUMN visited INTEGER NOT NULL DEFAULT 0;
