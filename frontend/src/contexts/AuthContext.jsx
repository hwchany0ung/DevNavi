import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
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
  // accessToken은 Context value에 직접 노출하지 않고 ref에 보관
  const accessTokenRef = useRef(null)

  useEffect(() => {
    if (!isSupabaseReady) return

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.warn('[AuthProvider] getSession 오류:', error.message)
        accessTokenRef.current = session?.access_token ?? null
        setUser(session ? _toUser(session) : null)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[AuthProvider] getSession 네트워크 오류:', err)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // FC-1: Safari 프라이빗 모드 등 localStorage 접근 실패 방어
        try {
          const lastUserId = localStorage.getItem('devnavi_last_user_id')
          if (lastUserId && lastUserId !== session.user.id) {
            Object.keys(localStorage)
              .filter((k) => k.startsWith('devnavi_') && k !== 'devnavi_theme' && k !== 'devnavi_last_user_id')
              .forEach((k) => localStorage.removeItem(k))
          }
          localStorage.setItem('devnavi_last_user_id', session.user.id)
        } catch (e) {
          console.warn('[AuthProvider] localStorage 접근 실패:', e)
        }
        cleanAuthParams()

        // PIPA: 약관 동의 이력을 서버에 기록
        // - 이메일 가입: user_metadata에 agreed_terms_at 포함 → 그대로 기록
        // - Google OAuth: user_metadata에 agreed_terms_at 없음 → 최초 SIGNED_IN 시각을 동의 시각으로 기록
        const consentKey = `devnavi_consent_sent_${session.user.id}`
        if (!localStorage.getItem(consentKey)) {
          localStorage.setItem(consentKey, '1')  // optimistic locking — 요청 전에 먼저 마킹
          const meta = session.user.user_metadata || {}
          const now  = new Date().toISOString()
          request('/auth/consent', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              agreed_terms_at:   meta.agreed_terms_at   || now,
              agreed_privacy_at: meta.agreed_privacy_at || meta.agreed_terms_at || now,
              consent_version:   meta.consent_version   || '2026-01-01',
            }),
          })
            .then((data) => {
              if (!data.consent_saved) {
                // 서버 저장 실패 — 다음 세션에서 재시도 허용
                localStorage.removeItem(consentKey)
                console.warn('[AuthProvider] consent 서버 저장 실패 — 다음 세션 재시도')
              }
            })
            .catch((err) => {
              // 네트워크/HTTP 오류 시 마킹 제거 (재시도 허용)
              localStorage.removeItem(consentKey)
              console.warn('[AuthProvider] consent 기록 실패 (재시도 예정):', err.message)
            })
        }
      }
      if (event === 'TOKEN_REFRESHED') {
        cleanAuthParams()
      }
      accessTokenRef.current = session?.access_token ?? null
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
    // FI-4: 서버 signOut 실패해도 로컬 세션은 반드시 정리 (불일치 방지)
    // M5: JWT는 stateless이므로 서버에서 토큰을 즉시 무효화할 수 없음.
    // supabase.auth.signOut()은 서버 세션 테이블을 삭제하지만,
    // 이미 발급된 JWT는 만료 시각까지 유효한 상태를 유지한다.
    // 보안 강화가 필요하면 서버 측 JWT blacklist 테이블 도입을 고려할 것.
    try {
      if (supabase) await supabase.auth.signOut()
    } catch (err) {
      console.warn('[AuthProvider] signOut 서버 실패 (로컬 정리 진행):', err.message)
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('devnavi_') && k !== 'devnavi_theme' && !k.startsWith('devnavi_consent_sent_'))
        .forEach((k) => localStorage.removeItem(k))
    } catch { /* localStorage 접근 실패 무시 */ }
    accessTokenRef.current = null
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

  /**
   * C2 보안 수정: accessToken을 Context value에 직접 노출하지 않고,
   * Authorization 헤더 객체를 반환하는 함수만 공개한다.
   * 외부 컴포넌트는 user.accessToken 대신 getAuthHeaders()를 사용할 것.
   */
  const getAuthHeaders = useCallback(() => {
    const token = accessTokenRef.current
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      signInWithEmail, signUpWithEmail, signInWithGoogle,
      signOut, resetPasswordForEmail, updatePassword,
      getAuthHeaders,
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
  // C2: accessToken은 user 객체에 포함하지 않음 — accessTokenRef에 별도 보관
  return {
    id:    session.user.id,
    email: session.user.email,
  }
}
