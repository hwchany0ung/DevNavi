import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthModal from '../components/auth/AuthModal'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)

  /* 로그인 상태면 기존 로드맵 or 온보딩으로 이동 */
  useEffect(() => {
    if (loading) return
    if (!user) return

    const keys = Object.keys(localStorage).filter(k => k.startsWith('devnavi_roadmap_'))
    if (keys.length > 0) {
      // 가장 최근에 저장된 로드맵 선택
      const id = keys[keys.length - 1].replace('devnavi_roadmap_', '')
      navigate(`/roadmap/${id}`, { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 네비게이션 */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-xl font-black text-indigo-600 tracking-tight">DevNavi</span>
        <button
          onClick={() => setAuthOpen(true)}
          className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
        >
          로그인
        </button>
      </nav>

      {/* 히어로 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          ✨ AI 기반 맞춤 커리어 로드맵
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight max-w-2xl mb-5">
          어떤 개발자가 될지,<br />
          <span className="text-indigo-600">AI가 길을 만들어 드립니다</span>
        </h1>

        <p className="text-gray-500 text-base sm:text-lg max-w-md mb-10 leading-relaxed">
          목표 직군·기간·현재 수준 3가지만 알려주세요.<br />
          나만의 학습 로드맵을 즉시 생성해 드립니다.
        </p>

        <button
          onClick={() => navigate('/onboarding')}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base rounded-2xl
            shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95"
        >
          무료로 시작하기 →
        </button>

        <p className="mt-4 text-xs text-gray-400">
          회원가입 없이 미리보기 가능 · 로드맵 저장은 로그인 필요
        </p>

        {/* 기능 카드 */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full text-left">
          {[
            {
              icon: '🎯',
              title: '맞춤 로드맵',
              desc: '직군·기간·현재 수준에 맞춰 월별·주별 학습 계획을 자동 생성',
            },
            {
              icon: '📊',
              title: '진행률 추적',
              desc: '완료한 태스크를 체크하고 캘린더로 학습 습관을 시각화',
            },
            {
              icon: '🔀',
              title: 'GPS 재탐색',
              desc: '중간에 방향이 바뀌어도 현재 상황에 맞게 로드맵을 즉시 재생성',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-gray-50 rounded-2xl p-5 space-y-2">
              <span className="text-2xl">{icon}</span>
              <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* 푸터 */}
      <footer className="py-6 border-t border-gray-100 text-center text-xs text-gray-400 space-x-4">
        <span>© 2025 DevNavi</span>
        <a href="/terms" className="hover:text-gray-600 transition-colors">이용약관</a>
        <a href="/privacy" className="hover:text-gray-600 transition-colors">개인정보처리방침</a>
        <a href="mailto:support@devnavi.kr" className="hover:text-gray-600 transition-colors">문의</a>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
