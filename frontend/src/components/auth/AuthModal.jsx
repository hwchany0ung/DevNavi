import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isSupabaseReady } from '../../lib/supabase'

/**
 * 로그인 / 회원가입 모달
 * - 모바일 키보드 대응: overflow-y-auto + 바텀시트 패턴
 * - 다크모드 지원
 *
 * @param {boolean}  open
 * @param {function} onClose
 */
export default function AuthModal({ open, onClose }) {
  const [mode, setMode]         = useState('login')  // 'login' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState('')
  const [agreeTerms, setAgreeTerms]     = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, error } = useAuth()

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    let ok
    if (mode === 'login') {
      ok = await signInWithEmail(email, password)
      if (ok) onClose()
    } else {
      ok = await signUpWithEmail(email, password)
      if (ok) setSuccess('가입 확인 이메일을 전송했습니다. 메일을 확인해주세요!')
    }
    setLoading(false)
  }

  return (
    /* 오버레이 — overflow-y-auto로 모바일 키보드 올라와도 스크롤 가능 */
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
                {mode === 'login' ? '로그인' : '회원가입'}
              </h2>
              <p className="text-xs text-gray-400 dark:text-white/50 mt-0.5">
                {mode === 'login'
                  ? '로드맵을 저장하고 진행률을 동기화하세요'
                  : '무료로 시작하고 나만의 로드맵을 관리하세요'}
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

          {/* Google OAuth */}
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

          <div className="flex items-center gap-3 text-xs text-gray-300 dark:text-white/20">
            <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
            또는 이메일로
            <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
                bg-white dark:bg-white/5 text-gray-900 dark:text-white
                placeholder:text-gray-400 dark:placeholder:text-white/30
                focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
            />
            <input
              type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10
                bg-white dark:bg-white/5 text-gray-900 dark:text-white
                placeholder:text-gray-400 dark:placeholder:text-white/30
                focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500/50 text-sm"
            />

            {/* 약관 동의 (회원가입 전용) */}
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
                    <a href="/privacy" target="_blank" rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 underline">개인정보처리방침</a>에 동의합니다
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p className="text-red-500 dark:text-red-400 text-xs px-1">{error}</p>
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
              {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
            </button>
          </form>

          {/* 모드 전환 */}
          <p className="text-center text-xs text-gray-400 dark:text-white/40">
            {mode === 'login' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            {' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {mode === 'login' ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
