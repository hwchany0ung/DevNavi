import { useState, useCallback } from 'react'
import ThemeToggle from '../common/ThemeToggle'
import { request } from '../../lib/api'

/**
 * RoadmapPage 헤더 컴포넌트
 */
export default function RoadmapHeader({
  completionRate,
  user,
  showGrass,
  onToggleGrass,
  onAuthOpen,
  onSidebarToggle,
  signOut,
  roadmapId,
  getAuthHeaders,
}) {
  const [shareToast, setShareToast] = useState(null) // null | 'copied' | 'error'

  const handleShare = useCallback(async () => {
    if (!user) { onAuthOpen?.(); return }
    if (!roadmapId) return
    try {
      const data = await request(`/roadmap/${roadmapId}/share`, {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : {},
      })
      const link = `${window.location.origin}/roadmap/shared/${data.share_token}`
      await navigator.clipboard.writeText(link)
      setShareToast('copied')
    } catch {
      setShareToast('error')
    }
    setTimeout(() => setShareToast(null), 2000)
  }, [user, roadmapId, getAuthHeaders, onAuthOpen])

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/10 px-4 sm:px-6 py-4
      flex items-center justify-between sticky top-0 z-20">
      <a
        href="/"
        className="text-lg font-black text-indigo-600 tracking-tight hover:opacity-80 transition-opacity"
      >
        Dev<span className="text-gray-800 dark:text-white">Navi</span>
      </a>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* 진행률 칩 */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-xl">
          <div className="w-16 h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${completionRate}%` }} />
          </div>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{Math.round(completionRate)}%</span>
        </div>

        {/* 공유 버튼 */}
        {user && roadmapId && (
          <button
            onClick={handleShare}
            aria-label="로드맵 공유 링크 복사"
            className="relative text-xs px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5
              bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
              <path d="M10 2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M9 1H7a1 1 0 0 0-1 1v1h4V2a1 1 0 0 0-1-1z" fill="currentColor"/>
            </svg>
            {shareToast === 'copied' ? '링크 복사됨!' : shareToast === 'error' ? '오류 발생' : '공유'}
          </button>
        )}

        {/* 잔디 토글 */}
        {user && (
          <button
            onClick={onToggleGrass}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors hidden sm:block
              ${showGrass
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/20'
              }`}>
            🌱 활동
          </button>
        )}

        {/* 테마 토글 + 인증 버튼 */}
        <ThemeToggle />
        {user ? (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-white/40 truncate max-w-[120px]">{user.email}</span>
            <button
              onClick={signOut}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-500 dark:text-white/60 transition-colors"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={onAuthOpen}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            저장하기
          </button>
        )}

        {/* 모바일 사이드바 토글 */}
        <button
          onClick={onSidebarToggle}
          className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-white/60" fill="none" viewBox="0 0 20 20">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
