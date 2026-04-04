import { useState } from 'react'

// ── 직군별 추천 스킬 (2024-2025 채용공고 기반) ──────────────────────
const ROLE_SKILLS = {
  // 국내 채용 1위: Java+Spring Boot, 스타트업: Python/Node.js
  backend:     ['Java', 'Spring Boot', 'Python', 'FastAPI', 'Node.js', 'JPA/Hibernate', 'MySQL', 'PostgreSQL', 'Redis', 'Docker', 'AWS EC2/S3', 'GitHub Actions'],
  // TypeScript 2024년부터 사실상 필수화
  frontend:    ['TypeScript', 'React', 'Next.js', 'JavaScript', 'HTML/CSS', 'Tailwind CSS', 'Zustand', 'TanStack Query', 'Vite', 'Jest', 'Figma'],
  // Kubernetes + Terraform이 핵심, AWS 1위
  cloud_devops:['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Linux', 'GitHub Actions', 'ArgoCD', 'Prometheus/Grafana', 'Ansible', 'Helm', 'Python/Shell'],
  // Next.js 풀스택이 2025 트렌드
  fullstack:   ['TypeScript', 'React', 'Next.js', 'Node.js', 'NestJS', 'Python', 'MySQL', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL'],
  // Python+SQL 절대 필수, Airflow·dbt 급부상
  data:        ['Python', 'SQL', 'Apache Spark', 'Apache Airflow', 'Kafka', 'dbt', 'AWS Redshift/S3', 'Pandas', 'Tableau/Looker', 'BigQuery'],
  // PyTorch가 TensorFlow 압도, RAG·LLM Fine-tuning 핵심
  ai_ml:       ['Python', 'PyTorch', 'LangChain/LlamaIndex', 'RAG', 'scikit-learn', 'FastAPI', 'MLflow', 'Docker', 'SQL', 'Hugging Face'],
  // SIEM·취약점 분석·클라우드 보안 필수
  security:    ['Linux', 'Python', 'Burp Suite', 'SIEM(Splunk/QRadar)', 'Wireshark', 'Nessus', 'AWS Security', 'Metasploit', 'Shell Script', 'Networking'],
  // Jetpack Compose·SwiftUI로 전환 중, Flutter 수요 증가
  ios_android: ['Kotlin', 'Swift', 'Jetpack Compose', 'SwiftUI', 'Flutter', 'Retrofit/Alamofire', 'Coroutines', 'Firebase', 'Android Architecture', 'Fastlane'],
  // Playwright 급부상, Python 자동화 필수화
  qa:          ['Selenium', 'Playwright', 'Python', 'Java', 'Postman', 'JMeter/k6', 'Jira/TestRail', 'GitHub Actions', 'Appium', 'REST API 테스트'],
}

// ── 직군별 추천 자격증 (2024-2025 실전 우선순위) ─────────────────────
const ROLE_CERTS = {
  // 정보처리기사(필수) > SQLD(권장) > AWS Cloud Practitioner(추천)
  backend:     ['정보처리기사', 'SQLD', 'AWS Cloud Practitioner', 'SQLP', '리눅스마스터 2급'],
  // 포트폴리오 > 자격증. 정보처리기사만 있어도 충분
  frontend:    ['정보처리기사', 'AWS Cloud Practitioner'],
  // AWS SAA + CKA가 핵심 2종 세트
  cloud_devops:['AWS SAA', 'CKA', '정보처리기사', '리눅스마스터 2급', 'Terraform Associate', 'AWS DevOps Pro'],
  // 정보처리기사 > SQLD > AWS Cloud Practitioner
  fullstack:   ['정보처리기사', 'SQLD', 'AWS Cloud Practitioner'],
  // SQLD(필수급) > 빅데이터분석기사 > ADsP
  data:        ['SQLD', '빅데이터분석기사', 'ADsP', 'ADP', 'SQLP'],
  // 자격증보다 GitHub·Kaggle이 중요. AICE·빅데이터분석기사 보조용
  ai_ml:       ['AICE', '빅데이터분석기사', 'ADsP', 'TensorFlow Developer Certificate'],
  // 정보보안기사(필수) + ISMS-P(금융·공공 강력 우대)
  security:    ['정보보안기사', '정보처리기사', 'ISMS-P 인증심사원', '리눅스마스터 2급', 'CISSP', 'CEH'],
  // 출시 앱이 자격증보다 중요. 정보처리기사 보조용
  ios_android: ['정보처리기사', 'AWS Cloud Practitioner'],
  // ISTQB CTFL(2025년부터 경력 요건 폐지, 신입 사실상 필수)
  qa:          ['ISTQB CTFL', '정보처리기사', 'ISTQB CTAL', 'CSTS'],
}

const COMPANY_TYPES = [
  { value: 'startup', label: '스타트업', icon: '🚀' },
  { value: 'msp',     label: 'MSP',      icon: '☁️' },
  { value: 'bigco',   label: '대기업',   icon: '🏢' },
  { value: 'si',      label: 'SI',       icon: '🔧' },
  { value: 'foreign', label: '외국계',   icon: '🌐' },
  { value: 'any',     label: '무관',     icon: '✨' },
]

const STUDY_HOURS = [
  { value: 'under1h', label: '1시간 미만' },
  { value: '1to2h',   label: '1~2시간' },
  { value: '3to4h',   label: '3~4시간' },
  { value: 'over5h',  label: '5시간 이상' },
]

const MAX_TAGS = 15  // FI-11: 스킬/자격증 최대 개수 제한
const MAX_TAG_LENGTH = 50  // C3: 태그당 최대 길이 제한

/**
 * C3: 프롬프트 인젝션 방어용 태그 sanitize 함수.
 * - 특수문자(<, >, ", \) 제거
 * - 과도한 개행/공백 정리
 * - 프롬프트 구분자 패턴 제거 (예: ---, ===, [INST], <s>, ###)
 * - 길이 제한 적용 (MAX_TAG_LENGTH)
 */
function sanitizeTag(raw) {
  return raw
    .replace(/[<>"\\]/g, '')            // HTML·이스케이프 특수문자 제거
    .replace(/\n+/g, ' ')               // 개행을 공백으로 치환
    .replace(/\s{2,}/g, ' ')            // 연속 공백 정규화
    .replace(/[-=]{3,}/g, '')           // 구분자 패턴(---, ===) 제거
    .replace(/#{2,}/g, '')              // 마크다운 헤더 패턴(##) 제거
    .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>/gi, '')  // LLM 프롬프트 태그 제거
    .trim()
    .slice(0, MAX_TAG_LENGTH)
}

// ── 숙련도 레벨 정의 ──────────────────────────────────────────────────
const SKILL_LEVELS = [
  { value: 'beginner',     label: '입문' },
  { value: 'basic',        label: '기초' },
  { value: 'intermediate', label: '중급' },
  { value: 'advanced',     label: '능숙' },
]

const LEVEL_COLORS = {
  beginner:     'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60 border-gray-200 dark:border-white/10',
  basic:        'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  intermediate: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  advanced:     'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
}

/** 숙련도 뱃지 — 클릭 시 순환 전환 */
function LevelBadge({ level, onChange }) {
  const idx = SKILL_LEVELS.findIndex(l => l.value === level)
  const safeIdx = idx === -1 ? 1 : idx
  const current = SKILL_LEVELS[safeIdx]
  const colors = LEVEL_COLORS[current.value] || LEVEL_COLORS.basic

  const cycle = () => {
    const next = SKILL_LEVELS[(safeIdx + 1) % SKILL_LEVELS.length]
    onChange(next.value)
  }

  return (
    <button type="button" onClick={cycle}
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${colors}`}
      title="클릭하여 숙련도 변경">
      {current.label}
    </button>
  )
}

/** 버튼 토글 + 직접 입력 공통 컴포넌트 (숙련도 뱃지 지원) */
function TagSelector({ suggestions, selected, onToggle, onAdd, placeholder, showLevels = false, onLevelChange }) {
  const [input, setInput] = useState('')

  // selected: showLevels ? [{name, level}] : [string]
  const selectedNames = showLevels
    ? selected.map(s => s.name)
    : selected

  const getLevel = (name) => {
    if (!showLevels) return 'basic'
    const item = selected.find(s => s.name === name)
    return item?.level || 'basic'
  }

  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      if (selectedNames.length >= MAX_TAGS) return
      const val = sanitizeTag(input.trim().replace(/,$/, ''))
      if (val) onAdd(val)
      setInput('')
    }
  }

  return (
    <div className="space-y-3">
      {/* 추천 버튼 */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((item) => {
          const active = selectedNames.includes(item)
          return (
            <span key={item} className="inline-flex items-center gap-1">
              <button type="button" onClick={() => onToggle(item)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                  ${active
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/75 hover:border-indigo-300 dark:hover:border-indigo-400/50 hover:text-indigo-500 dark:hover:text-indigo-300'}`}>
                {active && '\u2713 '}{item}
              </button>
              {showLevels && active && (
                <LevelBadge
                  level={getLevel(item)}
                  onChange={(lvl) => onLevelChange?.(item, lvl)}
                />
              )}
            </span>
          )
        })}
      </div>

      {/* 선택된 커스텀 항목 (추천 목록에 없는 것만) */}
      {selectedNames.filter(s => !suggestions.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedNames.filter(s => !suggestions.includes(s)).map((item) => (
            <span key={item}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-sm font-medium rounded-full border border-violet-200 dark:border-violet-500/30">
              {item}
              {showLevels && (
                <LevelBadge
                  level={getLevel(item)}
                  onChange={(lvl) => onLevelChange?.(item, lvl)}
                />
              )}
              <button type="button" onClick={() => onToggle(item)}
                className="text-violet-400 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-200 leading-none ml-0.5">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* 직접 입력 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 border-2 border-gray-100 dark:border-white/10 rounded-xl focus-within:border-indigo-400 dark:focus-within:border-indigo-400/70 transition-colors">
        <span className="text-gray-300 dark:text-white/50 text-sm">+</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="flex-1 outline-none text-sm text-gray-700 dark:text-white/80 placeholder:text-gray-300 dark:placeholder:text-white/20 bg-transparent"
        />
        {input.trim() && (
          <button type="button"
            onClick={() => { const val = sanitizeTag(input.trim()); if (val) onAdd(val); setInput('') }}
            className="text-xs text-indigo-500 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300">
            추가
          </button>
        )}
      </div>
    </div>
  )
}

// ── 추가 프로필 선택지 ─────────────────────────────────────────────────
const CODING_TEST_OPTIONS = [
  { value: 'none',         label: '경험 없음' },
  { value: 'basic',        label: 'Easy 수준' },
  { value: 'intermediate', label: 'Medium 수준' },
  { value: 'advanced',     label: 'Hard 수준' },
]

const TEAM_PROJECT_OPTIONS = [
  { value: 0, label: '없음' },
  { value: 1, label: '1회' },
  { value: 2, label: '2회' },
  { value: 3, label: '3회 이상' },
]

export default function Step2Form({ values, onChange, role = 'backend' }) {
  const set = (key) => (val) => onChange({ ...values, [key]: val })
  const [showExtra, setShowExtra] = useState(false)

  const suggestedSkills = ROLE_SKILLS[role] ?? ROLE_SKILLS.backend
  const suggestedCerts  = ROLE_CERTS[role]  ?? ROLE_CERTS.backend

  // skills: [{name, level}] 형태
  const skillNames = values.skills.map(s => typeof s === 'string' ? s : s.name)

  const toggleSkill = (skill) => {
    const exists = values.skills.find(s => (typeof s === 'string' ? s : s.name) === skill)
    if (exists) {
      set('skills')(values.skills.filter(s => (typeof s === 'string' ? s : s.name) !== skill))
    } else {
      set('skills')([...values.skills, { name: skill, level: 'basic' }])
    }
  }

  const addSkill = (skill) => {
    if (!skillNames.includes(skill)) {
      set('skills')([...values.skills, { name: skill, level: 'basic' }])
    }
  }

  const changeSkillLevel = (skillName, newLevel) => {
    set('skills')(values.skills.map(s => {
      const name = typeof s === 'string' ? s : s.name
      if (name === skillName) return { name, level: newLevel }
      return s
    }))
  }

  const toggleCert = (cert) => {
    const next = values.certifications.includes(cert)
      ? values.certifications.filter(c => c !== cert)
      : [...values.certifications, cert]
    set('certifications')(next)
  }

  const addCert = (cert) => {
    if (!values.certifications.includes(cert)) set('certifications')([...values.certifications, cert])
  }

  // extra_profile 헬퍼
  const ep = values.extra_profile || { has_deployment: false, coding_test_level: 'none', team_project_count: 0 }
  const setEp = (key, val) => {
    onChange({ ...values, extra_profile: { ...ep, [key]: val } })
  }

  return (
    <div className="space-y-8">
      {/* Q4: 보유 스킬 (숙련도 뱃지 포함) */}
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-cyan-400 mb-1 uppercase tracking-widest">
          Q4 · 보유 스킬
        </p>
        <p className="text-xs text-gray-400 dark:text-white/60 mb-3">
          클릭으로 선택 후 <span className="text-indigo-500 dark:text-indigo-400 font-semibold">숙련도 뱃지</span>를 눌러 수준을 조절하세요
        </p>
        <TagSelector
          suggestions={suggestedSkills}
          selected={values.skills}
          onToggle={toggleSkill}
          onAdd={addSkill}
          placeholder="직접 입력 후 Enter"
          showLevels={true}
          onLevelChange={changeSkillLevel}
        />
      </div>

      {/* Q5: 보유 자격증 */}
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-cyan-400 mb-1 uppercase tracking-widest">
          Q5 · 보유 자격증 <span className="text-gray-300 dark:text-white/50 font-normal">(선택)</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-white/60 mb-3">해당 직군 관련 자격증을 선택하세요</p>
        <TagSelector
          suggestions={suggestedCerts}
          selected={values.certifications}
          onToggle={toggleCert}
          onAdd={addCert}
          placeholder="다른 자격증 직접 입력"
        />
      </div>

      {/* Q6: 목표 회사 유형 */}
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-cyan-400 mb-1 uppercase tracking-widest">
          Q6 · 목표 회사 유형 <span className="text-gray-300 dark:text-white/50 font-normal">(선택)</span>
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COMPANY_TYPES.map((c) => (
            <button key={c.value} type="button" onClick={() => set('company_type')(c.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all
                ${values.company_type === c.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-white/85 hover:border-indigo-200 dark:hover:border-indigo-400/50'}`}>
              <span className="text-xl">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q7: 하루 학습 시간 */}
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-cyan-400 mb-3 uppercase tracking-widest">
          Q7 · 하루 학습 시간
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STUDY_HOURS.map((h) => (
            <button key={h.value} type="button" onClick={() => set('daily_study_hours')(h.value)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all
                ${values.daily_study_hours === h.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-white/85 hover:border-indigo-200 dark:hover:border-indigo-400/50'}`}>
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* 더 정교한 로드맵 — 접힌 섹션 */}
      <div className="border-t border-gray-100 dark:border-white/10 pt-4">
        <button type="button" onClick={() => setShowExtra(!showExtra)}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-cyan-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <span className={`transition-transform ${showExtra ? 'rotate-90' : ''}`}>&#9654;</span>
          더 정교한 로드맵을 원하시면 <span className="text-indigo-500 dark:text-indigo-400">(선택)</span>
        </button>

        {showExtra && (
          <div className="mt-4 space-y-5 pl-1">
            {/* 실배포 경험 */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-white/85 mb-2">
                실제 서비스 배포 경험이 있나요?
              </p>
              <div className="flex gap-3">
                {[{ v: true, l: '있음' }, { v: false, l: '없음' }].map(({ v, l }) => (
                  <button key={String(v)} type="button" onClick={() => setEp('has_deployment', v)}
                    className={`px-5 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                      ${ep.has_deployment === v
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-white/85 hover:border-indigo-200 dark:hover:border-indigo-400/50'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* 코딩테스트 경험 */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-white/85 mb-2">
                코딩테스트 준비 수준은?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CODING_TEST_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => setEp('coding_test_level', o.value)}
                    className={`p-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${ep.coding_test_level === o.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-white/85 hover:border-indigo-200 dark:hover:border-indigo-400/50'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 팀 프로젝트 경험 */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-white/85 mb-2">
                팀 프로젝트 경험 횟수는?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TEAM_PROJECT_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => setEp('team_project_count', o.value)}
                    className={`p-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${ep.team_project_count === o.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-white/85 hover:border-indigo-200 dark:hover:border-indigo-400/50'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
