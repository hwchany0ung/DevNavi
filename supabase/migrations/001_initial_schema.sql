-- ============================================================
-- CareerPath — Supabase 초기 스키마
-- 실행: Supabase Dashboard > SQL Editor 에 붙여넣기
-- ============================================================

-- ── users ───────────────────────────────────────────────────
CREATE TABLE public.users (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  nickname              VARCHAR(50),
  is_premium            BOOLEAN NOT NULL DEFAULT false,
  premium_until         TIMESTAMPTZ,
  daily_generation_count INT NOT NULL DEFAULT 0,
  daily_reset_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email    ON public.users(email);
CREATE INDEX idx_users_premium  ON public.users(is_premium, premium_until);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self_only" ON public.users
  USING (auth.uid() = id);

-- 신규 가입 시 users 행 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── onboarding_inputs ────────────────────────────────────────
CREATE TABLE public.onboarding_inputs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_role       VARCHAR(50)  NOT NULL,
  target_period     VARCHAR(20)  NOT NULL,
  knowledge_level   VARCHAR(30)  NOT NULL,
  skills            TEXT[]       NOT NULL DEFAULT '{}',
  certifications    TEXT[]       NOT NULL DEFAULT '{}',
  company_type      VARCHAR(30),
  daily_study_hours VARCHAR(20)  NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_user ON public.onboarding_inputs(user_id, created_at DESC);

ALTER TABLE public.onboarding_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_owner" ON public.onboarding_inputs
  USING (auth.uid() = user_id);


-- ── roadmaps ─────────────────────────────────────────────────
CREATE TABLE public.roadmaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  input_id        UUID NOT NULL REFERENCES public.onboarding_inputs(id),
  version         INT  NOT NULL DEFAULT 1,
  tier            VARCHAR(10)  NOT NULL CHECK (tier IN ('free','premium')),
  teaser_content  TEXT,
  full_content    JSONB,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','archived','rerouted')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_roadmaps_user   ON public.roadmaps(user_id, created_at DESC);
CREATE INDEX idx_roadmaps_status ON public.roadmaps(user_id, status);

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roadmaps_owner" ON public.roadmaps
  USING (auth.uid() = user_id);


-- ── roadmap_months ───────────────────────────────────────────
CREATE TABLE public.roadmap_months (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id    UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  month_number  INT  NOT NULL,
  theme         VARCHAR(100) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id, month_number)
);

CREATE INDEX idx_months_roadmap ON public.roadmap_months(roadmap_id, month_number);

ALTER TABLE public.roadmap_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "months_owner" ON public.roadmap_months
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id AND r.user_id = auth.uid()
    )
  );


-- ── tasks ────────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id      UUID NOT NULL REFERENCES public.roadmap_months(id) ON DELETE CASCADE,
  week_number   INT  NOT NULL,
  content       TEXT NOT NULL,
  category      VARCHAR(20) NOT NULL CHECK (category IN ('learn','project','cert')),
  is_completed  BOOLEAN     NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_month     ON public.tasks(month_id, week_number, sort_order);
CREATE INDEX idx_tasks_completed ON public.tasks(month_id, is_completed);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_owner" ON public.tasks
  USING (
    EXISTS (
      SELECT 1
      FROM public.roadmap_months rm
      JOIN public.roadmaps r ON r.id = rm.roadmap_id
      WHERE rm.id = month_id AND r.user_id = auth.uid()
    )
  );


-- ── activity_logs ────────────────────────────────────────────
CREATE TABLE public.activity_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date             DATE NOT NULL,
  completed_task_count INT  NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX idx_activity_user_date ON public.activity_logs(user_id, log_date DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_owner" ON public.activity_logs
  USING (auth.uid() = user_id);


-- ── persona_cards ────────────────────────────────────────────
CREATE TABLE public.persona_cards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id   UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  share_token  VARCHAR(12) NOT NULL UNIQUE
                 DEFAULT substr(md5(random()::text), 1, 12),
  share_count  INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id)
);

CREATE INDEX idx_persona_token ON public.persona_cards(share_token);

ALTER TABLE public.persona_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "persona_public_read" ON public.persona_cards
  FOR SELECT USING (true);
CREATE POLICY "persona_owner_write" ON public.persona_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id AND r.user_id = auth.uid()
    )
  );


-- ── subscriptions ────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  toss_billing_key  VARCHAR(255) NOT NULL,
  status            VARCHAR(20)  NOT NULL CHECK (status IN ('active','canceled','past_due')),
  amount            INT          NOT NULL,
  next_billing_at   TIMESTAMPTZ,
  canceled_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_user    ON public.subscriptions(user_id, status);
CREATE INDEX idx_sub_billing ON public.subscriptions(next_billing_at)
  WHERE status = 'active';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_owner" ON public.subscriptions
  USING (auth.uid() = user_id);


-- ── RPC: 무료 사용자 일일 한도 체크 ──────────────────────────
CREATE OR REPLACE FUNCTION public.check_daily_limit(p_user_id UUID, p_limit INT)
RETURNS TABLE(allowed BOOLEAN, count INT) AS $$
BEGIN
  UPDATE public.users SET
    daily_generation_count = CASE
      WHEN daily_reset_date < CURRENT_DATE THEN 1
      ELSE daily_generation_count + 1
    END,
    daily_reset_date = CURRENT_DATE
  WHERE id = p_user_id
    AND (daily_reset_date < CURRENT_DATE OR daily_generation_count < p_limit);

  RETURN QUERY
    SELECT (found), daily_generation_count
    FROM public.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
