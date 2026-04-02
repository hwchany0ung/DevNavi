// Design Ref: §5.4 — useAnalytics: fire-and-forget 이벤트 로깅
import { useCallback } from 'react'
import { request } from '../lib/api'

export function useAnalytics() {
  const logEvent = useCallback(async (eventType, taskId = null, metadata = {}) => {
    try {
      await request('/ai/qa/event', {
        method: 'POST',
        body: JSON.stringify({ event_type: eventType, task_id: taskId, metadata }),
      })
    } catch (e) {
      console.warn('[useAnalytics] logEvent 실패:', e)
    }
  }, [])

  return { logEvent }
}
