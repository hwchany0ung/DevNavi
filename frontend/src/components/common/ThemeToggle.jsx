import { useTheme } from '../../contexts/ThemeContext'

/**
 * 테마 전환 버튼 (단순 토글)
 * - 드롭다운 제거 → 터치/클릭 모두 100% 확실히 동작
 * - inline style 사용 → Tailwind dark: 클래스 purge 무관
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      style={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
        color: isDark ? 'rgba(255,255,255,0.7)' : '#374151',
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${className}`}
    >
      <span>{isDark ? '🌙' : '☀️'}</span>
      <span>{isDark ? '다크' : '라이트'}</span>
    </button>
  )
}
