import { useMemo } from 'react'
import PropTypes from 'prop-types'

/**
 * 주간 진도율 시각화 — activeMonth 기준 주차별 완료율 바
 *
 * @param {Array}  months      로드맵 전체 months 배열
 * @param {number} activeMonth 현재 선택된 월 (1-based)
 * @param {Set}    doneSet     완료 태스크 ID 집합 ("월-주-태스크인덱스")
 */
export default function WeeklyProgressBar({ months = [], activeMonth = 1, doneSet = new Set() }) {
  const weekStats = useMemo(() => {
    const monthData = months.find((m) => m.month === activeMonth)
    if (!monthData) return []

    return monthData.weeks.map((w) => {
      const total = w.tasks.length
      const done = w.tasks.filter((_, ti) =>
        doneSet.has(`${monthData.month}-${w.week}-${ti}`)
      ).length
      const rate = total > 0 ? Math.round((done / total) * 100) : 0
      return { week: w.week, total, done, rate }
    })
  }, [months, activeMonth, doneSet])

  if (weekStats.length === 0) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 space-y-3">
      {/* 헤더 */}
      <p className="text-xs font-bold text-gray-700 dark:text-white/80">📊 주간 진도율</p>

      {/* 주차별 바 */}
      <div className="space-y-2">
        {weekStats.map(({ week, total, done, rate }) => {
          const isAllDone = total > 0 && done === total
          const barColor = isAllDone
            ? 'bg-green-400 dark:bg-green-500'
            : 'bg-indigo-400 dark:bg-indigo-500'
          const labelColor = isAllDone
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-500 dark:text-white/50'

          return (
            <div key={week} className="space-y-1">
              {/* 주차 레이블 + 수치 */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-600 dark:text-white/60">
                  {week}주차
                  {isAllDone && (
                    <span className="ml-1 text-green-500 dark:text-green-400">✓</span>
                  )}
                </span>
                <span className={`text-[11px] font-semibold ${labelColor}`}>
                  {rate}% ({done}/{total})
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${rate}%` }}
                  role="progressbar"
                  aria-valuenow={rate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${week}주차 ${rate}%`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

WeeklyProgressBar.propTypes = {
  months:      PropTypes.array,
  activeMonth: PropTypes.number,
  doneSet:     PropTypes.instanceOf(Set),
}
