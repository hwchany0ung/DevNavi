import { useMemo } from 'react'
import PropTypes from 'prop-types'
import { useTheme } from '../../contexts/ThemeContext'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKS_TO_SHOW = 26  // 약 6개월

// 인라인 스타일용 색상 (Tailwind 빌드 purge 영향 없음)
const LIGHT_COLORS = ['#e5e7eb', '#bbf7d0', '#4ade80', '#16a34a', '#14532d']
const DARK_COLORS  = ['rgba(255,255,255,0.08)', '#064e3b', '#065f46', '#16a34a', '#4ade80']

/**
 * 잔디 달력 (GitHub-style activity heatmap)
 *
 * @param {Array}  activity  [{ activity_date: "2025-03-01", count: 3 }, ...]
 * @param {number} totalDone 전체 완료 태스크 수
 */
export default function GrassCalendar({ activity = [], totalDone = 0 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS

  // FI-10: activity 참조만으로 충분 (buildGrid 내부에서 Date 객체를 새로 생성)
  const { grid, maxCount } = useMemo(() => buildGrid(activity, WEEKS_TO_SHOW), [activity])

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 dark:text-white/80">🌱 활동 기록</p>
        <p className="text-xs text-gray-400 dark:text-white/40">{totalDone}개 완료</p>
      </div>

      {/* 달력 그리드 */}
      <div className="overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {/* 요일 라벨 */}
          <div className="flex flex-col gap-[3px] mr-1">
            {DAYS.map((d, i) => (
              <div key={i} className="w-3.5 h-3.5 flex items-center justify-center
                text-[8px] text-gray-300 dark:text-white/20">
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>

          {/* 주별 컬럼 */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <Cell key={di} day={day} maxCount={maxCount} colors={colors} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px] text-gray-300 dark:text-white/20">적음</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="w-3.5 h-3.5 rounded-sm"
            style={{ backgroundColor: colors[level] }}
          />
        ))}
        <span className="text-[10px] text-gray-300 dark:text-white/20">많음</span>
      </div>
    </div>
  )
}

GrassCalendar.propTypes = {
  activity:  PropTypes.arrayOf(PropTypes.shape({
    activity_date: PropTypes.string.isRequired,
    count:         PropTypes.number.isRequired,
  })),
  totalDone: PropTypes.number,
}

function Cell({ day, maxCount, colors }) {
  if (!day) {
    return <div className="w-3.5 h-3.5 rounded-sm bg-transparent" />
  }
  const level = day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / Math.max(maxCount, 1)) * 4))
  const title = `${day.date}: ${day.count}개 완료`

  return (
    <div
      title={title}
      className="w-3.5 h-3.5 rounded-sm cursor-default transition-transform hover:scale-125"
      style={{ backgroundColor: colors[level] }}
    />
  )
}

/** Date 객체를 로컬 시간 기준 YYYY-MM-DD 문자열로 변환 (toISOString은 UTC 기준이라 하루 어긋날 수 있음) */
function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * activity 배열 → 주×요일 2D 그리드 생성
 */
function buildGrid(activity, weeks) {
  const map = {}
  activity.forEach(({ activity_date, count }) => {
    map[activity_date] = count
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalDays = weeks * 7
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - totalDays + 1)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  let maxCount = 1
  const grid = []
  // FI-10: 루프 내에서 Date를 mutation하지 않고 타임스탬프 산술 사용
  const startMs = startDate.getTime()
  const todayMs = today.getTime()
  const dayMs = 86400000

  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const cellMs = startMs + (w * 7 + d) * dayMs
      if (cellMs > todayMs) {
        week.push(null)
      } else {
        const cellDate = new Date(cellMs)
        const key = toLocalDateStr(cellDate)
        const count = map[key] || 0
        if (count > maxCount) maxCount = count
        week.push({ date: key, count })
      }
    }
    grid.push(week)
  }

  return { grid, maxCount }
}
