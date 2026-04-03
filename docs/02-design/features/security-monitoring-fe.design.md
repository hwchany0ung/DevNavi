# Design: security-monitoring-fe

> 담당: frontend-architect | Plan Ref: security-monitoring.plan.md

## 1. 컴포넌트 구조

### SecurityEvents 컴포넌트

**파일**: `frontend/src/components/admin/SecurityEvents.jsx`

**패턴**: QAStats.jsx와 동일 (독립 데이터 페칭 + 섹션 컴포넌트)

```
<SecurityEvents>
  ├── <h2> "보안 모니터링"
  ├── <StatCard grid>   ─── 오늘 이벤트 요약 카드 2개
  │   ├── StatCard "Rate Limit 초과" (rate_limit_today)
  │   └── StatCard "인증 실패" (auth_failure_today)
  └── <SecurityEventTable>  ─── 최근 50건 테이블
      ├── thead: 시각 | 유형 | IP | 경로 | 상태코드
      └── tbody: events.map(...)
```

### 재사용 컴포넌트

| 컴포넌트 | 출처 | 사용 |
|---------|------|------|
| `StatCard` | `components/common/StatCard.jsx` | 요약 카드 |
| `request()` | `lib/api.js` | API 호출 (자동 인증 토큰 주입) |

### 데이터 흐름

```
useEffect (mount)
  ↓
request('/admin/security-events')
  ↓ 응답
setStats({ events, summary })
  ↓
StatCard × 2 + SecurityEventTable 렌더링
```

### 30초 자동 갱신

- `REFRESH_INTERVAL_MS` (AdminPage.jsx에서 정의, 30000ms) 활용하지 않음
- SecurityEvents는 독립 컴포넌트이므로 자체 interval 설정 (30초)
- 이유: QAStats와 동일 패턴 (독립 생명주기)

---

## 2. AdminPage 수정

### 파일: `frontend/src/pages/AdminPage.jsx`

**변경 사항:**
- `import SecurityEvents from '../components/admin/SecurityEvents'` 추가
- QAStats 섹션 아래에 `<SecurityEvents />` 추가

**배치 위치:** QAStats와 엔드포인트 분석 섹션 사이

```jsx
{/* Q&A Analytics */}
<QAStats />

{/* 보안 모니터링 — 신규 */}
<SecurityEvents />

{/* 엔드포인트 분석 + 에러 로그 */}
```

---

## 3. SecurityEventTable 상세

### 컬럼 정의

| 컬럼 | 데이터 | 스타일 |
|------|--------|--------|
| 시각 | created_at → ko-KR 포맷 | font-mono text-xs text-gray-400 |
| 유형 | event_type 뱃지 | rate_limit_exceeded=주황, auth_failure=빨강 |
| IP | ip | font-mono text-xs |
| 경로 | path (truncate 180px) | font-mono text-xs |
| 상태코드 | status_code | font-bold font-mono 컬러 코딩 |

### 유형 뱃지 매핑

```javascript
const EVENT_TYPE_CONFIG = {
  rate_limit_exceeded: { label: 'Rate Limit', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  auth_failure:        { label: '인증 실패',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}
```

### 상태 코드 컬러

```javascript
const STATUS_COLOR = {
  429: 'text-orange-500',
  401: 'text-red-500',
}
```

---

## 4. 에러/로딩 상태

### 로딩 (QAStats와 동일 패턴)

```jsx
// animate-pulse 스켈레톤
<div className="animate-pulse space-y-4">
  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
  <div className="grid grid-cols-2 gap-4">
    {[...Array(2)].map(...)}
  </div>
</div>
```

### 에러 (QAStats와 동일 패턴)

```jsx
// 에러 배너
<div className="flex items-center gap-3 bg-red-50 ...">
  <p>보안 이벤트를 불러오지 못했습니다.</p>
</div>
```

### 빈 데이터

```jsx
<p className="text-center text-gray-400 text-sm py-8">
  최근 보안 이벤트 없음
</p>
```

---

## 5. 접근성

- 테이블 `<thead>` 사용
- 뱃지에 색상 외 텍스트 레이블 포함 (색각 이상 대응)
- truncate 적용 컬럼에 `title` 속성 추가
