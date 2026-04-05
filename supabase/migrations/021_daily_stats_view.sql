-- Migration 021: 일별 통계 집계 뷰 (get_stats limit=1000 truncation 방지)
CREATE OR REPLACE VIEW public.daily_user_signups AS
SELECT
  created_at::date AS stat_date,
  COUNT(*)::integer AS cnt
FROM public.users
GROUP BY created_at::date;

CREATE OR REPLACE VIEW public.daily_roadmap_creates AS
SELECT
  created_at::date AS stat_date,
  COUNT(*)::integer AS cnt
FROM public.roadmaps
GROUP BY created_at::date;
