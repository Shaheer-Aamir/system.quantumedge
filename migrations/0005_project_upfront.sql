-- Phase 8: the upfront amount charged for each project
ALTER TABLE projects ADD COLUMN upfront_cents INTEGER NOT NULL DEFAULT 0 CHECK (upfront_cents >= 0);
