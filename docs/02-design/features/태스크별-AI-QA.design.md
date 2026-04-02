# Design: 태스크별 AI Q&A

> **Phase**: Design | **Date**: 2026-04-02 | **Feature**: 태스크별-AI-QA
> **Architecture**: Option B — Clean Architecture
> Plan Reference: `docs/01-plan/features/태스크별-AI-QA.plan.md`
> PRD Reference: `docs/00-pm/태스크별-AI-QA.prd.md`

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 태스크 수행 가이드 부재로 인한 이탈 및 완료율 정체 해소 |
| **WHO** | IT 직군 취업 준비생 (비전공 전환자 Beachhead) |
| **RISK** | 악의적 API 남용, task_id 소유권 우회, Haiku 품질 부족 |
| **SUCCESS** | Q&A 사용률 30%+, 완료율 20%+ 향상, 비용 월 $50 이하 |
| **SCOPE** | 로드맵 페이지 Q&A 버튼 + 우측 사이드 패널 + /ai/qa 엔드포인트 + 5계층 방어 |

---

## 1. Overview

### 아키텍처 결정: Option B (Clean Architecture)

완전 독립 모듈로 분리. `components/qa/`, `hooks/useQA.js`, `backend/app/api/ai_qa.py` + `services/qa_service.py`로 관심사를 완전 분리. 대화 이력은 세션 메모리(React state)만 사용, DB 저장 없음.

### 시스템 흐름

```
사용자 클릭 "?" 버튼 (QAButton)
    ↓
useQA hook → taskContext 구성 (job_type, month, week, category, task_name)
    ↓
POST /ai/qa (JWT 인증 + task_id 소유권 검증)
    ↓
qa_service.py → usage 체크 (Supabase qa_usage)
    ↓
slowapi rate limit 검사 (10/hr, 30/day)
    ↓
Claude Haiku API (맥락 주입 + max_tokens=300) → SSE 스트리밍
    ↓
QAPanel.jsx 실시간 렌더링 (세션 메모리 이력 유지)
```

---

## 2. 파일 구조

### 신규 파일 (7개)

```
frontend/src/
  components/qa/
    QAPanel.jsx        # 우측 사이드 패널 전체 (열림/닫힘, 대화 뷰)
    QAButton.jsx       # 태스크 옆 "?" 아이콘 버튼
    QAInput.jsx        # 하단 고정 입력폼 (textarea + 전송)
  hooks/
    useQA.js           # API 호출, 세션 메모리, 스트리밍 상태 관리

backend/app/
  api/
    ai_qa.py           # POST /ai/qa 라우터 + rate limit
  services/
    qa_service.py      # 맥락 주입 프롬프트 생성 + Haiku 호출
  models/
    qa_models.py       # QARequest, QAMessage Pydantic 모델
```

### 수정 파일 (2개)

```
frontend/src/
  pages/RoadmapPage.jsx          # QAPanel 마운트, QAButton 렌더링
backend/app/
  main.py                        # ai_qa 라우터 등록
```

### DB Migration (1개)

```
supabase/migrations/005_qa_usage.sql   # qa_usage 테이블 신규
```

---

## 3. 컴포넌트 설계 (Frontend)

### 3.1 QAButton.jsx

```jsx
// Props: taskId, taskName, onClick
// 렌더링: "?" 아이콘 버튼 (16px, 투명 배경, hover 시 primary색)
// 클릭: onClick(taskId, taskContext) 호출

<button
  className="qa-trigger-btn"
  onClick={() => onClick(taskId, { taskName, month, week, category, jobType })}
  aria-label={`${taskName} AI 질문`}
>
  ?
</button>
```

**위치**: WeekAccordion 내 각 태스크 행 우측에 삽입

### 3.2 QAInput.jsx

```jsx
// Props: onSubmit, disabled
// 렌더링: textarea (max 200자) + 전송 버튼
// Enter: 전송 (Shift+Enter: 줄바꿈)
// 스트리밍 중: disabled=true
```

### 3.3 QAPanel.jsx

