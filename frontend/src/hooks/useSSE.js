import { useState, useRef, useCallback } from 'react'
import { streamSSE } from '../lib/api'

/**
 * SSE 스트리밍 훅
 * @returns {{ text, isStreaming, error, start, stop }}
 */
export function useSSE() {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const controllerRef = useRef(null)

  const start = useCallback((path, body) => {
    setText('')
    setError(null)
    setIsStreaming(true)

    // textRef: onDone 콜백 시점에 최신 text 값 확인용 (클로저 문제 방지)
    const textRef = { current: '' }

    controllerRef.current = streamSSE(
      path,
      body,
      (chunk) => {
        textRef.current += chunk
        setText((prev) => prev + chunk)
      },
      () => {
        // SSE 완료됐는데 텍스트가 없으면 → 서버가 빈 응답 반환한 것으로 에러 처리
        if (!textRef.current.trim()) {
          setError(new Error('응답을 받지 못했어요. 잠시 후 다시 시도해주세요.'))
        }
        setIsStreaming(false)
      },
      (err) => {
        setError(err)
        setIsStreaming(false)
      }
    )
  }, [])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { text, isStreaming, error, start, stop }
}
