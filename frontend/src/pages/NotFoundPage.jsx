import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = '페이지를 찾을 수 없음 — DevNavi'
    return () => { document.title = 'DevNavi — IT 직군 맞춤형 AI 로드맵' }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <p className="text-7xl font-black text-indigo-600 dark:text-indigo-400 mb-4">404</p>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-gray-500 dark:text-white/50 mb-8 text-center">
        요청하신 주소가 존재하지 않거나 삭제된 페이지예요.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl transition-colors"
      >
        홈으로 돌아가기
      </button>
    </div>
  )
}
