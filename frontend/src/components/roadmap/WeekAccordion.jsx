import { memo, useState } from 'react'
import TaskItem from './TaskItem'

/**
 * 주차 아코디언 — WeekPlan 1개
 */
// 이 주차에 속한 task_id 중 하나라도 done 상태가 바뀌었을 때만 리렌더.
// doneSet은 toggle마다 새 Set 참조가 생성되므로 기본 memo(===)로는 매 toggle마다
// 모든 WeekAccordion이 리렌더됨 — custom comparator로 실제 변경 여부만 비교.
function _arePropsEqual(prev, next) {
  if (prev.week !== next.week || prev.monthIdx !== next.monthIdx || prev.onToggle !== next.onToggle) return false
  return prev.week.tasks.every((_, ti) => {
    const id = `${prev.monthIdx}-${prev.week.week}-${ti}`
    return prev.doneSet.has(id) === next.doneSet.has(id)
  })
}

const WeekAccordion = memo(function WeekAccordion({ week, monthIdx, doneSet, onToggle }) {
  const total = week.tasks.length
  const doneCount = week.tasks.filter((_, ti) => doneSet.has(`${monthIdx}-${week.week}-${ti}`)).length
  const allDone = doneCount === total

  const [open, setOpen] = useState(true)

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors
      ${allDone
        ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/10'
        : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5'
      }`}>
      {/* 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`week-tasks-${monthIdx}-${week.week}`}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {/* 주차 뱃지 */}
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
            ${allDone ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/85'}`}>
            {week.week}
          </span>
          <span className={`font-semibold text-sm ${allDone ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-white/80'}`}>
            {week.week}주차
          </span>
          {allDone && (
            <span className="text-indigo-500 text-xs font-medium">✓ 완료</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* 진행 바 */}
          <div className="w-20 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden hidden sm:block">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-white/70">{doneCount}/{total}</span>
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-white/70 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 16 16">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* 태스크 목록 */}
      {open && (
        <div id={`week-tasks-${monthIdx}-${week.week}`} className="px-2 pb-3 space-y-0.5">
          {week.tasks.map((task, ti) => {
            const taskId = `${monthIdx}-${week.week}-${ti}`
            return (
              <TaskItem
                key={taskId}
                task={task}
                taskId={taskId}
                done={doneSet.has(taskId)}
                onToggle={onToggle}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}, _arePropsEqual)

export default WeekAccordion
