import { Component } from 'react'

/**
 * 앱 전체 React 렌더 에러 경계.
 * 하위 트리에서 렌더 중 발생하는 예외를 잡아 빈 화면 대신 안내 UI를 표시.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '알 수 없는 오류' }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#07090f] px-6">
          <div className="max-w-md text-center space-y-4">
            <p className="text-4xl">⚠️</p>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              페이지를 불러오는 중 오류가 발생했어요
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/50">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
