import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/common/Footer'
import ThemeToggle from '../components/common/ThemeToggle'
import ExistingRoadmapModal from '../components/onboarding/ExistingRoadmapModal'
import Step1Form from '../components/onboarding/Step1Form'
import Step2Form from '../components/onboarding/Step2Form'
import TeaserStream from '../components/onboarding/TeaserStream'
import CareerSummaryPanel from '../components/roadmap/CareerSummaryPanel'
import AuthModal from '../components/auth/AuthModal'
import { useSSE } from '../hooks/useSSE'
import { useRoadmapStream } from '../hooks/useRoadmapStream'
import { useAuth } from '../hooks/useAuth'
import { request } from '../lib/api'

// Google OAuth 리다이렉트 후 폼 상태 복원용 sessionStorage 키
const DRAFT_KEY = 'devnavi_onboarding_draft'

// step 상태 상수 (숫자/문자열 혼재 방지)
const STEP = { S1: 1, S2: 2, SUMMARY: 'summary' }

// 복원된 draft 값의 유효성 검증 (주입 방지)
const VALID_ROLES = ['backend', 'frontend', 'cloud_devops', 'fullstack', 'data', 'ai_ml', 'security', 'ios_android', 'qa']
const VALID_PERIODS = ['3months', '6months', '1year', '1year_plus']
const VALID_LEVELS = ['beginner', 'basic', 'some_exp', 'career_change']
const VALID_COMPANY_TYPES = ['startup', 'msp', 'bigco', 'si', 'foreign', 'any']
const VALID_STUDY_HOURS = ['under1h', '1to2h', '3to4h', 'over5h']

function _isValidDraft(s1, s2) {
  return (
    VALID_ROLES.includes(s1?.role) &&
    VALID_PERIODS.includes(s1?.period) &&
    VALID_LEVELS.includes(s1?.level) &&
    Array.isArray(s2?.skills) &&
    Array.isArray(s2?.certifications) &&
    VALID_COMPANY_TYPES.includes(s2?.company_type) &&
    VALID_STUDY_HOURS.includes(s2?.daily_study_hours)
  )
}

// ── 파라미터 캐시 유틸 ─────────────────────────────────────────────────
/** 생성 파라미터를 정렬된 문자열 키로 변환 (캐시 비교용) */
function computeParamsKey(s1, s2) {
  return [
    s1.role, s1.period, s1.level,
    [...(s2.skills         || [])].sort().join(','),
    [...(s2.certifications || [])].sort().join(','),
    s2.company_type,
    s2.daily_study_hours,
  ].join('|')
}

/** devnavi_archived_* 에서 동일 paramsKey를 가진 보관 로드맵 ID 반환 */
function findArchivedRoadmap(paramsKey) {
  const match = Object.keys(localStorage)
    .filter(k => k.startsWith('devnavi_archived_'))
    .find(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k))
        return data?._meta?.paramsKey === paramsKey
      } catch { return false }
    })
  return match ? match.replace('devnavi_archived_', '') : null
}

/** 보관된 로드맵을 활성 상태로 복원 */
function restoreArchivedRoadmap(id) {
  const roadmap = localStorage.getItem(`devnavi_archived_${id}`)
  if (roadmap) {
    localStorage.setItem(`devnavi_roadmap_${id}`, roadmap)
    localStorage.removeItem(`devnavi_archived_${id}`)
  }
  const summary = localStorage.getItem(`devnavi_archived_summary_${id}`)
  if (summary) {
    localStorage.setItem(`devnavi_summary_${id}`, summary)
    localStorage.removeItem(`devnavi_archived_summary_${id}`)
  }
}

/** 오래된 보관 로드맵 정리 (최대 3개 유지) */
function pruneArchivedRoadmaps() {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith('devnavi_archived_') && !k.includes('_summary_'))
  if (keys.length <= 3) return
  // 가장 오래된 것부터 제거 (키 기준 정렬)
  keys.sort().slice(0, keys.length - 3).forEach(k => {
    const id = k.replace('devnavi_archived_', '')
    localStorage.removeItem(k)
    localStorage.removeItem(`devnavi_archived_summary_${id}`)
  })
}

