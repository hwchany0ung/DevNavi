import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Step1Form from '../components/onboarding/Step1Form'
import Step2Form from '../components/onboarding/Step2Form'
import TeaserStream from '../components/onboarding/TeaserStream'
import CareerSummaryPanel from '../components/roadmap/CareerSummaryPanel'
import { useSSE } from '../hooks/useSSE'
import { useRoadmapStream } from '../hooks/useRoadmapStream'
import { request } from '../lib/api'

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
  const [step, setStep] = useState(1)       // 1 | 'teaser' | 2 | 'summary' | 'generating'
  const [step1, setStep1] = useState(STEP1_INITIAL)
  const [step2, setStep2] = useState(STEP2_INITIAL)
  const [careerSummary, setCareerSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // 티저 스트리밍
  const { text: teaserText, isStreaming: teaserStreaming, error: teaserError, start: startTeaser } = useSSE()

  // 전체 로드맵 스트리밍
  const { isStreaming: fullStreaming, progress, error: fullError, start: startFull } = useRoadmapStream({
    onSaved: (id, roadmap) => {
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
      localStorage.setItem(`careerpath_roadmap_${id}`, JSON.stringify(withMeta))
      // 커리어 분석 결과도 로드맵 ID에 연결해 저장
      if (careerSummary) {
        localStorage.setItem(`careerpath_summary_${id}`, JSON.stringify(careerSummary))
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

  // Step 2 제출 → 커리어 분석 요약 (summary 스텝)
  const handleStep2Submit = async () => {
    if (!isStep2Complete(step2)) return
    setSummaryLoading(true)
    setSummaryError(null)
    setStep('summary')
    try {
      const data = await request('/roadmap/career-summary', {
        method: 'POST',
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

  // summary 스텝 → 전체 로드맵 SSE 스트리밍
  const handleStartGenerate = () => {
    if (fullStreaming) return
    setStep('generating')
    startFull({
      role: step1.role,
      period: step1.period,
      level: step1.level,
      skills: step2.skills,
      certifications: step2.certifications,
      company_type: step2.company_type,
      daily_study_hours: step2.daily_study_hours,
    })
  }

  const stepIndex = (step === 1 || step === 'teaser') ? 0
    : step === 2 ? 1
    : step === 'summary' ? 2
    : 2

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4
        flex items-center justify-between sticky top-0 z-10">
        <span className="text-lg font-black text-indigo-600 tracking-tight">
          Career<span className="text-gray-800">Path</span>
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
              커리어 분석하기 →
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
                <button onClick={handleStep2Submit}
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
