-- security_events: 보안 이벤트 기록 테이블
-- Plan Ref: security-monitoring.plan.md §6
-- 429 (Rate limit 초과) + 401 (인증 실패) 이벤트 저장

CREATE TABLE IF NOT EXISTS public.security_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text NOT NULL CHECK (event_type IN ('rate_limit_exceeded', 'auth_failure')),
  ip          text NOT NULL DEFAULT '',
  path        text NOT NULL DEFAULT '',
  method      text NOT NULL DEFAULT 'GET',
  user_id     uuid,
  status_code int  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

-- 인덱스: Telegram 알람 스크립트가 notified_at IS NULL 조건으로 조회
CREATE INDEX IF NOT EXISTS idx_security_events_not_notified
  ON public.security_events (created_at DESC)
  WHERE notified_at IS NULL;

-- 인덱스: AdminPage 보안 탭 최신순 조회
CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON public.security_events (created_at DESC);

-- 인덱스: event_type별 필터링
CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON public.security_events (event_type);

-- RLS: service_role만 INSERT/SELECT (미들웨어·알람 스크립트 모두 service_role 사용)
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- service_role은 RLS를 bypass하므로 별도 policy 불필요
-- 일반 사용자(anon/authenticated)는 접근 불가 (policy 없음 = deny)

COMMENT ON TABLE public.security_events IS '보안 이벤트 로그 (429 Rate limit, 401 Auth failure)';
COMMENT ON COLUMN public.security_events.event_type IS 'rate_limit_exceeded | auth_failure';
COMMENT ON COLUMN public.security_events.notified_at IS 'Telegram 알람 발송 시각 (NULL = 미발송)';
