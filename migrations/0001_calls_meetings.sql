-- Phase 3: leads, calls, meetings
CREATE TABLE leads (
  id TEXT PRIMARY KEY NOT NULL,
  company TEXT,
  contact_name TEXT,
  phone TEXT,
  phone_normalized TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'meeting_booked', 'closed', 'dead')),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  created_by TEXT REFERENCES admins (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX leads_phone_idx ON leads (phone_normalized);
CREATE INDEX leads_status_idx ON leads (status);

CREATE TABLE calls (
  id TEXT PRIMARY KEY NOT NULL,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  lead_id TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('no_answer', 'failed', 'not_interested', 'follow_up', 'meeting_booked')),
  notes TEXT,
  called_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX calls_called_at_idx ON calls (called_at);
CREATE INDEX calls_admin_idx ON calls (admin_id);
CREATE INDEX calls_lead_idx ON calls (lead_id);

CREATE TABLE meetings (
  id TEXT PRIMARY KEY NOT NULL,
  lead_id TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  call_id TEXT REFERENCES calls (id) ON DELETE SET NULL,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  title TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX meetings_starts_idx ON meetings (starts_at);
CREATE INDEX meetings_admin_idx ON meetings (admin_id);
