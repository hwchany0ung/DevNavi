// Design Ref: security-monitoring-fe.design.md §1-4
// Plan SC: AdminPage 보안 탭에서 이벤트 목록 확인 가능
import { useEffect, useState, useRef, useCallback } from 'react'
import { request } from '../../lib/api'
import StatCard from '../common/StatCard'

// ── 상수 ────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000 // 30초 자동 갱신 (독립 생명주기)

const EVENT_TYPE_CONFIG = {
  rate_limit_exceeded: {
    label: 'Rate Limit',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  auth_failure: {
    label: '인증 실패',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
}

const STATUS_COLOR = {
  429: 'text-orange-500',
  401: 'text-red-500',
}

// ── SecurityEventTable ─────────────────────────────────────────

function SecurityEventTable({ events }) {
  if (!events?.length) {
    return (
      <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
        최근 보안 이벤트 없음
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
            <th className="pb-2 pr-4 font-medium">시각</th>
            <th className="pb-2 pr-4 font-medium">유형</th>
            <th className="pb-2 pr-4 font-medium">IP</th>
            <th className="pb-2 pr-4 font-medium">경로</th>
            <th className="pb-2 font-medium">상태코드</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {events.map((e) => {
            const cfg = EVENT_TYPE_CONFIG[e.event_type] || {
              label: e.event_type,
              color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
            }
            return (
              <tr key={e.id} className="text-gray-600 dark:text-gray-400">
                <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-gray-400">
                  {new Date(e.created_at).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{e.ip || '-'}</td>
                <td
                  className="py-2 pr-4 font-mono text-xs max-w-[180px] truncate"
                  title={e.path}
                >
                  {e.path}
                </td>
                <td
                  className={`py-2 font-bold font-mono text-xs ${STATUS_COLOR[e.status_code] ?? 'text-gray-400'}`}
                >
                  {e.status_code}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── SecurityEvents (메인 컴포넌트) ──────────────────────────────

export default function SecurityEvents() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const timerRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await request('/admin/security-events')
      setData(res)
      setError(false)
    } catch (e) {
      console.warn('[SecurityEvents] 로드 실패:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // 마운트 시 첫 로드
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 30초 자동 갱신
  useEffect(() => {
    if (error) return
    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [error, fetchData])

  // ── 로딩 스켈레톤 ────────────────────────────────────────────
  if (loading) {
    return (
      <section>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // ── 에러 배너 ────────────────────────────────────────────────
  if (error) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          보안 모니터링
        </h2>
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4">
          <svg
            className="w-5 h-5 text-red-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              보안 이벤트를 불러오지 못했습니다.
            </p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
              잠시 후 페이지를 새로고침해 주세요.
            </p>
          </div>
        </div>
      </section>
    )
  }

  // ── 정상 렌더링 ──────────────────────────────────────────────
  const summary = data?.summary || {}

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        보안 모니터링
      </h2>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Rate Limit 초과"
          value={summary.rate_limit_today?.toLocaleString() ?? '0'}
          sub="오늘 429 이벤트"
        />
        <StatCard
          label="인증 실패"
          value={summary.auth_failure_today?.toLocaleString() ?? '0'}
          sub="오늘 401 이벤트"
        />
      </div>

      {/* 이벤트 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            최근 보안 이벤트
          </p>
          {data?.events?.length > 0 && (
            <span className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">
              {data.events.length}건
            </span>
          )}
        </div>
        <SecurityEventTable events={data?.events} />
      </div>
    </section>
  )
}
