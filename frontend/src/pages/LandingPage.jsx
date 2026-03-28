import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { request } from '../lib/api'
import AuthModal from '../components/auth/AuthModal'
import ThemeToggle from '../components/common/ThemeToggle'

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

/* ── 미니 로드맵 미리보기 컴포넌트 (항상 다크 스타일 유지) ── */
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
  const { user, loading, signOut } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    document.title = 'DevNavi — AI 맞춤 커리어 로드맵'
  }, [])

  // 관리자 여부 서버에서 확인 (로그인 시에만)
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    request('/admin/me', { headers: { Authorization: `Bearer ${user.accessToken}` } })
      .then(() => setIsAdmin(true))
      .catch((err) => {
        console.error('[isAdmin] /admin/me 실패:', err?.status, err?.message)
        setIsAdmin(false)
      })
  }, [user])

  // 자동 리다이렉트 제거 — '내 로드맵' 버튼으로 직접 이동하는 방식으로 변경

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: isDark ? '#080b12' : '#ffffff' }}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: isDark ? '#164e63' : '#e0e7ff', borderTopColor: isDark ? '#22d3ee' : '#6366f1' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden transition-colors"
      style={{
        backgroundColor: isDark ? '#080b12' : '#ffffff',
        backgroundImage: isDark
          ? 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)'
          : undefined,
      }}
    >

      {/* 네비게이션 */}
      <nav className="relative z-10 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-lg font-black tracking-tight">
          <span style={{ color: isDark ? '#ffffff' : '#111827' }}>Dev</span>
          <span style={{ color: isDark ? '#22d3ee' : '#6366f1' }}>Navi</span>
        </span>
        <div className="flex items-center gap-6">
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-sm transition-colors hidden sm:block"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }}>
            기능
          </button>
          <button
            onClick={() => navigate('/onboarding')}
            className="text-sm transition-colors hidden sm:block"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }}>
            시작하기
          </button>
          <ThemeToggle />
          {user ? (
            /* 로그인 상태 */
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // localStorage에서 최신 로드맵 ID 탐색
                  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                  const localKeys = Object.keys(localStorage)
                    .filter(k => k.startsWith('devnavi_roadmap_'))
                    .sort()
                  if (localKeys.length > 0) {
                    const id = localKeys[localKeys.length - 1].replace('devnavi_roadmap_', '')
                    if (UUID_RE.test(id)) { navigate(`/roadmap/${id}`); return }
                  }
                  // localStorage 없으면 서버에서 조회
                  request('/roadmap/my', { headers: { Authorization: `Bearer ${user.accessToken}` } })
                    .then(({ roadmap_id }) => navigate(roadmap_id ? `/roadmap/${roadmap_id}` : '/onboarding'))
                    .catch((err) => {
                      console.warn('[내 로드맵] /roadmap/my 조회 실패, 온보딩으로 이동:', err?.message)
                      navigate('/onboarding')
                    })
                }}
                className="text-sm px-4 py-2 rounded-xl font-bold text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}>
                내 로드맵
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#fecaca'}`,
                    color: isDark ? '#f87171' : '#dc2626',
                  }}>
                  관리자
                </button>
              )}
              <button
                onClick={signOut}
                className="text-sm transition-colors"
                style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
                로그아웃
              </button>
            </div>
          ) : (
            /* 비로그인 상태 */
            <button
              onClick={() => setAuthOpen(true)}
              className="text-sm px-4 py-2 rounded-xl transition-all backdrop-blur-sm"
              style={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`,
                color: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563',
              }}>
              로그인
            </button>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center
        gap-12 lg:gap-16 px-6 py-12 max-w-6xl mx-auto w-full">

        {/* 좌측 텍스트 */}
        <div className="flex-1 flex flex-col items-start max-w-xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
            style={{
              background: isDark ? 'rgba(6,182,212,0.1)' : '#eef2ff',
              border: `1px solid ${isDark ? 'rgba(6,182,212,0.2)' : '#c7d2fe'}`,
              color: isDark ? '#22d3ee' : '#6366f1',
            }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: isDark ? '#22d3ee' : '#6366f1' }} />
            AI 기반 맞춤 커리어 로드맵
          </div>

          <h1 className="text-4xl sm:text-5xl font-black leading-[1.15] mb-5"
            style={{ color: isDark ? '#ffffff' : '#111827' }}>
            어떤 개발자가<br />될지, AI가<br />
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #6366f1, #22d3ee)' }}>
              길을 만들어 드립니다
            </span>
          </h1>

          <p className="text-base leading-relaxed mb-8 max-w-md"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }}>
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
              className="px-6 py-3.5 font-bold text-sm rounded-xl transition-all"
              style={{
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb'}`,
                color: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563',
              }}>
              로그인
            </button>
          </div>

          <p className="mt-4 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>
            회원가입 없이 미리보기 가능 · 로드맵 저장은 로그인 필요
          </p>

          {/* 통계 */}
          <div className="flex items-center gap-8 mt-10 pt-8 w-full"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6'}` }}>
            {[
              { value: '9+', label: '지원 직군' },
              { value: '즉시', label: '로드맵 생성' },
              { value: '무료', label: '기본 이용' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-xl font-black" style={{ color: isDark ? '#ffffff' : '#111827' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 미리보기 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-4">
          <RoadmapPreview />
          <p className="text-xs text-gray-400 dark:text-white/25 text-center">↑ 클릭해서 탭 전환 가능한 실제 미리보기</p>
        </div>
      </main>

      {/* 기능 섹션 */}
      <section id="features" className="relative z-10 px-6 py-16 max-w-6xl mx-auto w-full"
        style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-center"
          style={{ color: isDark ? '#22d3ee' : '#6366f1' }}>
          Features
        </p>
        <h2 className="text-2xl font-black text-center mb-10"
          style={{ color: isDark ? '#ffffff' : '#111827' }}>
          개발자 커리어를 위한 모든 것
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '🎯',
              title: '맞춤 로드맵',
              desc: '직군·기간·수준에 맞춰 월별·주별 학습 계획 자동 생성',
              darkBg: 'rgba(99,102,241,0.15)',
              darkBorder: 'rgba(99,102,241,0.2)',
              lightBg: '#eef2ff',
              lightBorder: '#c7d2fe',
            },
            {
              icon: '📊',
              title: '진행률 추적',
              desc: '완료 태스크 체크 + 잔디 캘린더로 학습 습관 시각화',
              darkBg: 'rgba(6,182,212,0.15)',
              darkBorder: 'rgba(6,182,212,0.2)',
              lightBg: '#ecfeff',
              lightBorder: '#a5f3fc',
            },
            {
              icon: '🔀',
              title: '방향 재설정',
              desc: '중간에 방향이 바뀌어도 현재 상황 맞춤으로 즉시 재생성',
              darkBg: 'rgba(139,92,246,0.15)',
              darkBorder: 'rgba(139,92,246,0.2)',
              lightBg: '#f5f3ff',
              lightBorder: '#ddd6fe',
            },
          ].map(({ icon, title, desc, darkBg, darkBorder, lightBg, lightBorder }) => (
            <div key={title}
              className="rounded-2xl p-5 space-y-2"
              style={{
                background: isDark ? darkBg : lightBg,
                border: `1px solid ${isDark ? darkBorder : lightBorder}`,
              }}>
              <span className="text-2xl">{icon}</span>
              <h3 className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#6b7280' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="relative z-10 py-6 text-center text-xs"
        style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}`,
          color: isDark ? 'rgba(255,255,255,0.25)' : '#9ca3af',
        }}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} DevNavi. All rights reserved.</span>
          <a href="/terms"   className="hover:opacity-70 transition-opacity">이용약관</a>
          <a href="/privacy" className="hover:opacity-70 transition-opacity">개인정보처리방침</a>
          <a href="mailto:support@devnavi.kr" className="hover:opacity-70 transition-opacity">문의</a>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
