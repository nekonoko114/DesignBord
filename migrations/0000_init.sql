-- Migration: Initial Schema (Required D1 Schema)
-- Define users, projects, hearings, files, annotations, bookings

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'client')),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  progress_rate INTEGER DEFAULT 0,
  booking_limit INTEGER DEFAULT 3,
  last_activity_at INTEGER DEFAULT (strftime('%s', 'now')),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS hearings (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('draft', 'submitted')),
  overview_data TEXT,
  content_data TEXT,
  terms_accepted INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL, -- 'image' | 'audio' | 'design_comp'
  r2_url TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  comment TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reserved', 'completed', 'cancelled')),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
