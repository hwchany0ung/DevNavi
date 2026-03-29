/**
 * 공통 푸터 — 저작권 고지 + 법적 링크
 */
export default function Footer({ className = '' }) {
  return (
    <footer className={`py-5 border-t border-gray-100 ${className}`}>
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
        <span>© 2025 DevNavi. All rights reserved. 무단 복제 및 배포 금지.</span>
        <div className="flex items-center gap-4">
          <a href="/terms"   className="hover:text-gray-600 transition-colors inline-flex items-center min-h-[44px] px-1">이용약관</a>
          <a href="/privacy" className="hover:text-gray-600 transition-colors inline-flex items-center min-h-[44px] px-1">개인정보처리방침</a>
          <a href="mailto:support@devnavi.kr" className="hover:text-gray-600 transition-colors inline-flex items-center min-h-[44px] px-1">문의</a>
        </div>
      </div>
    </footer>
  )
}
