-- =============================================================
-- api_usage: Claude API 일일 사용량 추적 테이블
-- Supabase SQL Editor에서 실행
-- =============================================================

CREATE TABLE IF NOT EXISTS api_usage (
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE        NOT NULL DEFAULT CURRENT_DATE,
    endpoint   TEXT        NOT NULL,   -- 'full' | 'career-summary' | 'reroute'
    count      INTEGER     NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (user_id, usage_date, endpoint)
);

-- 조회 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_api_usage_user_date
    ON api_usage(user_id, usage_date);

-- RLS 활성화 (사용자는 자신의 데이터만 읽기 가능)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- 서비스 롤(백엔드)은 RLS 우회 — Service Key 헤더로 호출하므로 추가 정책 불필요
-- 사용자 본인 읽기 허용 (선택적 — 현재 프론트에서 직접 조회하지 않음)
CREATE POLICY "users_read_own_usage" ON api_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- 90일 이상 된 데이터 자동 삭제 (pg_cron 설치 시)
-- SELECT cron.schedule('cleanup-api-usage', '0 3 * * *',
--   $$DELETE FROM api_usage WHERE usage_date < CURRENT_DATE - INTERVAL '90 days'$$);
