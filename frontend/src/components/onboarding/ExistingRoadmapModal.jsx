import { useEffect, useCallback, useRef } from 'react'

/**
 * 기존 로드맵 존재 안내 모달
 * - 기존 로드맵으로 이동
 * - 기존 로드맵 삭제 후 새로 생성
 */
export default function ExistingRoadmapModal({ roadmapId, onGoExisting, onDeleteAndNew, onClose }) {
  const containerRef = useRef(null)

  // FI-6: ESC 키로 모달 닫기 + 포커스 트래핑
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { (onClose || onGoExisting)(); return }
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
  }, [onClose, onGoExisting])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // FI-6: 모달 오픈 시 첫 버튼에 자동 포커스
  const firstBtnRef = useRef(null)
  useEffect(() => { firstBtnRef.current?.focus() }, [])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
      role="dialog" aria-modal="true" aria-labelledby="existing-roadmap-title">
      <div ref={containerRef} className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm p-7 space-y-5">
        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-2xl">
          🗺️
        </div>

        {/* 제목 */}
        <div>
          <h2 id="existing-roadmap-title" className="text-lg font-black text-gray-900 dark:text-white">
            이미 로드맵이 있어요
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1 leading-relaxed">
            이전에 생성한 로드맵이 저장되어 있습니다.<br />
            어떻게 하시겠어요?
          </p>
        </div>

        {/* 버튼 */}
        <div className="space-y-2.5">
          <button
            ref={firstBtnRef}
            onClick={onGoExisting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-colors"
          >
            기존 로드맵 보러 가기 →
          </button>
          <button
            onClick={onDeleteAndNew}
            className="w-full py-3.5 border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10
              hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400
              font-bold text-sm rounded-2xl transition-colors"
          >
            기존 로드맵 보관 후 새로 만들기
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-white/30">
          보관된 로드맵은 동일한 조건으로 재생성 시 자동 복원됩니다
        </p>
      </div>
    </div>
  )
}
