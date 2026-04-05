import { useNavigate } from 'react-router-dom'

export default function EmptyRoadmapState({ user }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-5">
      <div className="text-center space-y-5 max-w-sm">
        <div className="text-6xl select-none">🧭</div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            아직 로드맵이 없어요
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/50 leading-relaxed">
            목표 직군과 기간을 입력하면 AI가 주차별 학습 계획을 만들어드려요.
          </p>
        </div>
        {!user && (
          <p className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl px-4 py-2">
            로그인하면 로드맵이 저장돼요
          </p>
        )}
        <button
          onClick={() => navigate('/onboarding')}
          className="px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          첫 로드맵 만들기 →
        </button>
      </div>
    </div>
  )
}
