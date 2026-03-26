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

    controllerRef.current = streamSSE(
      path,
      body,
      (chunk) => setText((prev) => prev + chunk),
      () => setIsStreaming(false),
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
