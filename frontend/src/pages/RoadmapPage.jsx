import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import Footer from '../components/common/Footer'
import PersonaCard         from '../components/roadmap/PersonaCard'
import MonthTimeline       from '../components/roadmap/MonthTimeline'
import WeekAccordion       from '../components/roadmap/WeekAccordion'
import RerouteButton       from '../components/roadmap/RerouteButton'
import GrassCalendar       from '../components/roadmap/GrassCalendar'
import RoadmapHeader       from '../components/roadmap/RoadmapHeader'
import RerouteModal        from '../components/roadmap/RerouteModal'
import CareerSummaryModal  from '../components/roadmap/CareerSummaryModal'
import AuthModal           from '../components/auth/AuthModal'
import QAPanel            from '../components/qa/QAPanel'
import { loadRoadmapLocal, saveRoadmapLocal } from '../hooks/useRoadmapStream'
import { useAuth } from '../hooks/useAuth'
import { useAnalytics } from '../hooks/useAnalytics'
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
// C2: authHeader(user) 헬퍼 제거 — getAuthHeaders() 콜백을 직접 전달

async function fetchRemoteCompletions(roadmapId, headers) {
  const data = await request(`/roadmap/${roadmapId}/completions`, { headers })
  return new Set(data.task_ids || [])
}

