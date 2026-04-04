-- 012_fix_user_profiles_premium_rls.sql
-- 취약점: user_profiles UPDATE 정책이 is_premium / premium_expires_at /
--         toss_customer_key 컬럼 수정을 허용 → 사용자가 자신을 프리미엄으로 변경 가능.
--
-- 수정 전:
--   CREATE POLICY "본인 프로필만 수정" ON user_profiles
--     FOR UPDATE USING (auth.uid() = id);   -- 모든 컬럼 허용
--
-- 수정 후:
--   UPDATE 정책 완전 제거.
--   user_profiles의 모든 쓰기는 service_role(백엔드)이 담당하며
--   service_role은 RLS를 우회하므로 기능 영향 없음.

DROP POLICY IF EXISTS "본인 프로필만 수정" ON public.user_profiles;

-- 혹시 영어 이름으로도 존재할 경우 대비
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_update"    ON public.user_profiles;

-- INSERT도 사용자 직접 접근 차단 (handle_new_user 트리거가 service_role로 처리)
DROP POLICY IF EXISTS "본인 프로필 생성" ON public.user_profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_profiles'
      AND policyname = 'user_profiles_no_direct_write'
  ) THEN
    -- INSERT: service_role 트리거가 담당, 사용자 직접 INSERT 차단
    CREATE POLICY "user_profiles_no_direct_write" ON public.user_profiles
      FOR INSERT
      WITH CHECK (false);
  END IF;
END $$;

-- 결과:
--   SELECT: "본인 프로필만 조회" (auth.uid() = id) 유지
--   INSERT: WITH CHECK (false) — 직접 삽입 불가 (트리거가 service_role로 처리)
--   UPDATE: 정책 없음 → authenticated 사용자 UPDATE 불가
--   DELETE: 정책 없음 → authenticated 사용자 DELETE 불가
--   service_role: RLS bypass → 백엔드 정상 동작
