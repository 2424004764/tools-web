-- 给路线表加 kind 字段，区分「直线路线」和「道路路线」
-- kind: 'straight' = 直线 / 自由画线（mode === 'route' 或 'route-from-points'）
--       'road'     = 沿道路画线（mode === 'route-osrm'，用 OSRM 算的真实道路）
--
-- 老路线默认 'straight' —— 它们都是建表时还没有「沿道路画路线」功能期间保存的，
-- 绝大多数是用户在地图上手点的直线路线，显示为「直线路线」符合实际。
-- 极个别老路线如果实际是 OSRM 道路路线，需要用户重新画一遍（少量数据，可接受）。
--
-- 执行：
--   本地  pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/033_add_route_kind.sql
--   线上  pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/033_add_route_kind.sql

ALTER TABLE travel_map_routes
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'straight';

-- 不加索引：路线按 map_id 查，sort_order 已经够用，kind 只是 UI 标签用，不参与筛选