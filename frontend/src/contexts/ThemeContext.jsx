import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

// FOUC(깜빡임) 방지: JS 로드 전에 HTML에 dark 클래스를 미리 적용
// index.html <head>에 아래 스크립트 추가 권장:
// <script>if(localStorage.getItem('devnavi_theme')==='dark')document.documentElement.classList.add('dark')</script>

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('devnavi_theme') || 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
    localStorage.setItem('devnavi_theme', theme)
  }, [theme])

  // setTheme을 직접 노출하는 대신 내부용으로만 사용
  // 외부에서는 toggle만 사용 (localStorage 동기화 보장)
  const toggle = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
