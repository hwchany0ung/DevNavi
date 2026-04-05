import PropTypes from 'prop-types'

/**
 * CompletionToast — 태스크 완료 시 우하단에 표시되는 피드백 토스트
 * props:
 *   message  (string)  — 표시할 메시지
 *   visible  (boolean) — 부모가 제어하는 표시 여부
 */
export default function CompletionToast({ message, visible }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed bottom-6 right-6 z-50
        flex items-center gap-2
        px-5 py-3
        bg-indigo-600 text-white text-sm font-semibold
        rounded-2xl shadow-lg
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <span>🎉</span>
      <span>{message}</span>
    </div>
  )
}

CompletionToast.propTypes = {
  message: PropTypes.string.isRequired,
  visible: PropTypes.bool.isRequired,
}
