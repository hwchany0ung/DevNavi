import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady, cleanAuthParams } from '../lib/supabase'
import { request } from '../lib/api'

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
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.warn('[useAuth] getSession 오류:', error.message)
        setUser(session ? _toUser(session) : null)
        setLoading(false)
      })
      .catch((err) => {
        // 네트워크 오류 등 — loading 무한 대기 방지
        console.warn('[useAuth] getSession 네트워크 오류:', err)
        setLoading(false)
      })

    // 인증 상태 변경 구독
    // SIGNED_IN 이벤트(OAuth/이메일 확인 리다이렉트 포함) 시 URL에 남은 auth 파라미터 즉시 제거
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // 다른 계정으로 로그인 시 이전 사용자의 localStorage 데이터 제거
        // (로그아웃 없이 계정 전환 시 이전 사용자의 로드맵이 노출되는 문제 방지)
        const lastUserId = localStorage.getItem('devnavi_last_user_id')
        if (lastUserId && lastUserId !== session.user.id) {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('devnavi_') && k !== 'devnavi_theme' && k !== 'devnavi_last_user_id')
            .forEach((k) => localStorage.removeItem(k))
        }
        localStorage.setItem('devnavi_last_user_id', session.user.id)
        cleanAuthParams()

        // PIPA: 최초 로그인 시 약관 동의 이력을 서버에 기록
        // user_metadata에 agreed_terms_at이 있으면 신규 가입 사용자로 판단
        // localStorage 플래그로 중복 전송 방지 (디바이스당 1회, 서버는 upsert로 멱등 처리)
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
            .catch((err) => console.warn('[useAuth] consent 기록 실패 (재시도 예정):', err.message))
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

  /**
   * @param {string} email
   * @param {string} password
   * @param {{ agreedTermsAt: string, agreedPrivacyAt: string }} consentData
   *   ISO 타임스탬프 — PIPA 준수를 위해 약관 동의 시각을 user_metadata에 기록
   */
  const signUpWithEmail = useCallback(async (email, password, consentData) => {
    setError(null)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          agreed_terms_at:   consentData?.agreedTermsAt   ?? null,
          agreed_privacy_at: consentData?.agreedPrivacyAt ?? null,
          consent_version:   '2026-01-01',  // 약관 버전 — 약관 변경 시 갱신
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
    // supabase가 null인 개발 모드에서도 안전하게 동작
    if (supabase) await supabase.auth.signOut()
    // 로그아웃 시 기기에 저장된 로드맵/분석 데이터 정리
    // (다른 사람이 같은 기기를 쓸 경우 이전 사용자 데이터 노출 방지)
    // devnavi_theme은 사용자 설정이므로 유지, 나머지(로드맵·분석·done·user_id 등)만 제거
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

  return { user, loading, error, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPasswordForEmail, updatePassword }
}

function _toUser(session) {
  return {
    id:          session.user.id,
    email:       session.user.email,
    accessToken: session.access_token,
  }
}
