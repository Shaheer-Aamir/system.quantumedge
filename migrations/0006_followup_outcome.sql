-- Phase 11: a new call type ("couldnt_talk") and a repair for leads wrongly marked as contacted.
-- SQLite cannot change a CHECK rule in place, so the calls table is rebuilt. The links from meetings
-- to calls are saved first and put back afterwards, because dropping the old table would clear them.
CREATE TABLE _meeting_call_links AS SELECT id, call_id FROM meetings WHERE call_id IS NOT NULL;

CREATE TABLE calls_new (
  id TEXT PRIMARY KEY NOT NULL,
  admin_id TEXT NOT NULL REFERENCES admins (id),
  lead_id TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('no_answer', 'failed', 'not_interested', 'follow_up', 'meeting_booked', 'couldnt_talk')),
  notes TEXT,
  called_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO calls_new (id, admin_id, lead_id, outcome, notes, called_at, created_at)
  SELECT id, admin_id, lead_id, outcome, notes, called_at, created_at FROM calls;
DROP TABLE calls;
ALTER TABLE calls_new RENAME TO calls;
CREATE INDEX calls_called_at_idx ON calls (called_at);
CREATE INDEX calls_admin_idx ON calls (admin_id);
CREATE INDEX calls_lead_idx ON calls (lead_id);

UPDATE meetings SET call_id = (SELECT call_id FROM _meeting_call_links l WHERE l.id = meetings.id)
  WHERE id IN (SELECT id FROM _meeting_call_links);
DROP TABLE _meeting_call_links;

-- Leads that say Contacted (or Meeting booked) but have no calls and no meetings go back to New.
UPDATE leads SET status = 'new'
  WHERE status = 'contacted' AND NOT EXISTS (SELECT 1 FROM calls WHERE calls.lead_id = leads.id);
UPDATE leads SET status = 'new'
  WHERE status = 'meeting_booked'
    AND NOT EXISTS (SELECT 1 FROM calls WHERE calls.lead_id = leads.id)
    AND NOT EXISTS (SELECT 1 FROM meetings WHERE meetings.lead_id = leads.id);
