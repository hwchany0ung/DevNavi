# Design: security-monitoring-infra

> 담당: infra-architect | Plan Ref: security-monitoring.plan.md

## 1. Supabase DDL

### security_events 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid PK | gen_random_uuid() | 자동 생성 |
| `event_type` | text NOT NULL | CHECK ('rate_limit_exceeded', 'auth_failure') | 이벤트 유형 |
| `ip` | text NOT NULL | DEFAULT '' | 클라이언트 IP |
| `path` | text NOT NULL | DEFAULT '' | 요청 경로 |
| `method` | text NOT NULL | DEFAULT 'GET' | HTTP 메서드 |
| `user_id` | uuid | nullable | 인증된 경우 사용자 ID |
| `status_code` | int NOT NULL | - | 응답 코드 (429, 401) |
| `created_at` | timestamptz NOT NULL | DEFAULT now() | 이벤트 발생 시각 |
| `notified_at` | timestamptz | nullable | 알람 발송 시각 |

### 인덱스

| 인덱스 | 컬럼 | 조건 | 용도 |
|--------|------|------|------|
| idx_security_events_not_notified | created_at DESC | WHERE notified_at IS NULL | 알람 스크립트 미발송 이벤트 조회 |
| idx_security_events_created_at | created_at DESC | - | AdminPage 최신순 조회 |
| idx_security_events_type | event_type | - | 유형별 필터링 |

### RLS

- RLS 활성화 (`ENABLE ROW LEVEL SECURITY`)
- policy 없음 = anon/authenticated 접근 불가
- service_role은 RLS bypass → 미들웨어/알람 스크립트 모두 정상 동작

DDL 파일: `supabase/security_events.sql`

---

## 2. GitHub Actions 워크플로우

### security-alert.yml

```yaml
name: Security Alert (Telegram)

on:
  schedule:
    - cron: '*/5 * * * *'   # 5분마다 실행
  workflow_dispatch:          # 수동 실행 가능

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - run: pip install httpx

      - name: Run security alert script
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: python scripts/notify_security_events.py
```

### 설계 결정

| 결정 | 이유 |
|------|------|
| httpx 설치 | Supabase REST API 호출용. requests 대비 async 지원 (향후 확장성) |
| `workflow_dispatch` 포함 | 수동 테스트 가능 |
| secrets 4개 주입 | SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID |

---

## 3. Telegram 알람 스크립트 설계

### scripts/notify_security_events.py

**흐름:**
1. 환경변수에서 SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 읽기
2. Supabase REST API로 `notified_at IS NULL` 이벤트 조회 (최대 100건)
3. 이벤트 없으면 exit 0 (조용히 종료)
4. 이벤트 있으면:
   a. event_type별 건수 집계
   b. IP별 건수 집계 (상위 5개)
   c. Telegram Bot API (`sendMessage`) 호출
   d. 조회한 이벤트들의 `notified_at` = now() 업데이트
5. 에러 발생 시 exit 1

**알람 메시지 포맷:**
```
🚨 [DevNavi 보안 알람] {timestamp}

📊 최근 5분 감지 이벤트
- Rate limit 초과: {N}건
- 인증 실패: {M}건

🔍 주요 IP
- {ip1} ({count}건)
- {ip2} ({count}건)

관리자 대시보드에서 확인하세요.
```

**에러 처리:**
- 환경변수 누락: 경고 출력 후 exit 0 (CI 실패 방지)
- Supabase API 실패: exit 1
- Telegram API 실패: 경고 출력, notified_at 업데이트 하지 않음 (다음 주기에 재시도)
