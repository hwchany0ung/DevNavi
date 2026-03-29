# Auth Flow Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password reset, privacy consent modal, DevNavi branded email support, and email verification callback page to the auth flow.

**Architecture:** New standalone utility (`validation.js`) holds the shared password regex. `useAuth` gains two new functions. Three new pages/components are created independently. `AuthModal` gains a third `forgot` mode and wires in the privacy modal. `App.jsx` gets two new routes.

**Tech Stack:** React 18, Vite, Tailwind CSS, Supabase JS v2 (PKCE), React Router v6, Vitest, @testing-library/react

---

## File Map

**Create:**
- `frontend/src/lib/validation.js` — `PASSWORD_RE` constant + `validatePassword()` helper
- `frontend/public/logo.svg` — DevNavi brand logo for email templates
- `frontend/src/components/auth/PrivacyConsentModal.jsx` — standalone modal, no external deps
- `frontend/src/pages/AuthCallbackPage.jsx` — `/auth/callback` PKCE code exchange + success/fail UI
- `frontend/src/pages/ResetPasswordPage.jsx` — `/reset-password` code exchange + new password form

**Modify:**
- `frontend/src/hooks/useAuth.js` — add `resetPasswordForEmail`, `updatePassword`
- `frontend/src/components/auth/AuthModal.jsx` — add `forgot` mode, password policy, privacy modal
- `frontend/src/App.jsx` — add `/auth/callback` and `/reset-password` routes

**Test files created:**
- `frontend/src/lib/__tests__/validation.test.js`
- `frontend/src/hooks/__tests__/useAuth.reset.test.js`
- `frontend/src/components/auth/__tests__/PrivacyConsentModal.test.jsx`
- `frontend/src/components/auth/__tests__/AuthModal.forgot.test.jsx`
- `frontend/src/pages/__tests__/AuthCallbackPage.test.jsx`
- `frontend/src/pages/__tests__/ResetPasswordPage.test.jsx`

---

### Task 1: Password Validation Utility

**Files:**
- Create: `frontend/src/lib/validation.js`
- Create: `frontend/src/lib/__tests__/validation.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/__tests__/validation.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { validatePassword } from '../validation'

describe('validatePassword', () => {
  it('accepts 8+ chars with special char', () => {
    expect(validatePassword('Abcdefg!')).toBe(true)
    expect(validatePassword('hello@world')).toBe(true)
    expect(validatePassword('12345678#')).toBe(true)
  })

  it('rejects fewer than 8 chars even with special char', () => {
    expect(validatePassword('Ab1!')).toBe(false)
    expect(validatePassword('1234567!')).toBe(false)
  })

  it('rejects 8+ chars without special char', () => {
    expect(validatePassword('abcdefgh')).toBe(false)
    expect(validatePassword('12345678')).toBe(false)
    expect(validatePassword('Abcdefgh')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validatePassword('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/__tests__/validation.test.js
```
Expected: FAIL — `validatePassword` not defined

- [ ] **Step 3: Implement validation.js**

Create `frontend/src/lib/validation.js`:
```js
export const PASSWORD_RE = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/

/**
 * @param {string} password
 * @returns {boolean}
 */
export function validatePassword(password) {
  return PASSWORD_RE.test(password)
}

export const PASSWORD_ERROR_MSG = '비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/__tests__/validation.test.js
```
Expected: PASS — 4 test suites pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/validation.js frontend/src/lib/__tests__/validation.test.js
git commit -m "feat: add password validation utility (8+ chars, special char required)"
```

---

### Task 2: DevNavi Logo SVG

**Files:**
- Create: `frontend/public/logo.svg`

No tests — static asset.

- [ ] **Step 1: Create logo.svg**

Create `frontend/public/logo.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48">
  <rect width="200" height="48" fill="#ffffff"/>
  <!-- "Dev" in dark gray -->
  <text
    x="8" y="34"
    font-family="'Segoe UI', Arial, sans-serif"
    font-weight="800"
    font-size="28"
    fill="#111827"
  >Dev</text>
  <!-- "Navi" in indigo -->
  <text
    x="72" y="34"
    font-family="'Segoe UI', Arial, sans-serif"
    font-weight="800"
    font-size="28"
    fill="#4F46E5"
  >Navi</text>
