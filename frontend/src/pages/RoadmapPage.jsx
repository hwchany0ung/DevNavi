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
  const { user, signOut } = useAuth()

  const [roadmap,      setRoadmap]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeMonth,  setActiveMonth]  = useState(1)
  const [doneSet,      setDoneSet]      = useState(new Set())
  const [activity,     setActivity]     = useState([])
  const [rerouteLoading, setRerouteLoading] = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [authOpen,     setAuthOpen]     = useState(false)
  const [showGrass,    setShowGrass]    = useState(false)
  const [showSummary,  setShowSummary]  = useState(false)
  const [careerSummary, setCareerSummary] = useState(null)

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
      // 서버 ID로 localStorage 이전
      localStorage.setItem(`devnavi_roadmap_${serverId}`, JSON.stringify(toSave))
      const summaryRaw = localStorage.getItem(`devnavi_summary_${id}`)
      if (summaryRaw) {
        localStorage.setItem(`devnavi_summary_${serverId}`, summaryRaw)
        localStorage.removeItem(`devnavi_summary_${id}`)
      }
      localStorage.removeItem(`devnavi_roadmap_${id}`)
      navigate(`/roadmap/${serverId}`, { replace: true })
    }).catch(() => {
      autoSaveDoneRef.current = false  // 실패 시 재시도 허용
    })
  }, [user, id, navigate])

  // ── 로드맵 로드 ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const local = loadRoadmapLocal(id)
    if (local) {
      setRoadmap(local)
      setDoneSet(loadDoneLocal(id))
      setLoading(false)
    } else {
      request(`/roadmap/${id}`)
        .then((data) => {
          const rm = data.data ?? data
          setRoadmap(rm)
          setDoneSet(loadDoneLocal(id))
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [id])

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

  // ── GPS 재탐색 ──────────────────────────────────────────────────
  const handleReroute = async () => {
    if (!roadmap) return
    if (!user) { setAuthOpen(true); return }
    setRerouteLoading(true)
    const doneContents = []
    roadmap.months.forEach((m) =>
      m.weeks.forEach((w) =>
        w.tasks.forEach((t, ti) => {
          if (doneSet.has(`${m.month}-${w.week}-${ti}`)) doneContents.push(t.content)
        })
      )
    )
    try {
      const res = await request('/roadmap/reroute', {
        method: 'POST',
        headers: authHeader(user),
        body: JSON.stringify({
          original_role:       roadmap._meta?.role ?? 'backend',
          original_period:     roadmap._meta?.period ?? '6months',
          company_type:        roadmap._meta?.company_type ?? 'any',
          completion_rate:     completionRate,
          done_contents:       doneContents,
          weeks_left:          Math.max(1, (roadmap.months.length * 4) - Math.round((completionRate / 100) * roadmap.months.length * 4)),
          daily_study_hours:   roadmap._meta?.daily_study_hours ?? '1to2h',
        }),
      })
      const newId = saveRoadmapLocal({ ...res, _meta: roadmap._meta })
      navigate(`/roadmap/${newId}`)
    } catch (e) {
      alert('재탐색 중 오류: ' + e.message)
    } finally {
      setRerouteLoading(false)
    }
  }

  // ── 로딩 ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex gap-1 justify-center">
            {[0,1,2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-400 text-sm">로드맵을 불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (error || !roadmap) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <p className="text-5xl">🗺️</p>
          <p className="text-gray-700 font-semibold">로드맵을 찾을 수 없어요</p>
          <p className="text-gray-400 text-sm">{error}</p>
          <button onClick={() => navigate('/onboarding')}
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            새 로드맵 만들기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4
        flex items-center justify-between sticky top-0 z-20">
        <span className="text-lg font-black text-indigo-600 tracking-tight">
          Dev<span className="text-gray-800">Navi</span>
        </span>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* 진행률 칩 */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl">
            <div className="w-16 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-xs font-bold text-indigo-700">{Math.round(completionRate)}%</span>
          </div>

          {/* 잔디 토글 */}
          {user && (
            <button
              onClick={() => setShowGrass((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors hidden sm:block
                ${showGrass ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
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
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 20 20">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 사이드바 ── */}
        <aside className={`
          fixed sm:sticky top-0 sm:top-[57px] h-screen sm:h-[calc(100vh-57px)]
          w-72 bg-white border-r border-gray-100 flex flex-col z-10
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
                  border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left">
                <span className="text-xl">💾</span>
                <div>
                  <p className="text-sm font-bold text-indigo-700">로그인하고 저장하기</p>
                  <p className="text-xs text-indigo-400">진행률이 기기 간 동기화돼요</p>
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
                  bg-white hover:bg-indigo-50 transition-colors text-left">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-bold text-indigo-700">커리어 분석 보기</p>
                  <p className="text-xs text-indigo-400">스킬·자격증 우선순위 확인</p>
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
                  <h1 className="text-xl font-black text-gray-900">{currentMonth.month}월차</h1>
                  <p className="text-indigo-600 font-semibold text-sm mt-0.5">{currentMonth.theme}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={activeMonth <= 1}
                    onClick={() => setActiveMonth((m) => m - 1)}
                    className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center
                      disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    disabled={activeMonth >= roadmap.months.length}
                    onClick={() => setActiveMonth((m) => m + 1)}
                    className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center
                      disabled:opacity-30 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
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
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              월을 선택해주세요
            </div>
          )}
        </main>
      </div>

      {/* 인증 모달 */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* 커리어 분석 모달 */}
      {showSummary && careerSummary && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSummary(false)} />
          {/* 패널 */}
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl
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
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 text-center text-xs text-gray-400">
          ⚠️ 본 로드맵은 AI가 생성한 참고 자료입니다. 실제 취업·학습 결과는 개인 역량 및 시장 상황에 따라 다를 수 있으며, DevNavi는 결과의 정확성에 대한 법적 책임을 지지 않습니다.
        </div>
        <Footer />
      </div>
    </div>
  )
}
