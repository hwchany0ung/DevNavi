import { useRef, useEffect } from 'react'
import CareerSummaryPanel from './CareerSummaryPanel'

/**
 * 커리어 분석 모달
 */
export default function CareerSummaryModal({ open, summary, onClose }) {
  const closeBtnRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (open) closeBtnRef.current?.focus()
  }, [open])

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

  if (!open || !summary) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog" aria-modal="true" aria-label="커리어 분석"
      onKeyDown={handleKeyDown}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose} />
      {/* 패널 */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl
          max-h-[85vh] overflow-y-auto p-6 space-y-2"
      >
        <CareerSummaryPanel
          summary={summary}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
