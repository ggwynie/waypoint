-- Waypoint: skema PostgreSQL
DROP TABLE IF EXISTS saved_items CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Pengguna (login/register). role: 'admin' | 'student'
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'student',
  semester      INT NOT NULL DEFAULT 5,
  major         VARCHAR(100) DEFAULT '',
  city          VARCHAR(100) DEFAULT '',
  interests     TEXT DEFAULT '',
  skills        TEXT DEFAULT '',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- FILE MASTER 1: kategori peluang
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

-- FILE MASTER 2: data peluang (magang, seminar/CFP, kompetisi)
CREATE TABLE opportunities (
  id            SERIAL PRIMARY KEY,
  category_id   INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title         VARCHAR(200) NOT NULL,
  organizer     VARCHAR(150) NOT NULL,
  location      VARCHAR(100) NOT NULL DEFAULT 'Online',
  description   TEXT DEFAULT '',
  deadline      DATE NOT NULL,
  source_url    TEXT NOT NULL,
  target_major  VARCHAR(200) DEFAULT '',   -- dipisah koma; kosong = semua jurusan
  min_semester  INT NOT NULL DEFAULT 5,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- FILE TRANSAKSI: mahasiswa menyimpan peluang / menandai daftar / tidak relevan
-- status: 'saved' | 'applied' | 'dismissed'
CREATE TABLE saved_items (
  id                 SERIAL PRIMARY KEY,
  user_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id     INT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status             VARCHAR(10) NOT NULL DEFAULT 'saved',
  remind_days_before INT NOT NULL DEFAULT 3,
  note               TEXT DEFAULT '',
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX idx_opp_deadline ON opportunities(deadline);
CREATE INDEX idx_saved_user ON saved_items(user_id);
