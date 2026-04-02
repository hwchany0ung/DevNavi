import { useState, useEffect } from 'react'

/**
 * 전체 로드맵 생성 중 로딩 화면
 */
export default function FullRoadmapLoading({ progress }) {
  const [timerProgress, setTimerProgress] = useState(0)

  // Lambda/CloudFront SSE 버퍼링으로 청크가 한꺼번에 도착할 수 있어
  // 청크 카운트 기반 progress가 0에 머무는 문제를 타이머로 보완
  useEffect(() => {
    const DURATION = 75000 // 75초에 90%까지 (ease-out 곡선)
    const start = Date.now()
    const id = setInterval(() => {
      const ratio = Math.min((Date.now() - start) / DURATION, 1)
      // ease-out: 처음엔 빠르게, 마지막엔 느리게
      setTimerProgress(Math.round(90 * (1 - Math.pow(1 - ratio, 2))))
    }, 600)
    return () => clearInterval(id)
  }, [])

  // 청크 기반 progress와 타이머 중 더 큰 값 사용
  const display = Math.max(progress, timerProgress)

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm p-8 text-center space-y-5">
      <div className="flex gap-1 justify-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-3 h-3 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div>
        <p className="text-gray-700 dark:text-white/80 font-bold text-sm">
          AI가 맞춤 로드맵을 생성하고 있어요 ✨
        </p>
        <p className="text-gray-400 dark:text-white/70 text-xs mt-1">
          스킬·목표 회사·학습 시간을 모두 반영 중…
        </p>
      </div>
      {/* 진행 바 */}
      <div className="w-full h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${display}%` }}
        />
      </div>
      <p className="text-xs text-indigo-400 font-medium">{display}%</p>
    </div>
  )
}
