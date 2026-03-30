/**
 * LandingPageMockup — /mockup 라우트 전용 미리보기
 * 실제 LandingPage에 적용 전 확인용. 프로덕션 배포 금지.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── 목업 데이터 ── */
const PREVIEW_WEEKS = [
  { week: '1주차', task: 'Git · GitHub 워크플로우 실습', done: true },
  { week: '2주차', task: 'Python 함수 · 클래스 미니 프로젝트', done: true },
  { week: '3주차', task: 'FastAPI 기초 + REST API 설계', done: false },
  { week: '4주차', task: 'Docker 컨테이너 입문 + 배포', done: false },
]

/* ── 서브 컴포넌트 ── */
function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
      bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
      {children}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold tracking-widest uppercase text-indigo-400 mb-3">
      {children}
    </p>
  )
}

/* ── 히어로 로드맵 미리보기 ── */
function HeroPreview() {
  const [active, setActive] = useState(0)
  return (
    <div className="w-full max-w-[360px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-[#0d0f1a]">
      {/* 상단 탭 바 */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#13151f] border-b border-white/10">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 text-[10px] font-mono text-white/30">백엔드 · 6개월 플랜</span>
        <span className="ml-auto text-[10px] font-mono text-indigo-400 animate-pulse">● live</span>
      </div>
      {/* 진행률 바 */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
          <span>전체 진행률</span><span className="text-indigo-400 font-mono">37%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[37%] bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" />
        </div>
      </div>
      {/* 주차 리스트 */}
      <div className="p-3 space-y-1.5">
        {PREVIEW_WEEKS.map((w, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
              ${active === i
                ? 'bg-indigo-500/15 border-indigo-500/30'
                : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'
              }`}
          >
            <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center
              ${w.done ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'}`}>
              {w.done && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10">
                  <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-[9px] text-white/30 font-mono">{w.week}</div>
              <div className={`text-[11px] font-medium leading-snug mt-0.5
                ${w.done ? 'text-white/30 line-through' : 'text-white/75'}`}>
                {w.task}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-4 pb-3 text-[9px] text-white/20 text-center">
        🤖 AI 생성 · 실제 미리보기
      </div>
    </div>
  )
}

/* ── 메인 목업 컴포넌트 ── */
export default function LandingPageMockup() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#07090f] text-white overflow-x-hidden"
      style={{ backgroundImage: 'radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.12), transparent)' }}>

      {/* ── 목업 배너 ── */}
      <div className="sticky top-0 z-50 bg-amber-500/90 backdrop-blur text-black text-xs font-bold
        text-center py-2 flex items-center justify-center gap-3">
        🎨 목업 미리보기 모드 — 실제 서비스에 미적용
        <button
          onClick={() => navigate('/')}
          className="underline opacity-70 hover:opacity-100">
          현재 랜딩 보기
        </button>
      </div>

      {/* ────────────────────────────────────────────
          NAV
      ──────────────────────────────────────────── */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <span className="text-xl font-black tracking-tight">
          Dev<span className="text-indigo-400">Navi</span>
        </span>
        <div className="flex items-center gap-6">
          <a href="#problem" className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:block">왜 필요한가</a>
          <a href="#how" className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:block">어떻게 작동하나</a>
          <button
            onClick={() => navigate('/onboarding')}
            className="text-sm px-4 py-2 rounded-xl font-bold text-white
              bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 transition-opacity">
            무료로 시작
          </button>
        </div>
      </nav>

      {/* ────────────────────────────────────────────
          SECTION 1 — HERO
      ──────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

        {/* 좌측 */}
        <div className="flex-1 max-w-xl">
          <Badge>AI가 만드는 나만의 커리어 플랜</Badge>

          <h1 className="mt-6 text-4xl sm:text-5xl font-black leading-[1.2] tracking-tight">
            어떤 개발자가 될지<br />
            <span className="text-white/40">아직 모르는 게</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              당연합니다
            </span>
          </h1>

          <p className="mt-6 text-base text-white/50 leading-relaxed max-w-md">
            목표 직군 · 목표 기간 · 지금 수준.<br />
            이 3가지로 AI가 주차별 학습 계획을 만들어 드립니다.<br />
            <span className="text-white/70">"뭘 공부해야 하지?"에서 "이번 주엔 이걸 하면 돼"로.</span>
          </p>

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/onboarding')}
              className="px-6 py-3.5 rounded-xl font-bold text-sm text-white
                bg-gradient-to-r from-indigo-500 to-cyan-500
                hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-indigo-500/20">
              지금 바로 만들어보기 (무료) →
            </button>
            <a href="#preview"
              className="px-6 py-3.5 rounded-xl font-bold text-sm text-white/60
                border border-white/10 hover:border-white/20 hover:text-white/80 transition-all">
              샘플 로드맵 보기
            </a>
          </div>

          {/* 통계 스트립 */}
          <div className="mt-10 pt-8 border-t border-white/10 flex items-center gap-8">
            {[
              { value: '9개', label: '직군 지원' },
              { value: '45초', label: '평균 생성 시간' },
              { value: '무료', label: '기본 이용' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-xl font-black text-white">{value}</div>
                <div className="text-xs text-white/35 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 — 로드맵 미리보기 */}
        <div id="preview" className="flex-shrink-0 flex flex-col items-center gap-3">
          <HeroPreview />
          <p className="text-xs text-white/25">↑ 클릭해서 탭 전환 가능한 실제 미리보기</p>
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 2 — PROBLEM
      ──────────────────────────────────────────── */}
      <section id="problem" className="px-6 py-20 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <SectionLabel>이런 적 있으셨나요?</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black leading-tight">
            로드맵을 찾다가<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
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
              color: 'indigo',
            },
            {
              emoji: '📋',
              title: '"리스트는 있는데 시작을 못 하겠어요"',
              desc: '노션에 공부할 것들 정리는 했는데 "이걸 다 해야 해?" 싶어서 오늘도 유튜브만 봄.',
              color: 'violet',
            },
            {
              emoji: '🔁',
              title: '"6개월째 기초만 반복하고 있어요"',
              desc: 'JavaScript 기초 강의를 세 번 들었는데 이제 뭘 해야 할지 여전히 모르겠음.',
              color: 'cyan',
            },
          ].map(({ emoji, title, desc, color }) => (
            <div key={title}
              className={`rounded-2xl p-6 border
                ${color === 'indigo' ? 'bg-indigo-500/[0.07] border-indigo-500/15' : ''}
                ${color === 'violet' ? 'bg-violet-500/[0.07] border-violet-500/15' : ''}
                ${color === 'cyan'   ? 'bg-cyan-500/[0.07]   border-cyan-500/15'   : ''}
              `}>
              <div className="text-3xl mb-4">{emoji}</div>
              <h3 className="font-bold text-sm text-white mb-2">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-base text-white/50">
          문제는 의지가 아닙니다.<br />
          <span className="text-white font-semibold">오늘 뭘 해야 할지 명확하지 않은 것입니다.</span>
        </p>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 3 — HOW IT WORKS
      ──────────────────────────────────────────── */}
      <section id="how" className="px-6 py-20 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <SectionLabel>DevNavi가 하는 일</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black">
            막연한 목표를<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              오늘 할 일로 바꿔드립니다
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
          {/* 연결선 */}
          <div className="hidden sm:block absolute top-10 left-[33%] right-[33%] h-px bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-cyan-500/30" />

          {[
            {
              step: '01',
              title: '3가지 답변',
              items: ['목표 직군 (예: 백엔드)', '목표 기간 (예: 6개월)', '지금 수준 (예: Python 기초)'],
              color: 'from-indigo-500 to-violet-500',
            },
            {
              step: '02',
              title: 'AI 커리어 분석',
              items: ['어떤 스킬을 쌓아야 하는지', '어떤 순서로 배워야 하는지', '얼마나 걸리는지'],
              color: 'from-violet-500 to-purple-500',
            },
            {
              step: '03',
              title: '주차별 플랜 완성',
              items: ['1주차: Git + GitHub 실습', '2주차: Python 미니 프로젝트', '이번 주 할 일이 명확'],
              color: 'from-purple-500 to-cyan-500',
            },
          ].map(({ step, title, items, color }) => (
            <div key={step} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 relative">
              <div className={`text-3xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r ${color}`}>
                {step}
              </div>
              <h3 className="font-bold text-white mb-4">{title}</h3>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/50">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 추가 기능 */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            '✅ 중간에 방향 바뀌어도 지금까지 한 것 유지하며 재설계',
            '✅ 완료 체크 + 진행률 추적으로 동기부여 유지',
            '✅ 직군별 핵심 자격증 · 포트폴리오 프로젝트 포함',
          ].map(text => (
            <div key={text} className="text-sm text-white/50 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 4 — SOCIAL PROOF
      ──────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-6xl mx-auto border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <SectionLabel>실제로 써본 분들</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black">
            "막막함이 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">사라졌어요</span>"
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              quote: '로드맵 영상을 10개 넘게 봤는데 다 달라서 혼란스러웠어요. DevNavi는 제 상황을 넣으니까 딱 지금 저한테 맞는 게 나오더라고요.',
              name: '비전공자',
              role: '프론트엔드 전향 준비 중',
            },
            {
              quote: '퇴근 후 2시간밖에 못 하는데, 그 2시간에 뭘 해야 할지 드디어 명확해졌어요. 6개월 계획이 주 단위로 쪼개지니까요.',
              name: '직장인',
              role: '백엔드 이직 준비 중',
            },
            {
              quote: '처음엔 그냥 써봤는데 지금 3주째 매일 체크하고 있어요. 진행률이 올라가는 게 보이니까 포기 안 하게 되더라고요.',
              name: '대학생',
              role: '클라우드/DevOps 목표',
            },
          ].map(({ quote, name, role }) => (
            <div key={name} className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <p className="text-sm text-white/60 leading-relaxed flex-1">"{quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                  {name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{name}</div>
                  <div className="text-xs text-white/40">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────
          SECTION 5 — CTA
      ──────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-3xl mx-auto text-center border-t border-white/[0.06]">
        <Badge>지금 바로 시작</Badge>
        <h2 className="mt-6 text-3xl sm:text-4xl font-black leading-tight">
          오늘 뭘 공부해야 할지,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            지금 바로 알 수 있어요
          </span>
        </h2>
        <p className="mt-5 text-white/45 text-base leading-relaxed">
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
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-white/50
              border border-white/10 hover:border-white/20 hover:text-white/70 transition-all text-base">
            샘플 먼저 보기
          </button>
        </div>

        <p className="mt-5 text-xs text-white/25">
          신용카드 불필요 · 언제든 삭제 가능
        </p>
      </section>

      {/* ── 푸터 ── */}
      <footer className="px-6 py-8 border-t border-white/[0.06] text-center text-xs text-white/20">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} DevNavi. All rights reserved.</span>
          <a href="/terms" className="hover:text-white/40 transition-colors">이용약관</a>
          <a href="/privacy" className="hover:text-white/40 transition-colors">개인정보처리방침</a>
          <a href="mailto:support@devnavi.kr" className="hover:text-white/40 transition-colors">문의</a>
        </div>
      </footer>
    </div>
  )
}
