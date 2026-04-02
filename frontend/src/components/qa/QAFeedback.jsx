// Design Ref: §5.1 — QAFeedback: Thumbs up/down 독립 컴포넌트
// Plan SC: SC-03 — 답변 만족도 측정
import { useState } from 'react'
import PropTypes from 'prop-types'
import { useFeedback } from '../../hooks/useFeedback'

export default function QAFeedback({ taskId, question, answer, isLoggedIn }) {
  const [rating, setRating] = useState(null) // null | 'up' | 'down'
  const { sendFeedback } = useFeedback()

  const handleClick = async (value) => {
    if (!isLoggedIn) return
    const newRating = rating === value ? null : value
    setRating(newRating)
    if (newRating) {
      await sendFeedback({ taskId, question, answer, rating: newRating })
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-white/10">
      <span className="text-xs text-gray-400 dark:text-white/50">답변이 도움이 됐나요?</span>
      <div className="flex gap-1">
        <button
          onClick={() => handleClick('up')}
          disabled={!isLoggedIn}
          title={!isLoggedIn ? '로그인 후 이용 가능' : '도움됨'}
          className={`p-1.5 rounded-lg text-sm transition-colors
            ${rating === 'up'
              ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10'}
            disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="도움됨"
          aria-pressed={rating === 'up'}
        >
          👍
        </button>
        <button
          onClick={() => handleClick('down')}
          disabled={!isLoggedIn}
          title={!isLoggedIn ? '로그인 후 이용 가능' : '아쉬움'}
          className={`p-1.5 rounded-lg text-sm transition-colors
            ${rating === 'down'
              ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
              : 'text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10'}
            disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="아쉬움"
          aria-pressed={rating === 'down'}
        >
          👎
        </button>
      </div>
    </div>
  )
}

QAFeedback.propTypes = {
  taskId:     PropTypes.string.isRequired,
  question:   PropTypes.string.isRequired,
  answer:     PropTypes.string.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
}
