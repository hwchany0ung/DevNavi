-- DEPRECATED: 이 파일은 supabase/migrations/004_consent_records.sql로 대체됨.
-- 직접 실행 금지. Supabase CLI로 004 마이그레이션을 사용할 것.
--
-- PIPA 준수를 위한 약관 동의 이력 테이블
-- 실행 위치: Supabase Dashboard > SQL Editor
-- 서비스 롤(service_key)로 INSERT, 사용자 본인만 SELECT 가능

CREATE TABLE IF NOT EXISTS public.consent_records (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agreed_terms_at   TIMESTAMPTZ NOT NULL,
    agreed_privacy_at TIMESTAMPTZ NOT NULL,
    consent_version   TEXT        NOT NULL DEFAULT '2026-01-01',
    ip_address        TEXT,
    user_agent        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 사용자당 최초 동의 1건만 보관 (재동의 시 upsert)
    UNIQUE (user_id)
);

-- RLS 활성화
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- 사용자는 본인 동의 이력만 조회 가능 (투명성)
CREATE POLICY "users can view own consent"
    ON public.consent_records
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE는 서비스 롤 전용 (RLS bypass)
-- 별도 정책 불필요 — service_role은 RLS를 자동으로 우회함

COMMENT ON TABLE public.consent_records IS
    'PIPA(개인정보보호법) 준수용 약관 동의 이력. 가입 시 서버 측에서 기록.';
COMMENT ON COLUMN public.consent_records.ip_address IS
    'CloudFront X-Forwarded-For 기준 클라이언트 IP (동의 당시)';
COMMENT ON COLUMN public.consent_records.consent_version IS
    '약관 버전 식별자 — 약관 개정 시 갱신 (YYYY-MM-DD 형식)';