</svg>
```

- [ ] **Step 2: Verify SVG renders**

Open `http://localhost:5173/logo.svg` in a browser (or check `frontend/public/logo.svg` exists with correct content).

- [ ] **Step 3: Commit**

```bash
git add frontend/public/logo.svg
git commit -m "feat: add DevNavi logo SVG for email templates"
```

---

### Task 3: useAuth — resetPasswordForEmail & updatePassword

**Files:**
- Modify: `frontend/src/hooks/useAuth.js`
- Create: `frontend/src/hooks/__tests__/useAuth.reset.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/__tests__/useAuth.reset.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock supabase BEFORE importing useAuth
vi.mock('../../lib/supabase', () => {
  const mockAuth = {
    getSession:          vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange:   vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    resetPasswordForEmail: vi.fn(),
    updateUser:          vi.fn(),
  }
  return {
    supabase:         { auth: mockAuth },
    isSupabaseReady:  true,
    cleanAuthParams:  vi.fn(),
  }
})

import { useAuth } from '../useAuth'
import { supabase } from '../../lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
})

describe('resetPasswordForEmail', () => {
  it('calls supabase with correct redirectTo and returns true on success', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth())
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('user@example.com')
    })

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: `${window.location.origin}/reset-password` }
    )
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns true even when email does not exist (prevent enumeration)', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth())
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('nonexistent@example.com')
    })
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns false and sets error on API failure', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'rate limit exceeded' },
    })
    const { result } = renderHook(() => useAuth())
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('user@example.com')
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('rate limit exceeded')
  })
})

describe('updatePassword', () => {
  it('calls supabase.auth.updateUser with new password and returns true', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth())
    let ok
    await act(async () => {
      ok = await result.current.updatePassword('NewPass1!')
    })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPass1!' })
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns false and sets error on failure', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } })
    const { result } = renderHook(() => useAuth())
    let ok
    await act(async () => {
      ok = await result.current.updatePassword('NewPass1!')
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('Auth session missing!')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useAuth.reset.test.js
```
Expected: FAIL — `resetPasswordForEmail` and `updatePassword` not in hook

- [ ] **Step 3: Add functions to useAuth.js**

In `frontend/src/hooks/useAuth.js`, add after the `signOut` callback (before the return statement):

```js
  const resetPasswordForEmail = useCallback(async (email) => {
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) setError(err.message)
    return !err
  }, [])

  const updatePassword = useCallback(async (password) => {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) setError(err.message)
    return !err
  }, [])
```

Also update the return value to include both new functions:
```js
  return { user, loading, error, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPasswordForEmail, updatePassword }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/hooks/__tests__/useAuth.reset.test.js
```
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useAuth.js frontend/src/hooks/__tests__/useAuth.reset.test.js
git commit -m "feat: add resetPasswordForEmail and updatePassword to useAuth"
```

---

### Task 4: PrivacyConsentModal Component

**Files:**
- Create: `frontend/src/components/auth/PrivacyConsentModal.jsx`
- Create: `frontend/src/components/auth/__tests__/PrivacyConsentModal.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/auth/__tests__/PrivacyConsentModal.test.jsx`:
```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrivacyConsentModal from '../PrivacyConsentModal'

