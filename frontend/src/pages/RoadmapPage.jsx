import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Footer from '../components/common/Footer'
import ThemeToggle from '../components/common/ThemeToggle'
import PersonaCard         from '../components/roadmap/PersonaCard'
import MonthTimeline       from '../components/roadmap/MonthTimeline'
import WeekAccordion       from '../components/roadmap/WeekAccordion'
import RerouteButton       from '../components/roadmap/RerouteButton'
import GrassCalendar       from '../components/roadmap/GrassCalendar'
import CareerSummaryPanel  from '../components/roadmap/CareerSummaryPanel'
import AuthModal           from '../components/auth/AuthModal'
import { loadRoadmapLocal, saveRoadmapLocal } from '../hooks/useRoadmapStream'
import { useAuth } from '../hooks/useAuth'
import { request } from '../lib/api'

const DONE_PREFIX = 'devnavi_done_'

const PERIOD_WEEKS = { '1month': 4, '3months': 13, '6months': 26, '1year': 52 }

// ── localStorage 유틸 ───────────────────────────────────────────────
function loadDoneLocal(roadmapId) {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_PREFIX + roadmapId) || '[]')) }
  catch { return new Set() }
}
function saveDoneLocal(roadmapId, doneSet) {
  localStorage.setItem(DONE_PREFIX + roadmapId, JSON.stringify([...doneSet]))
}

// ── Supabase API 헬퍼 ───────────────────────────────────────────────
function authHeader(user) {
  return user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}
}

async function fetchRemoteCompletions(roadmapId, user) {
  const data = await request(`/roadmap/${roadmapId}/completions`, {
    headers: authHeader(user),
  })
  return new Set(data.task_ids || [])
}

async function toggleRemote(roadmapId, taskId, completed, user) {
  await request(`/roadmap/${roadmapId}/completions`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ task_id: taskId, completed }),
  })
}

async function fetchActivity(user) {
  const data = await request('/roadmap/activity/me', { headers: authHeader(user) })
  return data.activity || []
}

