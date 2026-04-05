-- Migration 016: persona_cards share_token 암호학적 난수로 강화
-- 기존: md5(random()::text) 12자 — 암호학적 안전하지 않은 Mersenne Twister 기반
-- 변경: gen_random_bytes(9) hex 인코딩 18자 — pgcrypto 기반 CSPRNG, 72비트 엔트로피

-- pgcrypto extension 확인 (이미 활성화된 경우 no-op)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 컬럼 크기 확장 (12 → 18): 기존 데이터 하위 호환, 인덱스 자동 유지
ALTER TABLE public.persona_cards
  ALTER COLUMN share_token TYPE VARCHAR(18);

-- 2) DEFAULT 교체
ALTER TABLE public.persona_cards
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(9), 'hex');

-- 검증 쿼리 (실행 후 수동 확인용 주석)
-- SELECT length(encode(gen_random_bytes(9), 'hex')); -- 결과: 18
