import PropTypes from 'prop-types'

/**
 * StatCard — 통계 수치를 표시하는 공용 카드 컴포넌트
 *
 * Props:
 *   label — 항목 레이블 (대문자 표시)
 *   value — 표시할 수치
 *   sub   — 하단 보조 텍스트 (선택)
 */
export default function StatCard({ label, value, sub }) {
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

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sub: PropTypes.string,
}
