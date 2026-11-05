-- Phase 1: admins and sessions
CREATE TABLE admins (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  profile_complete INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT
);
CREATE UNIQUE INDEX admins_username_lower_idx ON admins (username_lower);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  admin_id TEXT NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_admin_idx ON sessions (admin_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
