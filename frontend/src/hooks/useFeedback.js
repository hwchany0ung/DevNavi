// Design Ref: §5.3 — useFeedback: 피드백 API 독립 훅
import { useCallback } from 'react'
import { request } from '../lib/api'

export function useFeedback() {
  const sendFeedback = useCallback(async ({ taskId, question, answer, rating }) => {
    try {
      await request('/ai/qa/feedback', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, question, answer, rating }),
      })
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[useFeedback] sendFeedback 실패:', e)
    }
  }, [])

  return { sendFeedback }
}
