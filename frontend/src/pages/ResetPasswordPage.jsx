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
        // 코드 교환 실패 시 부분적으로 생성된 세션을 반드시 제거
        // (Supabase가 에러를 반환하면서도 세션을 만드는 경우 방지)
        await supabase.auth.signOut()
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