const STEP1_INITIAL = {
  role: '',
  period: '',
  level: '',
}

const STEP2_INITIAL = {
  skills: [],
  certifications: [],
  company_type: 'any',
  daily_study_hours: '1to2h',
}

function isStep1Complete(v) {
  return v.role && v.period && v.level
}

function isStep2Complete(v) {
  return !!v.daily_study_hours
}

/** 전체 로드맵 생성 중 로딩 화면 */
function FullRoadmapLoading({ progress }) {
  const [timerProgress, setTimerProgress] = useState(0)

  // Lambda/CloudFront SSE 버퍼링으로 청크가 한꺼번에 도착할 수 있어
  // 청크 카운트 기반 progress가 0에 머무는 문제를 타이머로 보완
  useEffect(() => {
    const DURATION = 75000 // 75초에 90%까지 (ease-out 곡선)
    const start = Date.now()
    const id = setInterval(() => {
      const ratio = Math.min((Date.now() - start) / DURATION, 1)
      // ease-out: 처음엔 빠르게, 마지막엔 느리게
      setTimerProgress(Math.round(90 * (1 - Math.pow(1 - ratio, 2))))
    }, 600)
    return () => clearInterval(id)
  }, [])

  // 청크 기반 progress와 타이머 중 더 큰 값 사용
  const display = Math.max(progress, timerProgress)

  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm p-8 text-center space-y-5">
      <div className="flex gap-1 justify-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-3 h-3 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div>
        <p className="text-gray-700 dark:text-white/80 font-bold text-sm">
          AI가 맞춤 로드맵을 생성하고 있어요 ✨
        </p>
        <p className="text-gray-400 dark:text-white/70 text-xs mt-1">
          스킬·목표 회사·학습 시간을 모두 반영 중…
        </p>
      </div>
      {/* 진행 바 */}
      <div className="w-full h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-700"
          style={{ width: `${display}%` }}
        />
      </div>
      <p className="text-xs text-indigo-400 font-medium">{display}%</p>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  useEffect(() => {
    document.title = '시작하기 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  const [step, setStep] = useState(STEP.S1)  // STEP.S1 | STEP.S2 | STEP.SUMMARY
  const [step1, setStep1] = useState(STEP1_INITIAL)
  const [step2, setStep2] = useState(STEP2_INITIAL)
  const [careerSummary, setCareerSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // 로그인 모달
  const [showAuth, setShowAuth] = useState(false)
  // 로그인 완료 후 실행할 pending 액션 ('summary' | null)
  const pendingActionRef = useRef(null)
  // 로드맵 생성 중복 호출 방지
  const generatingRef = useRef(false)

  // 기존 로드맵 감지 모달
  const [existingRoadmapId, setExistingRoadmapId] = useState(null)

  // ── 기존 로드맵 존재 여부 확인 ──────────────────────────────────
  useEffect(() => {
    if (!user) return
    // OAuth 복원 중이면 스킵 (sessionStorage draft가 있을 때)
    const hasDraft = !!sessionStorage.getItem(DRAFT_KEY)
    if (hasDraft) return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('devnavi_roadmap_'))
    if (keys.length > 0) {
      const id = keys[keys.length - 1].replace('devnavi_roadmap_', '')
      setExistingRoadmapId(id)
    }
  }, [user])

  // ── Google OAuth 리다이렉트 복원 ──────────────────────────────────
  // Google로 로그인하면 /onboarding으로 리다이렉트됨 → 폼 상태 복원
  useEffect(() => {
    if (!user) return
    const saved = sessionStorage.getItem(DRAFT_KEY)
    if (!saved) return
    try {
      const { step1: s1, step2: s2 } = JSON.parse(saved)
      sessionStorage.removeItem(DRAFT_KEY)
      if (!_isValidDraft(s1, s2)) return  // 유효하지 않은 draft 무시
      setStep1(s1)
      setStep2(s2)
      setStep(STEP.S2)
      // step 2 복원 완료 → 커리어 분석 자동 실행 트리거
      pendingActionRef.current = 'summary'
    } catch {
      sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [user])

  // ── 로그인 완료 감지 → pending 액션 실행 ─────────────────────────
  useEffect(() => {
    if (!user || !pendingActionRef.current) return
    if (pendingActionRef.current === 'summary') {
      pendingActionRef.current = null
      setShowAuth(false)
      _doCareerSummary()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── 커리어 분석 API 실제 호출 (로그인 확인 후 실행) ──────────────
  const _doCareerSummary = async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    setStep(STEP.SUMMARY)
    try {
      const data = await request('/roadmap/career-summary', {
        method: 'POST',
        headers: user ? { Authorization: `Bearer ${user.accessToken}` } : {},
        body: JSON.stringify({
          role: step1.role,
          period: step1.period,
          level: step1.level,
          skills: step2.skills,
          certifications: step2.certifications,
          company_type: step2.company_type,
        }),
      })
      setCareerSummary(data)
    } catch (e) {
      setSummaryError(e?.message || '오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSummaryLoading(false)
    }
  }

  // 티저 스트리밍
  const { text: teaserText, isStreaming: teaserStreaming, error: teaserError, start: startTeaser } = useSSE()

  // 전체 로드맵 스트리밍
  const { isStreaming: fullStreaming, progress, error: fullError, start: startFull } = useRoadmapStream({
    onSaved: async (id, roadmap) => {
      // _meta에 입력 정보 저장 (GPS 재탐색 + 파라미터 캐시용)
      const withMeta = {
        ...roadmap,
        _meta: {
          role: step1.role,
          period: step1.period,
          level: step1.level,
          skills: step2.skills,
          certifications: step2.certifications,
          company_type: step2.company_type,
          daily_study_hours: step2.daily_study_hours,
          paramsKey: computeParamsKey(step1, step2),
        },
      }

      // 1. localStorage에 항상 저장 (오프라인 대응)
      // _isLocal: true → 비로그인 상태로 생성된 로드맵 표시 (RoadmapPage에서 로그인 시 자동 서버 저장용)
      if (!user) withMeta._isLocal = true
      localStorage.setItem(`devnavi_roadmap_${id}`, JSON.stringify(withMeta))
      if (careerSummary) {
        localStorage.setItem(`devnavi_summary_${id}`, JSON.stringify(careerSummary))
      }

      // 2. 로그인 상태면 Supabase에도 저장
      if (user) {
        try {
          const { roadmap_id: serverId } = await request('/roadmap/persist', {
            method: 'POST',
            headers: { Authorization: `Bearer ${user.accessToken}` },
            body: JSON.stringify({
              role: step1.role,
              period: step1.period,
              roadmap: withMeta,
            }),
          })
          // localStorage를 서버 ID로 이전
          localStorage.setItem(`devnavi_roadmap_${serverId}`, JSON.stringify(withMeta))
          if (careerSummary) {
            localStorage.setItem(`devnavi_summary_${serverId}`, JSON.stringify(careerSummary))
          }
          localStorage.removeItem(`devnavi_roadmap_${id}`)
          if (careerSummary) localStorage.removeItem(`devnavi_summary_${id}`)
          navigate(`/roadmap/${serverId}`)
          return
        } catch {
          // Supabase 저장 실패 → 로컬 ID로 계속
        }
      }

      navigate(`/roadmap/${id}`)
    },
  })

  // Step 1 제출 → 티저 스트리밍
  const handleStep1Submit = () => {
    if (!isStep1Complete(step1)) return
    startTeaser('/roadmap/teaser', {
      role: step1.role,
      period: step1.period,
      level: step1.level,
    })
    // setStep('teaser') 제거 — step 1 내에서 TeaserStream 인라인 표시
    // (teaser 실패 시 버튼이 다시 나타나는 fallback 보장)
  }

  // Step 2 제출 → 로그인 확인 → 커리어 분석
  const handleStep2Submit = () => {
    if (!isStep2Complete(step2)) return
    if (!user) {
      // Google OAuth 대비 폼 상태를 sessionStorage에 저장
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step1, step2 }))
      pendingActionRef.current = 'summary'
      setShowAuth(true)
      return
    }
    _doCareerSummary()
  }

  // summary 스텝 → 전체 로드맵 SSE 스트리밍 (캐시 우선 확인)
  const handleStartGenerate = () => {
    if (fullStreaming || generatingRef.current) return
    generatingRef.current = true

    // ── 보관된 로드맵 캐시 확인 ─────────────────────────────────────
    const paramsKey = computeParamsKey(step1, step2)
    const archivedId = findArchivedRoadmap(paramsKey)
    if (archivedId) {
      // 동일 파라미터 → API 호출 없이 복원
      restoreArchivedRoadmap(archivedId)
      generatingRef.current = false
      navigate(`/roadmap/${archivedId}`, { replace: true })
      return
    }

    // ── 신규 생성 (스텝 전환 없이 summary 내에서 로딩 인라인 표시) ──
    startFull(
      {
        role: step1.role,
        period: step1.period,
        level: step1.level,
        skills: step2.skills,
        certifications: step2.certifications,
        company_type: step2.company_type,
        daily_study_hours: step2.daily_study_hours,
      },
      user ? { Authorization: `Bearer ${user.accessToken}` } : {},
    )
    generatingRef.current = false
  }

  const stepIndex = step === STEP.S1 ? 0
    : step === STEP.S2 ? 1
    : 2  // STEP.SUMMARY

  // 기존 로드맵 핸들러
  const handleGoExisting = () => {
    navigate(`/roadmap/${existingRoadmapId}`, { replace: true })
  }
  const handleDeleteAndNew = () => {
    // 즉시 삭제 대신 보관(archive) → 동일 파라미터 재생성 시 API 호출 없이 복원 가능
    Object.keys(localStorage)
      .filter(k => k.startsWith('devnavi_roadmap_'))
      .forEach(k => {
        const id = k.replace('devnavi_roadmap_', '')
        const data = localStorage.getItem(k)
        if (data) localStorage.setItem(`devnavi_archived_${id}`, data)
        localStorage.removeItem(k)

        const summary = localStorage.getItem(`devnavi_summary_${id}`)
        if (summary) {
          localStorage.setItem(`devnavi_archived_summary_${id}`, summary)
          localStorage.removeItem(`devnavi_summary_${id}`)
        }
        // 완료 목록은 재생성 시 리셋
        localStorage.removeItem(`devnavi_done_${id}`)
      })
    // 보관함 3개 초과 시 오래된 것 정리
    pruneArchivedRoadmaps()
    setExistingRoadmapId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      {/* 기존 로드맵 안내 모달 */}
      {existingRoadmapId && (
        <ExistingRoadmapModal
          roadmapId={existingRoadmapId}
          onGoExisting={handleGoExisting}
          onDeleteAndNew={handleDeleteAndNew}
        />
      )}

      {/* 로그인 모달 */}
      <AuthModal
        open={showAuth}
        onClose={() => {
          setShowAuth(false)
          // 이메일 로그인 성공 시 user가 설정되면 useEffect에서 자동 처리
        }}
      />

      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/10 px-6 py-4
        flex items-center justify-between sticky top-0 z-10">
        <span className="text-lg font-black text-indigo-600 tracking-tight">
          Dev<span className="text-gray-800 dark:text-white">Navi</span>
        </span>
        <div className="flex items-center gap-2 text-sm">
          {['직군 선택', '상세 정보', '커리어 분석'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${i <= stepIndex ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-white/10'}`} />
              )}
              <span className={`font-medium
                ${i === stepIndex ? 'text-indigo-600 dark:text-indigo-400' : i < stepIndex ? 'text-indigo-300 dark:text-indigo-500/60' : 'text-gray-300 dark:text-white/50'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
        {/* 테마 토글 + 로그인 상태 */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-white/70 truncate max-w-[140px]">{user.email}</span>
              <button
                onClick={signOut}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-500 dark:text-white/85 transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">

        {/* ── Step 1 + 티저 (인라인 전환) ── */}
        {step === STEP.S1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                어떤 개발자가 되고 싶으세요?
              </h1>
              <p className="text-gray-400 dark:text-white/70 text-sm mt-1">
                3가지만 알려주시면 AI가 맞춤 로드맵을 즉시 만들어드려요
              </p>
            </div>

            <Step1Form values={step1} onChange={setStep1} />

            {/* 티저 스트리밍 중이거나 결과 있으면 TeaserStream 표시, 아니면 버튼 */}
            {(teaserStreaming || teaserText || teaserError) ? (
              <TeaserStream
                text={teaserText}
                isStreaming={teaserStreaming}
                error={teaserError}
                onDeepDive={() => setStep(STEP.S2)}
                onRetry={handleStep1Submit}
              />
            ) : (
              <button
                disabled={!isStep1Complete(step1)}
                onClick={handleStep1Submit}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                  disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 dark:disabled:text-white/60
                  text-white font-bold text-base rounded-2xl transition-colors">
                AI 로드맵 생성하기 ✨
              </button>
            )}
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === STEP.S2 && (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep(STEP.S1)}
                className="text-sm text-gray-400 dark:text-white/70 hover:text-gray-600 dark:hover:text-white/70 mb-4 flex items-center gap-1">
                ← 이전으로
              </button>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                조금 더 알려주세요
              </h1>
              <p className="text-gray-400 dark:text-white/70 text-sm mt-1">
                스킬과 목표를 반영한 주차별 체크리스트를 만들어드려요
              </p>
            </div>

            <Step2Form values={step2} onChange={setStep2} role={step1.role} />

            <button
              disabled={!isStep2Complete(step2)}
              onClick={handleStep2Submit}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 dark:disabled:text-white/60
                text-white font-bold text-base rounded-2xl transition-colors">
              {user ? '커리어 분석하기 →' : '로그인하고 커리어 분석하기 →'}
            </button>
          </div>
        )}

        {/* ── 커리어 분석 요약 ── */}
        {step === STEP.SUMMARY && (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep(STEP.S2)}
                className="text-sm text-gray-400 dark:text-white/70 hover:text-gray-600 dark:hover:text-white/70 mb-4 flex items-center gap-1">
                ← 이전으로
              </button>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                AI 분석 완료!
              </h1>
              <p className="text-gray-400 dark:text-white/70 text-sm mt-1">
                지금 상황에 맞는 학습 우선순위를 확인하세요
              </p>
            </div>

            {summaryLoading ? (
              <div className="rounded-2xl bg-white dark:bg-white/5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm p-10 text-center space-y-4">
                <div className="flex gap-1 justify-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-gray-500 dark:text-white/85 font-semibold text-sm">커리어 분석 중…</p>
                <p className="text-gray-400 dark:text-white/60 text-xs">보유 스킬과 목표를 비교하고 있어요</p>
              </div>
            ) : summaryError ? (
              <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 text-center space-y-3">
                <p className="text-red-600 dark:text-red-400 font-semibold text-sm">분석 중 오류가 발생했어요</p>
                <p className="text-red-400 dark:text-red-400/70 text-xs">{summaryError}</p>
                <button onClick={_doCareerSummary}
                  className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors">
                  다시 시도
                </button>
              </div>
            ) : careerSummary ? (
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-5">
                <CareerSummaryPanel summary={careerSummary} />
              </div>
            ) : null}

            {/* ── 로드맵 생성 버튼 / 로딩 / 에러 (인라인 전환) ── */}
            {!summaryLoading && (
              fullStreaming ? (
                <FullRoadmapLoading progress={progress} />
              ) : fullError ? (
                <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 text-center space-y-3">
                  <p className="text-red-600 dark:text-red-400 font-semibold text-sm">로드맵 생성 중 오류가 발생했어요</p>
                  <p className="text-red-400 dark:text-red-400/70 text-xs">{fullError.message}</p>
                  <button
                    onClick={handleStartGenerate}
                    className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors">
                    다시 시도
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartGenerate}
                  disabled={!careerSummary && !summaryError}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                    disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 dark:disabled:text-white/60
                    text-white font-bold text-base rounded-2xl transition-colors">
                  로드맵 생성하기 ✨
                </button>
              )
            )}
          </div>
        )}
      </main>

      {/* AI 면책 고지 */}
      <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-white/10 px-6 py-3 text-center text-xs text-gray-400 dark:text-white/60">
        ⚠️ AI가 생성한 로드맵은 참고용입니다. 실제 채용 결과와 다를 수 있으며, DevNavi는 결과의 정확성에 대한 법적 책임을 지지 않습니다.
      </div>
      <Footer />
    </div>
  )
}
