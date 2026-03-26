-- =============================================================
-- user_profiles: 사용자 프로필 및 구독 상태 테이블
-- Supabase SQL Editor에서 실행
-- auth.users 테이블과 1:1 연결
-- =============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email               TEXT,
    is_premium          BOOLEAN     NOT NULL DEFAULT FALSE,
    premium_expires_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 읽기 가능
CREATE POLICY "users_read_own_profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- 본인 프로필만 수정 가능
CREATE POLICY "users_update_own_profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- 신규 가입 시 자동으로 user_profiles 행 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- auth.users INSERT 시 트리거 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- roadmaps 테이블 (user_profiles 먼저 생성 후 실행)
-- =============================================================

CREATE TABLE IF NOT EXISTS roadmaps (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL,
    period          TEXT        NOT NULL,
    summary         TEXT        NOT NULL DEFAULT '',
    persona_title   TEXT        NOT NULL DEFAULT '',
    persona_subtitle TEXT       NOT NULL DEFAULT '',
    data            JSONB       NOT NULL,
    parent_id       UUID        REFERENCES roadmaps(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON roadmaps(user_id);

ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

-- 본인 로드맵 읽기/쓰기
CREATE POLICY "users_manage_own_roadmaps" ON roadmaps
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================
-- task_completions 테이블
-- =============================================================

CREATE TABLE IF NOT EXISTS task_completions (
    user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    roadmap_id  UUID    NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    task_id     TEXT    NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, roadmap_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_user_roadmap
    ON task_completions(user_id, roadmap_id);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_completions" ON task_completions
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================
-- activity_summary 뷰 (잔디 달력용)
-- =============================================================

CREATE OR REPLACE VIEW activity_summary AS
SELECT
    user_id,
    DATE(completed_at) AS activity_date,
    COUNT(*)::INT      AS count
FROM task_completions
WHERE completed_at >= NOW() - INTERVAL '365 days'
GROUP BY user_id, DATE(completed_at);
