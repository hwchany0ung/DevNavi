-- Migration: 010_fix_monthly_qa_usage
-- I-2: QA 월 한도 미작동 버그 수정
--
-- 문제: 기존 RPC는 monthly_count를 날짜별 단일 행의 누적 컬럼으로 관리해
--       행이 새로 생성될 때마다 1부터 시작하므로 월 누적 합산이 안 됨.
-- 수정: monthly_count 컬럼 대신 해당 월 전체 daily_count SUM으로 월 누적 집계.

CREATE OR REPLACE FUNCTION increment_and_check_qa_usage(
    p_user_id       UUID,
    p_daily_limit   INTEGER DEFAULT 30,
    p_monthly_limit INTEGER DEFAULT 100
) RETURNS JSON AS $$
DECLARE
    v_daily         INTEGER;
    v_monthly_total INTEGER;
    v_current_month TEXT := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
    -- 1. 오늘 날짜 행에 daily_count +1 (없으면 INSERT)
    INSERT INTO qa_usage (user_id, date, month, daily_count, monthly_count)
    VALUES (p_user_id, CURRENT_DATE, v_current_month, 1, 1)
    ON CONFLICT (user_id, date) DO UPDATE
        SET daily_count   = qa_usage.daily_count + 1,
            monthly_count = qa_usage.monthly_count + 1,  -- 하위 호환 유지
            updated_at    = NOW()
    RETURNING daily_count INTO v_daily;

    -- 2. 이번 달 전체 daily_count SUM으로 월 누적 집계 (핵심 수정)
    SELECT COALESCE(SUM(daily_count), 0)
      INTO v_monthly_total
      FROM qa_usage
     WHERE user_id = p_user_id
       AND month   = v_current_month;

    -- 3. 일/월 한도 초과 시 예외 발생 (usage_service가 hint 필드로 판단)
    IF v_daily > p_daily_limit THEN
        RAISE EXCEPTION 'daily limit exceeded'
            USING HINT = 'DAILY_LIMIT_EXCEEDED',
                  ERRCODE = 'P0001';
    END IF;

    IF v_monthly_total > p_monthly_limit THEN
        RAISE EXCEPTION 'monthly limit exceeded'
            USING HINT = 'MONTHLY_LIMIT_EXCEEDED',
                  ERRCODE = 'P0001';
    END IF;

    RETURN json_build_object(
        'allowed',        true,
        'daily_count',    v_daily,
        'monthly_count',  v_monthly_total,
        'daily_limit',    p_daily_limit,
        'monthly_limit',  p_monthly_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