describe('PrivacyConsentModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PrivacyConsentModal open={false} onAgree={vi.fn()} onDisagree={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows modal content when open', () => {
    render(<PrivacyConsentModal open={true} onAgree={vi.fn()} onDisagree={vi.fn()} />)
    expect(screen.getByText('개인정보 수집 및 이용 동의')).toBeInTheDocument()
    expect(screen.getByText(/이메일 주소/)).toBeInTheDocument()
    expect(screen.getByText(/회원 식별 및 서비스 제공/)).toBeInTheDocument()
    expect(screen.getByText(/회원 탈퇴 시까지/)).toBeInTheDocument()
    expect(screen.getByText(/동의를 거부할 권리/)).toBeInTheDocument()
  })

  it('calls onAgree when 동의하기 is clicked', () => {
    const onAgree = vi.fn()
    render(<PrivacyConsentModal open={true} onAgree={onAgree} onDisagree={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '동의하기' }))
    expect(onAgree).toHaveBeenCalledOnce()
  })

  it('calls onDisagree when 동의하지 않음 is clicked', () => {
    const onDisagree = vi.fn()
    render(<PrivacyConsentModal open={true} onAgree={vi.fn()} onDisagree={onDisagree} />)
    fireEvent.click(screen.getByRole('button', { name: '동의하지 않음' }))
    expect(onDisagree).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/auth/__tests__/PrivacyConsentModal.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement PrivacyConsentModal**

Create `frontend/src/components/auth/PrivacyConsentModal.jsx`:
```jsx
/**
 * 개인정보 수집 및 이용 동의 모달
 *
 * @param {boolean}  open
 * @param {function} onAgree     — "동의하기" 클릭
 * @param {function} onDisagree  — "동의하지 않음" 클릭
 */
export default function PrivacyConsentModal({ open, onAgree, onDisagree }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDisagree() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4
        border border-gray-100 dark:border-white/10">

        <h3 className="text-base font-black text-gray-900 dark:text-white">
          개인정보 수집 및 이용 동의
        </h3>

        <table className="w-full text-xs text-gray-600 dark:text-white/70 border-collapse">
          <tbody>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap w-20">수집 항목</td>
              <td className="py-2">이메일 주소, 비밀번호(암호화 저장)</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap">수집 목적</td>
              <td className="py-2">회원 식별 및 서비스 제공</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap align-top">보유 기간</td>
              <td className="py-2">회원 탈퇴 시까지<br />(관련 법령에 따라 보존 필요 시까지)</td>
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/10">
              <td className="py-2 pr-3 font-semibold text-gray-700 dark:text-white/80 whitespace-nowrap align-top">거부 권리</td>
              <td className="py-2">동의를 거부할 권리가 있으며,<br />거부 시 회원가입이 제한됩니다.</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-gray-400 dark:text-white/40">
          * 그 밖의 사항은 개인정보처리방침을 준수합니다.
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onDisagree}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10
              text-sm font-semibold text-gray-500 dark:text-white/60
              hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            동의하지 않음
          </button>
          <button
            onClick={onAgree}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-bold transition-colors"
          >
            동의하기
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/auth/__tests__/PrivacyConsentModal.test.jsx
```
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/PrivacyConsentModal.jsx frontend/src/components/auth/__tests__/PrivacyConsentModal.test.jsx
git commit -m "feat: add PrivacyConsentModal for PIPA consent display"
```

---

### Task 5: AuthModal — Forgot Mode, Password Policy, Privacy Modal

**Files:**
- Modify: `frontend/src/components/auth/AuthModal.jsx`
- Create: `frontend/src/components/auth/__tests__/AuthModal.forgot.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/auth/__tests__/AuthModal.forgot.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthModal from '../AuthModal'

vi.mock('../../../lib/supabase', () => ({
  supabase: null,
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

const mockResetPasswordForEmail = vi.fn()
const mockSignInWithEmail = vi.fn()
const mockSignUpWithEmail = vi.fn()
const mockSignInWithGoogle = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: vi.fn(),
    resetPasswordForEmail: mockResetPasswordForEmail,
    updatePassword: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthModal forgot mode', () => {
  it('shows "비밀번호 찾기" link in login mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('비밀번호를 잊으셨나요?')).toBeInTheDocument()
  })

  it('switches to forgot mode when link clicked', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    expect(screen.getByText('비밀번호 재설정')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('이메일')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '재설정 링크 보내기' })).toBeInTheDocument()
  })

  it('always shows the same success message regardless of email existence (prevent enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue(true)
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))
    await waitFor(() => {
      expect(screen.getByText('재설정 링크를 이메일로 보냈습니다. 이메일을 확인해주세요.')).toBeInTheDocument()
    })
  })

  it('shows back to login link in forgot mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    expect(screen.getByText('로그인으로 돌아가기')).toBeInTheDocument()
  })
})

describe('AuthModal password policy', () => {
  it('shows updated password placeholder in signup mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    // Switch to signup
    fireEvent.click(screen.getByText('회원가입'))
    expect(screen.getByPlaceholderText('비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
  })

  it('rejects signup with password missing special char', async () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    fireEvent.change(screen.getByLabelText('email') || screen.getByPlaceholderText('이메일'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('비밀번호 (8자 이상, 특수문자 포함)'), { target: { value: 'abcdefgh' } })
    // Check the submit button is present but clicking it shows error
    const submitBtn = screen.getByRole('button', { name: '가입하기' })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다')).toBeInTheDocument()
    })
    expect(mockSignUpWithEmail).not.toHaveBeenCalled()
  })
})

