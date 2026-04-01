import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function _parseError(err, status) {
  let detailMsg
  // FastAPI validation 오류는 detail이 배열({loc,msg,type})로 올 수 있음
  if (typeof err.detail === 'string') {
    detailMsg = err.detail
  } else if (Array.isArray(err.detail)) {
    detailMsg = err.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
  } else if (err.detail && typeof err.detail === 'object') {
    detailMsg = err.detail.message || JSON.stringify(err.detail)
  } else {
    detailMsg = `HTTP ${status}`
  }
  const error = new Error(detailMsg)
  error.status = status
  return error
}

/**
 * 일반 REST 요청.
 * 401 응답 시 Supabase 세션 갱신 후 1회 자동 재시도 (I12).
 */
export async function request(path, options = {}) {
  const { headers: extraHeaders = {}, ...rest } = options

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
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
              // teaser: { type:'text', chunk } / full: { type:'chunk', chunk }
              if (parsed.chunk !== undefined || parsed.text !== undefined) {
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
