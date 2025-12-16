-- Workspaces table (新增：支援多工作區)
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_path TEXT NOT NULL UNIQUE,
  workspace_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions table (工作時間段)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  is_allocated INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON sessions(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_sessions_allocated ON sessions(is_allocated);

-- Work items table (可交付成果)
CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  repo TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('commit', 'pr_merge', 'manual')),
  title TEXT NOT NULL,
  detail TEXT,
  occurred_at TEXT NOT NULL,
  url TEXT,
  commit_sha TEXT,
  pr_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_work_items_workspace ON work_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_work_items_time ON work_items(occurred_at);
CREATE INDEX IF NOT EXISTS idx_work_items_type ON work_items(type);

-- Allocations table (時間分配到成果)
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  note TEXT,
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_allocations_work_item ON allocations(work_item_id);
CREATE INDEX IF NOT EXISTS idx_allocations_date ON allocations(date);

-- Configuration table (儲存配置)
CREATE TABLE IF NOT EXISTS configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, key)
);

CREATE INDEX IF NOT EXISTS idx_configurations_workspace ON configurations(workspace_id);

-- Activity log table (用於調試和審計)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  data TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_time ON activity_logs(timestamp);

-- Database metadata
CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('schema_version', '1');
INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('created_at', datetime('now'));
