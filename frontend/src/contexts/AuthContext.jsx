import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady, cleanAuthParams } from '../lib/supabase'
import { request } from '../lib/api'

const AuthContext = createContext(null)

/**
 * AuthProvider — 앱 전체에서 단 하나의 onAuthStateChange 구독을 유지.
 *
 * 이전에는 useAuth()를 호출하는 컴포넌트마다 별도 구독이 생성되어
 * TOKEN_REFRESHED 이벤트 타이밍에 따라 일부 컴포넌트가 만료 토큰을
 * 계속 사용하는 문제가 있었음 (I6). Context 패턴으로 구독을 1개로 통일.
 */
export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(isSupabaseReady)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!isSupabaseReady) return

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.warn('[AuthProvider] getSession 오류:', error.message)
        setUser(session ? _toUser(session) : null)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[AuthProvider] getSession 네트워크 오류:', err)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const lastUserId = localStorage.getItem('devnavi_last_user_id')
        if (lastUserId && lastUserId !== session.user.id) {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('devnavi_') && k !== 'devnavi_theme' && k !== 'devnavi_last_user_id')
            .forEach((k) => localStorage.removeItem(k))
        }
        localStorage.setItem('devnavi_last_user_id', session.user.id)
        cleanAuthParams()

        // PIPA: 최초 로그인 시 약관 동의 이력을 서버에 기록
        const consentKey = `devnavi_consent_sent_${session.user.id}`
        const meta = session.user.user_metadata || {}
        if (meta.agreed_terms_at && !localStorage.getItem(consentKey)) {
          request('/auth/consent', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              agreed_terms_at:   meta.agreed_terms_at,
              agreed_privacy_at: meta.agreed_privacy_at || meta.agreed_terms_at,
              consent_version:   meta.consent_version || '2026-01-01',
            }),
          })
            .then(() => localStorage.setItem(consentKey, '1'))
            .catch((err) => console.warn('[AuthProvider] consent 기록 실패 (재시도 예정):', err.message))
        }
      }
      if (event === 'TOKEN_REFRESHED') {
        cleanAuthParams()
      }
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

  const signUpWithEmail = useCallback(async (email, password, consentData) => {
    setError(null)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          agreed_terms_at:   consentData?.agreedTermsAt   ?? null,
          agreed_privacy_at: consentData?.agreedPrivacyAt ?? null,
          consent_version:   '2026-01-01',
        },
      },
    })
    if (err) setError(err.message)
    return !err
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
    if (err) setError(err.message)
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    Object.keys(localStorage)
      .filter((k) => k.startsWith('devnavi_') && k !== 'devnavi_theme')
      .forEach((k) => localStorage.removeItem(k))
    setUser(null)
  }, [])

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

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      signInWithEmail, signUpWithEmail, signInWithGoogle,
      signOut, resetPasswordForEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 하위에서만 사용할 수 있습니다.')
  return ctx
}

function _toUser(session) {
  return {
    id:          session.user.id,
    email:       session.user.email,
    accessToken: session.access_token,
  }
}
