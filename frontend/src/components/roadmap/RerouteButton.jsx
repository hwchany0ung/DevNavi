/**
 * 방향 재설정 버튼 — 완료율 50% 이상, 로드맵당 최대 2회
 */
export default function RerouteButton({ completionRate, rerouteCount, onClick, loading }) {
  if (completionRate < 50) return null   // 50% 미만엔 노출 안 함
  if (rerouteCount >= 2)  return null    // 2회 소진 시 숨김

  const remaining = 2 - rerouteCount

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed
        border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10
        hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50
        transition-colors text-left group"
    >
      <span className="text-xl shrink-0 group-hover:animate-spin-slow">🧭</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
          {loading ? '방향 재설정 중…' : '방향 재설정'}
        </p>
        <p className="text-xs text-indigo-400 dark:text-indigo-400/70">
          {Math.round(completionRate)}% 완료 기준으로 남은 일정을 재조정해드려요 · 잔여 {remaining}회
        </p>
      </div>
      {!loading && (
        <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 16 16">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
