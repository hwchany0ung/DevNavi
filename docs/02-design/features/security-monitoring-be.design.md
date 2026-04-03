# Design: security-monitoring-be

> 담당: enterprise-expert | Plan Ref: security-monitoring.plan.md

## 1. 미들웨어: SecurityEventMiddleware

### 파일: `backend/app/middleware/security_events.py`

**패턴**: Pure ASGI (기존 ErrorLoggingMiddleware와 동일 패턴)

```python
class SecurityEventMiddleware:
    """보안 이벤트 감지 — Pure ASGI, SSE 스트리밍 안전.

    429 (Rate Limit Exceeded) + 401 (Auth Failure) 감지 후
    fire-and-forget으로 security_events 테이블에 비동기 저장.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._pending_tasks: set = set()  # BC-1 패턴: GC 방지

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        status_ref = {"code": 200}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_ref["code"] = message.get("status", 200)
            await send(message)

        await self.app(scope, receive, send_wrapper)

        code = status_ref["code"]
        if code in (401, 429):
            event_type = "rate_limit_exceeded" if code == 429 else "auth_failure"
            ip = _extract_client_ip(scope)
            path = scope.get("path", "")
            method = scope.get("method", "GET")

            task = asyncio.create_task(
                save_security_event(
                    event_type=event_type,
                    ip=ip,
                    path=path,
                    method=method,
                    status_code=code,
                )
            )
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)
```

### IP 추출 로직

```python
def _extract_client_ip(scope) -> str:
    """X-Forwarded-For 헤더 우선, 없으면 scope의 client IP."""
    headers = dict(scope.get("headers", []))
    xff = headers.get(b"x-forwarded-for", b"").decode("utf-8", errors="ignore")
    if xff:
        return xff.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else ""
```

### 미들웨어 등록 위치 (main.py)

```python
# 실행 순서 (안→밖):
# FastAPI → SecurityHeaders → ErrorLogging → SecurityEvent → CloudFrontSecret → CORS
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorLoggingMiddleware)
app.add_middleware(SecurityEventMiddleware)   # ← 신규 추가
app.add_middleware(CloudFrontSecretMiddleware)
```

**등록 위치 결정 이유:**
- ErrorLogging 바깥에 위치 → 5xx 에러와 별개로 429/401 감지
- CloudFrontSecret 안쪽 → CloudFront 인증 통과한 요청만 감지 (직접 접근 차단된 요청은 무시)

---

## 2. 서비스: SecurityEventService

### 파일: `backend/app/services/security_event_service.py`

```python
async def save_security_event(
    event_type: str,
    ip: str,
    path: str,
    method: str,
    status_code: int,
    user_id: str | None = None,
) -> None:
    """security_events 테이블에 이벤트 저장. 실패해도 예외 전파 안 함."""
    if not settings.supabase_ready:
        return
    try:
        client = get_supabase_client()
        payload = {
            "event_type":  event_type,
            "ip":          ip[:100],
            "path":        path[:500],
            "method":      method[:10],
            "status_code": status_code,
        }
        if user_id:
            payload["user_id"] = user_id
        await client.post(
            sb_url("security_events"),
            json=payload,
            headers=sb_headers(prefer="return=minimal"),
        )
    except Exception as e:
        logger.warning("[security] event 저장 실패: %s", e)
```

**설계 결정:**
- `save_error_log()` 패턴과 동일 (예외 전파 없음)
- `return=minimal`: 응답 바디 불필요 (fire-and-forget)
- IP/path 길이 제한: DB 과부하 방지

---

## 3. API 엔드포인트

### GET /admin/security-events

**파일**: `backend/app/api/admin.py`에 추가

```python
@router.get("/security-events")
@limiter.limit("30/minute")
async def get_security_events(
    request: Request,
    admin: dict = Depends(require_admin),
    limit: int = 50,
    event_type: str | None = None,
) -> dict:
```

**응답 구조:**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "rate_limit_exceeded",
      "ip": "192.168.1.1",
      "path": "/roadmap/full",
      "method": "POST",
      "status_code": 429,
      "created_at": "2026-04-03T14:30:00Z"
    }
  ],
  "summary": {
    "rate_limit_today": 12,
    "auth_failure_today": 3
  }
}
```

**구현 흐름:**
1. events: security_events 최신순 조회 (limit 적용, event_type 필터 옵션)
2. summary: 오늘 날짜 기준 event_type별 count (asyncio.gather로 병렬)
3. limit 범위: 1~200, 기본값 50

---

## 4. 단위 테스트 명세

### 파일: `backend/tests/unit/test_security_events.py`

| # | 테스트 | 검증 내용 |
|---|--------|----------|
| 1 | `test_middleware_detects_429` | status 429 → event_type='rate_limit_exceeded'로 save 호출 |
| 2 | `test_middleware_detects_401` | status 401 → event_type='auth_failure'로 save 호출 |
| 3 | `test_middleware_ignores_200` | status 200 → save 호출 안 됨 |
| 4 | `test_extract_client_ip_xff` | X-Forwarded-For 헤더 있을 때 첫 번째 IP 추출 |
| 5 | `test_extract_client_ip_fallback` | X-Forwarded-For 없을 때 scope client IP 사용 |

최소 3건 이상 (Plan DoD 기준), 5건으로 설계.
