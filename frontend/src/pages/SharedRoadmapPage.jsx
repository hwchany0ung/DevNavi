import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MonthTimeline from '../components/roadmap/MonthTimeline'
import WeekAccordion from '../components/roadmap/WeekAccordion'
import Footer from '../components/common/Footer'
import { request } from '../lib/api'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 공유 로드맵 공개 조회 페이지 — 읽기 전용, 인증 불필요.
 * 라우트: /roadmap/shared/:token
 */
export default function SharedRoadmapPage() {
  const { token }  = useParams()
  const navigate   = useNavigate()

  const [roadmap,     setRoadmap]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [activeMonth, setActiveMonth] = useState(1)

  useEffect(() => {
    document.title = '공유된 로드맵 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  useEffect(() => {
    if (!token || !UUID_RE.test(token)) {
      setError('유효하지 않은 공유 링크입니다.')
      setLoading(false)
      return
    }
    setLoading(true)
    request(`/roadmap/shared/${token}`)
      .then((data) => {
        // 서비스가 data 필드 (로드맵 JSON)를 최상위 data 키로 반환
        const rm = data.data ?? data
        setRoadmap({ ...data, ...(typeof rm === 'object' ? rm : {}) })
        setActiveMonth(1)
      })
      .catch((e) => setError(e.message || '로드맵을 불러오지 못했어요.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-400 dark:text-white/40 text-sm">공유 로드맵을 불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (error || !roadmap) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <p className="text-5xl">🔗</p>
          <p className="text-gray-700 dark:text-white font-semibold">
            {error || '로드맵을 찾을 수 없습니다.'}
          </p>
          <p className="text-sm text-gray-400 dark:text-white/40">공유 링크가 만료됐거나 삭제된 로드맵입니다.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const months = roadmap.months ?? []
  const currentMonth = months.find((m) => m.month === activeMonth)
  const EMPTY_SET = new Set()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/10 px-4 sm:px-6 py-4
        flex items-center justify-between sticky top-0 z-20">
        <a href="/" className="text-lg font-black text-indigo-600 tracking-tight hover:opacity-80 transition-opacity">
          Dev<span className="text-gray-800 dark:text-white">Navi</span>
        </a>
        <span className="text-xs text-gray-400 dark:text-white/40 bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-xl font-medium">
          읽기 전용
        </span>
      </header>

      {/* 공유 배너 */}
      <div className="bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20 px-4 py-3 text-center">
        <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
          공유된 로드맵입니다. 체크박스는 비활성화되어 있습니다.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <aside className="hidden sm:flex flex-col w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-white/10
          sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* 퍼소나 카드 */}
            <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 space-y-1">
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {roadmap.persona_title || '로드맵'}
              </p>
              {roadmap.persona_subtitle && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400">{roadmap.persona_subtitle}</p>
              )}
              {roadmap.summary && (
                <p className="text-xs text-gray-500 dark:text-white/50 mt-1 line-clamp-3">{roadmap.summary}</p>
              )}
            </div>

            <MonthTimeline
              months={months}
              activeMonth={activeMonth}
              doneSet={EMPTY_SET}
              onSelect={setActiveMonth}
            />
          </div>
        </aside>

        {/* 메인 */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 sm:pl-8">
          {currentMonth ? (
            <div className="max-w-2xl mx-auto space-y-4">
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
                    disabled={activeMonth >= months.length}
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
                  doneSet={EMPTY_SET}
                  onToggle={null}
                  onQAOpen={null}
                  jobType={roadmap.role ?? 'backend'}
                  readOnly
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

      {/* CTA */}
      <div className="bg-indigo-600 px-6 py-5 text-center">
        <p className="text-white font-bold text-sm mb-3">이 로드맵으로 나만의 커리어를 시작하세요!</p>
        <button
          onClick={() => navigate('/onboarding')}
          className="px-6 py-2.5 bg-white text-indigo-700 font-black text-sm rounded-xl hover:bg-indigo-50 transition-colors">
          이 로드맵으로 시작하기
        </button>
      </div>

      {/* 면책 고지 + 푸터 */}
      <div className="mt-auto">
        <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-white/10 px-6 py-3 text-center text-xs text-gray-400 dark:text-white/30">
          ⚠️ 본 로드맵은 AI가 생성한 참고 자료입니다. 실제 취업·학습 결과는 개인 역량 및 시장 상황에 따라 다를 수 있으며, DevNavi는 결과의 정확성에 대한 법적 책임을 지지 않습니다.
        </div>
        <Footer />
      </div>
    </div>
  )
}
