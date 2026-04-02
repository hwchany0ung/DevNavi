-- Migration: 005_qa_usage
-- 태스크별 AI Q&A 사용량 추적 테이블 및 RPC

CREATE TABLE qa_usage (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    month         TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    daily_count   INTEGER NOT NULL DEFAULT 0,
    monthly_count INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- RLS
ALTER TABLE qa_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own usage"
    ON qa_usage FOR SELECT
    USING (auth.uid() = user_id);

-- RPC: 사용량 증가 + 한도 초과 여부 반환
CREATE OR REPLACE FUNCTION increment_and_check_qa_usage(
    p_user_id      UUID,
    p_daily_limit  INTEGER DEFAULT 30,
    p_monthly_limit INTEGER DEFAULT 100
) RETURNS JSON AS $$
DECLARE
    v_daily   INTEGER;
    v_monthly INTEGER;
BEGIN
    INSERT INTO qa_usage (user_id, date, month, daily_count, monthly_count)
    VALUES (p_user_id, CURRENT_DATE, to_char(CURRENT_DATE, 'YYYY-MM'), 1, 1)
    ON CONFLICT (user_id, date) DO UPDATE
        SET daily_count   = qa_usage.daily_count + 1,
            monthly_count = qa_usage.monthly_count + 1,
            updated_at    = NOW()
    RETURNING daily_count, monthly_count INTO v_daily, v_monthly;

    RETURN json_build_object(
        'allowed',        (v_daily <= p_daily_limit AND v_monthly <= p_monthly_limit),
        'daily_count',    v_daily,
        'monthly_count',  v_monthly,
        'daily_limit',    p_daily_limit,
        'monthly_limit',  p_monthly_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
