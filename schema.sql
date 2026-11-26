-- floppy-disks database (D1, binding DB). Apply once; the Worker never creates tables.
CREATE TABLE IF NOT EXISTS disks (disk INTEGER PRIMARY KEY, last_tap INTEGER NOT NULL, state TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS visits (token_hash TEXT PRIMARY KEY, disk INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS machines (place INTEGER PRIMARY KEY, name TEXT NOT NULL); -- rows are filled in the database only, never in this repo
