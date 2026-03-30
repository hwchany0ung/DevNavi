/**
 * useAuth — AuthContext의 re-export 심.
 *
 * 기존 `import { useAuth } from '../hooks/useAuth'` 경로를 그대로 유지하면서
 * Context 기반 단일 구독으로 전환 (I6 다중 구독 문제 해결).
 * 실제 구현은 src/contexts/AuthContext.jsx 참조.
 */
export { useAuth } from '../contexts/AuthContext'
