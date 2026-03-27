import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Supabase 클라이언트.
 * 환경변수가 없으면 null (개발 환경에서 로컬스토리지 모드로 동작).
 *
 * 보안 설정:
 *  - flowType: 'pkce'  — OAuth/이메일 확인 후 code를 URL에 잠깐 노출하지만
 *                        exchange 완료 즉시 URL 정리 (implicit보다 안전)
 *  - detectSessionInUrl: true  — redirect 후 자동으로 code/hash를 처리하고
 *                                history.replaceState로 URL 즉시 정리
 */
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null

export const isSupabaseReady = !!supabase

/**
 * 인증 관련 URL 파라미터 제거 유틸.
 * Supabase가 detectSessionInUrl로 자동 정리하지만, 만약 남아있는 경우 수동 제거.
 */
export function cleanAuthParams() {
  const params = new URLSearchParams(window.location.search)
  const authKeys = ['code', 'error', 'error_description', 'error_code', 'message', 'token', 'type']
  const hadParams = authKeys.some(k => params.has(k))
  if (hadParams) {
    authKeys.forEach(k => params.delete(k))
    const newSearch = params.toString()
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash.replace(/#.*/, '')
    window.history.replaceState({}, '', newUrl)
  }
}
