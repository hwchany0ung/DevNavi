-- =============================================================
-- CareerPath — Supabase DB 스키마
-- Supabase SQL Editor 에서 순서대로 실행하세요.
-- =============================================================

-- ──────────────────────────────────────────
-- 0. Extensions
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────
-- 1. 사용자 프로필 (auth.users 확장)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium        BOOLEAN NOT NULL DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  toss_customer_key  TEXT,                         -- 토스페이먼츠 customerKey
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 신규 가입 시 자동으로 프로필 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────
-- 2. 로드맵
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  period          TEXT NOT NULL,
  summary         TEXT,
  persona_title   TEXT,
  persona_subtitle TEXT,
  data            JSONB NOT NULL,              -- FullRoadmapResponse JSON
  version         INT NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES roadmaps(id), -- GPS 재탐색 원본
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_created  ON roadmaps(created_at DESC);

-- ──────────────────────────────────────────
-- 3. 태스크 완료 (잔디 달력 소스)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id   UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
  task_id      TEXT NOT NULL,                  -- "{month}-{week}-{taskIndex}"
  completed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, roadmap_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_completions_user_roadmap
  ON task_completions(user_id, roadmap_id);
CREATE INDEX IF NOT EXISTS idx_completions_date
  ON task_completions(user_id, completed_at);

-- ──────────────────────────────────────────
-- 4. RLS (Row Level Security) 설정
-- ──────────────────────────────────────────

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 프로필만 조회" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "본인 프로필만 수정" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- roadmaps (서버는 SERVICE_KEY 로 RLS 우회)
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 로드맵 조회" ON roadmaps
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 로드맵 삽입" ON roadmaps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- task_completions
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 완료 조회" ON task_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 완료 삽입" ON task_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 완료 삭제" ON task_completions
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 5. 잔디 달력용 집계 뷰 (최근 365일)
-- ──────────────────────────────────────────
CREATE OR REPLACE VIEW activity_summary AS
SELECT
  user_id,
  completed_at AS activity_date,
  COUNT(*)     AS count
FROM task_completions
WHERE completed_at >= CURRENT_DATE - INTERVAL '365 days'
GROUP BY user_id, completed_at;
