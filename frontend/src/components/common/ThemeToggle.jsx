import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const OPTIONS = [
  { value: 'light', icon: '☀️', label: '화이트' },
  { value: 'dark',  icon: '🌙', label: '다크' },
]

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  /* 외부 클릭 시 닫기 */
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = OPTIONS.find(o => o.value === theme)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border
          border-gray-200 dark:border-white/15
          bg-white dark:bg-white/5
          hover:bg-gray-50 dark:hover:bg-white/10
          text-gray-600 dark:text-white/60
          text-xs font-semibold transition-all"
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-28 rounded-xl border
          border-gray-200 dark:border-white/10
          bg-white dark:bg-gray-900
          shadow-lg shadow-black/10 dark:shadow-black/40
          overflow-hidden z-50">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setTheme(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors
                ${theme === opt.value
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5'}`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
              {theme === opt.value && (
                <svg className="w-3 h-3 ml-auto text-indigo-500" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5 8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
