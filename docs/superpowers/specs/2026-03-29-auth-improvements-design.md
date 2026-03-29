# DevNavi 인증 플로우 개선 설계

**날짜:** 2026-03-29
**목표:** 비밀번호 찾기, 개인정보 동의 모달, devnavi 발신 메일, 이메일 인증 완료 페이지 구현

---

## 범위

| 항목 | 설명 |
|------|------|
| 비밀번호 찾기 | AuthModal에 forgot 모드 + /reset-password 페이지 |
| 비밀번호 정책 | 6자 → 8자 이상 + 특수문자 1개 이상 |
| 개인정보 동의 모달 | 체크박스 클릭 시 수집항목/목적/보유기간/거부권리 표시 |
| 발신 메일 | Hiworks SMTP → support@devnavi.kr, 한국어 이메일 템플릿 |
| DevNavi 로고 | frontend/public/logo.svg 생성 (이메일 템플릿 삽입용) |
| 인증 완료 페이지 | /auth/callback — 성공/실패 분기 후 메인(/)으로 이동 |

---

## 아키텍처

### 파일 맵

**생성**
- `frontend/public/logo.svg` — 이메일 템플릿용 DevNavi 로고
- `frontend/src/pages/AuthCallbackPage.jsx` — /auth/callback
- `frontend/src/pages/ResetPasswordPage.jsx` — /reset-password
- `frontend/src/components/auth/PrivacyConsentModal.jsx` — 개인정보 수집 동의 모달

**수정**
- `frontend/src/App.jsx` — 신규 라우트 2개 추가
- `frontend/src/components/auth/AuthModal.jsx` — forgot 모드, 비밀번호 정책, 개인정보 모달 연결
- `frontend/src/hooks/useAuth.js` — resetPasswordForEmail, updatePassword 추가

---

## 상세 설계

### 1. 비밀번호 정책

프론트 validation 정규식:
```js
const PASSWORD_RE = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
```
- 8자 이상
- 특수문자 1개 이상 (`!@#$%^&*` 등)
- 에러 메시지: "비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다"

Supabase Dashboard → Authentication → Password Policy에서도 동일하게 설정.

### 2. 비밀번호 찾기 (AuthModal forgot 모드)

**상태:** `mode: 'login' | 'signup' | 'forgot'`

**forgot 모드 UI:**
- 이메일 입력란 1개
- "재설정 링크 보내기" 버튼
- 로그인으로 돌아가기 링크

**useAuth 추가 함수:**
```js
resetPasswordForEmail(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}
```

**보안:**
- 이메일이 존재하지 않아도 동일한 성공 메시지 표시 (이메일 존재 여부 노출 방지)
- "재설정 링크를 이메일로 보냈습니다. 이메일을 확인해주세요." (항상 동일한 문구)

### 3. /reset-password 페이지

**흐름:**
1. Supabase 재설정 링크 클릭 → `/reset-password?code=...`
2. `supabase.auth.exchangeCodeForSession(code)` — 세션 교환 (PKCE)
3. 새 비밀번호 입력 폼 (비밀번호 + 확인)
4. `supabase.auth.updateUser({ password: newPassword })`
5. 성공 → `/`로 이동

**보안:**
- code 파라미터 없으면 즉시 `/`로 리다이렉트 (직접 접근 차단)
- 비밀번호 확인 불일치 시 제출 차단
- PASSWORD_RE 동일 적용
- 링크 만료(expired token) 시 "링크가 만료됐습니다. 다시 요청해 주세요." + 로그인 이동

### 4. 개인정보 수집 동의 모달 (PrivacyConsentModal)

**트리거:** AuthModal에서 개인정보처리방침 체크박스 클릭 시 모달 오픈 (label의 onClick intercept)

