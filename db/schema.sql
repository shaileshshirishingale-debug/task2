-- QuestHabit PostgreSQL Schema
-- Compatible with Vercel Postgres, Neon, Supabase, Cloud SQL, and standard PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  program_start_date VARCHAR(20) DEFAULT CURRENT_DATE,
  sound_enabled BOOLEAN DEFAULT FALSE,
  haptics_enabled BOOLEAN DEFAULT FALSE,
  daily_minimum_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_number INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'Productivity',
  difficulty VARCHAR(20) NOT NULL DEFAULT 'Easy',
  xp_reward INT NOT NULL DEFAULT 10, -- Exactly 10 XP
  estimated_minutes INT NOT NULL DEFAULT 5, -- 2 to 15 minutes
  order_index INT NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  original_title TEXT,
  is_low_energy_replacement BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_completions (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_number INT NOT NULL DEFAULT 1,
  completed_date VARCHAR(20) NOT NULL, -- YYYY-MM-DD
  xp_awarded INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, completed_date)
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
  amount INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS streaks (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date VARCHAR(20),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rest_days (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  date VARCHAR(20) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, day_number)
);

CREATE TABLE IF NOT EXISTS reward_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  unlock_type VARCHAR(20) NOT NULL, -- 'tasks' | 'days'
  target_count INT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'break',
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reviews (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  date VARCHAR(20) NOT NULL,
  what_went_well TEXT NOT NULL,
  what_learned TEXT NOT NULL,
  what_distracted TEXT NOT NULL,
  improvement_tomorrow TEXT NOT NULL,
  energy_level INT NOT NULL DEFAULT 3, -- 1 to 5
  mood_level INT NOT NULL DEFAULT 3, -- 1 to 5
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, day_number)
);

CREATE TABLE IF NOT EXISTS user_backups (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for per-user query optimization
CREATE INDEX IF NOT EXISTS idx_tasks_user_day ON tasks(user_id, day_number);
CREATE INDEX IF NOT EXISTS idx_completions_user_day ON task_completions(user_id, day_number);
CREATE INDEX IF NOT EXISTS idx_reviews_user_day ON daily_reviews(user_id, day_number);
CREATE INDEX IF NOT EXISTS idx_rest_days_user ON rest_days(user_id);
