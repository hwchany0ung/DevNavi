# Plan: 로드맵 생성 개인화 정밀도 개선

## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | skills가 list[str]로 숙련도 구분 없이 전달되어 "React 입문자"와 "React 3년차"가 동일하게 처리됨. 실배포/코딩테스트/팀프로젝트 경험 미수집으로 현실감 낮은 로드맵 생성 |
| Solution | SkillItem{name, level} 구조로 숙련도 반영, ExtraProfile{has_deployment, coding_test_level, team_project_count}로 추가 경험 수집, 프롬프트에 SKIP/REVIEW/FOCUS 3구간 분류 도입 |
| Function UX Effect | 온보딩 Step2에서 스킬별 숙련도 뱃지 선택 + "더 정교한 로드맵" 접힌 섹션으로 추가 정보 수집. 기존 UX 흐름 유지하면서 선택적 심화 |
| Core Value | 동일 스킬 보유자라도 숙련도에 따라 차별화된 로드맵 생성 -> 학습 효율 극대화, 불필요한 반복 학습 제거 |

---

## 1. 문제 정의

### 현재 상태
- `skills: list[str]` — 스킬명만 전달, 숙련도 정보 없음
- 프롬프트에 "보유 스킬: React, Python, SQL" 형태로 전달
- AI가 "보유 스킬은 건너뛰고" 처리하지만, 기초인지 능숙인지 판단 불가
- 실배포 경험, 코딩테스트 준비 수준, 팀 프로젝트 경험 미수집

### 문제 영향
- React 입문자와 React 3년차가 동일한 로드맵 수신
- 이미 충분한 스킬을 다시 학습하게 되거나, 기초가 부족한 스킬을 건너뛰는 문제
- 취업 준비에 핵심인 실무 경험 정보가 로드맵에 반영되지 않음

---

## 2. 해결 방안

### 2.1 데이터 모델 확장

```python
class SkillLevel(str, Enum):
    beginner = "beginner"       # 입문 (들어본 정도)
    basic = "basic"             # 기초 (튜토리얼 수준)
    intermediate = "intermediate"  # 중급 (개인 프로젝트 경험)
    advanced = "advanced"       # 능숙 (실무/팀 프로젝트 경험)

class SkillItem(BaseModel):
    name: str
    level: SkillLevel = SkillLevel.basic

class ExtraProfile(BaseModel):
    has_deployment: bool = False                          # 실배포 경험
    coding_test_level: Literal["none","basic","intermediate","advanced"] = "none"
    team_project_count: Literal[0, 1, 2, 3] = 0          # 팀 프로젝트 횟수 (3 = 3회 이상)
```

### 2.2 하위호환 전략
- `skills` 필드가 `list[str]` 로 들어오면 validator가 자동으로 `[SkillItem(name=s, level="basic")]`로 변환
- `extra_profile`은 `Optional[ExtraProfile] = None` — 미제공 시 기존 동작 유지
- 기존 188개 테스트 영향 없음

### 2.3 프롬프트 3구간 분류

```
◆ 스킵/최소화 구간 (advanced/intermediate): React(중급), Python(능숙)
  → 이 스킬은 이미 보유. 복습 불필요, 심화 또는 실전 프로젝트에 바로 활용.

◆ 빠른 복습 구간 (basic): SQL(기초)
  → 기초 지식 있음. 1~2주 빠른 복습 후 실전 적용.

◆ 집중 학습 구간 (beginner/미보유): Docker(입문), Kubernetes, ...
  → 처음부터 체계적으로 학습 필요. 로드맵 핵심 구간.
```

---

## 3. 범위

### In Scope
| 영역 | 변경 항목 |
|------|----------|
| Backend Model | `SkillLevel` Enum, `SkillItem`, `ExtraProfile` 추가 (roadmap.py) |
| Backend Model | `FullRoadmapRequest.skills` 하위호환 validator |
| Backend Prompt | `builder.py` — `_format_skills_with_levels()`, `_format_extra_profile()` 헬퍼 |
| Backend Prompt | `build_full_prompt`, `build_full_prompt_partial`, `build_career_summary_prompt` 시그니처 업데이트 |
| Frontend | `Step2Form.jsx` — 스킬별 숙련도 뱃지 UI |
| Frontend | `OnboardingPage.jsx` — "더 정교한 로드맵" 접힌 섹션, API 페이로드 변경 |
| Reference Data | `backend.py`, `frontend.py`, `fullstack.py`, `ai_ml.py`, `cloud_devops.py` 2026 트렌드 업데이트 |

### Out of Scope
- DB 스키마 변경 (Supabase 테이블 수정 없음)
- reroute 프롬프트 변경
- `data.py`, `security.py`, `ios_android.py`, `qa.py` role_references
- CSP / rate limit 설정 변경
- `claude_service.py` 변경 최소화 (시그니처만 맞춤)

---

## 4. 기존 기능 보호

- `skills: list[str]` 하위호환 — validator로 자동 변환
- 기존 테스트 188개 통과 유지
- CSP / rate limit 미변경
- `claude_service.py` 최소 변경 (stream_full_multicall의 skills 타입만 확장)

---

## 5. 리스크

| 리스크 | 대응 |
|--------|------|
| 기존 프론트엔드에서 `list[str]` 전송 시 호환 깨짐 | validator로 str → SkillItem 자동 변환 |
| 프롬프트 길이 증가로 토큰 비용 상승 | 3구간 요약 형태로 최소화 (스킬 나열이 아닌 구간 분류) |
| ExtraProfile 미입력 시 로드맵 품질 변화 | None일 때 기존 동작 완전 유지 |

---

## 6. 성공 기준

1. `list[str]` 형태 skills 전송 시 기존과 동일하게 동작 (하위호환)
2. `list[SkillItem]` 형태 전송 시 프롬프트에 3구간 분류 반영
3. ExtraProfile 전송 시 프롬프트에 추가 컨텍스트 반영
4. 기존 테스트 188개 전체 통과
5. 온보딩 UI에서 숙련도 선택 가능
