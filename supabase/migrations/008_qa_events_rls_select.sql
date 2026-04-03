-- Migration: 008_qa_events_rls_select
-- Purpose: qa_events 테이블 SELECT RLS 정책 추가
--   배경: 006_qa_feedback_events.sql에 INSERT 정책만 존재하며,
--         SELECT 정책 부재로 anon/authenticated 키 노출 시 전체 이벤트 데이터 열람 가능.
--   대응: service_role만 SELECT 허용, anon/authenticated SELECT 불가.

CREATE POLICY "service_role can select events"
    ON qa_events FOR SELECT
    USING (auth.role() = 'service_role');
