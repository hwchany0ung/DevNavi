import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { streamSSE } from '../lib/api'
import { useAnalytics } from './useAnalytics'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function _getAuthHeader() {
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
 * useQA — 태스크별 AI Q&A 세션 관리 hook
 *
 * - messages: Map<taskId, Message[]>  세션 메모리 (DB 저장 없음)
 * - isStreaming: 스트리밍 중 여부
 * - currentTaskId: 현재 열린 패널의 taskId
 */
export function useQA() {
  // Map<taskId, Message[]> — 세션 메모리
  const [messagesMap, setMessagesMap] = useState(new Map())
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const [taskContext, setTaskContext] = useState(null)

  // AbortController ref — 패널 닫기 시 스트리밍 취소
  const abortRef = useRef(null)

  const { logEvent } = useAnalytics()

  /** 현재 taskId의 메시지 배열 */
  const messages = currentTaskId ? (messagesMap.get(currentTaskId) ?? []) : []

  /** 패널 열기 — 같은 taskId 재오픈 시 이전 대화 복원 */
  const openPanel = useCallback((taskId, context) => {
    setCurrentTaskId(taskId)
    setTaskContext(context)
    // messagesMap에 해당 taskId가 없으면 빈 배열로 초기화
    setMessagesMap((prev) => {
      if (prev.has(taskId)) return prev
      const next = new Map(prev)
      next.set(taskId, [])
      return next
    })
    logEvent('qa_opened', taskId)
  }, [logEvent])

  /** 패널 닫기 — 스트리밍 중이면 취소 */
  const closePanel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsStreaming(false)
    setCurrentTaskId(null)
    setTaskContext(null)
  }, [])

  /**
   * 메시지 전송 — SSE 스트리밍
   * @param {string} question
   */
  const sendMessage = useCallback(async (question) => {
    if (!currentTaskId || !taskContext || isStreaming) return

    logEvent('qa_submitted', currentTaskId)

    // 사용자 메시지 추가
    const userMsg = { role: 'user', content: question }
    setMessagesMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(currentTaskId) ?? []
      next.set(currentTaskId, [...existing, userMsg])
      return next
    })

    // 어시스턴트 메시지 자리 확보 (스트리밍용 빈 메시지)
    const assistantMsg = { role: 'assistant', content: '', followups: [] }
    setMessagesMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(currentTaskId) ?? []
      next.set(currentTaskId, [...existing, assistantMsg])
      return next
    })

    setIsStreaming(true)

    // 이전 대화 이력 (현재 user 메시지 제외)
    const prevMessages = messagesMap.get(currentTaskId) ?? []

    const authHeader = await _getAuthHeader()

    const body = {
      task_id: currentTaskId,
      question,
      task_context: {
        job_type: taskContext.jobType,
        month: taskContext.month,
        week: taskContext.week,
        category: taskContext.category,
        task_name: taskContext.taskName,
      },
      messages: prevMessages.map((m) => ({ role: m.role, content: m.content })),
    }

    const controller = streamSSE(
      '/ai/qa',
      body,
      // onChunk — 텍스트 청크 또는 {followups:[]} 이벤트 처리
      (chunkOrEvent) => {
        if (chunkOrEvent !== null && typeof chunkOrEvent === 'object' && Array.isArray(chunkOrEvent.followups)) {
          // followups 이벤트 — 마지막 어시스턴트 메시지에 저장
          setMessagesMap((prev) => {
            const next = new Map(prev)
            const msgs = [...(next.get(currentTaskId) ?? [])]
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...msgs[msgs.length - 1],
                followups: chunkOrEvent.followups,
              }
            }
            next.set(currentTaskId, msgs)
            return next
          })
        } else {
          // 텍스트 청크 — 마지막 어시스턴트 메시지에 append
          setMessagesMap((prev) => {
            const next = new Map(prev)
            const msgs = [...(next.get(currentTaskId) ?? [])]
            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...msgs[msgs.length - 1],
                content: msgs[msgs.length - 1].content + chunkOrEvent,
              }
            }
            next.set(currentTaskId, msgs)
            return next
          })
        }
      },
      // onDone
      () => {
        setIsStreaming(false)
        abortRef.current = null
      },
      // onError
      (err) => {
        setIsStreaming(false)
        abortRef.current = null
        // 에러 메시지를 어시스턴트 메시지로 표시
        const errText = err?.message || '오류가 발생했습니다. 다시 시도해 주세요.'
        setMessagesMap((prev) => {
          const next = new Map(prev)
          const msgs = [...(next.get(currentTaskId) ?? [])]
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: errText, isError: true }
          }
          next.set(currentTaskId, msgs)
          return next
        })
      },
      authHeader,
    )

    abortRef.current = controller
  }, [currentTaskId, taskContext, isStreaming, messagesMap, logEvent])

  return {
    messages,
    messagesMap,
    isStreaming,
    currentTaskId,
    taskContext,
    openPanel,
    closePanel,
    sendMessage,
  }
}
