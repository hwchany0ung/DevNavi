import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * 인증이 필요한 라우트 보호.
 * 미인증 시 홈('/')으로 리다이렉트 (로그인 모달이 랜딩 페이지에 있음).
 */
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null   // 인증 상태 로딩 중 → 깜빡임 방지

  if (!user) return <Navigate to="/" replace />

  return children
}
