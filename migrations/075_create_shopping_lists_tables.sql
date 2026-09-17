-- Shopping lists and items
CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  budget REAL,
  note TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  weight TEXT,
  estimated_price REAL,
  actual_price REAL,
  category TEXT,
  note TEXT,
  checked INTEGER NOT NULL DEFAULT 0,
  purchased_at DATETIME,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_uid_update ON shopping_lists(uid, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_uid ON shopping_list_items(list_id, uid, checked, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_uid ON shopping_list_items(uid, update_time DESC);

INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('shopping-list-2026-09-13', '购物清单', '/shopping-list/', 13, '内容管理',
   '创建多个购物清单，记录数量、重量、预计与实际花费，随时标记已购买并导出清单',
   '', 155, 1, '2026-09-13 00:00:00', '2026-09-13 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;
