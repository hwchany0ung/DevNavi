import { memo } from 'react'

/**
 * 월 네비게이션 — 좌측 사이드바 하단 스크롤 리스트
 * React.memo로 감싸 불필요한 재렌더링 방지 (I22)
 */
const MonthTimeline = memo(function MonthTimeline({ months, activeMonth, doneSet, onSelect }) {
  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold text-gray-400 dark:text-white/60 uppercase tracking-widest px-1 mb-2">
        월별 로드맵
      </p>
      {months.map((m) => {
        // 해당 월 태스크 전체·완료 수
        let total = 0, done = 0
        m.weeks.forEach((w) => {
          w.tasks.forEach((_, ti) => {
            const id = `${m.month}-${w.week}-${ti}`
            total++
            if (doneSet.has(id)) done++
          })
        })
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        const isActive = activeMonth === m.month
        const isComplete = pct === 100

        return (
          <button
            key={m.month}
            onClick={() => onSelect(m.month)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors min-h-[44px]
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white/85'
              }`}
          >
            {/* 월 번호 */}
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0
              ${isActive ? 'bg-indigo-500 text-white' : isComplete ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/75'}`}>
              {m.month}
            </span>

            {/* 테마 */}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-gray-700 dark:text-white/80'}`}>
                {m.month}월차
              </p>
              <p className={`text-xs truncate ${isActive ? 'text-indigo-200' : 'text-gray-400 dark:text-white/70'}`}>
                {m.theme}
              </p>
            </div>

            {/* 진행률 */}
            <span className={`text-xs shrink-0 ${isActive ? 'text-indigo-200' : 'text-gray-400 dark:text-white/70'}`}>
              {pct}%
            </span>
          </button>
        )
      })}
    </nav>
  )
})

export default MonthTimeline
