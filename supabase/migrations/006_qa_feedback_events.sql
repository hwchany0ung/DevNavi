-- Migration: 006_qa_feedback_events
-- AI Q&A 피드백 + 이벤트 로그 테이블

-- qa_feedback 테이블
CREATE TABLE qa_feedback (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id     TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    rating      TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, task_id, question)
);

ALTER TABLE qa_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own feedback"
    ON qa_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can select own feedback"
    ON qa_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "users can update own feedback"
    ON qa_feedback FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- qa_events 테이블
CREATE TABLE qa_events (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    task_id     TEXT,
    event_type  TEXT NOT NULL CHECK (event_type IN ('qa_opened', 'qa_submitted', 'task_checked')),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE qa_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert events"
    ON qa_events FOR INSERT
    WITH CHECK (TRUE);

-- v_qa_daily_counts 뷰 (일별 Q&A 횟수, 최근 7일)
CREATE VIEW v_qa_daily_counts AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS count
FROM qa_events
WHERE event_type = 'qa_submitted'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
