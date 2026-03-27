import { useMemo } from 'react'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKS_TO_SHOW = 26  // 약 6개월

/**
 * 잔디 달력 (GitHub-style activity heatmap)
 *
 * @param {Array}  activity  [{ activity_date: "2025-03-01", count: 3 }, ...]
 * @param {number} totalDone 전체 완료 태스크 수
 */
export default function GrassCalendar({ activity = [], totalDone = 0 }) {
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
                <Cell key={di} day={day} maxCount={maxCount} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px] text-gray-300 dark:text-white/20">적음</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div key={level} className={`w-3.5 h-3.5 rounded-sm ${levelColor(level)}`} />
        ))}
        <span className="text-[10px] text-gray-300 dark:text-white/20">많음</span>
      </div>
    </div>
  )
}

function Cell({ day, maxCount }) {
  if (!day) {
    return <div className="w-3.5 h-3.5 rounded-sm bg-transparent" />
  }
  const level = day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / Math.max(maxCount, 1)) * 4))
  const title = `${day.date}: ${day.count}개 완료`

  return (
    <div
      title={title}
      className={`w-3.5 h-3.5 rounded-sm cursor-default transition-transform hover:scale-125 ${levelColor(level)}`}
    />
  )
}

function levelColor(level) {
  return [
    'bg-gray-100 dark:bg-white/10',        // 0: 없음
    'bg-emerald-200 dark:bg-emerald-900',  // 1: 1개
    'bg-emerald-400 dark:bg-emerald-700',  // 2: 2~3개
    'bg-emerald-500 dark:bg-emerald-500',  // 3: 4~5개
    'bg-emerald-700 dark:bg-emerald-300',  // 4: 6개+
  ][level]
}

/**
 * activity 배열 → 주×요일 2D 그리드 생성
 * grid[weekIndex][dayIndex(0=일~6=토)] = { date, count } | null
 */
function buildGrid(activity, weeks) {
  // date → count map
  const map = {}
  activity.forEach(({ activity_date, count }) => {
    map[activity_date] = count
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 오늘 기준으로 weeks*7일 전 일요일부터 시작
  const totalDays = weeks * 7
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - totalDays + 1)
  // 해당 주의 일요일로 맞춤
  startDate.setDate(startDate.getDate() - startDate.getDay())

  let maxCount = 1
  const grid = []
  let current = new Date(startDate)

  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      if (current > today) {
        week.push(null)
      } else {
        const key = current.toISOString().slice(0, 10)
        const count = map[key] || 0
        if (count > maxCount) maxCount = count
        week.push({ date: key, count })
      }
      current.setDate(current.getDate() + 1)
    }
    grid.push(week)
  }

  return { grid, maxCount }
}
