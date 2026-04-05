import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useAuth } from '../../contexts/AuthContext'


function formatDate(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

/**
 * QAHistoryPanel — task_id 기준 Q&A 이력 목록
 *
 * Props:
 *   taskId — 현재 태스크 ID (필수)
 */
export default function QAHistoryPanel({ taskId }) {
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const { getAuthHeaders } = useAuth()

  useEffect(() => {
    if (!taskId) return
    const controller = new AbortController()
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const headers = getAuthHeaders()
        const url = `${import.meta.env.VITE_API_BASE_URL}/ai/qa/history?task_id=${encodeURIComponent(taskId)}&limit=20`
        const resp = await fetch(url, { headers, signal: controller.signal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (!cancelled) setHistory(data.history ?? [])
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') setError('이력을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [taskId, getAuthHeaders, retryCount])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-16">
        <span className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-2">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => setRetryCount(n => n + 1)}
          className="text-xs text-indigo-500 dark:text-indigo-400 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
          <span className="text-gray-400 dark:text-white/40 text-lg">📂</span>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-white/60">
          아직 질문 기록이 없어요
        </p>
        <p className="text-xs text-gray-400 dark:text-white/30">
          이 태스크에서 질문하면 여기에 저장됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {history.map((item) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 dark:text-white/30">
              {formatDate(item.created_at)}
            </span>
          </div>
          {/* 질문 */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed bg-indigo-600 text-white">
              {item.question}
            </div>
          </div>
          {/* 답변 */}
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white/80">
              {item.answer}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

QAHistoryPanel.propTypes = {
  taskId: PropTypes.string,
}