async function toggleRemote(roadmapId, taskId, completed, headers) {
  await request(`/roadmap/${roadmapId}/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ task_id: taskId, completed }),
  })
}

async function fetchActivity(headers) {
  const data = await request('/roadmap/activity/me', { headers })
  return data.activity || []
}

// ───────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user, signOut, loading: authLoading, getAuthHeaders } = useAuth()
  const { logEvent } = useAnalytics()
  // FC-4: user 객체는 TOKEN_REFRESHED(~60s)마다 새로 생성되므로
  // 안정적인 원시값(id)을 추출하여 useEffect/useCallback 의존성에 사용
  const userId = user?.id

  const [roadmap,      setRoadmap]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeMonth,  setActiveMonth]  = useState(1)
  const [doneSet,      setDoneSet]      = useState(new Set())
  const [activity,     setActivity]     = useState([])
  const [rerouteLoading, setRerouteLoading] = useState(false)
  const [rerouteModalOpen, setRerouteModalOpen] = useState(false)
  const [reroutePeriod,    setReroutePeriod]    = useState('3months')
  const [rerouteCount,     setRerouteCount]     = useState(0)   // 로드맵당 최대 2회
  const [userRequests,     setUserRequests]     = useState('')  // 사용자 추가 학습 요청
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [authOpen,     setAuthOpen]     = useState(false)
  const [showGrass,    setShowGrass]    = useState(true)
  const [showSummary,  setShowSummary]  = useState(false)
  const [careerSummary, setCareerSummary] = useState(null)
  const [autoSaveError, setAutoSaveError] = useState(false)
  const [autoSaveRetry, setAutoSaveRetry] = useState(0)
  const [rerouteError, setRerouteError] = useState(null)
  const [qaOpen,        setQaOpen]       = useState(false)
  const [qaTaskContext, setQaTaskContext] = useState(null)
  const [qaSessionSet,  setQaSessionSet] = useState(() => new Set())

  useEffect(() => {
    document.title = '나의 로드맵 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  // ── id 변경 시 이전 로드맵 상태 초기화 ────────────────────────────
  // 다른 로드맵으로 이동할 때 이전 데이터가 잠깐 노출되지 않도록 즉시 초기화
  useEffect(() => {
    setRoadmap(null)
    setError(null)
    setActiveMonth(1)
    setDoneSet(new Set())
    setCareerSummary(null)
    setAutoSaveError(false)
    autoSaveDoneRef.current = false
    loadedForIdRef.current = null  // I-4: A→B→A 재방문 시 stale 상태 방지
  }, [id])

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
      headers: getAuthHeaders(),
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
  }, [user, id, navigate, autoSaveRetry, getAuthHeaders])

  // ── 로드맵 로드 ─────────────────────────────────────────────────
  // loadedForIdRef: 현재 id로 이미 성공 로드 시 TOKEN_REFRESHED 등 user 변경으로 재요청 방지
  const loadedForIdRef = useRef(null)
  useEffect(() => {
    if (authLoading) return  // 인증 확인 완료 전 대기
    if (loadedForIdRef.current === id) return  // 이미 이 id로 로드 완료 (flicker 방지)
    // autoSave 진행 중이면 로드 스킵 — autoSave가 navigate로 새 id로 전환하거나 실패 시 재시도
    if (autoSaveDoneRef.current) return
    setLoading(true)
    const local = loadRoadmapLocal(id)
    if (local) {
      setRoadmap(local)
      setDoneSet(loadDoneLocal(id))
      setLoading(false)
      loadedForIdRef.current = id
      // 로드맵별 방향재설정 사용 횟수 복원
      setRerouteCount(Number(localStorage.getItem(`devnavi_reroute_count_${id}`) ?? 0))
      return
    }
    // FC-4 통일: getAuthHeaders()로 항상 최신 토큰 사용
    request(`/roadmap/${id}`, { headers: getAuthHeaders() })
      .then((data) => {
        const rm = data.data ?? data
        setRoadmap(rm)
        setDoneSet(loadDoneLocal(id))
        loadedForIdRef.current = id  // 성공 시만 set — 실패 시 userId 변경으로 재시도 허용
        setRerouteCount(Number(localStorage.getItem(`devnavi_reroute_count_${id}`) ?? 0))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, userId, authLoading, autoSaveRetry, getAuthHeaders])

  // ── 로그인 시 Supabase completions 동기화 ───────────────────────
  useEffect(() => {
    if (!userId) return
    fetchRemoteCompletions(id, getAuthHeaders())
      .then((remote) => {
        // remote와 local 병합 (remote 우선)
        setDoneSet((local) => {
          const merged = new Set([...local, ...remote])
          saveDoneLocal(id, merged)
          return merged
        })
      })
      .catch(() => {}) // 실패 시 로컬 유지
  }, [id, userId, getAuthHeaders])

  // ── 로그인 시 잔디 활동 로드 ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    fetchActivity(getAuthHeaders()).then(setActivity).catch(() => {})
  }, [userId, getAuthHeaders])

  // ── 태스크 토글 ─────────────────────────────────────────────────
  const handleToggle = useCallback((taskId) => {
    setDoneSet((prev) => {
      const next = new Set(prev)
      const nowDone = !next.has(taskId)
      if (nowDone) next.add(taskId)
      else next.delete(taskId)
      saveDoneLocal(id, next)
      // 로그인 시 Supabase에도 동기화
      if (userId) {
        toggleRemote(id, taskId, nowDone, getAuthHeaders()).catch(() => {})
      }
      return next
    })
    // Plan SC: SC-02 — Q&A 사용 이력이 있는 태스크만 task_checked 이벤트 발송
    if (qaSessionSet.has(taskId)) {
      logEvent('task_checked', taskId)
    }
  }, [id, userId, getAuthHeaders, logEvent, qaSessionSet])

  const handleQAOpen = useCallback((taskId, context) => {
    setQaTaskContext({ taskId, ...context })
    setQaOpen(true)
    setQaSessionSet((prev) => { const next = new Set(prev); next.add(taskId); return next })
  }, [])

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
    setRerouteError(null)
    setRerouteModalOpen(true)
  }

  // ── GPS 재탐색 — 실제 API 호출 ──────────────────────────────────
  const handleRerouteConfirm = async () => {
    setRerouteError(null)
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
    // 사용자 추가 요청을 줄 단위로 파싱 (빈 줄 제거)
    const parsedUserRequests = userRequests
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)  // 최대 10개
    try {
      const res = await request('/roadmap/reroute', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          original_role:     roadmap._meta?.role ?? 'backend',
          original_period:   reroutePeriod,
          company_type:      roadmap._meta?.company_type ?? 'any',
          completion_rate:   completionRate,
          done_contents:     doneContents,
          weeks_left:        weeksLeft,
          daily_study_hours: roadmap._meta?.daily_study_hours ?? '1to2h',
          user_requests:     parsedUserRequests,
        }),
      })
      const rerouteMeta = { ...roadmap._meta, period: reroutePeriod }
      const newId = saveRoadmapLocal({ ...res, _meta: rerouteMeta })
      // 방향재설정 횟수 증가 (기존 로드맵 ID 기준)
      const newCount = rerouteCount + 1
      if (id) localStorage.setItem(`devnavi_reroute_count_${id}`, String(newCount))
      setUserRequests('')  // 요청 초기화

      // I9: Reroute 결과를 Supabase에도 저장 (로컬 전용 문제 해결)
      if (user) {
        request('/roadmap/persist', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            role:      rerouteMeta?.role ?? roadmap._meta?.role ?? 'backend',
            period:    reroutePeriod,
            roadmap:   res,
            parent_id: id ?? null,
          }),
        }).catch((persistErr) => {
          console.warn('[reroute] Supabase persist 실패 (로컬 저장은 완료):', persistErr)
        })
      }

      navigate(`/roadmap/${newId}`)
    } catch (e) {
      const msg = e.message === 'Failed to fetch'
        ? '서버 응답 시간이 초과됐어요. 잠시 후 다시 시도해주세요.'
        : '재탐색 중 오류: ' + e.message
      setRerouteError(msg)
    } finally {
      setRerouteLoading(false)
    }
  }

  // ── UUID 검증 — hooks 호출 완료 후 early return ─────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) return <Navigate to="/" replace />

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
      <RoadmapHeader
        completionRate={completionRate}
        user={user}
        showGrass={showGrass}
        onToggleGrass={() => setShowGrass((v) => !v)}
        onAuthOpen={() => setAuthOpen(true)}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
        signOut={signOut}
      />

      {/* 자동 저장 실패 알림 */}
      {autoSaveError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
          <span>로드맵 서버 저장에 실패했습니다. 로컬에는 저장되어 있습니다.</span>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => {
                autoSaveDoneRef.current = false
                setAutoSaveError(false)
                setAutoSaveRetry((n) => n + 1)
              }}
              className="font-bold underline hover:opacity-70">
              다시 시도
            </button>
            <button onClick={() => setAutoSaveError(false)} className="font-bold hover:opacity-70">✕</button>
          </div>
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
              <GrassCalendar
                months={roadmap.months}
                activeMonth={activeMonth}
                doneSet={doneSet}
                totalDone={completedCount}
              />
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
              rerouteCount={rerouteCount}
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
                  onQAOpen={handleQAOpen}
                  jobType={roadmap._meta?.role ?? 'backend'}
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
      <RerouteModal
        open={rerouteModalOpen}
        completionRate={completionRate}
        completedCount={completedCount}
        totalCount={totalCount}
        rerouteCount={rerouteCount}
        reroutePeriod={reroutePeriod}
        rerouteLoading={rerouteLoading}
        rerouteError={rerouteError}
        userRequests={userRequests}
        onPeriodChange={setReroutePeriod}
        onUserRequestsChange={setUserRequests}
        onConfirm={handleRerouteConfirm}
        onClose={() => { setRerouteModalOpen(false); setRerouteError(null) }}
      />

      {/* AI Q&A 사이드 패널 */}
      <QAPanel
        isOpen={qaOpen}
        taskContext={qaTaskContext}
        onClose={() => setQaOpen(false)}
      />

      {/* 인증 모달 */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* 커리어 분석 모달 */}
      <CareerSummaryModal
        open={showSummary}
        summary={careerSummary}
        onClose={() => setShowSummary(false)}
      />

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
