import { useEffect, useState, useRef, useCallback } from 'react'

/* ── 스트리밍 미리보기 데이터 ── */
export const PREVIEW_WEEKS = [
  { week: '1주차', task: 'Git · GitHub 워크플로우 실습' },
  { week: '2주차', task: 'Python 함수 · 클래스 미니 프로젝트' },
  { week: '3주차', task: 'FastAPI 기초 + REST API 설계' },
  { week: '4주차', task: 'Docker 컨테이너 입문 + 배포' },
  { week: '5주차', task: 'PostgreSQL + ORM 연동' },
  { week: '6주차', task: 'AWS EC2 · S3 배포 실습' },
]

export const STREAM_DELAY_ITEM = 900
export const STREAM_DELAY_CHAR = 28
export const PAUSE_AFTER_DONE  = 2800


/* ── 히어로 로드맵 미리보기 ── */
export default function HeroPreview({ isDark }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [typingText, setTypingText]     = useState('')
  const [isTyping, setIsTyping]         = useState(false)

  const cardRef = useRef(null)
  const rafRef  = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [glow, setGlow] = useState({ x: 50, y: 50 })

  useEffect(() => {
    let cancelled = false
    let charTimer, itemTimer, resetTimer

    async function streamItem(idx) {
      if (cancelled) return
      const fullText = PREVIEW_WEEKS[idx].task
      setIsTyping(true)
      setTypingText('')
      for (let c = 1; c <= fullText.length; c++) {
        await new Promise(r => { charTimer = setTimeout(r, STREAM_DELAY_CHAR) })
        if (cancelled) return
        setTypingText(fullText.slice(0, c))
      }
      setIsTyping(false)
      setVisibleCount(idx + 1)
      setTypingText('')
    }

    async function runStream() {
      setVisibleCount(0)
      setTypingText('')
      for (let i = 0; i < PREVIEW_WEEKS.length; i++) {
        if (cancelled) return
        await new Promise(r => { itemTimer = setTimeout(r, i === 0 ? 600 : STREAM_DELAY_ITEM) })
        if (cancelled) return
        await streamItem(i)
      }
      await new Promise(r => { resetTimer = setTimeout(r, PAUSE_AFTER_DONE) })
      if (!cancelled) runStream()
    }

    runStream()
    return () => {
      cancelled = true
      clearTimeout(charTimer)
      clearTimeout(itemTimer)
      clearTimeout(resetTimer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / rect.width
    const cy = (e.clientY - rect.top)  / rect.height
    const tx = (cy - 0.5) * -18
    const ty = (cx - 0.5) *  18
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setTilt({ x: tx, y: ty })
      setGlow({ x: cx * 100, y: cy * 100 })
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setGlow({ x: 50, y: 50 })
  }, [])

  const progress = Math.round((visibleCount / PREVIEW_WEEKS.length) * 100)

  const cardBg    = isDark ? 'bg-[#0d0f1a]'       : 'bg-white'
  const cardBdr   = isDark ? 'border-white/10'     : 'border-slate-200'
  const topBarBg  = isDark ? 'bg-[#13151f]'        : 'bg-slate-50'
  const topBarBdr = isDark ? 'border-white/10'     : 'border-slate-200'
  const monoMuted = isDark ? 'text-white/30'       : 'text-slate-400'
  const progBg    = isDark ? 'bg-white/10'         : 'bg-slate-100'
  const progBdr   = isDark ? 'border-white/10'     : 'border-slate-100'
  const itemBg    = isDark ? 'bg-white/[0.03]'     : 'bg-slate-50'
  const itemBdr   = isDark ? 'border-white/[0.05]' : 'border-slate-100'
  const taskText  = isDark ? 'text-white/70'       : 'text-slate-700'
  const footerTxt = isDark ? 'text-white/20'       : 'text-slate-300'

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div
        style={{ perspective: '900px' }}
        className="hero-preview-float w-full max-w-[340px]"
      >

        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: 'transform 0.15s ease',
            transformStyle: 'preserve-3d',
          }}
          className={`rounded-2xl overflow-hidden border shadow-2xl shadow-indigo-500/10 relative ${cardBg} ${cardBdr}`}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(99,102,241,0.10), transparent 65%)`,
            }}
          />

          <div className={`flex items-center gap-1.5 px-4 py-3 border-b ${topBarBg} ${topBarBdr}`}>
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            <span className={`ml-3 text-[10px] font-mono ${monoMuted}`}>백엔드 · 6개월 플랜</span>
            <span className="ml-auto text-[10px] font-mono text-indigo-500 animate-pulse">● AI 생성 중</span>
          </div>

          <div className={`px-4 py-2.5 border-b ${progBdr}`}>
            <div className={`flex justify-between text-[10px] mb-1.5 ${monoMuted}`}>
              <span>생성 진행률</span>
              <span className="text-indigo-500 font-mono">{progress}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${progBg}`}>
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div aria-live="polite" aria-label="로드맵 생성 진행 현황" className="p-3 space-y-1.5 min-h-[200px]">
            {PREVIEW_WEEKS.slice(0, visibleCount).map((w) => (
              <div
                key={w.week}
                className={`stream-item flex items-center gap-3 px-3 py-2.5 rounded-xl border ${itemBg} ${itemBdr}`}
              >
                <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-500">
                  <svg aria-hidden="true" className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10">
                    <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <div>
                  <div className={`text-[9px] font-mono ${monoMuted}`}>{w.week}</div>
                  <div className={`text-[11px] font-medium leading-snug mt-0.5 ${taskText}`}>{w.task}</div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="stream-item flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-indigo-500/10 border-indigo-500/25">
                <div className="w-4 h-4 rounded-full border border-indigo-400/50 flex-shrink-0 animate-pulse" />
                <div>
                  <div className="text-[9px] text-indigo-400/60 font-mono">
                    {PREVIEW_WEEKS[visibleCount]?.week}
                  </div>
                  <div className={`text-[11px] font-medium text-indigo-500 leading-snug mt-0.5 ${typingText ? 'cursor-blink' : ''}`}>
                    {typingText || ' '}
                  </div>
                </div>
              </div>
            )}

            {visibleCount === 0 && !isTyping && (
              <div className={`flex items-center justify-center h-32 text-[11px] ${monoMuted}`}>
                AI가 로드맵을 생성하고 있습니다...
              </div>
            )}
          </div>

          <div className={`px-4 pb-3 text-[9px] text-center ${footerTxt}`}>
            🤖 Claude AI · 실시간 생성
          </div>
        </div>
      </div>

      <p className={`text-xs ${isDark ? 'text-white/25' : 'text-slate-400'}`}>↑ 실제 생성 과정 미리보기</p>
    </div>
  )
}
