import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import OnboardingPage from './pages/OnboardingPage'
import RoadmapPage from './pages/RoadmapPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivateRoute from './components/auth/PrivateRoute'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 로그인 후 /dashboard 진입 시 최근 로드맵 또는 온보딩으로 이동 */
function DashboardRedirect() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('devnavi_roadmap_'))
    if (keys.length > 0) {
      const id = keys[keys.length - 1].replace('devnavi_roadmap_', '')
      if (UUID_RE.test(id)) return <Navigate to={`/roadmap/${id}`} replace />
    }
  } catch {
    // localStorage 접근 불가(보안 정책 등) → 온보딩으로 폴백
  }
  return <Navigate to="/onboarding" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/roadmap/:id" element={<RoadmapPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* 관리자 대시보드: 서버에서 role='admin' 검증, 비인가 접근 시 홈 리다이렉트 */}
      <Route path="/admin" element={<AdminPage />} />
      {/* BUG-003: /dashboard 미인증 접근 시 홈으로, 인증 시 최근 로드맵으로 */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardRedirect /></PrivateRoute>} />
      {/* BUG-004: /roadmap (ID 없음) 접근 시 홈으로 */}
      <Route path="/roadmap" element={<Navigate to="/" replace />} />
      {/* 이메일 인증 콜백: PKCE code → session exchange */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {/* 비밀번호 재설정: PKCE code → new password form */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* BUG-002: catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
