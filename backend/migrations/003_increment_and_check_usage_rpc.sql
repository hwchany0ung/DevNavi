-- C1(리뷰): increment_and_check_usage RPC — primary 원자적 사용량 증가 + 한도 초과 체크
-- usage_service.py 의 check_and_increment 가 이 함수를 primary 경로로 호출한다.
-- 한도 초과 시 DAILY_LIMIT_EXCEEDED 에러코드로 RAISE EXCEPTION → Supabase가 400 반환.
-- 한도 이내면 새 카운트를 INT로 반환 → Supabase가 200 반환.
--
-- 실행 위치: Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION increment_and_check_usage(
    p_user_id   UUID,
    p_endpoint  TEXT,
    p_date      DATE,
    p_limit     INT
) RETURNS INT AS $$
DECLARE
    new_count INT;
BEGIN
    -- 원자적 upsert: 동시 요청에서도 race condition 없음
    INSERT INTO public.api_usage (user_id, usage_date, endpoint, count)
    VALUES (p_user_id, p_date, p_endpoint, 1)
    ON CONFLICT (user_id, usage_date, endpoint)
    DO UPDATE SET count = api_usage.count + 1
    RETURNING count INTO new_count;

    -- 한도 초과 시 예외 발생 (Supabase → 400, code = DAILY_LIMIT_EXCEEDED)
    IF new_count > p_limit THEN
        RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED'
            USING HINT    = 'DAILY_LIMIT_EXCEEDED',
                  ERRCODE = 'P0001';
    END IF;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_and_check_usage IS
    '원자적 API 사용량 증가 + 한도 초과 체크 — usage_service primary 경로용 (C1 코드리뷰 수정)';
