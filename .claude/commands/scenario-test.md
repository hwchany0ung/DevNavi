# /scenario-test

`.qa-evidence.json` 시나리오 기반 테스트를 실행합니다.

## 사용법
```
/scenario-test [feature-name]
/scenario-test                    # 현재 PDCA 기능 자동 감지
/scenario-test ai-qa-phase2       # 특정 기능 지정
```

## 동작

1. `docs/archive/YYYY-MM/<feature>/.qa-evidence.json` 로드
2. 시나리오별 실행:
   - Happy Path → 정상 응답 확인
   - Edge Case → 경계값 처리 확인
   - Failure Case → 에러 응답 형식 확인
3. qa-testing.md 규칙에 따라 순서대로 실행:
   - pytest unit → pytest integration → E2E (Playwright)
4. Match Rate 산정 및 보고

## 실행 순서

```bash
# 1. .qa-evidence.json 경로 확인
ls docs/archive/$(date +%Y-%m)/

# 2. 백엔드 단위 테스트 (항상)
cd backend && pytest tests/unit/ -v -m unit

# 3. 통합 테스트 (SUPABASE_TEST_URL 설정 시)
pytest tests/integration/ -v -m integration || [ $? -eq 5 ]

# 4. 프론트엔드 테스트
cd frontend && npm test -- --coverage --run

# 5. E2E (서버 기동 후)
npx playwright test
```

## 출력 형식
```
시나리오 결과:
  SC-01 정상 요청 처리 ✅ PASS (1.2s)
  SC-02 미인증 요청 거부 ✅ PASS (0.3s)
  SC-03 빈 입력 처리 ❌ FAIL - 예상: 400, 실제: 500

Match Rate: 87% (기준: 90%)
→ iterate 필요
```
