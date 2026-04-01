import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isSupabaseReady } from '../../lib/supabase'
import { validatePassword, PASSWORD_ERROR_MSG } from '../../lib/validation'
import PrivacyConsentModal from './PrivacyConsentModal'

/**
 * 로그인 / 회원가입 / 비밀번호 찾기 모달
 * - mode: 'login' | 'signup' | 'forgot'
 * - 비밀번호 정책: 8자 이상 + 특수문자 1개 이상 (signup 전용)
 * - 비밀번호 확인 필드 (signup)
 * - 비밀번호 표시/숨김 토글 (눈 아이콘)
 * - 개인정보 동의 모달 연결
 *
 * @param {boolean}  open
 * @param {function} onClose
 */
export default function AuthModal({ open, onClose }) {
  const [mode, setMode]         = useState('login')  // 'login' | 'signup' | 'forgot'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState('')
  const [localError, setLocalError] = useState('')
  const [agreeTerms, setAgreeTerms]     = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPasswordForEmail, error, user } = useAuth()

  // 다른 탭(이메일 인증 탭)에서 로그인 완료되면 모달 자동 닫힘
  // Supabase onAuthStateChange는 localStorage 기반으로 모든 탭에 동기화됨
  useEffect(() => {
    if (user && open) onClose()
  }, [user, open, onClose])

  // 모달이 다시 열릴 때 이전 오류/성공 메시지 초기화
  useEffect(() => {
    if (open) {
      setLocalError('')
      setSuccess('')
    }
  }, [open])

  if (!open) return null

  const switchMode = (next) => {
    setMode(next)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
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

    if (mode === 'signup') {
      // FC-6: 약관 동의 없이 가입 요청 시 클라이언트 검증 (PIPA 준수)
      if (!agreeTerms || !agreePrivacy) {
        setLocalError('서비스 이용약관과 개인정보 처리방침에 동의해주세요.')
        return
      }
      if (!validatePassword(password)) {
        setLocalError(PASSWORD_ERROR_MSG)
        return
      }
      if (password !== confirmPassword) {
        setLocalError('비밀번호가 일치하지 않습니다')
        return
      }
    }

    setLoading(true)
    if (mode === 'login') {
      const ok = await signInWithEmail(email, password)
      if (ok) onClose()
    } else {
      const now = new Date().toISOString()
      const ok = await signUpWithEmail(email, password, {
        agreedTermsAt:   now,
        agreedPrivacyAt: now,
      })
      if (ok) setSuccess('가입 확인 이메일을 전송했습니다. 메일을 확인해주세요!')
    }
    setLoading(false)
  }

  const handlePrivacyLabelClick = (e) => {
    e.preventDefault()
    setPrivacyModalOpen(true)
  }

  const displayError = localError || error

  // 공통 비밀번호 입력 스타일
  const inputCls = `w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
    bg-white dark:bg-white/5 text-gray-900 dark:text-white
    placeholder:text-gray-400 dark:placeholder:text-white/30
    focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm`

  // 눈 아이콘 SVG
  const EyeIcon = ({ open: eyeOpen }) => eyeOpen ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )

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
                disabled={!isSupabaseReady || loading || (mode === 'signup' && (!agreeTerms || !agreePrivacy))}
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
                className={inputCls}
              />

              {/* 비밀번호 입력 — forgot 모드에서는 숨김 */}
              {mode !== 'forgot' && (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password" id="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required minLength={mode === 'login' ? 6 : 8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? '비밀번호' : '비밀번호 (8자 이상, 특수문자 포함)'}
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40
                      hover:text-gray-600 dark:hover:text-white/70 transition-colors"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              )}

              {/* 비밀번호 확인 — signup 전용 */}
              {mode === 'signup' && (
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword" id="confirmPassword"
                    autoComplete="new-password"
                    required minLength={8}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 확인"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/40
                      hover:text-gray-600 dark:hover:text-white/70 transition-colors"
                    aria-label={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
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
                  동의 이력(타임스탬프, IP, 버전)은 AuthContext의 SIGNED_IN 핸들러에서
                  /auth/consent 엔드포인트를 통해 서버에 기록됩니다.
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
