import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase'

/**
 * Supabase 인증 상태 훅.
 *
 * - isSupabaseReady=false 이면 항상 { user: null, loading: false } 반환 (로컬 개발 모드)
 * - user.accessToken 을 API 요청 헤더에 사용
 *
 * @returns {{
 *   user: {id, email, accessToken} | null,
 *   loading: boolean,
 *   signInWithEmail: (email, password) => Promise,
 *   signUpWithEmail: (email, password) => Promise,
 *   signInWithGoogle: () => Promise,
 *   signOut: () => Promise,
 *   error: string | null,
 * }}
 */
export function useAuth() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(isSupabaseReady)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!isSupabaseReady) return

    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? _toUser(session) : null)
      setLoading(false)
    })

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? _toUser(session) : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    return !err
  }, [])

  const signUpWithEmail = useCallback(async (email, password) => {
    setError(null)
    const { error: err } = await supabase.auth.signUp({ email, password })
    if (err) setError(err.message)
    return !err
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/onboarding' },
    })
    if (err) setError(err.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return { user, loading, error, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }
}

function _toUser(session) {
  return {
    id:          session.user.id,
    email:       session.user.email,
    accessToken: session.access_token,
  }
}
