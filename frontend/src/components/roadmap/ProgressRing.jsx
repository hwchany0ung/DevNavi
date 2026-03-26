/**
 * 원형 진행률 표시 컴포넌트
 * @param {number} percent 0~100
 * @param {number} size    SVG 크기 (px), 기본 80
 * @param {number} stroke  원 두께 (px), 기본 7
 */
export default function ProgressRing({ percent = 0, size = 80, stroke = 7 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#e0e7ff" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#4f46e5" strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute text-indigo-700 font-bold"
        style={{ fontSize: size * 0.2 }}
      >
        {Math.round(percent)}%
      </span>
    </div>
  )
}
