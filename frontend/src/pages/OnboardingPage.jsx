import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  return (
    <div className="rounded-2xl bg-white border border-indigo-100 shadow-sm p-8 text-center space-y-5">
      <div className="flex gap-1 justify-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-3 h-3 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div>
        <p className="text-gray-700 font-bold text-sm">
          AI가 맞춤 로드맵을 생성하고 있어요 ✨
        </p>
        <p className="text-gray-400 text-xs mt-1">
          스킬·목표 회사·학습 시간을 모두 반영 중…
        </p>
      </div>
      {/* 진행 바 */}
      <div className="w-full h-2 rounded-full bg-indigo-100 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-indigo-400 font-medium">{progress}%</p>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState(1)       // 1 | 'teaser' | 2 | 'summary' | 'generating'
  const [step1, setStep1] = useState(STEP1_INITIAL)
  const [step2, setStep2] = useState(STEP2_INITIAL)
  const [careerSummary, setCareerSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // 로그인 모달
  const [showAuth, setShowAuth] = useState(false)
  // 로그인 완료 후 실행할 pending 액션 ('summary' | null)
  const pendingActionRef = useRef(null)

  // ── Google OAuth 리다이렉트 복원 ──────────────────────────────────
  // Google로 로그인하면 /onboarding으로 리다이렉트됨 → 폼 상태 복원
  useEffect(() => {
    if (!user) return
    const saved = sessionStorage.getItem(DRAFT_KEY)
    if (!saved) return
    try {
      const { step1: s1, step2: s2 } = JSON.parse(saved)
      sessionStorage.removeItem(DRAFT_KEY)
      setStep1(s1)
      setStep2(s2)
      setStep(2)
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
    setStep('summary')
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
      setSummaryError(e.message)
    } finally {
      setSummaryLoading(false)
    }
  }

  // 티저 스트리밍
  const { text: teaserText, isStreaming: teaserStreaming, error: teaserError, start: startTeaser } = useSSE()

  // 전체 로드맵 스트리밍
  const { isStreaming: fullStreaming, progress, error: fullError, start: startFull } = useRoadmapStream({
    onSaved: async (id, roadmap) => {
      // _meta에 입력 정보 저장 (GPS 재탐색용)
      const withMeta = {
        ...roadmap,
        _meta: {
          role: step1.role,
          period: step1.period,
          company_type: step2.company_type,
          daily_study_hours: step2.daily_study_hours,
        },
      }

      // 1. localStorage에 항상 저장 (오프라인 대응)
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
    setStep('teaser')
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

  // summary 스텝 → 전체 로드맵 SSE 스트리밍
  const handleStartGenerate = () => {
    if (fullStreaming) return
    setStep('generating')
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
      // Authorization 헤더 전달 (/roadmap/full 은 로그인 필수)
      user ? { Authorization: `Bearer ${user.accessToken}` } : {},
    )
  }

  const stepIndex = (step === 1 || step === 'teaser') ? 0
    : step === 2 ? 1
    : step === 'summary' ? 2
    : 2

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 로그인 모달 */}
      <AuthModal
        open={showAuth}
        onClose={() => {
          setShowAuth(false)
          // 이메일 로그인 성공 시 user가 설정되면 useEffect에서 자동 처리
        }}
      />

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4
        flex items-center justify-between sticky top-0 z-10">
        <span className="text-lg font-black text-indigo-600 tracking-tight">
          Dev<span className="text-gray-800">Navi</span>
        </span>
        {/* 로드맵 생성 중에는 스텝 인디케이터 숨김 */}
        {step !== 'generating' && (
          <div className="flex items-center gap-2 text-sm">
            {['직군 선택', '상세 정보', '커리어 분석'].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`w-8 h-px ${i <= stepIndex ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                )}
                <span className={`font-medium
                  ${i === stepIndex ? 'text-indigo-600' : i < stepIndex ? 'text-indigo-300' : 'text-gray-300'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* 로그인 상태 표시 */}
        {user && (
          <span className="text-xs text-gray-400 hidden sm:block">
            {user.email}
          </span>
        )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">

        {/* ── Step 1 + 티저 ── */}
        {(step === 1 || step === 'teaser') && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                어떤 개발자가 되고 싶으세요?
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                3가지만 알려주시면 AI가 맞춤 로드맵을 즉시 만들어드려요
              </p>
            </div>

            <Step1Form values={step1} onChange={setStep1} />

            {step === 1 && (
              <button
                disabled={!isStep1Complete(step1)}
                onClick={handleStep1Submit}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                  disabled:bg-gray-200 disabled:text-gray-400
                  text-white font-bold text-base rounded-2xl transition-colors">
                AI 로드맵 생성하기 ✨
              </button>
            )}

            {step === 'teaser' && (
              <TeaserStream
                text={teaserText}
                isStreaming={teaserStreaming}
                error={teaserError}
                onDeepDive={() => setStep(2)}
              />
            )}
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep('teaser')}
                className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
                ← 이전으로
              </button>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                조금 더 알려주세요
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                스킬과 목표를 반영한 주차별 체크리스트를 만들어드려요
              </p>
            </div>

            <Step2Form values={step2} onChange={setStep2} role={step1.role} />

            <button
              disabled={!isStep2Complete(step2)}
              onClick={handleStep2Submit}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                disabled:bg-gray-200 disabled:text-gray-400
                text-white font-bold text-base rounded-2xl transition-colors">
              {user ? '커리어 분석하기 →' : '로그인하고 커리어 분석하기 →'}
            </button>
          </div>
        )}

        {/* ── 커리어 분석 요약 ── */}
        {step === 'summary' && (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep(2)}
                className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
                ← 이전으로
              </button>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                AI 분석 완료!
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                지금 상황에 맞는 학습 우선순위를 확인하세요
              </p>
            </div>

            {summaryLoading ? (
              <div className="rounded-2xl bg-white border border-indigo-100 shadow-sm p-10 text-center space-y-4">
                <div className="flex gap-1 justify-center">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <p className="text-gray-500 font-semibold text-sm">커리어 분석 중…</p>
                <p className="text-gray-400 text-xs">보유 스킬과 목표를 비교하고 있어요</p>
              </div>
            ) : summaryError ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
                <p className="text-red-600 font-semibold text-sm">분석 중 오류가 발생했어요</p>
                <p className="text-red-400 text-xs">{summaryError}</p>
                <button onClick={_doCareerSummary}
                  className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors">
                  다시 시도
                </button>
              </div>
            ) : careerSummary ? (
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <CareerSummaryPanel summary={careerSummary} />
              </div>
            ) : null}

            {!summaryLoading && (
              <button
                onClick={handleStartGenerate}
                disabled={!careerSummary && !summaryError}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700
                  disabled:bg-gray-200 disabled:text-gray-400
                  text-white font-bold text-base rounded-2xl transition-colors">
                로드맵 생성하기 ✨
              </button>
            )}
          </div>
        )}

        {/* ── 생성 중 ── */}
        {step === 'generating' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                로드맵 생성 중
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                완성되면 자동으로 이동해드려요
              </p>
            </div>
            {fullError ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
                <p className="text-red-600 font-semibold text-sm">오류가 발생했어요</p>
                <p className="text-red-400 text-xs">{fullError.message}</p>
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors">
                  다시 시도
                </button>
              </div>
            ) : (
              <FullRoadmapLoading progress={progress} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
