-- supabase/migrations/20260404_pipeline_tables.sql

-- 1. 파이프라인 실행 이력
create table if not exists pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  triggered_by text not null,
  status       text not null check (status in ('running','completed','failed')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  error        text,
  meta         jsonb
);

-- 2. 소스별 수집 결과
create table if not exists reference_sources (
  id              uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references pipeline_runs(id) on delete cascade,
  role            text not null,
  source_type     text not null check (source_type in ('worknet','tech_blog','npm_pypi','so_survey')),
  raw_stats       jsonb not null,
  collected_at    timestamptz not null default now()
);

create index if not exists idx_ref_sources_run_role
  on reference_sources(pipeline_run_id, role);

-- 3. 최종 참조 데이터 버전 관리
create table if not exists role_references (
  id              uuid primary key default gen_random_uuid(),
  role            text not null check (role in (
                    'backend','frontend','cloud_devops','fullstack',
                    'data','ai_ml','security','ios_android','qa')),
  version         integer not null,
  content         text not null,
  pipeline_run_id uuid references pipeline_runs(id),
  is_active       boolean not null default false,
  activated_at    timestamptz,
  activated_by    text,
  created_at      timestamptz not null default now()
);

create unique index if not exists uq_role_active
  on role_references(role) where is_active = true;

create index if not exists idx_role_refs_role_ver
  on role_references(role, version desc);

-- RLS 비활성화 (service role key로만 접근)
alter table pipeline_runs     disable row level security;
alter table reference_sources disable row level security;
alter table role_references   disable row level security;
