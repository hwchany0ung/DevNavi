-- 011_minor_rls_fixes.sql
-- M-1: qa_feedback DELETE 정책 추가 (본인 피드백만 삭제 가능)
-- M-2: increment_and_check_qa_usage PUBLIC 노출 차단

-- ============================================================
-- M-1: qa_feedback DELETE 정책
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'qa_feedback'
      AND policyname = 'users can delete own feedback'
  ) THEN
    EXECUTE 'CREATE POLICY "users can delete own feedback" ON qa_feedback
      FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END
$$;

-- ============================================================
-- M-2: increment_and_check_qa_usage PUBLIC EXECUTE 권한 제거
-- service_role 전용으로 제한
-- ============================================================
REVOKE ALL ON FUNCTION public.increment_and_check_qa_usage(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_and_check_qa_usage(UUID, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_and_check_qa_usage(UUID, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_and_check_qa_usage(UUID, INTEGER, INTEGER) TO service_role;
