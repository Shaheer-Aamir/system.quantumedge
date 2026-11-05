-- Phase 7: failed login attempts, used to slow down password guessing
CREATE TABLE login_failures (
  id TEXT PRIMARY KEY NOT NULL,
  ip TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX login_failures_pair_idx ON login_failures (ip, username_lower, at);
CREATE INDEX login_failures_at_idx ON login_failures (at);
