# GitHub Secrets & Environment Variables Setup Guide

새 환경 또는 새 팀원이 DevNavi를 셋업할 때 필요한 시크릿/환경변수 목록.

---

## 1. GitHub Repository Secrets

`Settings > Secrets and variables > Actions > New repository secret`

### AWS (OIDC 기반 — Access Key 사용하지 않음)

| Secret Name | 설명 | 획득 방법 |
|-------------|------|----------|
| `AWS_ROLE_ARN` | GitHub Actions OIDC용 IAM Role ARN | AWS IAM → Roles → `devnavi-prod-github-actions-role` → ARN 복사 |

### S3 / CloudFront

| Secret Name | 설명 | 획득 방법 |
|-------------|------|----------|
| `S3_BUCKET` | 프론트엔드 배포용 S3 버킷명 | AWS S3 콘솔에서 확인 |
| `S3_LAMBDA_BUCKET` | Lambda 패키지 업로드용 S3 버킷명 | AWS S3 콘솔에서 확인 |
| `CF_FRONTEND_DIST_ID` | 프론트엔드 CloudFront Distribution ID | `E2P1UZ7WSES79H` (devnavi.kr) |
| `CF_API_DISTRIBUTION_ID` | API CloudFront Distribution ID | `EMOTTXC5WYHVW` (api.devnavi.kr) |

### 프론트엔드 빌드 환경변수

| Secret Name | 설명 | 값/획득 방법 |
|-------------|------|------------|
| `VITE_API_URL` | API 엔드포인트 | **반드시 `https://api.devnavi.kr`** — Lambda URL 직접 사용 금지 (403 발생) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon 공개 키 | Supabase Dashboard → Project Settings → API → `anon` `public` |

### CI 통합 테스트 전용 (선택사항)

미설정 시 integration tests가 자동 skip됨 — CI 실패가 아님.

| Secret Name | 설명 | 획득 방법 |
|-------------|------|----------|
| `SUPABASE_TEST_URL` | 테스트용 Supabase 프로젝트 URL | 별도 테스트 Supabase 프로젝트 생성 권장 |
| `SUPABASE_TEST_SERVICE_KEY` | 테스트용 service_role 키 | Supabase Dashboard → Project Settings → API → `service_role` |
| `SUPABASE_TEST_ANON_KEY` | 테스트용 anon 키 | Supabase Dashboard → Project Settings → API → `anon` `public` |
| `SUPABASE_TEST_JWT_SECRET` | 테스트용 JWT secret | Supabase Dashboard → Project Settings → API → JWT Secret |

---

## 2. AWS SSM Parameter Store

백엔드 Lambda가 런타임에 읽는 시크릿. AWS SSM → Parameter Store → 아래 경로로 생성.

모두 `SecureString` 타입, 리전: `ap-northeast-2`

| Parameter Path | 설명 | 획득 방법 |
|---------------|------|----------|
| `/devnavi/prod/ANTHROPIC_API_KEY` | Claude API 키 | https://console.anthropic.com → API Keys |
| `/devnavi/prod/SUPABASE_URL` | Supabase 프로젝트 URL | Supabase Dashboard → Project Settings → API |
| `/devnavi/prod/SUPABASE_SERVICE_KEY` | Supabase service_role 키 (RLS 우회) | Supabase Dashboard → Project Settings → API |
| `/devnavi/prod/SUPABASE_ANON_KEY` | Supabase anon 키 | Supabase Dashboard → Project Settings → API |
| `/devnavi/prod/SUPABASE_JWT_SECRET` | Supabase JWT 서명 시크릿 | Supabase Dashboard → Project Settings → API → JWT Secret |
| `/devnavi/prod/CLOUDFRONT_SECRET` | CloudFront Origin Custom Header 검증값 | 임의 강력한 랜덤 문자열 생성 (32자 이상 권장) |
| `/devnavi/prod/CORS_ORIGINS` | 허용 CORS 도메인 (쉼표 구분) | 예: `https://devnavi.kr,https://www.devnavi.kr` |
| `/devnavi/prod/FREE_DAILY_LIMIT` | 무료 사용자 일일 한도 | 숫자 (기본값 5) |
| `/devnavi/prod/DEV_BYPASS_USERS` | 쿼터 제한 제외 UUID 목록 (쉼표 구분) | 개발자 Supabase user UUID |

---

## 3. 로컬 개발 환경변수

### 백엔드 (`backend/.env`)

```env
ENV=local
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
CLOUDFRONT_SECRET=local-dev-secret
CORS_ORIGINS=http://localhost:5173
FREE_DAILY_LIMIT=5
DEV_BYPASS_USERS=your-supabase-user-uuid
```

### 프론트엔드 (`frontend/.env.local`)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. CloudFront Origin Custom Header 설정 (수동)

AWS 콘솔에서 직접 설정 필요 (Terraform 미관리):

1. CloudFront → Distributions → `EMOTTXC5WYHVW` (api.devnavi.kr)
2. Origins 탭 → Lambda Origin 편집
3. Add custom header: `X-CF-Secret` = `/devnavi/prod/CLOUDFRONT_SECRET` 값과 동일

---

## 5. Supabase 대시보드 수동 설정

| 항목 | 설정값 |
|------|--------|
| Site URL | `https://devnavi.kr` |
| Redirect URLs | `https://devnavi.kr/**` |
| SMTP 발신자 | `support@devnavi.kr` (Resend smtp.resend.com:465) |
| 비밀번호 정책 | 8자 이상 + 특수문자 1개 이상 |

---

## 6. 주의사항

- `VITE_API_URL`은 **반드시 `https://api.devnavi.kr`** (CloudFront URL)
  - Lambda Function URL 직접 사용 시 `X-CF-Secret` 헤더 없어 403 발생
- `SUPABASE_TEST_*` 미설정 시 integration tests 자동 skip — CI 실패 아님
- `job if` 조건에 secrets 비교 (`${{ secrets.X != '' }}`) 절대 금지 — GitHub Actions 오류 유발

---

## 7. 빠른 설정 체크리스트

### 최소 운영 (프로덕션 배포)
- [ ] `AWS_ROLE_ARN`
- [ ] `S3_BUCKET`, `S3_LAMBDA_BUCKET`
- [ ] `CF_FRONTEND_DIST_ID`, `CF_API_DISTRIBUTION_ID`
- [ ] `VITE_API_URL` = `https://api.devnavi.kr`
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] SSM: `ANTHROPIC_API_KEY`, `SUPABASE_*`, `CLOUDFRONT_SECRET`
- [ ] CloudFront Origin Custom Header `X-CF-Secret` 설정

### 통합 테스트 활성화 (선택)
- [ ] `SUPABASE_TEST_URL`
- [ ] `SUPABASE_TEST_SERVICE_KEY`
- [ ] `SUPABASE_TEST_ANON_KEY`
- [ ] `SUPABASE_TEST_JWT_SECRET`
