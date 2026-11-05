-- Phase 4: lead assignment, imported extra columns, call scripts
ALTER TABLE leads ADD COLUMN assigned_to TEXT REFERENCES admins (id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN extra TEXT;
CREATE INDEX leads_assigned_idx ON leads (assigned_to);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES admins (id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES admins (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
