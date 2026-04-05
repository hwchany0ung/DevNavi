import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function _parseError(err, status) {
  // I-7: HTTP 상태 코드 기반 사용자 친화적 메시지 반환
  // 원본 서버 메시지는 개발 환경에서만 포함
  let userMsg
  if (status === 400) {
    userMsg = '잘못된 요청입니다.'
  } else if (status === 401) {
    userMsg = '인증이 필요합니다. 다시 로그인해 주세요.'
  } else if (status === 403) {
    userMsg = '접근 권한이 없습니다.'
  } else if (status === 404) {
    userMsg = '요청한 리소스를 찾을 수 없습니다.'
  } else if (status === 422) {
    userMsg = '입력값을 확인해주세요.'
  } else if (status === 429) {
    userMsg = '잠시 후 다시 시도해주세요.'
  } else if (status >= 500) {
    userMsg = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  } else {
    userMsg = '요청 처리 중 오류가 발생했습니다.'
  }

  // DEV 환경에서만 원본 서버 메시지 추가
  if (import.meta.env.DEV) {
    let detailMsg
    if (typeof err.detail === 'string') {
      detailMsg = err.detail
    } else if (Array.isArray(err.detail)) {
      detailMsg = err.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
    } else if (err.detail && typeof err.detail === 'object') {
      detailMsg = err.detail.message || JSON.stringify(err.detail)
    } else {
      detailMsg = `HTTP ${status}`
    }
    if (detailMsg && detailMsg !== `HTTP ${status}`) {
      userMsg = `${userMsg} (${detailMsg})`
    }
  }

  const error = new Error(userMsg)
  error.status = status
  // 원본 detail 데이터 보존 (reset_at 등 구조화된 필드 접근용)
  if (err.detail && typeof err.detail === 'object') {
    error.data = err.detail
  }
  return error
}

/**
 * 현재 Supabase 세션 토큰을 자동으로 주입한 Authorization 헤더 반환.
 * 세션이 없거나 Supabase 미연동 시 빈 객체 반환.
 */
async function _getAutoAuthHeader() {
  if (!supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/**
 * 일반 REST 요청.
 * - Authorization 헤더가 없으면 Supabase 세션 토큰을 자동 주입 (I20).
 * - 401 응답 시 Supabase 세션 갱신 후 1회 자동 재시도 (I12).
 */
export async function request(path, options = {}) {
  const { headers: extraHeaders = {}, ...rest } = options

  // I20: Authorization이 명시되지 않은 경우 세션 토큰 자동 주입
  const autoAuth = extraHeaders.Authorization ? {} : await _getAutoAuthHeader()
  const mergedHeaders = { ...autoAuth, ...extraHeaders }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...mergedHeaders },
    ...rest,
  })

  // 401: 토큰 만료 → 세션 갱신 후 1회 재시도
  if (res.status === 401 && supabase) {
    const { data } = await supabase.auth.refreshSession().catch(() => ({ data: null }))
    if (data?.session?.access_token) {
      const retryHeaders = {
        ...extraHeaders,
        Authorization: `Bearer ${data.session.access_token}`,
      }
      const retryRes = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...retryHeaders },
        ...rest,
      })
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}))
        throw _parseError(err, retryRes.status)
      }
      return retryRes.json()
    }
    // FC-2: 토큰 갱신 실패 시 undefined 반환 대신 명시적 에러 throw
    const error = new Error('세션이 만료되었습니다. 다시 로그인해 주세요.')
    error.status = 401
    throw error
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw _parseError(err, res.status)
  }
  return res.json()
}

/**
 * SSE 스트리밍 요청
 * @param {string} path - API 경로
 * @param {object} body - 요청 바디
 * @param {function} onChunk    - 청크 수신 콜백 (text) => void
 * @param {function} onDone     - 완료 콜백 () => void
 * @param {function} onError    - 에러 콜백 (error) => void
 * @param {object} [extraHeaders] - 추가 헤더 (Authorization 등)
 * @param {function} [onProgress] - 멀티콜 진행 콜백 ({ current, total }) => void
 * @returns {AbortController} - 취소용
 */
export function streamSSE(path, body, onChunk, onDone, onError, extraHeaders = {}, onProgress) {
  const controller = new AbortController()

  ;(async () => {
    try {
      let res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        // FI-3: 401 시 토큰 갱신 후 1회 재시도 (request()와 동일 패턴)
        if (res.status === 401 && supabase) {
          const { data } = await supabase.auth.refreshSession().catch(() => ({ data: null }))
          if (data?.session?.access_token) {
            const retryRes = await fetch(`${BASE_URL}${path}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...extraHeaders,
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            })
            if (retryRes.ok) {
              // 재시도 성공 — 아래 스트림 읽기 로직으로 계속
              res = retryRes
            } else {
              const err = await retryRes.json().catch(() => ({}))
              onError?.(_parseError(err, retryRes.status))
              return
            }
          } else {
            const error = new Error('세션이 만료되었습니다. 다시 로그인해 주세요.')
            error.status = 401
            onError?.(error)
            return
          }
        } else {
          const err = await res.json().catch(() => ({}))
          onError?.(_parseError(err, res.status))
          return
        }
      }

      // Content-Type 검증: text/event-stream 이 아니면 잘못된 엔드포인트
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        onError?.(new Error('잘못된 API 엔드포인트 — SSE 응답이 아닙니다.'))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let doneSignalReceived = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // 마지막 미완성 줄 보존

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              doneSignalReceived = true
              onDone?.()
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'error') {
                onError?.(new Error(parsed.message || '서버 오류가 발생했어요.'))
                return
              }
              // progress: 멀티콜 진행 알림 — onProgress 콜백으로 전달
              if (parsed.type === 'progress') {
                onProgress?.(parsed)
                continue
              }
              // followups: 동적 팔로업 질문 배열 — 객체 그대로 전달
              if (parsed.followups !== undefined) {
                onChunk?.({ followups: parsed.followups })
              // teaser: { type:'text', chunk } / full: { type:'chunk', chunk }
              } else if (parsed.chunk !== undefined || parsed.text !== undefined) {
                onChunk?.(parsed.chunk ?? parsed.text)
              }
            } catch {
              onChunk?.(data) // plain text fallback
            }
          }
        }
      }
      // [DONE] 없이 스트림이 끊긴 경우 — 비정상 종료 (max_tokens 등)
      if (!doneSignalReceived) {
        onError?.(new Error('로드맵 생성 중 연결이 끊겼습니다. 목표 기간을 줄이거나 다시 시도해 주세요.'))
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err)
    }
  })()

  return controller
}
