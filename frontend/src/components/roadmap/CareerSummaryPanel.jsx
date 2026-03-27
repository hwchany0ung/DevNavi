/**
 * 커리어 분석 패널 — 온보딩 결과 요약 및 로드맵 내 재열람용
 * Props:
 *   summary  : { skills_to_learn, certs_to_get, appeal_points, career_message }
 *   onClose? : 닫기 콜백 (모달 모드에서 사용)
 */
export default function CareerSummaryPanel({ summary, onClose }) {
  if (!summary) return null

  const priorityColor = (p) => {
    if (p === 1) return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700/40'
    if (p === 2) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/40'
    if (p === 3) return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40'
    return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/10 dark:text-white/50 dark:border-white/10'
  }

  const priorityLabel = (p) => {
    if (p === 1) return '필수'
    if (p === 2) return '권장'
    if (p === 3) return '추천'
    return `P${p}`
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white">📊 커리어 분석 결과</h2>
          <p className="text-xs text-gray-400 dark:text-white/50 mt-0.5">AI가 분석한 나의 학습 우선순위</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-300 dark:text-white/30 hover:text-gray-500 dark:hover:text-white/60 transition-colors mt-0.5 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Q1: 배워야 할 스킬 ── */}
      <section>
        <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest mb-2.5">
          🎯 우선 학습 스킬
        </p>
        <div className="space-y-2">
          {(summary.skills_to_learn ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/40 px-1">분석된 스킬 항목이 없어요.</p>
          ) : (
            (summary.skills_to_learn ?? []).map((item) => (
              <div key={item.name}
                className="flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${priorityColor(item.priority)}`}>
                  {priorityLabel(item.priority)}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-gray-800 dark:text-white/90">{item.name}</span>
                  <span className="text-xs text-gray-400 dark:text-white/40 ml-2">{item.reason}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Q2: 취득 추천 자격증 ── */}
      {(summary.certs_to_get ?? []).length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest mb-2.5">
            📜 추천 자격증
          </p>
          <div className="space-y-2">
            {summary.certs_to_get.map((item) => (
              <div key={item.name}
                className="flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 shadow-sm">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${priorityColor(item.priority)}`}>
                  {priorityLabel(item.priority)}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-gray-800 dark:text-white/90">{item.name}</span>
                  <span className="text-xs text-gray-400 dark:text-white/40 ml-2">{item.why}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Q3: 어필 포인트 ── */}
      {(summary.appeal_points ?? []).length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest mb-2.5">
            💼 회사 지원 어필 포인트
          </p>
          <ul className="space-y-2">
            {summary.appeal_points.map((point, i) => (
              <li key={i}
                className="flex items-start gap-2.5 px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <span className="w-4 h-4 rounded-full bg-indigo-200 dark:bg-indigo-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                </span>
                <span className="text-sm text-indigo-800 dark:text-indigo-300 font-medium leading-snug">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 응원 메시지 ── */}
      {summary.career_message && (
        <div className="px-4 py-3.5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10
          rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-center">
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 leading-snug">
            ✨ {summary.career_message}
          </p>
        </div>
      )}
    </div>
  )
}