// ───────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user, signOut, loading: authLoading } = useAuth()

  const [roadmap,      setRoadmap]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeMonth,  setActiveMonth]  = useState(1)
  const [doneSet,      setDoneSet]      = useState(new Set())
  const [activity,     setActivity]     = useState([])
  const [rerouteLoading, setRerouteLoading] = useState(false)
  const [rerouteModalOpen, setRerouteModalOpen] = useState(false)
  const [reroutePeriod,    setReroutePeriod]    = useState('3months')
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [authOpen,     setAuthOpen]     = useState(false)
  const [showGrass,    setShowGrass]    = useState(true)
  const [showSummary,  setShowSummary]  = useState(false)
  const [careerSummary, setCareerSummary] = useState(null)
  const [autoSaveError, setAutoSaveError] = useState(false)

  useEffect(() => {
    document.title = '나의 로드맵 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  // ── 커리어 분석 로드 ────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`devnavi_summary_${id}`)
      if (raw) setCareerSummary(JSON.parse(raw))
    } catch { /* 없으면 null 유지 */ }
  }, [id])

  // ── 로그인 시 로컬 전용 로드맵 자동 서버 저장 ───────────────────
  // 비로그인으로 생성한 로드맵(_isLocal=true)을 로그인 후 Supabase에 저장하고 URL을 서버 ID로 교체
  const autoSaveDoneRef = useRef(false)
  useEffect(() => {
    if (!user || autoSaveDoneRef.current) return
    const local = loadRoadmapLocal(id)
    if (!local?._isLocal) return  // 이미 서버 저장됐거나 로컬 전용 아님

    autoSaveDoneRef.current = true
    const { _isLocal, ...toSave } = local  // _isLocal 플래그 제거 후 저장

    request('/roadmap/persist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({
        role: local._meta?.role ?? '',
        period: local._meta?.period ?? '',
        roadmap: toSave,
      }),
    }).then(({ roadmap_id: serverId }) => {
      // 서버 ID로 localStorage 이전 (roadmap → summary → done 순서)
      localStorage.setItem(`devnavi_roadmap_${serverId}`, JSON.stringify(toSave))
      const summaryRaw = localStorage.getItem(`devnavi_summary_${id}`)
      if (summaryRaw) {
        localStorage.setItem(`devnavi_summary_${serverId}`, summaryRaw)
        localStorage.removeItem(`devnavi_summary_${id}`)
      }
      // done 데이터도 함께 이전 — 누락 시 로그인 후 완료 기록이 초기화됨
      const doneRaw = localStorage.getItem(`devnavi_done_${id}`)
      if (doneRaw) {
        localStorage.setItem(`devnavi_done_${serverId}`, doneRaw)
        localStorage.removeItem(`devnavi_done_${id}`)
      }
      localStorage.removeItem(`devnavi_roadmap_${id}`)
      navigate(`/roadmap/${serverId}`, { replace: true })
    }).catch(() => {
      autoSaveDoneRef.current = false  // 실패 시 재시도 허용
      setAutoSaveError(true)
    })
  }, [user, id, navigate])

  // ── 로드맵 로드 ─────────────────────────────────────────────────
  // loadedForIdRef: 현재 id로 이미 성공 로드 시 TOKEN_REFRESHED 등 user 변경으로 재요청 방지
  const loadedForIdRef = useRef(null)
  useEffect(() => {
    if (authLoading) return  // 인증 확인 완료 전 대기
    if (loadedForIdRef.current === id) return  // 이미 이 id로 로드 완료 (flicker 방지)
    setLoading(true)
    const local = loadRoadmapLocal(id)
    if (local) {
      setRoadmap(local)
      setDoneSet(loadDoneLocal(id))
      setLoading(false)
      loadedForIdRef.current = id
      return
    }
    const headers = user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}
    request(`/roadmap/${id}`, { headers })
      .then((data) => {
        const rm = data.data ?? data
        setRoadmap(rm)
        setDoneSet(loadDoneLocal(id))
        loadedForIdRef.current = id  // 성공 시만 set — 실패 시 user 변경으로 재시도 허용
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, user, authLoading])

  // ── 로그인 시 Supabase completions 동기화 ───────────────────────
  useEffect(() => {
    if (!user) return
    fetchRemoteCompletions(id, user)
      .then((remote) => {
        // remote와 local 병합 (remote 우선)
        setDoneSet((local) => {
          const merged = new Set([...local, ...remote])
          saveDoneLocal(id, merged)
          return merged
        })
      })
      .catch(() => {}) // 실패 시 로컬 유지
  }, [id, user])

  // ── 로그인 시 잔디 활동 로드 ─────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchActivity(user).then(setActivity).catch(() => {})
  }, [user])

  // ── 태스크 토글 ─────────────────────────────────────────────────
  const handleToggle = useCallback((taskId) => {
    setDoneSet((prev) => {
      const next = new Set(prev)
      const nowDone = !next.has(taskId)
      if (nowDone) next.add(taskId)
      else next.delete(taskId)
      saveDoneLocal(id, next)
      // 로그인 시 Supabase에도 동기화
      if (user) {
        toggleRemote(id, taskId, nowDone, user).catch(() => {})
      }
      return next
    })
  }, [id, user])

  // ── 통계 ────────────────────────────────────────────────────────
  const { totalCount, completedCount, completionRate } = useMemo(() => {
    if (!roadmap) return { totalCount: 0, completedCount: 0, completionRate: 0 }
    // doneSet.size 대신 실제 로드맵 태스크 기준으로 카운트
    // (remote + local 병합 시 유효하지 않은 task_id가 섞여도 100% 초과 방지)
    let total = 0
    let done  = 0
    roadmap.months.forEach((m) =>
      m.weeks.forEach((w) =>
        w.tasks.forEach((_, ti) => {
          total++
          if (doneSet.has(`${m.month}-${w.week}-${ti}`)) done++
        })
      )
    )
    return { totalCount: total, completedCount: done, completionRate: total > 0 ? (done / total) * 100 : 0 }
  }, [roadmap, doneSet])

  const currentMonth = roadmap?.months.find((m) => m.month === activeMonth)

  // ── GPS 재탐색 — 모달 열기 ──────────────────────────────────────
  const handleReroute = () => {
    if (!roadmap) return
    if (!user) { setAuthOpen(true); return }
    setRerouteModalOpen(true)
  }

  // ── GPS 재탐색 — 실제 API 호출 ──────────────────────────────────
  const handleRerouteConfirm = async () => {
    setRerouteModalOpen(false)
    setRerouteLoading(true)
    const doneContents = []
    roadmap.months.forEach((m) =>
      m.weeks.forEach((w) =>
        w.tasks.forEach((t, ti) => {
          if (doneSet.has(`${m.month}-${w.week}-${ti}`)) doneContents.push(t.content)
        })
      )
    )
    const weeksLeft = PERIOD_WEEKS[reroutePeriod] ?? 13
    try {
      const res = await request('/roadmap/reroute', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({
          original_role:     roadmap._meta?.role ?? 'backend',
          original_period:   reroutePeriod,
          company_type:      roadmap._meta?.company_type ?? 'any',
          completion_rate:   completionRate,
          done_contents:     doneContents,
          weeks_left:        weeksLeft,
          daily_study_hours: roadmap._meta?.daily_study_hours ?? '1to2h',
        }),
      })
      const newId = saveRoadmapLocal({ ...res, _meta: { ...roadmap._meta, period: reroutePeriod } })
      navigate(`/roadmap/${newId}`)
    } catch (e) {
      const msg = e.message === 'Failed to fetch'
        ? '서버 응답 시간이 초과됐어요. 잠시 후 다시 시도해주세요.'
        : '재탐색 중 오류: ' + e.message
      alert(msg)
    } finally {
      setRerouteLoading(false)
    }
  }

  // ── 로딩 ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex gap-1 justify-center">
            {[0,1,2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-400 dark:text-white/40 text-sm">로드맵을 불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (error || !roadmap) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <p className="text-5xl">🗺️</p>
          <p className="text-gray-700 dark:text-white font-semibold">로드맵을 찾을 수 없어요</p>
          <p className="text-gray-400 dark:text-white/40 text-sm">{error}</p>
          <button onClick={() => navigate('/onboarding')}
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            새 로드맵 만들기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* ── 헤더 ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/10 px-4 sm:px-6 py-4
        flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => navigate('/')}
          className="text-lg font-black text-indigo-600 tracking-tight hover:opacity-80 transition-opacity"
        >
          Dev<span className="text-gray-800 dark:text-white">Navi</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 진행률 칩 */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-xl">
            <div className="w-16 h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{Math.round(completionRate)}%</span>
          </div>

          {/* 잔디 토글 */}
          {user && (
            <button
              onClick={() => setShowGrass((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors hidden sm:block
                ${showGrass
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/20'
                }`}>
              🌱 활동
            </button>
          )}

          {/* 테마 토글 + 인증 버튼 */}
          <ThemeToggle />
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-white/40 truncate max-w-[120px]">{user.email}</span>
              <button
                onClick={signOut}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-500 dark:text-white/60 transition-colors"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
              저장하기
            </button>
          )}

          {/* 모바일 사이드바 토글 */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-gray-600 dark:text-white/60" fill="none" viewBox="0 0 20 20">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* 자동 저장 실패 알림 */}
      {autoSaveError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
          <span>로드맵 서버 저장에 실패했습니다. 로컬에는 저장되어 있으니 다시 시도해주세요.</span>
          <button onClick={() => setAutoSaveError(false)} className="ml-4 font-bold hover:opacity-70">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── 사이드바 ── */}
        <aside className={`
          fixed sm:sticky top-0 sm:top-[57px] h-screen sm:h-[calc(100vh-57px)]
          w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-white/10 flex flex-col z-10
          transition-transform sm:translate-x-0 overflow-y-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4 space-y-4">
            <PersonaCard
              roadmap={roadmap}
              role={roadmap._meta?.role ?? 'backend'}
              completedCount={completedCount}
              totalCount={totalCount}
            />

            {/* 잔디 달력 — 로그인 + showGrass 시 */}
            {user && showGrass && (
              <GrassCalendar activity={activity} totalDone={completedCount} />
            )}

            {/* 미로그인 시 저장 유도 */}
            {!user && (
              <button
                onClick={() => setAuthOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed
                  border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10
                  hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors text-left">
                <span className="text-xl">💾</span>
                <div>
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">로그인하고 저장하기</p>
                  <p className="text-xs text-indigo-400 dark:text-indigo-400/70">진행률이 기기 간 동기화돼요</p>
                </div>
              </button>
            )}

            <MonthTimeline
              months={roadmap.months}
              activeMonth={activeMonth}
              doneSet={doneSet}
              onSelect={(m) => { setActiveMonth(m); setSidebarOpen(false) }}
            />

            <RerouteButton
              completionRate={completionRate}
              onClick={handleReroute}
              loading={rerouteLoading}
            />

            {/* 커리어 분석 버튼 */}
            {careerSummary && (
              <button
                onClick={() => { setShowSummary(true); setSidebarOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-indigo-100
                  dark:border-indigo-500/20 bg-white dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10
                  transition-colors text-left">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">커리어 분석 보기</p>
                  <p className="text-xs text-indigo-400 dark:text-indigo-400/70">스킬·자격증 우선순위 확인</p>
                </div>
              </button>
            )}
          </div>
        </aside>

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-[9] sm:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── 메인 ── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 sm:pl-8">
          {currentMonth ? (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* 월 헤더 */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h1 className="text-xl font-black text-gray-900 dark:text-white">{currentMonth.month}월차</h1>
                  <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm mt-0.5">{currentMonth.theme}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={activeMonth <= 1}
                    onClick={() => setActiveMonth((m) => m - 1)}
                    className="w-8 h-8 rounded-xl border border-gray-200 dark:border-white/20 flex items-center justify-center
                      text-gray-500 dark:text-white/60 disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    disabled={activeMonth >= roadmap.months.length}
                    onClick={() => setActiveMonth((m) => m + 1)}
                    className="w-8 h-8 rounded-xl border border-gray-200 dark:border-white/20 flex items-center justify-center
                      text-gray-500 dark:text-white/60 disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {currentMonth.weeks.map((week) => (
                <WeekAccordion
                  key={`${currentMonth.month}-${week.week}`}
                  week={week}
                  monthIdx={currentMonth.month}
                  doneSet={doneSet}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-white/40 text-sm">
              월을 선택해주세요
            </div>
          )}
        </main>
      </div>

      {/* ── 재탐색 기간 선택 모달 ── */}
      {rerouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setRerouteModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 space-y-5">
            {/* 헤더 */}
            <div>
              <p className="text-lg font-black text-gray-900 dark:text-white">🧭 방향 재설정</p>
              <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
                현재 <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round(completionRate)}%</span> 완료 ({completedCount}/{totalCount} 태스크)
              </p>
            </div>

            {/* 남은 기간 선택 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">남은 목표 기간 선택</p>
              {[
                { value: '1month',  label: '1개월',  sub: '집중 단기 완성' },
                { value: '3months', label: '3개월',  sub: '균형잡힌 속도' },
                { value: '6months', label: '6개월',  sub: '안정적인 학습' },
                { value: '1year',   label: '12개월', sub: '여유있는 장기 플랜' },
              ].map(({ value, label, sub }) => (
                <button
                  key={value}
                  onClick={() => setReroutePeriod(value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left
                    ${reroutePeriod === value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20'
                      : 'border-gray-100 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40'
                    }`}
                >
                  <span className={`text-sm font-bold ${reroutePeriod === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-white/80'}`}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-white/40">{sub}</span>
                </button>
              ))}
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRerouteModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10
                  text-gray-500 dark:text-white/50 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                취소
              </button>
              <button
                onClick={handleRerouteConfirm}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700
                  text-white text-sm font-bold transition-colors">
                재생성 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인증 모달 */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* 커리어 분석 모달 */}
      {showSummary && careerSummary && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSummary(false)} />
          {/* 패널 */}
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl
            max-h-[85vh] overflow-y-auto p-6 space-y-2">
            <CareerSummaryPanel
              summary={careerSummary}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}

      {/* AI 면책 고지 + 푸터 */}
      <div className="mt-auto">
        <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-white/10 px-6 py-3 text-center text-xs text-gray-400 dark:text-white/30">
          ⚠️ 본 로드맵은 AI가 생성한 참고 자료입니다. 실제 취업·학습 결과는 개인 역량 및 시장 상황에 따라 다를 수 있으며, DevNavi는 결과의 정확성에 대한 법적 책임을 지지 않습니다.
        </div>
        <Footer />
      </div>
    </div>
  )
}
