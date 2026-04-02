import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { request } from '../lib/api'
import QAStats from '../components/admin/QAStats'

// ── 상수 ────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000 // 30초 자동 갱신

const ENDPOINT_LABELS = {
  '/roadmap/full':           '전체 로드맵',
  '/roadmap/teaser':         '미리보기',
  '/roadmap/career-summary': '커리어 분석',
  '/roadmap/reroute':        'GPS 재탐색',
}

// ── 소형 컴포넌트들 ──────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
        {value ?? '—'}
      </p>
      {sub && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
      )}
    </div>
  )
}

// 단순 SVG 바 차트 (외부 라이브러리 없음)
function BarChart({ data, color = '#6366f1' }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 500
  const H = 100
  const padX = 30
  const padY = 10
  const chartW = W - padX * 2
  const chartH = H - padY * 2
  const barW = Math.floor(chartW / data.length) - 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * chartH, 2)
        const x = padX + i * (chartW / data.length) + 2
        const y = padY + chartH - barH
        const label = d.date.slice(5) // "MM-DD"
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={H - 1}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              className="fill-gray-400"
            >
              {label}
            </text>
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill={color}
                fontWeight="600"
              >
                {d.count}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function ChartCard({ title, data, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{title}</p>
      {data ? <BarChart data={data} color={color} /> : (
        <div className="h-24 flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">
          데이터 없음
        </div>
      )}
    </div>
  )
}

function ErrorTable({ errors }) {
  if (!errors?.length) {
    return (
      <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
        최근 에러 없음
      </p>
    )
  }

  const STATUS_COLOR = {
    500: 'text-red-500',
    502: 'text-orange-500',
    503: 'text-yellow-500',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
            <th className="pb-2 pr-4 font-medium">시각</th>
            <th className="pb-2 pr-4 font-medium">메서드</th>
            <th className="pb-2 pr-4 font-medium">경로</th>
            <th className="pb-2 pr-4 font-medium">상태</th>
            <th className="pb-2 font-medium">메시지</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {errors.map(e => (
            <tr key={e.id} className="text-gray-600 dark:text-gray-400">
              <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-gray-400">
                {new Date(e.created_at).toLocaleString('ko-KR', {
                  month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </td>
              <td className="py-2 pr-4">
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {e.method}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono text-xs max-w-[180px] truncate" title={e.path}>
                {e.path}
              </td>
              <td className={`py-2 pr-4 font-bold font-mono text-xs ${STATUS_COLOR[e.status_code] ?? 'text-red-400'}`}>
                {e.status_code}
              </td>
              <td className="py-2 text-xs text-gray-400 max-w-[200px] truncate" title={e.error_msg}>
                {e.error_msg || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EndpointTable({ breakdown }) {
  const entries = Object.entries(breakdown || {})
    .sort(([, a], [, b]) => b - a)

  if (!entries.length) return (
    <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">오늘 호출 없음</p>
  )

  const total = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="space-y-3">
      {entries.map(([ep, cnt]) => {
        const pct = total ? Math.round((cnt / total) * 100) : 0
        const label = ENDPOINT_LABELS[ep] ?? ep
        return (
          <div key={ep}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-300 font-mono text-xs truncate max-w-[180px]"
                title={ep}>
                {label}
              </span>
              <span className="text-gray-700 dark:text-gray-200 font-semibold text-xs tabular-nums">
                {cnt}회 ({pct}%)
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 dark:bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading, getAuthHeaders } = useAuth()
  const navigate   = useNavigate()
  const [stats,    setStats]    = useState(null)
  const [errors,   setErrors]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [authErr,  setAuthErr]  = useState(false)
  const timerRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!user) return
    try {
      const [s, e] = await Promise.all([
        request('/admin/stats',  { headers: getAuthHeaders() }),
        request('/admin/errors', { headers: getAuthHeaders() }),
      ])
      setStats(s)
      setErrors(e)
      setLastSync(new Date())
      setAuthErr(false)
    } catch (err) {
      // 404 or 401 → 관리자 아님 → 홈으로
      if (err.status === 404 || err.status === 401 || err.status === 403) {
        setAuthErr(true)
      }
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeaders])

  // 인증 완료 후 데이터 로드
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/', { replace: true }); return }
    fetchAll()
  }, [authLoading, user, fetchAll, navigate])

  // 30초 자동 갱신
  useEffect(() => {
    if (!user || authErr) return
    timerRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [user, authErr, fetchAll])

  // 비관리자 → 홈 리다이렉트 (404 받은 경우)
  useEffect(() => {
    if (authErr) navigate('/', { replace: true })
  }, [authErr, navigate])

  // ── 로딩 상태 ────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  // ── 대시보드 ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">

      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="홈으로"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold">관리자 대시보드</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                최근 갱신: {lastSync.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); fetchAll() }}
              className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400
                         hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg
                         transition-colors font-medium flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* 요약 지표 카드 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
            핵심 지표
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard
              label="총 가입자"
              value={stats?.total_users?.toLocaleString()}
              sub="누적 전체"
            />
            <StatCard
              label="오늘 신규"
              value={stats?.new_users_today?.toLocaleString()}
              sub="오늘 기준"
            />
            <StatCard
              label="총 로드맵"
              value={stats?.total_roadmaps?.toLocaleString()}
              sub="누적 전체"
            />
            <StatCard
              label="오늘 로드맵"
              value={stats?.roadmaps_today?.toLocaleString()}
              sub="오늘 기준"
            />
            <StatCard
              label="오늘 API 호출"
              value={stats?.api_calls_today?.toLocaleString()}
              sub="전체 엔드포인트"
            />
            <StatCard
              label="오늘 에러"
              value={stats?.errors_today?.toLocaleString()}
              sub={stats?.errors_today > 0 ? '에러 로그 확인 필요' : '정상'}
            />
          </div>
        </section>

        {/* 차트 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
            최근 7일 추이
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard
              title="일별 신규 가입"
              data={stats?.daily_signups}
              color="#6366f1"
            />
            <ChartCard
              title="일별 로드맵 생성"
              data={stats?.daily_roadmaps}
              color="#10b981"
            />
          </div>
        </section>

        {/* Q&A Analytics */}
        <QAStats />

        {/* 엔드포인트 분석 + 에러 로그 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* 엔드포인트별 호출 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
              오늘 엔드포인트별 호출
            </p>
            <EndpointTable breakdown={stats?.endpoint_breakdown} />
          </div>

          {/* 에러 로그 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                최근 에러 로그
              </p>
              {errors?.length > 0 && (
                <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400
                                 px-2 py-0.5 rounded-full font-medium">
                  {errors.length}건
                </span>
              )}
            </div>
            <ErrorTable errors={errors} />
          </div>
        </section>

      </main>
    </div>
  )
}