```jsx
// Props: isOpen, taskContext, onClose
// 내부 상태: useQA(taskContext) hook 사용

구조:
┌─────────────────────────────┐
│ [태스크명]              [X] │  ← 헤더
├─────────────────────────────┤
│                             │
│  [AI 답변 스트리밍 영역]    │  ← 스크롤 가능
│                             │
├─────────────────────────────┤
│  [QAInput]                  │  ← 하단 고정
└─────────────────────────────┘

CSS: position fixed, right: 0, width: 360px, height: 100vh
     transform: translateX(360px) → translateX(0) 200ms ease
```

### 3.4 useQA.js

```js
// 관리 상태:
// - messages: Map<taskId, Message[]>  (세션 메모리)
// - isStreaming: boolean
// - currentTaskId: string

// 주요 함수:
// - openPanel(taskId, taskContext)  → 패널 열기, 이전 대화 복원
// - sendMessage(question)           → SSE 스트리밍 시작
// - closePanel()                    → 패널 닫기

// SSE 처리: 기존 streamSSE 유틸리티 재사용
// AbortController로 스트리밍 취소 지원 (패널 닫기 시)
```

---

## 4. API 설계 (Backend)

### 4.1 POST /ai/qa

```
URL: /ai/qa
Auth: Bearer JWT (필수)
Rate Limit: 10/hour per IP (slowapi)
Content-Type: application/json
Response: text/event-stream (SSE)
```

**Request Body**:
```json
{
  "task_id": "1-1-0",
  "question": "이게 뭔가요?",
  "task_context": {
    "job_type": "backend",
    "month": 1,
    "week": 1,
    "category": "기초",
    "task_name": "Docker 네트워킹 설정하기"
  },
  "messages": [
    {"role": "user", "content": "이전 질문"},
    {"role": "assistant", "content": "이전 답변"}
  ]
}
```

**SSE Response Events**:
```
data: {"type": "delta", "content": "Docker는 컨테이너"}
data: {"type": "delta", "content": " 네트워크를..."}
data: {"type": "done"}

# 오류 시
data: {"type": "error", "code": "rate_limit", "message": "오늘 질문 한도(30회)를 소진했습니다."}
data: {"type": "error", "code": "ownership", "message": "접근 권한이 없습니다."}
```

**HTTP 상태 코드**:
- 200: 정상 스트리밍 (소유권 오류도 SSE error event로 전달)
- 401: 미인증 (JWT 없음 또는 만료)
- 422: 입력 검증 실패 (question 200자 초과 등)
- 429: rate limit 초과 (slowapi IP 기반)

> **구현 참고**: SSE 스트리밍은 HTTP 헤더를 먼저 전송하므로 task_id 소유권 오류는
> HTTP 403 대신 `{"type": "error", "code": "ownership", "message": "..."}` SSE 이벤트로 전달됨.

### 4.2 qa_models.py

```python
class QAMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1000)

class QATaskContext(BaseModel):
    job_type: str
    month: int = Field(ge=1, le=12)
    week: int = Field(ge=1, le=4)
    category: str
    task_name: str = Field(max_length=200)

class QARequest(BaseModel):
    task_id: str = Field(pattern=r"^\d+-\d+-\d+$")  # "1-1-0" 형식
    question: str = Field(min_length=1, max_length=200)
    task_context: QATaskContext
    messages: list[QAMessage] = Field(default=[], max_length=10)
```

---

## 5. 다층 방어 구현 상세

### Layer 1: slowapi Rate Limit

```python
# ai_qa.py
@router.post("/ai/qa")
@limiter.limit("10/hour")     # IP 기반
async def ask_qa(request: Request, body: QARequest, user=Depends(get_current_user)):
    ...
```

### Layer 2: 사용량 카운터 (Supabase)

```python
# qa_service.py
async def check_and_increment_qa_usage(user_id: str) -> bool:
    """
    Returns True if allowed, False if limit exceeded
    daily_limit=30, monthly_limit=100
    """
    result = await supabase.rpc(
        "increment_and_check_qa_usage",
        {"p_user_id": user_id, "p_daily_limit": 30, "p_monthly_limit": 100}
    ).execute()
    return result.data["allowed"]
```

### Layer 3: task_id 소유권 검증

