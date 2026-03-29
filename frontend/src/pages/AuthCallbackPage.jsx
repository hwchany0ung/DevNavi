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
 *   - Supabase JS v2 detectSessionInUrl:true가 ?code= 자동 교환
 *     → exchangeCodeForSession 수동 호출 금지 (double-exchange 방지)
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

    // Supabase JS v2 with detectSessionInUrl:true auto-exchanges PKCE ?code= on init.
    // Calling exchangeCodeForSession() manually causes double-exchange.
    // Use onAuthStateChange to detect when session is established.
    let settled = false
    const settle = (newStatus) => {
      if (!settled) {
        settled = true
        setStatus(newStatus)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        settle('success')
      }
    })

    // Immediate check: auto-exchange may have completed before subscription
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) settle('success')
    })

    // If no session within 10s, code was expired or invalid
    const timer = setTimeout(() => settle('error'), 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
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