describe('AuthModal privacy modal integration', () => {
  it('opens privacy consent modal when privacy checkbox label clicked', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    // Click the privacy label text to open modal
    fireEvent.click(screen.getByText('개인정보처리방침'))
    expect(screen.getByText('개인정보 수집 및 이용 동의')).toBeInTheDocument()
  })

  it('sets agreePrivacy=true when 동의하기 clicked in modal', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    fireEvent.click(screen.getByText('개인정보처리방침'))
    fireEvent.click(screen.getByRole('button', { name: '동의하기' }))
    // Privacy modal should be closed
    expect(screen.queryByText('개인정보 수집 및 이용 동의')).not.toBeInTheDocument()
    // agreePrivacy checkbox should be checked
    const privacyCheckbox = screen.getAllByRole('checkbox')[1]
    expect(privacyCheckbox).toBeChecked()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/auth/__tests__/AuthModal.forgot.test.jsx
```
Expected: FAIL — forgot mode, password policy, privacy modal not implemented

- [ ] **Step 3: Rewrite AuthModal.jsx with all three features**

Replace `frontend/src/components/auth/AuthModal.jsx` entirely:
```jsx
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isSupabaseReady } from '../../lib/supabase'
import { validatePassword, PASSWORD_ERROR_MSG } from '../../lib/validation'
import PrivacyConsentModal from './PrivacyConsentModal'

/**
 * 로그인 / 회원가입 / 비밀번호 찾기 모달
 * - mode: 'login' | 'signup' | 'forgot'
 * - 비밀번호 정책: 8자 이상 + 특수문자 1개 이상 (signup 전용)
 * - 개인정보 동의 모달 연결
 *
 * @param {boolean}  open
 * @param {function} onClose
 */
export default function AuthModal({ open, onClose }) {
  const [mode, setMode]         = useState('login')  // 'login' | 'signup' | 'forgot'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState('')
  const [localError, setLocalError] = useState('')
  const [agreeTerms, setAgreeTerms]     = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPasswordForEmail, error } = useAuth()

  if (!open) return null

  const switchMode = (next) => {
    setMode(next)
    setEmail('')
    setPassword('')
    setSuccess('')
    setLocalError('')
    setAgreeTerms(false)
    setAgreePrivacy(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    setSuccess('')

    if (mode === 'forgot') {
      setLoading(true)
      await resetPasswordForEmail(email)
      // Always show the same message regardless of result (prevent email enumeration)
      setSuccess('재설정 링크를 이메일로 보냈습니다. 이메일을 확인해주세요.')
      setLoading(false)
      return
    }

    if (mode === 'signup' && !validatePassword(password)) {
      setLocalError(PASSWORD_ERROR_MSG)
      return
    }

    setLoading(true)
    if (mode === 'login') {
      const ok = await signInWithEmail(email, password)
      if (ok) onClose()
    } else {
      const ok = await signUpWithEmail(email, password)
      if (ok) setSuccess('가입 확인 이메일을 전송했습니다. 메일을 확인해주세요!')
    }
    setLoading(false)
  }

  const handlePrivacyLabelClick = (e) => {
    e.preventDefault()
    setPrivacyModalOpen(true)
  }

  const displayError = localError || error

  return (
    <>
      {/* 개인정보 동의 모달 */}
      <PrivacyConsentModal
        open={privacyModalOpen}
        onAgree={() => {
          setAgreePrivacy(true)
          setPrivacyModalOpen(false)
        }}
        onDisagree={() => {
          setAgreePrivacy(false)
          setPrivacyModalOpen(false)
        }}
      />

      {/* 오버레이 — overflow-y-auto로 모바일 키보드 올라와도 스크롤 가능 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="min-h-full flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm p-7 space-y-5
            border-t border-gray-100 dark:border-white/10">

            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '비밀번호 재설정'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-white/50 mt-0.5">
                  {mode === 'login'
                    ? '로드맵을 저장하고 진행률을 동기화하세요'
                    : mode === 'signup'
                    ? '무료로 시작하고 나만의 로드맵을 관리하세요'
                    : '가입한 이메일로 재설정 링크를 보내드립니다'}
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-white/50 transition-colors">
                ✕
              </button>
            </div>

            {/* Supabase 미연동 경고 */}
            {!isSupabaseReady && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ 개발 모드 — Supabase 환경변수가 설정되지 않았습니다.
              </div>
            )}

            {/* Google OAuth — login/signup 전용 */}
            {mode !== 'forgot' && (
              <button
                disabled={!isSupabaseReady || loading}
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 dark:border-white/10
                  rounded-2xl bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10
                  disabled:opacity-50 transition-colors text-sm font-medium text-gray-700 dark:text-white/80"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google로 계속하기
              </button>
            )}

            {mode !== 'forgot' && (
              <div className="flex items-center gap-3 text-xs text-gray-300 dark:text-white/20">
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
                또는 이메일로
                <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
              </div>
            )}

            {/* 이메일 폼 */}
            <form onSubmit={handleSubmit} method="post" className="space-y-3">
              <input
                type="email" name="email" id="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
                  bg-white dark:bg-white/5 text-gray-900 dark:text-white
                  placeholder:text-gray-400 dark:placeholder:text-white/30
                  focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
              />

              {/* 비밀번호 입력 — forgot 모드에서는 숨김 */}
              {mode !== 'forgot' && (
                <input
                  type="password" name="password" id="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required minLength={mode === 'login' ? 6 : 8}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? '비밀번호' : '비밀번호 (8자 이상, 특수문자 포함)'}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
                    bg-white dark:bg-white/5 text-gray-900 dark:text-white
                    placeholder:text-gray-400 dark:placeholder:text-white/30
                    focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
                />
              )}

              {/* 비밀번호 찾기 링크 — login 모드 전용 */}
              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
              )}

              {/* 약관 동의 — signup 전용
                  TODO Phase 6: PIPA 준수를 위해 동의 이력(타임스탬프, IP, 버전)을
                  서버에 기록해야 합니다. 현재는 클라이언트 전용 처리.
              */}
              {mode === 'signup' && (
                <div className="space-y-2 py-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={e => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span className="text-xs text-gray-500 dark:text-white/60 leading-relaxed">
                      (필수){' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 underline">이용약관</a>에 동의합니다
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={e => setAgreePrivacy(e.target.checked)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <span className="text-xs text-gray-500 dark:text-white/60 leading-relaxed">
                      (필수){' '}
                      <button
                        type="button"
                        onClick={handlePrivacyLabelClick}
                        className="text-indigo-600 dark:text-indigo-400 underline"
                      >
                        개인정보처리방침
                      </button>
                      에 동의합니다
                    </span>
                  </label>
                </div>
              )}

              {displayError && (
                <p className="text-red-500 dark:text-red-400 text-xs px-1">{displayError}</p>
              )}
              {success && (
                <p className="text-emerald-600 dark:text-emerald-400 text-xs px-1">{success}</p>
              )}

              <button
                type="submit"
                disabled={
                  !isSupabaseReady || loading ||
                  (mode === 'signup' && (!agreeTerms || !agreePrivacy))
                }
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700
                  disabled:bg-gray-200 dark:disabled:bg-white/10
                  disabled:text-gray-400 dark:disabled:text-white/30
                  text-white font-bold text-sm rounded-2xl transition-colors"
              >
                {loading
                  ? '처리 중…'
                  : mode === 'login'
                  ? '로그인'
                  : mode === 'signup'
                  ? '가입하기'
                  : '재설정 링크 보내기'}
              </button>
            </form>

            {/* 모드 전환 */}
            {mode === 'forgot' ? (
              <p className="text-center text-xs text-gray-400 dark:text-white/40">
                <button
                  onClick={() => switchMode('login')}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  로그인으로 돌아가기
                </button>
              </p>
            ) : (
              <p className="text-center text-xs text-gray-400 dark:text-white/40">
                {mode === 'login' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                {' '}
                <button
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  {mode === 'login' ? '회원가입' : '로그인'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/auth/__tests__/AuthModal.forgot.test.jsx
```
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/AuthModal.jsx frontend/src/components/auth/__tests__/AuthModal.forgot.test.jsx
git commit -m "feat: add forgot mode, password policy (8+special), privacy modal to AuthModal"
```

---

### Task 6: AuthCallbackPage

**Files:**
- Create: `frontend/src/pages/AuthCallbackPage.jsx`
- Create: `frontend/src/pages/__tests__/AuthCallbackPage.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/__tests__/AuthCallbackPage.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthCallbackPage from '../AuthCallbackPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockExchangeCodeForSession = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args) => mockExchangeCodeForSession(...args),
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
  },
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

function renderWithUrl(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthCallbackPage', () => {
  it('redirects immediately when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('redirects immediately when already authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=abc')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows processing state while exchanging code', async () => {
    mockExchangeCodeForSession.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithUrl('?code=abc')
    await waitFor(() => expect(screen.getByText('이메일 인증 중…')).toBeInTheDocument())
  })

  it('shows success and auto-redirects to / after 3 seconds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    renderWithUrl('?code=valid-code')

    await waitFor(() =>
      expect(screen.getByText('이메일 인증 완료!')).toBeInTheDocument()
    )

    act(() => vi.advanceTimersByTime(3000))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows error UI when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })
    renderWithUrl('?code=expired-code')

    await waitFor(() =>
      expect(screen.getByText('인증에 실패했습니다')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument()
  })

  it('shows error UI when error query param is present', async () => {
    renderWithUrl('?error=access_denied&error_description=Token+expired')
    await waitFor(() =>
      expect(screen.getByText('인증에 실패했습니다')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/pages/__tests__/AuthCallbackPage.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement AuthCallbackPage**

Create `frontend/src/pages/AuthCallbackPage.jsx`:
```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * /auth/callback — Supabase 이메일 인증 콜백 페이지 (PKCE)
 *
 * 성공: "이메일 인증 완료!" → 3초 후 / 이동
 * 실패: "인증에 실패했습니다" + "처음으로" 버튼
 * 보안:
 *   - code 없이 접근 → 즉시 / 리다이렉트
 *   - 이미 인증된 사용자 → 즉시 / 리다이렉트
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [status, setStatus] = useState('processing') // 'processing' | 'success' | 'error'

  useEffect(() => {
    const code  = params.get('code')
    const error = params.get('error')

    // error 파라미터가 있으면 즉시 실패 처리
    if (error) {
      setStatus('error')
      return
    }

    // code 없으면 즉시 홈으로 (직접 접근 차단)
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    async function exchange() {
      // 이미 인증된 사용자면 홈으로
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/', { replace: true })
        return
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setStatus('error')
      } else {
        setStatus('success')
      }
    }

    exchange()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => navigate('/', { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [status, navigate])

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 dark:text-white/60">이메일 인증 중…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">인증에 실패했습니다</h1>
          <p className="text-sm text-gray-500 dark:text-white/60">
            링크가 만료됐거나 이미 사용된 링크입니다.<br />다시 요청해 주세요.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            처음으로
          </button>
        </div>
      </div>
    )
  }

  // success
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center space-y-4 max-w-sm px-6">
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">이메일 인증 완료!</h1>
        <p className="text-sm text-gray-500 dark:text-white/60">
          잠시 후 메인 화면으로 이동합니다…
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/pages/__tests__/AuthCallbackPage.test.jsx
```
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AuthCallbackPage.jsx frontend/src/pages/__tests__/AuthCallbackPage.test.jsx
git commit -m "feat: add AuthCallbackPage for email verification PKCE flow"
```

---

### Task 7: ResetPasswordPage

**Files:**
- Create: `frontend/src/pages/ResetPasswordPage.jsx`
- Create: `frontend/src/pages/__tests__/ResetPasswordPage.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/__tests__/ResetPasswordPage.test.jsx`:
```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResetPasswordPage from '../ResetPasswordPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockExchangeCodeForSession = vi.fn()
const mockGetSession = vi.fn()
const mockUpdatePassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args) => mockExchangeCodeForSession(...args),
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: mockUpdatePassword,
  }),
}))

function renderWithUrl(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  mockExchangeCodeForSession.mockResolvedValue({ error: null })
  mockUpdatePassword.mockResolvedValue(true)
})

describe('ResetPasswordPage', () => {
  it('redirects to / when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows new password form after successful code exchange', async () => {
    renderWithUrl('?code=valid-code')
    await waitFor(() =>
      expect(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
    )
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toBeInTheDocument()
  })

  it('shows expired link error when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })
    renderWithUrl('?code=expired')
    await waitFor(() =>
      expect(screen.getByText('링크가 만료됐습니다. 다시 요청해 주세요.')).toBeInTheDocument()
    )
  })

  it('prevents submit when passwords do not match', async () => {
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'Different1!' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('prevents submit when password does not meet policy', async () => {
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'nospecia' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'nospecia' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다')).toBeInTheDocument()
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('redirects to / on successful password update', async () => {
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/pages/__tests__/ResetPasswordPage.test.jsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement ResetPasswordPage**

Create `frontend/src/pages/ResetPasswordPage.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { validatePassword, PASSWORD_ERROR_MSG } from '../lib/validation'

/**
 * /reset-password — 비밀번호 재설정 페이지 (PKCE)
 *
 * 흐름:
 * 1. ?code= 없으면 즉시 / 리다이렉트 (직접 접근 차단)
 * 2. exchangeCodeForSession(code) — PKCE 세션 교환
 * 3. 새 비밀번호 폼 표시
 * 4. updateUser({ password }) → / 이동
 *
 * 보안:
 * - 링크 만료 시 명확한 에러 + 로그인 이동
 * - PASSWORD_RE 검증 (8자+특수문자)
 * - 비밀번호 확인 불일치 차단
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { updatePassword } = useAuth()

  const [step, setStep] = useState('exchanging') // 'exchanging' | 'form' | 'expired'
  const [newPassword, setNewPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    async function exchange() {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        setStep('expired')
      } else {
        setStep('form')
      }
    }
    exchange()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    if (newPassword !== confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다')
      return
    }
    if (!validatePassword(newPassword)) {
      setLocalError(PASSWORD_ERROR_MSG)
      return
    }

    setLoading(true)
    const ok = await updatePassword(newPassword)
    if (ok) {
      navigate('/', { replace: true })
    }
    setLoading(false)
  }

  if (step === 'exchanging') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 dark:text-white/60">링크 확인 중…</p>
        </div>
      </div>
    )
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="text-4xl">⏰</div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">링크가 만료됐습니다. 다시 요청해 주세요.</h1>
          <p className="text-sm text-gray-500 dark:text-white/60">
            재설정 링크는 1시간 후 만료됩니다.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">새 비밀번호 설정</h1>
          <p className="text-sm text-gray-400 dark:text-white/50 mt-1">
            8자 이상, 특수문자를 포함해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (8자 이상, 특수문자 포함)"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
              bg-white dark:bg-white/5 text-gray-900 dark:text-white
              placeholder:text-gray-400 dark:placeholder:text-white/30
              focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
              bg-white dark:bg-white/5 text-gray-900 dark:text-white
              placeholder:text-gray-400 dark:placeholder:text-white/30
              focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
          />

          {localError && (
            <p className="text-red-500 dark:text-red-400 text-xs px-1">{localError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700
              disabled:bg-gray-200 dark:disabled:bg-white/10
              disabled:text-gray-400 dark:disabled:text-white/30
              text-white font-bold text-sm rounded-2xl transition-colors"
          >
            {loading ? '처리 중…' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/pages/__tests__/ResetPasswordPage.test.jsx
```
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ResetPasswordPage.jsx frontend/src/pages/__tests__/ResetPasswordPage.test.jsx
git commit -m "feat: add ResetPasswordPage for PKCE password reset flow"
```

---

### Task 8: App.jsx Routes

**Files:**
- Modify: `frontend/src/App.jsx`

No new tests — route wiring only (App.jsx routing is covered by page-level tests).

- [ ] **Step 1: Add imports and routes**

In `frontend/src/App.jsx`, add imports after line 9 (after the existing imports):
```js
import AuthCallbackPage from './pages/AuthCallbackPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
```

Add routes inside `<Routes>` before the catch-all `*` route:
```jsx
      {/* 이메일 인증 콜백: PKCE code → session exchange */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {/* 비밀번호 재설정: PKCE code → new password form */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
```

Full updated `frontend/src/App.jsx`:
```jsx
import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import RoadmapPage from './pages/RoadmapPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivateRoute from './components/auth/PrivateRoute'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 로그인 후 /dashboard 진입 시 최근 로드맵 또는 온보딩으로 이동 */
function DashboardRedirect() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('devnavi_roadmap_'))
    if (keys.length > 0) {
      const id = keys[keys.length - 1].replace('devnavi_roadmap_', '')
      if (UUID_RE.test(id)) return <Navigate to={`/roadmap/${id}`} replace />
    }
  } catch {
    // localStorage 접근 불가(보안 정책 등) → 온보딩으로 폴백
  }
  return <Navigate to="/onboarding" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/roadmap/:id" element={<RoadmapPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* 관리자 대시보드: 서버에서 role='admin' 검증, 비인가 접근 시 홈 리다이렉트 */}
      <Route path="/admin" element={<AdminPage />} />
      {/* BUG-003: /dashboard 미인증 접근 시 홈으로, 인증 시 최근 로드맵으로 */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardRedirect /></PrivateRoute>} />
      {/* BUG-004: /roadmap (ID 없음) 접근 시 홈으로 */}
      <Route path="/roadmap" element={<Navigate to="/" replace />} />
      {/* 이메일 인증 콜백: PKCE code → session exchange */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {/* 비밀번호 재설정: PKCE code → new password form */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* BUG-002: catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Run all tests to confirm nothing broken**

```bash
cd frontend && npx vitest run
```
Expected: All tests pass (no regressions)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add /auth/callback and /reset-password routes to App"
```

---

### Task 9: Supabase Dashboard Config (Manual Steps)

No code changes — configuration guide for the Supabase dashboard.

**Files:**
- Create: `docs/superpowers/specs/2026-03-29-supabase-config-checklist.md`

- [ ] **Step 1: Create the config checklist**

Create `docs/superpowers/specs/2026-03-29-supabase-config-checklist.md`:
```markdown
# Supabase Dashboard Configuration Checklist

인증 개선 기능을 완성하려면 아래 Supabase 대시보드 설정이 필요합니다.

## 1. Custom SMTP (Authentication → SMTP Settings)

| 항목 | 값 |
|------|-----|
| Enabled | true |
| Host | smtp.hiworks.com |
| Port | 465 |
| Username | support@devnavi.kr |
| Password | [하이웍스 비밀번호 입력] |
| Sender Name | DevNavi |
| Sender Email | support@devnavi.kr |

## 2. URL Configuration (Authentication → URL Configuration)

| 항목 | 값 |
|------|-----|
| Site URL | https://devnavi.kr |
| Redirect URLs | https://devnavi.kr/auth/callback |
| | https://devnavi.kr/reset-password |

## 3. Password Policy (Authentication → Policies)

- Minimum password length: **8**
- Require uppercase letters: OFF (프론트에서 regex로 처리)
- Require numbers: OFF
- Require special characters: **ON**

## 4. Email Templates (Authentication → Email Templates)

### Confirm signup

**Subject:** DevNavi 이메일 인증

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" style="margin-bottom: 24px;" />
  <h2 style="color: #111827; font-size: 20px; font-weight: 800; margin-bottom: 8px;">이메일 인증</h2>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
    아래 버튼을 클릭해 이메일 인증을 완료해 주세요.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display: inline-block; background: #4F46E5; color: #fff; text-decoration: none;
            padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
    이메일 인증하기
  </a>
  <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
    본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
  </p>
</div>
```

### Reset password

**Subject:** DevNavi 비밀번호 재설정

```html
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <img src="https://devnavi.kr/logo.svg" width="120" alt="DevNavi" style="margin-bottom: 24px;" />
  <h2 style="color: #111827; font-size: 20px; font-weight: 800; margin-bottom: 8px;">비밀번호 재설정</h2>
  <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
    아래 버튼을 클릭해 새 비밀번호를 설정해 주세요.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display: inline-block; background: #4F46E5; color: #fff; text-decoration: none;
            padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px;">
    비밀번호 재설정하기
  </a>
  <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
    본인이 요청하지 않은 경우 이 메일을 무시해 주세요. 링크는 1시간 후 만료됩니다.
  </p>
</div>
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-03-29-supabase-config-checklist.md
git commit -m "docs: add Supabase dashboard config checklist for auth improvements"
```

---

## Final Step: Run All Tests

- [ ] **Run full test suite**

```bash
cd frontend && npx vitest run
```
Expected: All tests pass

- [ ] **Build check**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors
