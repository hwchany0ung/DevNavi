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
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/assets/**',
        'src/**/__tests__/**',
        'src/test-setup.js',
        'src/pages/LandingPageMockup.jsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
