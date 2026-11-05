-- Phase 5: projects, payments (USD, with the PKR rate used at the time) and app settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  client TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed', 'on_hold', 'cancelled')),
  agreed_cents INTEGER NOT NULL DEFAULT 0 CHECK (agreed_cents >= 0),
  owner_id TEXT REFERENCES admins (id),
  started_at INTEGER,
  notes TEXT,
  created_by TEXT REFERENCES admins (id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX projects_status_idx ON projects (status);
CREATE INDEX projects_owner_idx ON projects (owner_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  rate REAL NOT NULL CHECK (rate > 0),
  received_at INTEGER NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES admins (id),
  created_at INTEGER NOT NULL
);
CREATE INDEX payments_project_idx ON payments (project_id);
CREATE INDEX payments_received_idx ON payments (received_at);
