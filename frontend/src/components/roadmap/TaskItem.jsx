const CATEGORY = {
  learn:   { label: '학습',     cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' },
  project: { label: '프로젝트', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' },
  cert:    { label: '자격증',   cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' },
}

/**
 * 단일 태스크 아이템 (체크박스 + 카테고리 뱃지)
 */
export default function TaskItem({ task, taskId, done, onToggle }) {
  const cat = CATEGORY[task.category] ?? CATEGORY.learn

  return (
    <label
      onClick={() => onToggle(taskId)}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer
        transition-colors hover:bg-gray-50 dark:hover:bg-white/5 group
        ${done ? 'opacity-60' : ''}`}
    >
      {/* 커스텀 체크박스 */}
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
          transition-colors
          ${done
            ? 'bg-indigo-600 border-indigo-600'
            : 'border-gray-300 dark:border-white/30 group-hover:border-indigo-400'
          }`}
      >
        {done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* 내용 */}
      <span className={`flex-1 text-sm leading-snug ${done ? 'line-through text-gray-400 dark:text-white/30' : 'text-gray-700 dark:text-white/80'}`}>
        {task.content}
      </span>

      {/* 카테고리 뱃지 */}
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cat.cls}`}>
        {cat.label}
      </span>
    </label>
  )
}
