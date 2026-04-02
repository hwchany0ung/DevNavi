import PropTypes from 'prop-types'

/**
 * QAButton — 태스크 행 우측에 렌더되는 "?" AI 질문 버튼
 *
 * Props:
 *   taskId      — "{month}-{week}-{taskIndex}" 형식
 *   taskName    — 태스크 표시명
 *   taskContext — { jobType, month, week, category }
 *   onOpen      — (taskId, taskContext) => void
 */
export default function QAButton({ taskId, taskName, taskContext, onOpen }) {
  const handleClick = (e) => {
    e.stopPropagation()
    onOpen(taskId, { ...taskContext, taskName })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${taskName} AI 질문`}
      title="AI에게 질문하기"
      className="
        ml-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
        text-xs font-bold leading-none
        text-gray-400 dark:text-white/40
        border border-gray-200 dark:border-white/15
        hover:text-indigo-600 dark:hover:text-indigo-400
        hover:border-indigo-300 dark:hover:border-indigo-500/50
        hover:bg-indigo-50 dark:hover:bg-indigo-500/10
        transition-colors duration-150
      "
    >
      ?
    </button>
  )
}

QAButton.propTypes = {
  taskId:      PropTypes.string.isRequired,
  taskName:    PropTypes.string.isRequired,
  taskContext: PropTypes.shape({
    jobType:  PropTypes.string,
    month:    PropTypes.number,
    week:     PropTypes.number,
    category: PropTypes.string,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
}
