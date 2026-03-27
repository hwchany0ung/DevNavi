const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * 일반 REST 요청
 */
export async function request(path, options = {}) {
  // headers를 먼저 분리한 뒤 나머지를 spread해야
  // Content-Type이 options.headers에 덮어씌워지지 않음
  const { headers: extraHeaders = {}, ...rest } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...rest,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // FastAPI validation 오류는 detail이 배열({loc,msg,type})로 올 수 있음
    let detailMsg
    if (typeof err.detail === 'string') {
      detailMsg = err.detail
    } else if (Array.isArray(err.detail)) {
      detailMsg = err.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
    } else if (err.detail) {
      detailMsg = JSON.stringify(err.detail)
    } else {
      detailMsg = `HTTP ${res.status}`
    }
    const error = new Error(detailMsg)
    error.status = res.status
    throw error
  }
  return res.json()
}

/**
 * SSE 스트리밍 요청
 * @param {string} path - API 경로
 * @param {object} body - 요청 바디
 * @param {function} onChunk - 청크 수신 콜백 (text) => void
 * @param {function} onDone  - 완료 콜백 () => void
 * @param {function} onError - 에러 콜백 (error) => void
 * @param {object} [extraHeaders] - 추가 헤더 (Authorization 등)
 * @returns {AbortController} - 취소용
 */
export function streamSSE(path, body, onChunk, onDone, onError, extraHeaders = {}) {
  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const error = new Error(err.detail || `HTTP ${res.status}`)
        error.status = res.status
        onError?.(error)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
              onDone?.()
              return
            }
            try {
              const parsed = JSON.parse(data)
              // 서버 측 에러 이벤트 처리
              if (parsed.type === 'error') {
                const err = new Error(parsed.message || '서버 오류가 발생했어요.')
                onError?.(err)
                return
              }
              // teaser: { type:'text', chunk } / full: { type:'chunk', chunk }
              onChunk?.(parsed.chunk ?? parsed.text ?? data)
            } catch {
              onChunk?.(data) // plain text fallback
            }
          }
        }
      }
      onDone?.()
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err)
    }
  })()

  return controller
}
