-- Migration 020: rollback_role_reference 원자적 처리 RPC
-- 두 UPDATE를 트랜잭션으로 묶어 partial failure 방지
CREATE OR REPLACE FUNCTION public.rollback_role_reference(
  p_current_id uuid,
  p_prev_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.role_references SET is_active = false WHERE id = p_current_id;
  UPDATE public.role_references SET is_active = true, activated_by = 'admin_rollback' WHERE id = p_prev_id;
END;
$$;
