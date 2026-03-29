import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * 인증이 필요한 라우트 보호.
 * 미인증 시 홈('/')으로 리다이렉트 (로그인 모달이 랜딩 페이지에 있음).
 */
export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )

  if (!user) return <Navigate to="/" replace />

  return children
}
