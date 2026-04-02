import { useState, useRef, useCallback, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { streamSSE } from '../lib/api'

const LS_PREFIX = 'devnavi_roadmap_'
const LS_MAX_COUNT = 5          // 최대 보관 개수
const LS_MAX_BYTES = 50 * 1024  // 50KB

/**
 * localStorage 로드맵 저장 — 최대 5개, 50KB 제한.
 * 초과 시 가장 오래된 항목부터 제거 (LRU 방식).
 */
export function saveRoadmapLocal(roadmap) {
  const id = uuidv4()
  const serialized = JSON.stringify(roadmap)

  // 50KB 초과 시 저장 스킵 (기존 항목 보호)
  if (serialized.length > LS_MAX_BYTES) {
    console.warn('[saveRoadmapLocal] 로드맵이 50KB를 초과하여 저장을 건너뜁니다.')
    return id
  }

  try {
    // 기존 로드맵 키 목록 (삽입 순서 기준)
    const existingKeys = Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))

    // 최대 개수 초과 시 가장 오래된 항목 제거
    if (existingKeys.length >= LS_MAX_COUNT) {
      const toRemove = existingKeys.slice(0, existingKeys.length - LS_MAX_COUNT + 1)
      toRemove.forEach((k) => localStorage.removeItem(k))
    }

    localStorage.setItem(LS_PREFIX + id, serialized)
  } catch (e) {
    // QuotaExceededError 등 스토리지 꽉 찬 경우
    console.warn('[saveRoadmapLocal] localStorage 저장 실패:', e)
  }
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
  // FI-1: 콜백을 ref로 관리하여 start의 deps에서 제거 (무한 재생성 방지)
  const onSavedRef = useRef(onSaved)
  const onErrorRef = useRef(onError)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])
  useEffect(() => { onErrorRef.current = onError }, [onError])

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

    let multicallTotal = 0 // 백엔드 progress 이벤트로 확인된 총 콜 수

    controllerRef.current = streamSSE(
      '/roadmap/full',
      body,
      (chunk) => {
        bufferRef.current += chunk
        chunkCount.current += 1
        // multicall progress 이벤트가 없을 때 청크 카운트 기반 추정으로 폴백
        if (multicallTotal === 0) {
          setProgress(Math.min(Math.round((chunkCount.current / 300) * 100), 95))
        }
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
            onErrorRef.current?.(truncErr)
            return
          }
          const roadmap = JSON.parse(cleaned)
          const id = saveRoadmapLocal(roadmap)
          onSavedRef.current?.(id, roadmap)
        } catch (e) {
          const parseErr = new Error('로드맵 파싱 실패: ' + e.message)
          setError(parseErr)
          onErrorRef.current?.(parseErr)
        }
      },
      (err) => {
        setError(err)
        setIsStreaming(false)
        onErrorRef.current?.(err)
      },
      headers,
      (progressEvt) => {
        // 백엔드: { type:'progress', step: N, total: M }
        // I10: 백엔드 필드명(step)과 일치하도록 수정 (current → step)
        const step  = progressEvt.step  ?? progressEvt.current ?? 0
        const total = progressEvt.total ?? 0
        if (total > 0) {
          multicallTotal = total
          setProgress(Math.min(Math.round((step / total) * 95), 95))
        }
      },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks tracked via refs
  }, [])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { isStreaming, progress, error, start, stop }
}
