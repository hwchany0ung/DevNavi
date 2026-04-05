CREATE TABLE qa_history (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    roadmap_id  UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
    task_id     TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE qa_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own history"
    ON qa_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can select own history"
    ON qa_history FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_qa_history_user_task ON qa_history(user_id, task_id, created_at DESC);
