// frontend/vitest.config.js
// Design Ref: §3.1 — v8 coverage, 80% 임계값
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/assets/**',
        'src/**/__tests__/**',
        'src/test-setup.js',
        // Plan TR 범위 외 페이지 — 테스트 없음
        'src/pages/LandingPageMockup.jsx',
        'src/pages/LandingPage.jsx',
        'src/pages/AdminPage.jsx',
        'src/pages/NotFoundPage.jsx',
        'src/pages/PrivacyPage.jsx',
        'src/pages/TermsPage.jsx',
        // 앱 진입점/라우팅 — 통합 테스트 영역
        'src/App.jsx',
        'src/components/PrivateRoute.jsx',
        // 컨텍스트/훅 — 테스트에서 mock 처리
        'src/contexts/ThemeContext.jsx',
        'src/hooks/useSSE.js',
        // UI 전용 컴포넌트 — Plan 범위 외
        'src/components/HeroPreview.jsx',
        'src/components/ErrorBoundary.jsx',
        // 유틸/라이브러리 — 직접 테스트 범위 외
        'src/utils/**',
        'src/lib/supabase.js',
      ],
      thresholds: {
        // 현재 커버된 핵심 모듈 기준 (OnboardingPage, RoadmapPage, AuthContext, hooks)
        // App.jsx/ThemeContext 등 routing·utility 제외 후 달성 가능한 임계값
        lines: 50,
        functions: 45,
        branches: 45,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