```python
# qa_service.py
async def verify_task_ownership(user_id: str, task_id: str) -> bool:
    """
    task_id format: "{month}-{week}-{task_index}"
    user의 active roadmap에서 해당 task 존재 여부 확인
    """
    month, week, idx = task_id.split("-")
    result = await supabase.table("roadmaps") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("is_active", True) \
        .execute()
    # roadmap JSON에서 task 존재 여부 확인
    ...
```

### Layer 4: 입력 검증 (Pydantic)
- `question`: max_length=200 (QARequest 모델에서 자동 검증)
- `task_id`: 정규식 패턴 `^\d+-\d+-\d+$`
- `messages`: max_length=10 (과거 이력 10턴 이하)

### Layer 5: max_tokens 하드코딩

```python
# qa_service.py
response = anthropic.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=300,  # 하드코딩 — 요청으로 변경 불가
    system=system_prompt,
    messages=conversation_history,
    stream=True,
)
```

---

## 6. DB Schema

### qa_usage 테이블

```sql
-- supabase/migrations/005_qa_usage.sql
CREATE TABLE qa_usage (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    month       TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    daily_count INTEGER NOT NULL DEFAULT 0,
    monthly_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- RLS
ALTER TABLE qa_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own usage"
    ON qa_usage FOR SELECT USING (auth.uid() = user_id);
```

### RPC: increment_and_check_qa_usage

```sql
CREATE OR REPLACE FUNCTION increment_and_check_qa_usage(
    p_user_id UUID,
    p_daily_limit INTEGER DEFAULT 30,
    p_monthly_limit INTEGER DEFAULT 100
) RETURNS JSON AS $$
DECLARE
    v_daily   INTEGER;
    v_monthly INTEGER;
BEGIN
    INSERT INTO qa_usage (user_id, date, month, daily_count, monthly_count)
    VALUES (p_user_id, CURRENT_DATE, to_char(CURRENT_DATE, 'YYYY-MM'), 1, 1)
    ON CONFLICT (user_id, date) DO UPDATE
        SET daily_count   = qa_usage.daily_count + 1,
            monthly_count = qa_usage.monthly_count + 1,
            updated_at    = NOW()
    RETURNING daily_count, monthly_count INTO v_daily, v_monthly;

    RETURN json_build_object(
        'allowed',        (v_daily <= p_daily_limit AND v_monthly <= p_monthly_limit),
        'daily_count',    v_daily,
        'monthly_count',  v_monthly,
        'daily_limit',    p_daily_limit,
        'monthly_limit',  p_monthly_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. 프롬프트 설계

### System Prompt (qa_service.py)

```python
SYSTEM_PROMPT = """당신은 DevNavi의 IT 취업 커리어 코치입니다.
사용자의 로드맵 태스크를 실행하도록 돕습니다.

## 현재 컨텍스트
- 직군: {job_type}
- 현재 진도: {month}개월차 {week}주차
- 태스크 카테고리: {category}
- 현재 태스크: {task_name}

## 답변 규칙
1. 200자 이내로 간결하게 답변 (max_tokens=300 제약 있음)
2. 코드 예시는 5줄 이내
3. 추가 질문을 유도하는 짧은 마무리 문장 포함
4. 해당 직군({job_type}) 맥락에 맞는 답변만
"""
```

---

## 8. 테스트 계획

### 단위 테스트 (backend/tests/unit/)

| 테스트 | 파일 | 검증 항목 |
|--------|------|---------|
| QARequest 검증 | test_qa_models.py | max_length=200, task_id 패턴, messages 제한 |
| check_qa_usage | test_qa_service.py | 한도 초과 시 False 반환 |
| verify_ownership | test_qa_service.py | 타인 task_id → False |
| build_prompt | test_qa_service.py | 맥락 정상 주입 |

### 통합 테스트 (backend/tests/integration/)

| 테스트 | 검증 항목 |
|--------|---------|
| POST /ai/qa 인증 | 401 반환 |
| POST /ai/qa 소유권 | 403 반환 |
| POST /ai/qa 한도 초과 | 429 반환 |
| POST /ai/qa 정상 스트리밍 | SSE 응답 확인 |

### Frontend 단위 테스트 (frontend/src/tests/)

| 테스트 | 파일 | 검증 항목 |
|--------|------|---------|
| QAButton 렌더링 | QAButton.test.jsx | 클릭 시 onClick 호출 |
| QAInput 제출 | QAInput.test.jsx | Enter 전송, 200자 제한 |
| QAPanel 열림/닫힘 | QAPanel.test.jsx | isOpen prop 변화 |
| useQA 세션 메모리 | useQA.test.js | 같은 taskId 재오픈 시 이력 복원 |

### E2E (frontend/tests/e2e/)

```
ai-qa.spec.ts:
  - 로드맵 페이지 로드 → "?" 버튼 표시 확인
  - "?" 클릭 → 우측 패널 슬라이드 인 확인
  - 질문 입력 → 스트리밍 응답 수신 확인
  - 패널 닫기 → 재클릭 → 이전 대화 유지 확인
  - 31번째 질문 → 429 에러 메시지 확인 (Mock)
