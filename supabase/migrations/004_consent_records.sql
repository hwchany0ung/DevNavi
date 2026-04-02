-- ============================================================
-- 004_consent_records.sql
-- PIPA 약관 동의 이력 테이블 추가
-- ============================================================

-- ── consent_records ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agreed_terms_at   TIMESTAMPTZ NOT NULL,
  agreed_privacy_at TIMESTAMPTZ NOT NULL,
  consent_version   VARCHAR(20) NOT NULL DEFAULT '2026-01-01',
  ip_address        VARCHAR(45),   -- IPv4 최대 15자, IPv6 최대 45자
  user_agent        VARCHAR(512),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)   -- 동일 user_id 중복 시 upsert (merge-duplicates)
);

CREATE INDEX IF NOT EXISTS idx_consent_user    ON public.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_version ON public.consent_records(consent_version, created_at DESC);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- 서비스 롤(service_role)만 INSERT/UPDATE 가능 — 사용자는 직접 조회 불가
CREATE POLICY "consent_deny_all" ON public.consent_records
  USING (false);
