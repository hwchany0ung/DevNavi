-- Migration 019: qa_history DELETE/UPDATE 명시적 RLS 정책 추가

-- 사용자 본인 이력 삭제 허용
CREATE POLICY "users can delete own history"
  ON public.qa_history FOR DELETE
  USING (auth.uid() = user_id);

-- 이력 수정 명시적 차단 (service_role은 RLS bypass이므로 영향 없음)
CREATE POLICY "qa_history_deny_update"
  ON public.qa_history AS RESTRICTIVE FOR UPDATE
  USING (false);
