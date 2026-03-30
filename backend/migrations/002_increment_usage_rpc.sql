-- I3: usage_service 폴백 경로의 race condition 해소용 RPC
-- SELECT count → INSERT/UPDATE 2단계는 동시 요청 시 경쟁 조건 발생 가능.
-- 이 함수는 단일 원자적 upsert로 카운터를 증가시킨다.
--
-- 실행 위치: Supabase Dashboard > SQL Editor

CREATE OR REPLACE FUNCTION increment_api_usage(
    p_user_id   UUID,
    p_endpoint  TEXT,
    p_date      DATE
) RETURNS INT AS $$
DECLARE
    new_count INT;
BEGIN
    INSERT INTO public.api_usage (user_id, usage_date, endpoint, count)
    VALUES (p_user_id, p_date, p_endpoint, 1)
    ON CONFLICT (user_id, usage_date, endpoint)
    DO UPDATE SET count = api_usage.count + 1
    RETURNING count INTO new_count;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_api_usage IS
    '원자적 API 사용량 카운터 증가 — usage_service 폴백 경로용 (I3 race condition 해소)';
