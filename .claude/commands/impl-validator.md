# /impl-validator

구현 코드와 설계 문서 간의 일치 여부를 빠르게 검증합니다. gap-detector 실행 전 사전 확인용.

## 사용법
```
/impl-validator [feature-name]
/impl-validator                    # 현재 PDCA 기능 자동 감지
/impl-validator test-environment   # 특정 기능 지정
```

## 동작

### Step 1 — 설계 문서 로드
```
docs/01-plan/<feature>/plan.md
docs/02-design/<feature>/design.md
docs/archive/YYYY-MM/<feature>/.qa-evidence.json
```

### Step 2 — 구현 체크리스트 자동 생성
설계 문서의 각 항목에 대해:
- [ ] API 엔드포인트 구현 여부
- [ ] DB 스키마/마이그레이션 생성 여부
- [ ] 프론트엔드 UI 구현 여부
- [ ] 테스트 파일 존재 여부
- [ ] Rate limit 설정 여부

### Step 3 — 빠른 정적 검증
```bash
# 엔드포인트 존재 확인
grep -rn "@router\." backend/app/api/

# 마이그레이션 파일 확인
ls supabase/migrations/

# 테스트 파일 확인
find backend/tests frontend/src -name "*.test.*" -o -name "test_*.py"

# 프론트엔드 컴포넌트 확인
find frontend/src/components frontend/src/pages -name "*.jsx"
```

### Step 4 — 결과 요약
```
구현 검증 결과 (정적 분석):
  ✅ API: POST /ai/qa — qa_service.py 확인
  ✅ Migration: 006_qa_feedback_events.sql 존재
  ✅ Component: QAPanel.jsx, QAFeedback.jsx 존재
  ❌ Test: QAFeedback.test.jsx 없음
  ⚠️  Rate limit: /ai/qa/event 미설정

예비 Match Rate: 82%
→ gap-detector 정밀 분석 권장
```

## 참고
- 정적 분석만 수행 (서버 기동 불필요)
- Runtime 검증은 `/scenario-test` 또는 gap-detector 사용
- 결과는 참고용 — 최종 판단은 gap-detector (opus)
