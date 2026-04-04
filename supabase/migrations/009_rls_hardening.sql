-- ============================================================
-- 009_rls_hardening.sql
-- RLS 보안 강화 마이그레이션
--
-- 수정 항목:
--   C-1: users.role self-UPDATE → 관리자 권한 상승 차단
--   C-2: activity_summary 뷰 SECURITY DEFINER → INVOKER로 전환
--   I-4: qa_events 비인증 INSERT 허용 정책 교체
--   I-5: check_daily_limit 함수 PUBLIC 노출 차단
--   I-6: security_events 테이블 migrations에 통합
-- ============================================================


-- ============================================================
-- C-1: users 테이블 role 컬럼 self-UPDATE 차단
-- ============================================================
-- 문제: 001_initial_schema.sql의 "users_self_only" 정책에 FOR 절이 없어
--       SELECT·INSERT·UPDATE·DELETE 모두 허용됨.
--       사용자가 자신의 role 컬럼을 'admin'으로 UPDATE해 권한 상승 가능.
-- 해결: FOR 없는 포괄 정책을 DROP 후 SELECT/UPDATE(role 제외)로 분리.
--       role 컬럼 UPDATE는 service_role만 가능 (RLS bypass 활용).

-- 1-a) 기존 포괄 정책 제거
DROP POLICY IF EXISTS "users_self_only" ON public.users;

-- 1-b) SELECT: 본인 행만 읽기
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_select'
  ) THEN
    CREATE POLICY "users_self_select" ON public.users
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- 1-c) INSERT: 신규 가입 트리거(SECURITY DEFINER)가 service_role로 실행되므로
--       authenticated 사용자 직접 INSERT 금지 (불필요하나 명시적으로 차단)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_insert'
  ) THEN
    CREATE POLICY "users_self_insert" ON public.users
      FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;

-- 1-d) UPDATE: 본인 행만, role 컬럼 변경 불가
--       PostgreSQL RLS는 컬럼 수준 UPDATE 제한을 직접 지원하지 않으므로
--       WITH CHECK에서 role 값이 기존과 동일한지 검증한다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_update_no_role'
  ) THEN
    CREATE POLICY "users_self_update_no_role" ON public.users
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (
        auth.uid() = id
        -- role 값은 기존과 동일해야 함 (서브쿼리로 현재 DB 값과 비교)
        AND role = (SELECT role FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- 1-e) DELETE: 본인 행 삭제 금지 (CASCADE는 auth.users 삭제 시 자동 처리)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_delete'
  ) THEN
    CREATE POLICY "users_self_delete" ON public.users
      FOR DELETE
      USING (false);
  END IF;
END $$;


-- ============================================================
-- C-2: activity_summary 뷰 SECURITY DEFINER → INVOKER 전환
-- ============================================================
-- 문제: 002_atomic_usage_rpc.sql의 activity_summary 뷰는
--       PostgreSQL 기본값(SECURITY INVOKER)이지만 OWNER가 postgres로 설정되어
--       실질적으로 RLS를 우회할 수 있다.
--       또한 WHERE 절에 user_id 필터가 없어 타 사용자 데이터 노출 위험이 있다.
-- 해결: security_invoker=true 명시 + WHERE user_id = auth.uid() 추가.
--       (PostgreSQL 15+ 지원: security_invoker 옵션)

DROP VIEW IF EXISTS activity_summary;

CREATE OR REPLACE VIEW activity_summary
  WITH (security_invoker = true)
AS
SELECT
  user_id,
  DATE(completed_at AT TIME ZONE 'Asia/Seoul') AS activity_date,
  COUNT(*)::INT AS count
FROM task_completions
WHERE completed_at >= NOW() - INTERVAL '365 days'
GROUP BY user_id, DATE(completed_at AT TIME ZONE 'Asia/Seoul');

-- security_invoker=true: 호출자 권한으로 실행 → task_completions RLS(auth.uid()=user_id) 적용
-- 백엔드가 service_role로 호출할 때는 user_id=eq.{user_id} 파라미터 필터가 적용됨
-- auth.uid() 필터는 제거 — service_role 호출 시 auth.uid()=NULL로 빈 결과 반환 방지
COMMENT ON VIEW activity_summary IS
  'security_invoker=true: 호출자 권한으로 실행. RLS는 task_completions 테이블 정책이 담당.';


-- ============================================================
-- I-4: qa_events 비인증 INSERT 허용 정책 교체
-- ============================================================
-- 문제: 006_qa_feedback_events.sql의 "anyone can insert events" 정책이
--       WITH CHECK (TRUE)로 anon 포함 모든 역할의 INSERT를 허용.
--       스팸/어뷰징 이벤트 삽입 가능.
-- 해결: authenticated 또는 service_role만 INSERT 허용.

DROP POLICY IF EXISTS "anyone can insert events" ON qa_events;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'qa_events'
      AND policyname = 'authenticated insert events'
  ) THEN
    CREATE POLICY "authenticated insert events"
      ON qa_events FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;


-- ============================================================
-- I-5: check_daily_limit 함수 PUBLIC 노출 차단
-- ============================================================
-- 문제: 001_initial_schema.sql의 check_daily_limit 함수에
--       REVOKE 구문이 없어 anon/authenticated 모두 직접 호출 가능.
--       사용자가 daily_generation_count를 임의 조작할 수 있음.
-- 해결: PUBLIC EXECUTE 권한 제거, service_role만 허용.
--       (백엔드는 service_role key로 호출하므로 기능 영향 없음)

REVOKE ALL ON FUNCTION public.check_daily_limit(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_daily_limit(UUID, INT) TO service_role;


-- ============================================================
-- I-6: security_events 테이블 migrations에 통합
-- ============================================================
-- 문제: supabase/security_events.sql이 migrations 디렉토리 밖에 존재해
--       Supabase CLI migration 추적에서 누락됨.
--       재현 가능한 DB 상태 보장 불가.
-- 해결: security_events.sql 내용을 IF NOT EXISTS로 멱등하게 이관.
--       (이미 적용된 환경에서도 안전하게 재실행 가능)

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
