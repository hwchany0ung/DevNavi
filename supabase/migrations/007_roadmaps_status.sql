-- Migration: 007_roadmaps_status.sql
-- Purpose: roadmaps 테이블에 status 컬럼 추가
--   배경: qa_service.py의 verify_task_ownership 함수가 ?status=eq.active 필터로
--         roadmaps를 조회하는데, 컬럼 미존재로 PostgREST 400 반환 -> 권한 오류 발생
--   허용 값: 'active' (기본), 'archived', 'rerouted'

-- 1. status 컬럼 추가 (이미 존재하면 무시)
ALTER TABLE roadmaps
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'rerouted'));

-- 2. 기존 NULL rows 백필 (ADD COLUMN IF NOT EXISTS + DEFAULT로 자동 처리되나 명시적 보완)
UPDATE roadmaps SET status = 'active' WHERE status IS NULL;

-- 3. (user_id, status) 복합 인덱스 추가 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_roadmaps_status ON roadmaps(user_id, status);
