-- Migration 018: roadmaps UPDATE/DELETE 직접 접근 명시적 차단
-- 백엔드는 service_role 키로 RLS bypass 하므로 영향 없음
-- authenticated 사용자가 Supabase REST API 직접 호출로 타인/자신 로드맵 수정 불가

-- authenticated 사용자의 직접 UPDATE 차단
CREATE POLICY "roadmaps_deny_direct_update" ON public.roadmaps
  AS RESTRICTIVE FOR UPDATE
  USING (false);

-- authenticated 사용자의 직접 DELETE 차단
CREATE POLICY "roadmaps_deny_direct_delete" ON public.roadmaps
  AS RESTRICTIVE FOR DELETE
  USING (false);
