-- supabase/migrations/017_rls_admin_tables.sql
-- HIGH-01: 관리자 전용 테이블 RLS 활성화 — anon 키 직접 접근 차단
--
-- 배경: pipeline_runs, reference_sources, role_references는 관리자 전용 데이터.
--       role_skills는 공개 참조 데이터(SELECT만 허용).
--       백엔드는 service_role 키를 사용하므로 RLS bypass → 영향 없음.

-- ============================================================
-- 1. pipeline_runs, reference_sources, role_references
--    → 모든 접근 차단 (service_role만 bypass로 접근)
-- ============================================================

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_references ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE 정책: anon/authenticated 모두 차단
CREATE POLICY "pipeline_runs_deny_all" ON public.pipeline_runs
  AS RESTRICTIVE FOR ALL USING (false);

CREATE POLICY "reference_sources_deny_all" ON public.reference_sources
  AS RESTRICTIVE FOR ALL USING (false);

CREATE POLICY "role_references_deny_all" ON public.role_references
  AS RESTRICTIVE FOR ALL USING (false);

-- ============================================================
-- 2. role_skills
--    → SELECT 공개 허용, INSERT/UPDATE/DELETE 차단
-- ============================================================

ALTER TABLE public.role_skills ENABLE ROW LEVEL SECURITY;

-- SELECT는 공개 허용 (직군별 추천 스킬 공개 데이터)
CREATE POLICY "role_skills_public_read" ON public.role_skills
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE는 service_role만 가능 (RESTRICTIVE 정책으로 차단)
CREATE POLICY "role_skills_deny_write" ON public.role_skills
  AS RESTRICTIVE FOR INSERT WITH CHECK (false);

CREATE POLICY "role_skills_deny_update" ON public.role_skills
  AS RESTRICTIVE FOR UPDATE USING (false);

CREATE POLICY "role_skills_deny_delete" ON public.role_skills
  AS RESTRICTIVE FOR DELETE USING (false);
