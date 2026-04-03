import { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const MAX_LENGTH = 200

/**
 * QAInput — 하단 고정 질문 입력폼
 *
 * Props:
 *   onSubmit  — (question: string) => void
 *   disabled  — 스트리밍 중 true
 */
export default function QAInput({ onSubmit, disabled = false }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  // 패널이 열릴 때 포커스
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isOverLimit) return
    onSubmit(trimmed)
    setValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const remaining = MAX_LENGTH - value.length
  const isOverLimit = remaining < 0

  return (
    <div className="border-t border-gray-100 dark:border-white/10 p-3 bg-white dark:bg-gray-900">
      <div className={`
        flex flex-col gap-2 rounded-xl border transition-colors
        ${disabled
          ? 'border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5'
          : 'border-gray-200 dark:border-white/15 bg-white dark:bg-gray-800 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50'
        }
      `}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'AI가 답변 중입니다...' : '궁금한 점을 입력하세요 (Enter로 전송)'}
          maxLength={MAX_LENGTH + 1}
          rows={3}
          className="
            w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm
            text-gray-800 dark:text-white/90
            placeholder-gray-400 dark:placeholder-white/30
            focus:outline-none
            disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-white/30
          "
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-400 dark:text-white/30'}`}>
            {remaining < 50 ? `${remaining}자 남음` : ''}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || isOverLimit}
            className="
              px-3 py-1 rounded-lg text-xs font-semibold transition-colors
              bg-indigo-600 text-white
              hover:bg-indigo-700
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            {disabled ? '답변 중...' : '전송'}
          </button>
        </div>
      </div>
    </div>
  )
}

QAInput.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

