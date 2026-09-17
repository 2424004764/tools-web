-- Shopping list enhancements: procurement metadata, templates and purchase history
ALTER TABLE shopping_lists ADD COLUMN purchase_method TEXT;
ALTER TABLE shopping_lists ADD COLUMN purchase_location TEXT;
ALTER TABLE shopping_lists ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

ALTER TABLE shopping_list_items ADD COLUMN brand TEXT;
ALTER TABLE shopping_list_items ADD COLUMN purchase_location TEXT;
ALTER TABLE shopping_list_items ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shopping_list_items ADD COLUMN is_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shopping_list_items ADD COLUMN actual_quantity REAL;
ALTER TABLE shopping_list_items ADD COLUMN actual_weight TEXT;

CREATE TABLE IF NOT EXISTS shopping_list_templates (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  budget REAL,
  purchase_method TEXT,
  purchase_location TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  items_json TEXT NOT NULL DEFAULT '[]',
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_purchase_history (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  list_id TEXT,
  item_id TEXT,
  purchase_key TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  unit TEXT,
  quantity REAL,
  weight TEXT,
  actual_quantity REAL,
  actual_weight TEXT,
  actual_price REAL,
  purchase_location TEXT,
  purchased_at DATETIME NOT NULL,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(uid, purchase_key)
);

CREATE INDEX IF NOT EXISTS idx_shopping_templates_uid_update ON shopping_list_templates(uid, update_time DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_history_uid_date ON shopping_purchase_history(uid, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_history_uid_name ON shopping_purchase_history(uid, name);
