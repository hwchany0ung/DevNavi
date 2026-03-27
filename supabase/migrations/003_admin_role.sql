-- ============================================================
-- 003_admin_role.sql
-- 관리자 역할 컬럼 + 에러 로그 테이블 추가
-- ============================================================

-- ── users 테이블에 role 컬럼 추가 ────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ── error_logs 테이블 ─────────────────────────────────────────
-- 백엔드 미들웨어가 5xx 발생 시 자동으로 기록.
-- RLS: 공개 접근 전면 차단 (service_role만 접근 가능).
CREATE TABLE IF NOT EXISTS public.error_logs (
  id          BIGSERIAL    PRIMARY KEY,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  method      VARCHAR(10),
  path        TEXT,
  status_code INT,
  error_msg   TEXT,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_status  ON public.error_logs(status_code, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 일반 유저는 조회·수정·삭제 전부 불가
CREATE POLICY "error_logs_deny_all" ON public.error_logs
  USING (false);

-- ── api_usage 테이블 (002 migration과 동일 위치에 생성) ───────
-- 002 migration의 RPC 함수가 참조하는 테이블.
-- 이미 존재하면 무시.
CREATE TABLE IF NOT EXISTS public.api_usage (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usage_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
  endpoint    TEXT         NOT NULL,
  count       INT          NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date     ON public.api_usage(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user     ON public.api_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON public.api_usage(endpoint, usage_date);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "api_usage_deny_all" ON public.api_usage
  USING (false);
