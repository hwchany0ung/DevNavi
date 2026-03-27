import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className={`w-8 h-8 flex items-center justify-center rounded-xl
        hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-base ${className}`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
