# Plan: security-monitoring

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 비정상 접근·공격 시도(Rate limit 초과, 인증 실패 반복)가 발생해도 관리자가 인지할 수단이 없음. error_logs는 5xx만 기록하고 보안 이벤트 개념이 없음 |
| **Solution** | Pure ASGI 미들웨어로 429·401 이벤트를 security_events 테이블에 기록, GitHub Actions 5분 Cron으로 Telegram 알람 발송, AdminPage에 보안 탭 추가 |
| **UX Effect** | 관리자는 대시보드에서 공격 패턴을 한눈에 확인하고, 5분 이내 Telegram으로 공격 알람을 수신 |
| **Core Value** | 추가 AWS 비용 없이(WAF 불필요) 실용적인 보안 가시성 확보 |

---

## 1. 기능 개요

- **Feature**: security-monitoring
- **목적**: 비정상 접근·공격 시도를 실시간 감지하여 관리자 대시보드에 표시하고 5분 내 Telegram 알람 발송
- **범위 (v1)**: Rate limit 초과(429) + 인증 실패 반복(401) 감지, 관리자 대시보드 보안 탭, 5분 배치 Telegram 알람

---

## 2. 사용자 의도 발견 (Intent Discovery)

| 질문 | 답변 |
|------|------|
| 핵심 문제 | 공격 시도를 인지할 수단 없음 |
| 주요 사용자 | 관리자 (서비스 운영자) |
| 감지 우선순위 | Rate limit 초과 + 인증 실패 반복 (v1), 스캐너 UA·관리자 무단접근 (v2) |
| 알람 채널 | Telegram 봇 (기존 훅 인프라 활용) |
| 알람 방식 | 5분 집계 배치 (스팸 방지) |

---

## 3. 탐색한 대안들 (Alternatives Explored)

| 방식 | 장점 | 단점 | 결론 |
|------|------|------|------|
| **A. 미들웨어 인라인 감지** | 기존 패턴 재사용, 추가 서비스 불필요 | 미들웨어 약간 무거워짐 | **선택** |
| B. CloudFront WAF | 앱 레이어 전 차단 | 비용($5/월+), 커스텀 어려움 | 제외 |
| C. 전용 Security 서비스 분리 | 관심사 분리 명확 | 현재 규모 오버엔지니어링 | 제외 |

---

## 4. YAGNI 검토

### v1 포함
- [ ] `security_events` Supabase 테이블 생성
- [ ] `SecurityEventMiddleware` (Pure ASGI) — 429·401 감지 및 기록
- [ ] `GET /admin/security-events` API 엔드포인트
- [ ] `AdminPage.jsx` 보안 이벤트 탭 (테이블 + 통계 카드)
- [ ] GitHub Actions Cron (5분) — Supabase 조회 → Telegram 알람

### v2 이후 (스코프 제외)
- 스캐너 User-Agent 탐지 (sqlmap, nikto 등)
- /admin/* 무단 접근 감지
- IP 자동 차단 연동
- 이메일(AWS SES) 알람

---

## 5. 시스템 아키텍처

```
HTTP 요청
    │
    ▼
SecurityEventMiddleware (Pure ASGI — main.py에 추가)
    │  429 감지: RateLimitExceeded 응답 인터셉트
    │  401 감지: 응답 상태코드 확인
    │  → asyncio.create_task(save_security_event(...))  ← fire-and-forget
    │
    ▼
기존 미들웨어 체인 (CloudFrontSecret → SecurityHeaders → ErrorLogging)

Supabase
    └── security_events 테이블
        id | event_type | ip | path | method | user_id | status_code | created_at | notified_at

GitHub Actions (cron: */5 * * * *)
    └── scripts/notify_security_events.py
        1. Supabase REST API로 notified_at IS NULL 이벤트 조회
        2. 있으면 Telegram Bot API로 집계 메시지 발송
        3. notified_at 업데이트

