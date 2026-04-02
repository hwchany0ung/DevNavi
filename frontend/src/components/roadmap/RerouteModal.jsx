import { useRef, useEffect } from 'react'

const PERIOD_OPTIONS = [
  { value: '1month',  label: '1개월',  sub: '집중 단기 완성' },
  { value: '3months', label: '3개월',  sub: '균형잡힌 속도' },
  { value: '6months', label: '6개월',  sub: '안정적인 학습' },
  { value: '1year',   label: '12개월', sub: '여유있는 장기 플랜' },
]

/**
 * GPS 재탐색 기간 선택 모달
 */
export default function RerouteModal({
  open,
  completionRate,
  completedCount,
  totalCount,
  reroutePeriod,
  rerouteLoading,
  rerouteError,
  onPeriodChange,
  onConfirm,
  onClose,
}) {
  const confirmBtnRef = useRef(null)

  // 모달 오픈 시 포커스 이동
  useEffect(() => {
    if (open) confirmBtnRef.current?.focus()
  }, [open])

  // 포커스 트래핑
  const containerRef = useRef(null)
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key !== 'Tab') return
    const focusable = containerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus() }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="방향 재설정"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose} />
      <div ref={containerRef} className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 space-y-5">
        {/* 헤더 */}
        <div>
          <p className="text-lg font-black text-gray-900 dark:text-white">🧭 방향 재설정</p>
          <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
            현재 <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round(completionRate)}%</span> 완료 ({completedCount}/{totalCount} 태스크)
          </p>
        </div>

        {/* 남은 기간 선택 */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">남은 목표 기간 선택</p>
          {PERIOD_OPTIONS.map(({ value, label, sub }) => (
            <button
              key={value}
              onClick={() => onPeriodChange(value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left
                ${reroutePeriod === value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20'
                  : 'border-gray-100 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40'
                }`}
            >
              <span className={`text-sm font-bold ${reroutePeriod === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-white/80'}`}>
                {label}
              </span>
              <span className="text-xs text-gray-400 dark:text-white/40">{sub}</span>
            </button>
          ))}
        </div>

        {/* 재탐색 오류 메시지 */}
        {rerouteError && (
          <p className="text-red-500 dark:text-red-400 text-xs px-1">{rerouteError}</p>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10
              text-gray-500 dark:text-white/50 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            취소
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={rerouteLoading}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            재생성 시작
          </button>
        </div>
      </div>
    </div>
  )
}
