import { useEffect, useRef } from 'react'

/** 타이핑 커서 */
function Cursor({ visible }) {
  return visible ? (
    <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
  ) : null
}

/** 마크다운 ## 월차 헤더 파싱 */
function parseTeaser(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const match = line.match(/^##\s*(.+)/)
    if (match) {
      return (
        <p key={i} className="font-bold text-indigo-700 dark:text-indigo-400 mt-4 first:mt-0">
          {match[1]}
        </p>
      )
    }
    if (line.trim()) {
      return <p key={i} className="text-gray-600 dark:text-white/60 text-sm mt-1">{line}</p>
    }
    return null
  })
}

export default function TeaserStream({ text, isStreaming, error, onDeepDive, onRetry }) {
  const bottomRef = useRef(null)

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text])

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 text-center space-y-3">
        <p className="text-red-600 dark:text-red-400 font-semibold">로드맵 생성 중 오류가 발생했어요</p>
        <p className="text-red-400 dark:text-red-400/70 text-sm">{error.message}</p>
        {error.status === 402 ? (
          <button
            onClick={onDeepDive}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            프리미엄으로 업그레이드
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors">
            다시 시도
          </button>
        )}
      </div>
    )
  }

  if (!text && isStreaming) {
    return (
      <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-6">
        <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i}
                className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          <span className="text-sm font-medium">AI가 로드맵을 생성하고 있어요…</span>
        </div>
      </div>
    )
  }

  if (!text) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-white/10 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-2">
        <span className="text-white text-sm font-bold">✨ AI 맞춤 로드맵 (티저)</span>
        {isStreaming && (
          <span className="text-indigo-200 text-xs animate-pulse">생성 중…</span>
        )}
      </div>

      {/* 본문 */}
      <div className="px-6 py-5 min-h-24">
        {parseTeaser(text)}
        <Cursor visible={isStreaming} />
        <div ref={bottomRef} />
      </div>

      {/* 딥다이브 유도 — 스트리밍 완료 후 표시 */}
      {!isStreaming && text && (
        <div className="px-6 pb-6">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 text-center">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-1">
              더 완벽한 맞춤형 세부 계획을 원하시나요?
            </p>
            <p className="text-xs text-indigo-400 dark:text-indigo-400/70 mb-3">
              스킬·자격증·목표 회사까지 반영한 주차별 체크리스트를 생성해드려요
            </p>
            <button
              onClick={onDeepDive}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors">
              심화 로드맵 생성하기 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