AdminPage.jsx
    └── 보안 탭
        - 오늘 이벤트 수 카드 (event_type별)
        - 최근 50건 테이블 (시각·유형·IP·경로)
        - 30초 자동 갱신 (기존 REFRESH_INTERVAL_MS 활용)
```

---

## 6. 데이터 모델

### security_events 테이블 (Supabase)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | 자동 생성 |
| `event_type` | text | `rate_limit_exceeded` \| `auth_failure` |
| `ip` | text | 클라이언트 IP (X-Forwarded-For) |
| `path` | text | 요청 경로 |
| `method` | text | HTTP 메서드 |
| `user_id` | uuid nullable | 인증된 경우 사용자 ID |
| `status_code` | int | 응답 코드 (429, 401) |
| `created_at` | timestamptz | 이벤트 발생 시각 |
| `notified_at` | timestamptz nullable | Telegram 알람 발송 시각 |

---

## 7. API 명세

### GET /admin/security-events
- **인증**: require_admin
- **쿼리 파라미터**: `limit` (default 50), `event_type` (optional filter)
- **응답**: `{ events: [...], summary: { rate_limit_today, auth_failure_today } }`

---

## 8. Telegram 알람 포맷

```
🚨 [DevNavi 보안 알람] 2026-04-03 23:40

📊 최근 5분 감지 이벤트
- Rate limit 초과: 12건
- 인증 실패: 3건

🔍 주요 IP
- 192.168.1.1 (8건)
- 10.0.0.5 (4건)

관리자 대시보드에서 확인하세요.
```

---

## 9. 구현 파일 목록

| 파일 | 변경 유형 | 담당 |
|------|----------|------|
| `backend/app/main.py` | 수정 — SecurityEventMiddleware 등록 | BE |
| `backend/app/middleware/security_events.py` | 신규 — 미들웨어 구현 | BE |
| `backend/app/services/security_event_service.py` | 신규 — DB 저장 로직 | BE |
| `backend/app/api/admin.py` | 수정 — `/admin/security-events` 엔드포인트 추가 | BE |
| `supabase/security_events.sql` | 신규 — 테이블 DDL | DB |
| `scripts/notify_security_events.py` | 신규 — Telegram 알람 스크립트 | Ops |
| `.github/workflows/security-alert.yml` | 신규 — 5분 Cron 워크플로우 | CI |
| `frontend/src/components/admin/SecurityEvents.jsx` | 신규 — 보안 이벤트 테이블 컴포넌트 | FE |
| `frontend/src/pages/AdminPage.jsx` | 수정 — 보안 탭 추가 | FE |

---

## 10. 브레인스토밍 로그

| 결정 | 이유 |
|------|------|
| Telegram 알람 방식: GitHub Actions Cron | Lambda cold start 없이 안정적. APScheduler는 서버리스 환경 부적합 |
| 알람 주기: 5분 배치 | 즉시 발송은 429 폭탄 공격 시 Telegram 스팸 위험 |
| 미들웨어 위치: Pure ASGI | 기존 SecurityHeaders·ErrorLogging 패턴과 일관성, SSE 스트리밍 안전 |
| v1 감지 범위: 429+401만 | 스캐너 UA 등은 false positive 가능성. 핵심 신호 먼저 검증 후 확장 |

---

## 11. 완료 조건 (Definition of Done)

- [ ] 429 이벤트 발생 시 security_events에 기록됨
- [ ] 401 반복 이벤트 발생 시 security_events에 기록됨
- [ ] `/admin/security-events` 인증 없이 접근 시 404 반환
- [ ] AdminPage 보안 탭에서 이벤트 목록 확인 가능
- [ ] GitHub Actions Cron이 5분마다 실행되어 미알람 이벤트 Telegram 발송
- [ ] 이벤트 없는 경우 Telegram 알람 미발송 (조용히 통과)
- [ ] 단위 테스트: 미들웨어 감지 로직 (event_type 분류) ≥ 3건
