import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useTheme } from '../../contexts/ThemeContext'

const COLS = 7  // 7열 고정 그리드

// 인라인 스타일용 색상 (Tailwind 빌드 purge 영향 없음)
const LIGHT_EMPTY    = '#e5e7eb'
const LIGHT_DONE     = '#4ade80'
const DARK_EMPTY     = 'rgba(255,255,255,0.08)'
const DARK_DONE      = '#16a34a'

/**
 * 잔디 달력 — 월별 태스크 히트맵
 *
 * @param {Array}  months      로드맵 전체 months 배열
 * @param {number} activeMonth 현재 선택된 월 (1-based)
 * @param {Set}    doneSet     완료 태스크 ID 집합 ("월-주-태스크인덱스")
 * @param {number} totalDone   전체 완료 태스크 수
 */
export default function GrassCalendar({ months = [], activeMonth = 1, doneSet = new Set(), totalDone = 0 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const emptyColor = isDark ? DARK_EMPTY : LIGHT_EMPTY
  const doneColor  = isDark ? DARK_DONE  : LIGHT_DONE

  // 현재 월의 태스크를 순서대로 평탄화
  const { cells, totalInMonth } = useMemo(() => {
    const monthData = months.find((m) => m.month === activeMonth)
    if (!monthData) return { cells: [], totalInMonth: 0 }

    const items = []
    monthData.weeks.forEach((w) => {
      w.tasks.forEach((task, ti) => {
        const id = `${monthData.month}-${w.week}-${ti}`
        items.push({ id, label: task.content ?? task.title ?? task })
      })
    })
    return { cells: items, totalInMonth: items.length }
  }, [months, activeMonth])

  // 7열 그리드를 채우기 위해 빈 패딩 셀 추가
  const paddedCells = useMemo(() => {
    const remainder = totalInMonth % COLS
    const padCount  = remainder === 0 ? 0 : COLS - remainder
    const padding   = Array.from({ length: padCount }, (_, i) => ({ id: `__pad_${i}`, label: null }))
    return [...cells, ...padding]
  }, [cells, totalInMonth])

  const doneInMonth = useMemo(
    () => cells.filter((c) => doneSet.has(c.id)).length,
    [cells, doneSet]
  )

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 dark:text-white/80">🌱 활동 기록</p>
        <p className="text-xs text-gray-400 dark:text-white/40">{doneInMonth}/{totalInMonth}개</p>
      </div>

      {/* 서브타이틀 */}
      <p className="text-[10px] text-gray-400 dark:text-white/30">{activeMonth}월차</p>

      {/* 태스크 그리드 */}
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {paddedCells.map((cell) => (
          <TaskCell
            key={cell.id}
            cell={cell}
            isDone={cell.label !== null && doneSet.has(cell.id)}
            emptyColor={emptyColor}
            doneColor={doneColor}
          />
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 justify-end">
        <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: emptyColor }} />
        <span className="text-[10px] text-gray-300 dark:text-white/20">미완료</span>
        <div className="w-3.5 h-3.5 rounded-sm ml-1" style={{ backgroundColor: doneColor }} />
        <span className="text-[10px] text-gray-300 dark:text-white/20">완료</span>
      </div>
    </div>
  )
}

GrassCalendar.propTypes = {
  months:      PropTypes.array,
  activeMonth: PropTypes.number,
  doneSet:     PropTypes.instanceOf(Set),
  totalDone:   PropTypes.number,
}

function TaskCell({ cell, isDone, emptyColor, doneColor }) {
  // 패딩 셀 (label === null)
  if (cell.label === null) {
    return <div className="aspect-square rounded-sm bg-transparent" />
  }

  const title = `${cell.label} — ${isDone ? '완료' : '미완료'}`

  return (
    <div
      title={title}
      className="aspect-square rounded-sm cursor-default transition-transform hover:scale-110"
      style={{ backgroundColor: isDone ? doneColor : emptyColor }}
    />
  )
}
