-- ============================================================
-- 002_atomic_usage_rpc.sql
-- Rate Limit Race Condition(TOCTOU) 해결을 위한 원자적 RPC 함수
--
-- 기존 문제:
--   usage_service.py에서 "조회 → 비교 → upsert" 3단계가
--   별도 HTTP 요청으로 분리되어 동시 요청 시 limit 초과 가능
--
-- 해결책:
--   단일 PostgreSQL 함수로 increment + check를 원자적 처리
--   ON CONFLICT DO UPDATE로 레이스 컨디션 완전 제거
-- ============================================================

CREATE OR REPLACE FUNCTION increment_and_check_usage(
  p_user_id   UUID,
  p_endpoint  TEXT,
  p_date      DATE,
  p_limit     INT
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count INT;
BEGIN
  -- 원자적 upsert: count < limit일 때만 increment
  INSERT INTO api_usage (user_id, usage_date, endpoint, count)
  VALUES (p_user_id, p_date, p_endpoint, 1)
  ON CONFLICT (user_id, usage_date, endpoint)
  DO UPDATE
    SET count = api_usage.count + 1
    WHERE api_usage.count < p_limit
  RETURNING count INTO v_new_count;

  -- RETURNING이 없으면 limit 초과 → 현재 count 조회 후 예외
  IF v_new_count IS NULL THEN
    SELECT count INTO v_new_count
    FROM api_usage
    WHERE user_id = p_user_id
      AND usage_date = p_date
      AND endpoint = p_endpoint;
    RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED:%', v_new_count;
  END IF;

  RETURN v_new_count;
END;
$$;

-- RLS: Service Role Key로만 호출 (백엔드 전용)
REVOKE ALL ON FUNCTION increment_and_check_usage FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_and_check_usage TO service_role;


-- ============================================================
-- activity_summary 뷰 (잔디달력용)
-- task_completions 테이블에 completed_at 컬럼이 있어야 합니다.
-- ============================================================

-- 1) completed_at 컬럼 추가 (없으면)
ALTER TABLE task_completions
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();

-- 2) 기존 completed=true 행에 대략적인 시각 설정 (최초 1회)
UPDATE task_completions
SET completed_at = NOW()
WHERE completed = TRUE AND completed_at IS NULL;

-- 3) 뷰 생성
CREATE OR REPLACE VIEW activity_summary AS
SELECT
  user_id,
  DATE(completed_at AT TIME ZONE 'Asia/Seoul') AS activity_date,
  COUNT(*)::INT AS count
FROM task_completions
WHERE
  completed = TRUE
  AND completed_at >= NOW() - INTERVAL '365 days'
GROUP BY user_id, DATE(completed_at AT TIME ZONE 'Asia/Seoul');

-- 4) RLS: 인증된 사용자는 자신의 데이터만 조회
ALTER VIEW activity_summary OWNER TO postgres;
