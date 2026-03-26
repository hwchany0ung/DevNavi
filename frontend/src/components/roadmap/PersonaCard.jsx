import ProgressRing from './ProgressRing'

const ROLE_EMOJI = {
  backend: '⚙️', frontend: '🎨', cloud_devops: '☁️', fullstack: '🌐',
  data: '📊', ai_ml: '🤖', security: '🔒', ios_android: '📱', qa: '🧪',
}

/**
 * 페르소나 카드 — 좌측 사이드바 상단
 */
export default function PersonaCard({ roadmap, role, completedCount, totalCount }) {
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const emoji = ROLE_EMOJI[role] ?? '💻'

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg">
      {/* 이모지 + 타이틀 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-indigo-200 text-xs font-medium mb-1">{emoji} 나의 개발자 유형</p>
          <h2 className="font-black text-sm leading-snug break-keep">
            {roadmap.persona_title}
          </h2>
          <p className="text-indigo-200 text-xs mt-1 leading-snug">
            {roadmap.persona_subtitle}
          </p>
        </div>
        <div className="shrink-0">
          <ProgressRing percent={percent} size={64} stroke={6} />
        </div>
      </div>

      {/* 요약 */}
      <p className="mt-3 text-indigo-100 text-xs leading-relaxed border-t border-indigo-500/50 pt-3">
        {roadmap.summary}
      </p>

      {/* 진행 상황 텍스트 */}
      <p className="mt-2 text-indigo-200 text-xs">
        {completedCount} / {totalCount} 완료
      </p>
    </div>
  )
}
