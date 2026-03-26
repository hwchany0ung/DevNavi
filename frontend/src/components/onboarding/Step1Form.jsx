const ROLES = [
  { value: 'backend',      label: '백엔드',          icon: '⚙️' },
  { value: 'frontend',     label: '프론트엔드',       icon: '🖥️' },
  { value: 'cloud_devops', label: '클라우드/DevOps',  icon: '☁️' },
  { value: 'fullstack',    label: '풀스택',           icon: '🔗' },
  { value: 'data',         label: '데이터',           icon: '📊' },
  { value: 'ai_ml',        label: 'AI/ML',            icon: '🤖' },
  { value: 'security',     label: '보안',             icon: '🔒' },
  { value: 'ios_android',  label: 'iOS/Android',      icon: '📱' },
  { value: 'qa',           label: 'QA',               icon: '🧪' },
]

const PERIODS = [
  { value: '3months',   label: '3개월 이내' },
  { value: '6months',   label: '6개월' },
  { value: '1year',     label: '1년' },
  { value: '1year_plus', label: '1년 이상' },
]

const LEVELS = [
  { value: 'beginner',      label: '완전 입문',        desc: '개발 경험이 없어요' },
  { value: 'basic',         label: '기초 이해',        desc: '코딩 기초는 배웠어요' },
  { value: 'some_exp',      label: '일부 실무 경험',   desc: '사이드 프로젝트 수준' },
  { value: 'career_change', label: '재직 중 전환',     desc: '다른 직군으로 일하고 있어요' },
]

export default function Step1Form({ values, onChange }) {
  const set = (key) => (val) => onChange({ ...values, [key]: val })

  return (
    <div className="space-y-8">
      {/* Q1: 목표 직군 */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-widest">
          Q1 · 목표 직군
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => set('role')(r.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all
                ${values.role === r.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200'}`}
            >
              <span className="text-xl">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q2: 목표 기간 */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-widest">
          Q2 · 목표 기간
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('period')(p.value)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all
                ${values.period === p.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-indigo-200'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q3: 지식 수준 */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-widest">
          Q3 · 현재 수준
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => set('level')(l.value)}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                ${values.level === l.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-100 bg-white hover:border-indigo-200'}`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                ${values.level === l.value ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                {values.level === l.value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
              <div>
                <p className={`text-sm font-bold ${values.level === l.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {l.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
