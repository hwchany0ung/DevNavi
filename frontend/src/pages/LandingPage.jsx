import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthModal from '../components/auth/AuthModal'

/* ── 로드맵 미리보기 목업 데이터 ── */
const PREVIEW_MONTHS = [
  {
    month: 1, theme: '기초 다지기',
    weeks: [
      { title: 'Linux & 네트워크 기초', done: true },
      { title: 'Python 기초 문법 완성', done: true },
      { title: 'Git / GitHub 워크플로우', done: true },
      { title: 'Docker 컨테이너 입문', done: false },
    ],
  },
  {
    month: 2, theme: 'AWS 핵심 서비스',
    weeks: [
      { title: 'EC2 · VPC · IAM 실습', done: false },
      { title: 'S3 · CloudFront 구성', done: false },
      { title: 'RDS · Lambda 연동', done: false },
      { title: 'CloudWatch 모니터링', done: false },
    ],
  },
]

/* ── 미니 로드맵 미리보기 컴포넌트 ── */
function RoadmapPreview() {
  const [activeMonth, setActiveMonth] = useState(0)
  const month = PREVIEW_MONTHS[activeMonth]

  return (
    <div className="w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 text-left select-none">
      {/* 상단 바 */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1a1d27] border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-[11px] text-white/30 font-mono">DevNavi — 클라우드/DevOps · 6개월</span>
      </div>

      <div className="flex h-64">
        {/* 사이드바 */}
        <div className="w-28 bg-[#0d0f18] border-r border-white/10 flex flex-col py-3 gap-1 px-2">
          <p className="text-[9px] text-white/30 uppercase tracking-widest px-2 mb-1">Timeline</p>
          {PREVIEW_MONTHS.map((m, i) => (
            <button
              key={m.month}
              onClick={() => setActiveMonth(i)}
              className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors text-[10px] font-medium
                ${activeMonth === i
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
            >
              <span className="block text-[9px] opacity-60">Month {m.month}</span>
              {m.theme}
            </button>
          ))}
          <div className="mt-auto px-2 py-2 border-t border-white/10">
            <div className="text-[9px] text-white/30 mb-1">진행률</div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: '37%' }} />
            </div>
            <div className="text-[9px] text-cyan-400 mt-1">37%</div>
          </div>
        </div>

        {/* 메인 */}
        <div className="flex-1 p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-white/80">Month {month.month} · {month.theme}</span>
            <span className="text-[9px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">4 tasks</span>
          </div>
          <div className="space-y-1.5">
            {month.weeks.map((w, i) => (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors
                ${w.done
                  ? 'bg-cyan-500/10 border-cyan-500/20'
                  : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'}`}>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0
                  ${w.done ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>
                  {w.done && <svg className="w-2 h-2 text-white" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
                </div>
                <span className={`text-[10px] leading-snug ${w.done ? 'text-white/40 line-through' : 'text-white/70'}`}>
                  {w.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 바 */}
      <div className="px-4 py-2.5 bg-[#1a1d27] border-t border-white/10 flex items-center justify-between">
        <span className="text-[9px] text-white/30">🤖 AI 생성 로드맵 · 미리보기</span>
        <span className="text-[9px] text-cyan-400 font-mono animate-pulse">● live</span>
      </div>
    </div>
  )
}

/* ── 메인 랜딩 페이지 ── */
export default function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('devnavi_roadmap_'))
    if (keys.length > 0) {
      const id = keys[keys.length - 1].replace('devnavi_roadmap_', '')
      navigate(`/roadmap/${id}`, { replace: true })
    } else {
      navigate('/onboarding', { replace: true })
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080b12]">
        <div className="w-8 h-8 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col overflow-hidden" style={{
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)',
    }}>

      {/* 네비게이션 */}
      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-lg font-black tracking-tight">
          <span className="text-white">Dev</span><span className="text-cyan-400">Navi</span>
        </span>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-white/50 hover:text-white/90 transition-colors hidden sm:block">기능</a>
          <button
            onClick={() => navigate('/onboarding')}
            className="text-sm text-white/50 hover:text-white/90 transition-colors hidden sm:block"
          >
            시작하기
          </button>
          <button
            onClick={() => setAuthOpen(true)}
            className="text-sm px-4 py-2 border border-white/20 hover:border-white/40 text-white/70 hover:text-white
              rounded-xl transition-all backdrop-blur-sm"
          >
            로그인
          </button>
        </div>
      </nav>

      {/* 히어로 */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center
        gap-12 lg:gap-16 px-6 py-12 max-w-6xl mx-auto w-full">

        {/* 좌측 텍스트 */}
        <div className="flex-1 flex flex-col items-start max-w-xl">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20
            text-cyan-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            AI 기반 맞춤 커리어 로드맵
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.15] mb-5">
            어떤 개발자가<br />될지, AI가<br />
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #22d3ee, #818cf8)' }}>
              길을 만들어 드립니다
            </span>
          </h1>

          <p className="text-white/50 text-base leading-relaxed mb-8 max-w-md">
            목표 직군·기간·현재 수준 3가지만 알려주세요.<br />
            AI가 월별·주별 학습 계획을 즉시 생성합니다.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/onboarding')}
              className="px-6 py-3.5 font-bold text-sm rounded-xl text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}
            >
              무료로 시작하기 →
            </button>
            <button
              onClick={() => setAuthOpen(true)}
              className="px-6 py-3.5 font-bold text-sm rounded-xl border border-white/15
                text-white/70 hover:text-white hover:border-white/30 transition-all"
            >
              로그인
            </button>
          </div>

          <p className="mt-4 text-xs text-white/30">
            회원가입 없이 미리보기 가능 · 로드맵 저장은 로그인 필요
          </p>

          {/* 통계 */}
          <div className="flex items-center gap-8 mt-10 pt-8 border-t border-white/10 w-full">
            {[
              { value: '9+', label: '지원 직군' },
              { value: '즉시', label: '로드맵 생성' },
              { value: '무료', label: '기본 이용' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-xl font-black text-white">{value}</div>
                <div className="text-xs text-white/40 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 미리보기 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4">
          <RoadmapPreview />
          <p className="text-xs text-white/25 text-center">↑ 클릭해서 탭 전환 가능한 실제 미리보기</p>
        </div>
      </main>

      {/* 기능 섹션 */}
      <section id="features" className="px-6 py-16 max-w-6xl mx-auto w-full border-t border-white/[0.06]">
        <p className="text-xs text-cyan-400 font-semibold tracking-widest uppercase mb-3 text-center">Features</p>
        <h2 className="text-2xl font-black text-white text-center mb-10">
          개발자 커리어를 위한 모든 것
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '🎯',
              title: '맞춤 로드맵',
              desc: '직군·기간·수준에 맞춰 월별·주별 학습 계획 자동 생성',
              color: 'from-indigo-500/20 to-indigo-500/5',
              border: 'border-indigo-500/20',
            },
            {
              icon: '📊',
              title: '진행률 추적',
              desc: '완료 태스크 체크 + 잔디 캘린더로 학습 습관 시각화',
              color: 'from-cyan-500/20 to-cyan-500/5',
              border: 'border-cyan-500/20',
            },
            {
              icon: '🔀',
              title: 'GPS 재탐색',
              desc: '중간에 방향이 바뀌어도 현재 상황 맞춤으로 즉시 재생성',
              color: 'from-violet-500/20 to-violet-500/5',
              border: 'border-violet-500/20',
            },
          ].map(({ icon, title, desc, color, border }) => (
            <div key={title}
              className={`bg-gradient-to-b ${color} border ${border} rounded-2xl p-5 space-y-2`}>
              <span className="text-2xl">{icon}</span>
              <h3 className="font-bold text-white text-sm">{title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="py-6 border-t border-white/[0.06] text-center text-xs text-white/25">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span>© 2025 DevNavi. All rights reserved.</span>
          <a href="/terms"   className="hover:text-white/50 transition-colors">이용약관</a>
          <a href="/privacy" className="hover:text-white/50 transition-colors">개인정보처리방침</a>
          <a href="mailto:support@devnavi.kr" className="hover:text-white/50 transition-colors">문의</a>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
