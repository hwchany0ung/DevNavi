import { Link } from 'react-router-dom'

/**
 * 공통 푸터 — 저작권 고지 + 법적 링크
 */
export default function Footer({ className = '' }) {
  return (
    <footer className={`py-5 border-t border-gray-100 dark:border-white/10 ${className}`}>
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 dark:text-white/40">
        <span>© {new Date().getFullYear()} DevNavi. All rights reserved. 무단 복제 및 배포 금지.</span>
        <div className="flex items-center gap-4">
          <Link to="/terms"   className="hover:text-gray-600 dark:hover:text-white/70 transition-colors inline-flex items-center min-h-[44px] px-1">이용약관</Link>
          <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-white/70 transition-colors inline-flex items-center min-h-[44px] px-1">개인정보처리방침</Link>
          <a href="mailto:support@devnavi.kr" className="hover:text-gray-600 dark:hover:text-white/70 transition-colors inline-flex items-center min-h-[44px] px-1">문의</a>
        </div>
      </div>
    </footer>
  )
}
