import { useState } from 'react'
import TaskItem from './TaskItem'

/**
 * 주차 아코디언 — WeekPlan 1개
 */
export default function WeekAccordion({ week, monthIdx, doneSet, onToggle }) {
  const total = week.tasks.length
  const doneCount = week.tasks.filter((_, ti) => doneSet.has(`${monthIdx}-${week.week}-${ti}`)).length
  const allDone = doneCount === total

  const [open, setOpen] = useState(true)

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors
      ${allDone ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100 bg-white'}`}>
      {/* 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {/* 주차 뱃지 */}
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black
            ${allDone ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {week.week}
          </span>
          <span className={`font-semibold text-sm ${allDone ? 'text-indigo-700' : 'text-gray-700'}`}>
            {week.week}주차
          </span>
          {allDone && (
            <span className="text-indigo-500 text-xs font-medium">✓ 완료</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* 진행 바 */}
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden hidden sm:block">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{doneCount}/{total}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 16 16">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* 태스크 목록 */}
      {open && (
        <div className="px-2 pb-3 space-y-0.5">
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
}
