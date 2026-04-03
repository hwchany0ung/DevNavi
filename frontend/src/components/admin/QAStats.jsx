// Design Ref: §5.2 — QAStats: 독립 데이터 페칭 + Admin 통계 카드
import { useEffect, useState } from 'react'
import { request } from '../../lib/api'
import StatCard from '../common/StatCard'

function MiniBarChart({ data }) {
  if (!data?.length) return <div className="text-xs text-gray-400">데이터 없음</div>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-indigo-400 dark:bg-indigo-500 rounded-sm transition-all"
            style={{ height: `${Math.max((d.count / max) * 36, 2)}px` }}
            title={`${d.date}: ${d.count}건`}
          />
        </div>
      ))}
    </div>
  )
}

export default function QAStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)  // C2: 에러 상태

  useEffect(() => {
    request('/admin/qa/stats')
      .then(setStats)
      .catch((e) => {
        console.warn('[QAStats] 통계 로드 실패:', e)
        setError(true)  // C2: 에러 플래그 설정
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // C2: 에러 배너 표시
  if (error) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Q&A Analytics
        </h2>
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Q&A 통계를 불러오지 못했습니다.</p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">잠시 후 페이지를 새로고침해 주세요.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Q&A Analytics
      </h2>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="총 Q&A 횟수"
          value={stats?.total_qa_count?.toLocaleString() ?? '—'}
        />
        <StatCard
          label="답변 만족도"
          value={stats?.satisfaction_rate != null
            ? `${Math.round(stats.satisfaction_rate * 100)}%`
            : '—'}
          sub="👍 비율"
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            일별 Q&A (7일)
          </p>
          <MiniBarChart data={stats?.daily_counts} />
        </div>
        <StatCard
          label="완료율 향상"
          value={stats?.task_completion_lift != null
            ? `+${Math.round(stats.task_completion_lift * 100)}%`
            : '—'}
          sub="Q&A 후 태스크 완료"
        />
      </div>

      {/* 최근 피드백 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80">최근 피드백</h3>
        </div>
        {!stats?.recent_feedback?.length ? (
          <p className="text-sm text-gray-400 dark:text-white/40 px-5 py-4">피드백 데이터 없음</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {stats.recent_feedback.map((fb) => (
              <div key={fb.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-700 dark:text-white/80 truncate flex-1">
                  {fb.question}
                </p>
                <span className="text-lg flex-shrink-0">{fb.rating === 'up' ? '👍' : '👎'}</span>
                <span className="text-xs text-gray-400 dark:text-white/40 flex-shrink-0">
                  {new Date(fb.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