```

---

## 9. RoadmapPage.jsx 통합 방식

```jsx
// 추가할 state
const [qaOpen, setQaOpen] = useState(false);
const [qaTaskContext, setQaTaskContext] = useState(null);

// QAButton이 WeekAccordion 내부에서 사용 — taskContext 전달
const handleQAOpen = (taskId, context) => {
  setQaTaskContext({ taskId, ...context });
  setQaOpen(true);
};

// JSX 말미에 QAPanel 마운트 (항상 렌더, isOpen prop으로 제어)
<QAPanel
  isOpen={qaOpen}
  taskContext={qaTaskContext}
  onClose={() => setQaOpen(false)}
/>
```

**WeekAccordion 내 태스크 행 수정**:
```jsx
<div className="task-row">
  <input type="checkbox" ... />
  <span>{task.name}</span>
  <QAButton
    taskId={`${month}-${week}-${taskIndex}`}
    taskName={task.name}
    onClick={onQAOpen}   // RoadmapPage에서 prop으로 전달
  />
</div>
```

---

## 10. 구현 순서 및 세션 가이드

### Module Map

| 모듈 | 파일 | 예상 시간 |
|------|------|--------|
| M1: DB + 백엔드 기반 | 005_qa_usage.sql, qa_models.py, qa_service.py | 1.5h |
| M2: API 라우터 + 방어 | ai_qa.py, main.py 등록 | 1h |
| M3: Frontend 컴포넌트 | QAButton, QAInput, QAPanel | 1.5h |
| M4: useQA Hook | useQA.js | 1h |
| M5: RoadmapPage 통합 | RoadmapPage.jsx, WeekAccordion.jsx | 0.5h |
| M6: 테스트 | unit + integration + E2E | 1.5h |

### 11.3 Session Guide

**권장 세션 분할**:

- **Session 1** (M1 + M2): DB migration 실행 → 백엔드 API 완성 → curl 테스트
- **Session 2** (M3 + M4): 프론트엔드 컴포넌트 → useQA hook → 스토리북
- **Session 3** (M5 + M6): RoadmapPage 통합 → 단위/통합/E2E 테스트

**명령어**:
```bash
/pdca do 태스크별-AI-QA --scope M1,M2   # Session 1
/pdca do 태스크별-AI-QA --scope M3,M4   # Session 2
/pdca do 태스크별-AI-QA --scope M5,M6   # Session 3
```

---

## 11. 주요 설계 결정 기록

| 결정 | 선택 | 이유 |
|------|------|------|
| 대화 이력 저장 | 세션 메모리만 | DB 저장 시 구현 복잡도 급증, 사용자 프라이버시 |
| 모델 | Claude Haiku | 비용 $0.0007/회, 응답 속도 빠름 |
| max_tokens | 300 하드코딩 | 비용 상한 고정, 사용자 조작 불가 |
| Rate limit 계층 | slowapi(IP) + Supabase(사용자) | IP만으로는 우회 가능, 이중 방어 |
| task_id 형식 | "{month}-{week}-{taskIndex}" | 기존 GrassCalendar/RoadmapPage와 동일한 패턴 |
| QA 패널 위치 | 우측 고정 사이드 패널 | 로드맵 콘텐츠와 동시 확인 가능 |