**모달 내용:**
```
개인정보 수집 및 이용 동의

수집 항목   이메일 주소, 비밀번호(암호화 저장)
수집 목적   회원 식별 및 서비스 제공
보유 기간   회원 탈퇴 시까지
            (관련 법령에 따라 보존 필요 시까지)
거부 권리   동의를 거부할 권리가 있으며,
            거부 시 회원가입이 제한됩니다.

* 그 밖의 사항은 개인정보처리방침을 준수합니다.

[동의하기]  [동의하지 않음]
```

- "동의하기" → `agreePrivacy = true`, 모달 닫힘
- "동의하지 않음" → `agreePrivacy = false`, 모달 닫힘
- 이용약관 체크박스는 현행 유지

### 5. DevNavi 로고 (logo.svg)

- `frontend/public/logo.svg`로 저장 → `https://devnavi.kr/logo.svg`로 이메일에서 참조
- 스타일: "Dev"(검정/흰색) + "Navi"(인디고 #4F46E5), sans-serif bold
- 가로형, 배경 흰색, 이메일 클라이언트 호환 (인라인 스타일)

### 6. /auth/callback 페이지

**흐름:**
1. Supabase 이메일 인증 링크 클릭 → `/auth/callback?code=...`
2. `supabase.auth.exchangeCodeForSession(code)` 처리
3. 성공 → "✅ 이메일 인증 완료!" 메시지 표시 → 3초 후 `/`로 이동
4. 실패(error 파라미터 또는 교환 실패) → "인증에 실패했습니다" + "처음으로" 버튼

**보안:**
- 이미 인증된 사용자가 접근하면 즉시 `/`로 리다이렉트
- code 없이 직접 접근 시 `/`로 리다이렉트

### 7. Supabase 대시보드 설정 (코드 외 작업)

**SMTP (Authentication → SMTP Settings):**
```
Enabled:  true
Host:     smtp.hiworks.com
Port:     465
Username: support@devnavi.kr
Password: [하이웍스 비밀번호]
Sender:   DevNavi <support@devnavi.kr>
```

**URL Configuration:**
```
Site URL:          https://devnavi.kr
Redirect URLs:     https://devnavi.kr/auth/callback
                   https://devnavi.kr/reset-password
```

**이메일 템플릿 (Authentication → Email Templates):**

Confirm signup 템플릿:
```html
<img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" />
<h2>이메일 인증</h2>
<p>아래 버튼을 클릭해 이메일 인증을 완료해 주세요.</p>
<a href="{{ .ConfirmationURL }}">이메일 인증하기</a>
<p>본인이 요청하지 않은 경우 이 메일을 무시해 주세요.</p>
```

Reset password 템플릿:
```html
<img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" />
<h2>비밀번호 재설정</h2>
<p>아래 버튼을 클릭해 새 비밀번호를 설정해 주세요.</p>
<a href="{{ .ConfirmationURL }}">비밀번호 재설정하기</a>
<p>본인이 요청하지 않은 경우 이 메일을 무시해 주세요. 링크는 1시간 후 만료됩니다.</p>
```

---

## 보안 요약

| 항목 | 조치 |
|------|------|
| 이메일 존재 여부 노출 | 항상 동일한 성공 메시지 반환 |
| 재설정 링크 직접 접근 | code 없으면 즉시 / 리다이렉트 |
| 토큰 만료 | 명확한 에러 메시지 + 재요청 안내 |
| 비밀번호 정책 | 8자+특수문자 프론트+Supabase 양쪽 적용 |
| PKCE 플로우 | 기존 flowType: 'pkce' 그대로 활용 |

---

## 구현 순서

1. `logo.svg` 생성
2. `PASSWORD_RE` 상수 + `useAuth` resetPasswordForEmail/updatePassword 추가
3. `PrivacyConsentModal` 컴포넌트
4. `AuthModal` — forgot 모드 + 비밀번호 정책 + 모달 연결
5. `AuthCallbackPage` + `ResetPasswordPage`
6. `App.jsx` 라우트 추가
7. Supabase 대시보드 설정 가이드 문서화
