-- supabase/migrations/014_role_skills.sql
-- 직군별 추천 스킬·자격증 참조 테이블
-- category: 'skill' | 'cert'

create table if not exists role_skills (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in (
                'backend','frontend','cloud_devops','fullstack',
                'data','ai_ml','security','ios_android','qa')),
  skill_name  text not null,
  category    text not null check (category in ('skill','cert')),
  priority    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_role_skills_role_cat
  on role_skills(role, category, priority desc);

-- RLS 비활성화 (service role key로만 접근, 공개 읽기 허용)
alter table role_skills disable row level security;

-- 초기 시드 데이터 (2024-2025 채용공고 기반)
insert into role_skills (role, skill_name, category, priority) values
  -- backend skills
  ('backend', 'Java',              'skill', 100),
  ('backend', 'Spring Boot',       'skill', 95),
  ('backend', 'Python',            'skill', 90),
  ('backend', 'FastAPI',           'skill', 85),
  ('backend', 'Node.js',           'skill', 80),
  ('backend', 'JPA/Hibernate',     'skill', 75),
  ('backend', 'MySQL',             'skill', 70),
  ('backend', 'PostgreSQL',        'skill', 65),
  ('backend', 'Redis',             'skill', 60),
  ('backend', 'Docker',            'skill', 55),
  ('backend', 'AWS EC2/S3',        'skill', 50),
  ('backend', 'GitHub Actions',    'skill', 45),
  -- backend certs
  ('backend', '정보처리기사',       'cert', 100),
  ('backend', 'SQLD',              'cert', 90),
  ('backend', 'AWS Cloud Practitioner', 'cert', 80),
  ('backend', 'SQLP',              'cert', 70),
  ('backend', '리눅스마스터 2급',   'cert', 60),

  -- frontend skills
  ('frontend', 'TypeScript',       'skill', 100),
  ('frontend', 'React',            'skill', 95),
  ('frontend', 'Next.js',          'skill', 90),
  ('frontend', 'JavaScript',       'skill', 85),
  ('frontend', 'HTML/CSS',         'skill', 80),
  ('frontend', 'Tailwind CSS',     'skill', 75),
  ('frontend', 'Zustand',          'skill', 70),
  ('frontend', 'TanStack Query',   'skill', 65),
  ('frontend', 'Vite',             'skill', 60),
  ('frontend', 'Jest',             'skill', 55),
  ('frontend', 'Figma',            'skill', 50),
  -- frontend certs
  ('frontend', '정보처리기사',      'cert', 100),
  ('frontend', 'AWS Cloud Practitioner', 'cert', 80),

  -- cloud_devops skills
  ('cloud_devops', 'AWS',              'skill', 100),
  ('cloud_devops', 'Kubernetes',       'skill', 95),
  ('cloud_devops', 'Docker',           'skill', 90),
  ('cloud_devops', 'Terraform',        'skill', 85),
  ('cloud_devops', 'Linux',            'skill', 80),
  ('cloud_devops', 'GitHub Actions',   'skill', 75),
  ('cloud_devops', 'ArgoCD',           'skill', 70),
  ('cloud_devops', 'Prometheus/Grafana','skill', 65),
  ('cloud_devops', 'Ansible',          'skill', 60),
  ('cloud_devops', 'Helm',             'skill', 55),
  ('cloud_devops', 'Python/Shell',     'skill', 50),
  -- cloud_devops certs
  ('cloud_devops', 'AWS SAA',              'cert', 100),
  ('cloud_devops', 'CKA',                  'cert', 95),
  ('cloud_devops', '정보처리기사',          'cert', 85),
  ('cloud_devops', '리눅스마스터 2급',      'cert', 75),
  ('cloud_devops', 'Terraform Associate',  'cert', 70),
  ('cloud_devops', 'AWS DevOps Pro',       'cert', 65),

  -- fullstack skills
  ('fullstack', 'TypeScript',  'skill', 100),
  ('fullstack', 'React',       'skill', 95),
  ('fullstack', 'Next.js',     'skill', 90),
  ('fullstack', 'Node.js',     'skill', 85),
  ('fullstack', 'NestJS',      'skill', 80),
  ('fullstack', 'Python',      'skill', 75),
  ('fullstack', 'MySQL',       'skill', 70),
  ('fullstack', 'PostgreSQL',  'skill', 65),
  ('fullstack', 'Docker',      'skill', 60),
  ('fullstack', 'AWS',         'skill', 55),
  ('fullstack', 'GraphQL',     'skill', 50),
  -- fullstack certs
  ('fullstack', '정보처리기사',       'cert', 100),
  ('fullstack', 'SQLD',              'cert', 90),
  ('fullstack', 'AWS Cloud Practitioner', 'cert', 80),

  -- data skills
  ('data', 'Python',           'skill', 100),
  ('data', 'SQL',              'skill', 95),
  ('data', 'Apache Spark',     'skill', 90),
  ('data', 'Apache Airflow',   'skill', 85),
  ('data', 'Kafka',            'skill', 80),
  ('data', 'dbt',              'skill', 75),
  ('data', 'AWS Redshift/S3',  'skill', 70),
  ('data', 'Pandas',           'skill', 65),
  ('data', 'Tableau/Looker',   'skill', 60),
  ('data', 'BigQuery',         'skill', 55),
  -- data certs
  ('data', 'SQLD',             'cert', 100),
  ('data', '빅데이터분석기사',  'cert', 95),
  ('data', 'ADsP',             'cert', 85),
  ('data', 'ADP',              'cert', 75),
  ('data', 'SQLP',             'cert', 65),

  -- ai_ml skills
  ('ai_ml', 'Python',                  'skill', 100),
  ('ai_ml', 'PyTorch',                 'skill', 95),
  ('ai_ml', 'LangChain/LlamaIndex',    'skill', 90),
  ('ai_ml', 'RAG',                     'skill', 85),
  ('ai_ml', 'scikit-learn',            'skill', 80),
  ('ai_ml', 'FastAPI',                 'skill', 75),
  ('ai_ml', 'MLflow',                  'skill', 70),
  ('ai_ml', 'Docker',                  'skill', 65),
  ('ai_ml', 'SQL',                     'skill', 60),
  ('ai_ml', 'Hugging Face',            'skill', 55),
  -- ai_ml certs
  ('ai_ml', 'AICE',                    'cert', 100),
  ('ai_ml', '빅데이터분석기사',         'cert', 90),
  ('ai_ml', 'ADsP',                    'cert', 80),
  ('ai_ml', 'TensorFlow Developer Certificate', 'cert', 70),

  -- security skills
  ('security', 'Linux',               'skill', 100),
  ('security', 'Python',              'skill', 95),
  ('security', 'Burp Suite',          'skill', 90),
  ('security', 'SIEM(Splunk/QRadar)', 'skill', 85),
  ('security', 'Wireshark',           'skill', 80),
  ('security', 'Nessus',              'skill', 75),
  ('security', 'AWS Security',        'skill', 70),
  ('security', 'Metasploit',          'skill', 65),
  ('security', 'Shell Script',        'skill', 60),
  ('security', 'Networking',          'skill', 55),
  -- security certs
  ('security', '정보보안기사',         'cert', 100),
  ('security', '정보처리기사',         'cert', 90),
  ('security', 'ISMS-P 인증심사원',   'cert', 85),
  ('security', '리눅스마스터 2급',     'cert', 75),
  ('security', 'CISSP',              'cert', 70),
  ('security', 'CEH',                'cert', 65),

  -- ios_android skills
  ('ios_android', 'Kotlin',               'skill', 100),
  ('ios_android', 'Swift',                'skill', 95),
  ('ios_android', 'Jetpack Compose',      'skill', 90),
  ('ios_android', 'SwiftUI',              'skill', 85),
  ('ios_android', 'Flutter',              'skill', 80),
  ('ios_android', 'Retrofit/Alamofire',   'skill', 75),
  ('ios_android', 'Coroutines',           'skill', 70),
  ('ios_android', 'Firebase',             'skill', 65),
  ('ios_android', 'Android Architecture','skill', 60),
  ('ios_android', 'Fastlane',             'skill', 55),
  -- ios_android certs
  ('ios_android', '정보처리기사',          'cert', 100),
  ('ios_android', 'AWS Cloud Practitioner','cert', 80),

  -- qa skills
  ('qa', 'Selenium',           'skill', 100),
  ('qa', 'Playwright',         'skill', 95),
  ('qa', 'Python',             'skill', 90),
  ('qa', 'Java',               'skill', 85),
  ('qa', 'Postman',            'skill', 80),
  ('qa', 'JMeter/k6',          'skill', 75),
  ('qa', 'Jira/TestRail',      'skill', 70),
  ('qa', 'GitHub Actions',     'skill', 65),
  ('qa', 'Appium',             'skill', 60),
  ('qa', 'REST API 테스트',    'skill', 55),
  -- qa certs
  ('qa', 'ISTQB CTFL',        'cert', 100),
  ('qa', '정보처리기사',       'cert', 90),
  ('qa', 'ISTQB CTAL',        'cert', 75),
  ('qa', 'CSTS',              'cert', 65)
on conflict do nothing;
