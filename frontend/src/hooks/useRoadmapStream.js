import { useState, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { streamSSE } from '../lib/api'

const LS_PREFIX = 'devnavi_roadmap_'

/** localStorage에 로드맵 저장 */
export function saveRoadmapLocal(roadmap) {
  const id = uuidv4()
  localStorage.setItem(LS_PREFIX + id, JSON.stringify(roadmap))
  return id
}

/** localStorage에서 로드맵 조회 */
export function loadRoadmapLocal(id) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * 전체 로드맵 JSON SSE 스트리밍 훅.
 *
 * 청크를 버퍼링하다가 [DONE] 수신 시 JSON.parse → localStorage 저장 → onSaved(id) 호출.
 *
 * @returns {{ isStreaming, progress, error, start, stop }}
 */
export function useRoadmapStream({ onSaved, onError } = {}) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [progress, setProgress]     = useState(0)   // 0~100 추정 (청크 수 기반)
  const [error, setError]           = useState(null)
  const bufferRef    = useRef('')
  const chunkCount   = useRef(0)
  const controllerRef = useRef(null)

  /**
   * @param {object} body        - 요청 바디
   * @param {object} [headers]   - 추가 헤더 (Authorization 등)
   */
  const start = useCallback((body, headers = {}) => {
    bufferRef.current = ''
    chunkCount.current = 0
    setProgress(0)
    setError(null)
    setIsStreaming(true)

    controllerRef.current = streamSSE(
      '/roadmap/full',
      body,
      (chunk) => {
        bufferRef.current += chunk
        chunkCount.current += 1
        // 대략 300청크를 100%로 간주 (Sonnet ~8000토큰 기준)
        setProgress(Math.min(Math.round((chunkCount.current / 300) * 100), 95))
      },
      () => {
        setProgress(100)
        setIsStreaming(false)
        // JSON 파싱 후 localStorage 저장
        try {
          // 코드블록 제거 (Sonnet이 간혹 감쌈)
          const cleaned = bufferRef.current
            .replace(/```(?:json)?\s*/g, '')
            .replace(/```\s*$/g, '')
            .trim()
          // JSON 완전성 벨트-서스펜더 체크.
          // 서버는 max_tokens 도달 시 [DONE] 대신 error 이벤트를 전송하지만,
          // 만약 청크 스트림이 정상 종료처럼 보이면서도 JSON이 잘렸을 경우 대비.
          if (!cleaned.endsWith('}')) {
            const truncErr = new Error('로드맵이 너무 길어 생성이 중단됐습니다. 목표 기간을 줄이거나 다시 시도해 주세요.')
            setError(truncErr)
            onError?.(truncErr)
            return
          }
          const roadmap = JSON.parse(cleaned)
          const id = saveRoadmapLocal(roadmap)
          onSaved?.(id, roadmap)
        } catch (e) {
          const parseErr = new Error('로드맵 파싱 실패: ' + e.message)
          setError(parseErr)
          onError?.(parseErr)
        }
      },
      (err) => {
        setError(err)
        setIsStreaming(false)
        onError?.(err)
      },
      headers,
    )
  }, [onSaved, onError])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { isStreaming, progress, error, start, stop }
}
