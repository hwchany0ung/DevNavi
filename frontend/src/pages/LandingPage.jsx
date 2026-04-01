import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { request } from '../lib/api'
import AuthModal from '../components/auth/AuthModal'
import ThemeToggle from '../components/common/ThemeToggle'

import HeroPreview from '../components/landing/HeroPreview'

/* ── 메인 랜딩 페이지 ── */
export default function LandingPage() {
  const { user, loading, signOut } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [authOpen, setAuthOpen] = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)

  /* 테마 헬퍼 */
  const t = (d, l) => isDark ? d : l

  useEffect(() => {
    document.title = 'DevNavi — AI 맞춤 커리어 로드맵'
  }, [])

  useEffect(() => {
    if (!user?.accessToken) { setIsAdmin(false); return }
    request('/admin/me', { headers: { Authorization: `Bearer ${user.accessToken}` } })
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false))
  }, [user])

  const goToMyRoadmap = useCallback(() => {
    if (!user?.accessToken) { navigate('/onboarding'); return }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    try {
      // FI-8: UUID는 사전순 정렬이 시간순과 무관 → 서버 API로 최신 로드맵 조회 우선
      const localKeys = Object.keys(localStorage)
        .filter(k => k.startsWith('devnavi_roadmap_'))
      if (localKeys.length > 0) {
        const id = localKeys[localKeys.length - 1].replace('devnavi_roadmap_', '')
        if (UUID_RE.test(id)) { navigate(`/roadmap/${id}`); return }
      }
    } catch {
      // 프라이빗 브라우징 등 localStorage 접근 불가 → API 폴백
    }
    request('/roadmap/my', { headers: { Authorization: `Bearer ${user.accessToken}` } })
      .then(({ roadmap_id }) => navigate(roadmap_id ? `/roadmap/${roadmap_id}` : '/onboarding'))
      .catch(() => navigate('/onboarding'))
  }, [user, navigate])

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${t('bg-[#07090f]', 'bg-slate-50')}`}>
        <div className="w-8 h-8 border-4 rounded-full animate-spin border-indigo-500/20 border-t-indigo-500" />
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors duration-300
        ${t('bg-[#07090f] text-white', 'bg-slate-50 text-slate-900')}`}
      style={{
        backgroundImage: t(
          'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.12), transparent)',
          'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.06), transparent)',
        ),
      }}
    >
      {/* ────────── NAV ────────── */}
      <nav className={`px-6 py-5 flex items-center justify-between max-w-6xl mx-auto
        ${t('', 'border-b border-slate-200/60 bg-white/80 backdrop-blur sticky top-0 z-40')}`}>
        <span className="text-xl font-black tracking-tight">
          Dev<span className="text-indigo-500">Navi</span>
        </span>
        <div className="flex items-center gap-5">
          <a href="#how"   className={`text-sm transition-colors hidden sm:block ${t('text-white/40 hover:text-white/70', 'text-slate-500 hover:text-slate-800')}`}>기능 소개</a>
          <a href="#proof" className={`text-sm transition-colors hidden sm:block ${t('text-white/40 hover:text-white/70', 'text-slate-500 hover:text-slate-800')}`}>이용 후기</a>
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={goToMyRoadmap}
                className="text-sm px-4 py-2 rounded-xl font-bold text-white
                  bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 transition-opacity active:scale-95">
                내 로드맵
              </button>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all
                    ${t('bg-red-500/15 border border-red-500/30 text-red-400',
                        'bg-red-50 border border-red-200 text-red-600')}`}>
                  관리자
                </button>
              )}
              <button
                onClick={signOut}
                className={`text-sm transition-colors ${t('text-white/40 hover:text-white/70', 'text-slate-500 hover:text-slate-800')}`}>
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className={`text-sm px-4 py-2 rounded-xl transition-all border
                ${t('text-white/70 border-white/20 hover:border-white/30',
                    'text-slate-600 border-slate-200 hover:border-slate-300 bg-white')}`}>
              로그인
            </button>
          )}
        </div>
      </nav>

      {/* ────────── HERO ────────── */}
      <section className="px-6 py-16 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
        <div className="flex-1 max-w-xl">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
            bg-indigo-500/10 border border-indigo-500/20 text-indigo-500`}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            AI가 만드는 나만의 커리어 플랜
          </span>

          <h1 className="mt-6 text-4xl sm:text-5xl font-black leading-[1.15] tracking-tight">
            어떤 개발자가 될지<br />
            <span className={t('text-white/40', 'text-slate-400')}>아직 모르는 게 당연합니다</span>
          </h1>
          <p className="mt-3 text-3xl sm:text-4xl font-black leading-[1.2] tracking-tight">
            3가지만 답하면<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
              오늘부터 할 일이 생깁니다
            </span>
          </p>

          <p className={`mt-6 text-base leading-relaxed max-w-md ${t('text-white/50', 'text-slate-500')}`}>
            목표 직군 · 목표 기간 · 지금 수준.<br />
            이 세 가지로 AI가 주차별 학습 계획을 만들어 드립니다.<br />
            <span className={t('text-white/70', 'text-slate-700')}>"뭘 공부해야 하지?"에서 "이번 주엔 이걸 하면 돼"로.</span>
          </p>

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/onboarding')}
              className="px-6 py-3.5 rounded-xl font-bold text-sm text-white
                bg-gradient-to-r from-indigo-500 to-cyan-500
                hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-indigo-500/20">
              지금 바로 만들어보기 (무료) →
            </button>
            {!user && (
              <button
                onClick={() => setAuthOpen(true)}
                className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-all
                  ${t('text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80',
                      'text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700')}`}>
                로그인
              </button>
            )}
          </div>

          <div className={`mt-10 pt-8 border-t flex items-center gap-8 ${t('border-white/10', 'border-slate-200')}`}>
            {[
              { value: '9개',  label: '직군 지원' },
              { value: '45초', label: '평균 생성 시간' },
              { value: '무료', label: '기본 이용' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className={`text-xl font-black ${t('text-white', 'text-slate-900')}`}>{value}</div>
                <div className={`text-xs mt-0.5 ${t('text-white/35', 'text-slate-400')}`}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0">
          <HeroPreview isDark={isDark} />
        </div>
      </section>

      {/* ────────── PROBLEM ────────── */}
      <section id="problem" className={`px-6 py-20 max-w-6xl mx-auto border-t ${t('border-white/[0.06]', 'border-slate-200')}`}>
        <div className="text-center mb-14">
          <p className={`text-xs font-bold tracking-widest uppercase mb-3 ${t('text-indigo-400', 'text-indigo-500')}`}>
            이런 적 있으셨나요?
          </p>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight">
            로드맵을 찾다가<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
              오히려 더 막막해졌다면
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              emoji: '😵',
              title: '"유튜브 로드맵 영상 다 달라요"',
              desc: '백엔드 로드맵 검색하면 영상마다 추천 스택이 달라서 뭘 믿어야 할지 모르겠음. 결국 아무것도 안 함.',
              darkCls:  'bg-indigo-500/[0.07] border-indigo-500/15',
              lightCls: 'bg-indigo-50 border-indigo-100',
            },
            {
              emoji: '📋',
              title: '"리스트는 있는데 시작을 못 하겠어요"',
              desc: '노션에 공부할 것들 정리는 했는데 "이걸 다 해야 해?" 싶어서 오늘도 유튜브만 봄.',
              darkCls:  'bg-violet-500/[0.07] border-violet-500/15',
              lightCls: 'bg-violet-50 border-violet-100',
            },
            {
              emoji: '🔁',
              title: '"6개월째 기초만 반복하고 있어요"',
              desc: 'JavaScript 기초 강의를 세 번 들었는데 이제 뭘 해야 할지 여전히 모르겠음.',
              darkCls:  'bg-cyan-500/[0.07] border-cyan-500/15',
              lightCls: 'bg-cyan-50 border-cyan-100',
            },
          ].map(({ emoji, title, desc, darkCls, lightCls }) => (
            <div key={title} className={`rounded-2xl p-6 border ${isDark ? darkCls : lightCls}`}>
              <div className="text-3xl mb-4">{emoji}</div>
              <h3 className={`font-bold text-sm mb-2 ${t('text-white', 'text-slate-800')}`}>{title}</h3>
              <p className={`text-xs leading-relaxed ${t('text-white/45', 'text-slate-500')}`}>{desc}</p>
            </div>
          ))}
        </div>

        <p className={`text-center mt-10 text-base ${t('text-white/50', 'text-slate-500')}`}>
          문제는 의지가 아닙니다.<br />
          <span className={`font-semibold ${t('text-white', 'text-slate-900')}`}>오늘 뭘 해야 할지 명확하지 않은 것입니다.</span>
        </p>
      </section>

      {/* ────────── HOW IT WORKS ────────── */}
      <section id="how" className={`px-6 py-20 max-w-6xl mx-auto border-t ${t('border-white/[0.06]', 'border-slate-200')}`}>
        <div className="text-center mb-14">
          <p className={`text-xs font-bold tracking-widest uppercase mb-3 ${t('text-indigo-400', 'text-indigo-500')}`}>
            DevNavi가 하는 일
          </p>
          <h2 className="text-3xl sm:text-4xl font-black">
            막연한 목표를<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
              오늘 할 일로 바꿔드립니다
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
          <div className="hidden sm:block absolute top-10 left-[33%] right-[33%] h-px bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-cyan-500/30" />
          {[
            {
              step: '01', title: '3가지 답변', color: 'from-indigo-500 to-violet-500',
              items: ['목표 직군 (예: 백엔드)', '목표 기간 (예: 6개월)', '지금 수준 (예: Python 기초)'],
            },
            {
              step: '02', title: 'AI 커리어 분석', color: 'from-violet-500 to-purple-500',
              items: ['어떤 스킬을 쌓아야 하는지', '어떤 순서로 배워야 하는지', '얼마나 걸리는지'],
            },
            {
              step: '03', title: '주차별 플랜 완성', color: 'from-purple-500 to-cyan-500',
              items: ['1주차: Git + GitHub 실습', '2주차: Python 미니 프로젝트', '이번 주 할 일이 명확'],
            },
          ].map(({ step, title, items, color }) => (
            <div key={step}
              className={`border rounded-2xl p-6 relative
                ${t('bg-white/[0.03] border-white/10', 'bg-white border-slate-200 shadow-sm')}`}>
              <div className={`text-3xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r ${color}`}>{step}</div>
              <h3 className={`font-bold mb-4 ${t('text-white', 'text-slate-800')}`}>{title}</h3>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className={`flex items-start gap-2 text-sm ${t('text-white/50', 'text-slate-500')}`}>
                    <span className="text-indigo-500 mt-0.5 flex-shrink-0">›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            '✅ 중간에 방향 바뀌어도 지금까지 한 것 유지하며 재설계',
            '✅ 완료 체크 + 진행률 추적으로 동기부여 유지',
            '✅ 직군별 핵심 자격증 · 포트폴리오 프로젝트 포함',
          ].map(text => (
            <div key={text}
              className={`text-sm rounded-xl px-4 py-3 border
                ${t('text-white/50 bg-white/[0.02] border-white/[0.06]', 'text-slate-600 bg-white border-slate-200')}`}>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ────────── SOCIAL PROOF ────────── */}
      <section id="proof" className={`px-6 py-20 max-w-6xl mx-auto border-t ${t('border-white/[0.06]', 'border-slate-200')}`}>
        <div className="text-center mb-14">
          <p className={`text-xs font-bold tracking-widest uppercase mb-3 ${t('text-indigo-400', 'text-indigo-500')}`}>
            실제 사용 후기
          </p>
          <h2 className="text-3xl sm:text-4xl font-black">
            "막막함이{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
              사라졌어요
            </span>"
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              quote: '로드맵 영상을 10개 넘게 봤는데 다 달라서 혼란스러웠어요. DevNavi는 제 상황을 넣으니까 딱 지금 저한테 맞는 게 나오더라고요.',
              name: '비전공자', role: '프론트엔드 전향 준비 중',
            },
            {
              quote: '퇴근 후 2시간밖에 못 하는데, 그 2시간에 뭘 해야 할지 드디어 명확해졌어요. 6개월 계획이 주 단위로 쪼개지니까요.',
              name: '직장인', role: '백엔드 이직 준비 중',
            },
            {
              quote: '처음엔 그냥 써봤는데 지금 3주째 매일 체크하고 있어요. 진행률이 올라가는 게 보이니까 포기 안 하게 되더라고요.',
              name: '대학생', role: '클라우드/DevOps 목표',
            },
          ].map(({ quote, name, role }) => (
            <div key={name}
              className={`border rounded-2xl p-6 flex flex-col gap-4
                ${t('bg-white/[0.03] border-white/10', 'bg-white border-slate-200 shadow-sm')}`}>
              <p className={`text-sm leading-relaxed flex-1 ${t('text-white/60', 'text-slate-600')}`}>"{quote}"</p>
              <div className={`flex items-center gap-3 pt-4 border-t ${t('border-white/10', 'border-slate-100')}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                  {name[0]}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${t('text-white', 'text-slate-800')}`}>{name}</div>
                  <div className={`text-xs ${t('text-white/40', 'text-slate-400')}`}>{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className={`mt-6 text-center text-[11px] ${t('text-white/20', 'text-slate-300')}`}>
          * 실제 사용자 경험을 바탕으로 재구성한 내용입니다.
        </p>
      </section>

      {/* ────────── CTA ────────── */}
      <section className={`px-6 py-24 max-w-3xl mx-auto text-center border-t ${t('border-white/[0.06]', 'border-slate-200')}`}>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
          bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          지금 바로 시작
        </span>
        <h2 className="mt-6 text-3xl sm:text-4xl font-black leading-tight">
          오늘 뭘 공부해야 할지,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
            지금 바로 알 수 있어요
          </span>
        </h2>
        <p className={`mt-5 text-base leading-relaxed ${t('text-white/45', 'text-slate-500')}`}>
          회원가입 없이 바로 시작 가능합니다.<br />
          로드맵 저장과 진행률 추적은 무료 계정으로.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-white
              bg-gradient-to-r from-indigo-500 to-cyan-500
              hover:opacity-90 active:scale-95 transition-all
              shadow-xl shadow-indigo-500/25 text-base">
            내 로드맵 만들기 — 무료
          </button>
          {!user && (
            <button
              onClick={() => setAuthOpen(true)}
              className={`w-full sm:w-auto px-8 py-4 rounded-xl font-bold transition-all text-base
                ${t('text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70',
                    'text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700')}`}>
              로그인
            </button>
          )}
        </div>

      </section>

      {/* ────────── FOOTER ────────── */}
      <footer className={`px-6 py-8 border-t text-center text-xs
        ${t('border-white/[0.06] text-white/20', 'border-slate-200 text-slate-400')}`}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} DevNavi. All rights reserved.</span>
          <a href="/terms"   className={`transition-colors ${t('hover:text-white/40', 'hover:text-slate-600')}`}>이용약관</a>
          <a href="/privacy" className={`transition-colors ${t('hover:text-white/40', 'hover:text-slate-600')}`}>개인정보처리방침</a>
          <a href="mailto:support@devnavi.kr" className={`transition-colors ${t('hover:text-white/40', 'hover:text-slate-600')}`}>문의</a>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
