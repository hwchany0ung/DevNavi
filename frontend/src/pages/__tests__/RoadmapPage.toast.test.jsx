import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// F4: 피드백 토스트 통합 테스트
// 중량 서브컴포넌트를 모두 모킹해 렌더 비용 최소화 — OOM 방지

vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseReady: false,
  cleanAuthParams: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: vi.fn(),
    getAuthHeaders: vi.fn().mockReturnValue({}),
  }),
}))

vi.mock('../../hooks/useRoadmapStream', () => ({
  loadRoadmapLocal: vi.fn().mockReturnValue(null),
  saveRoadmapLocal: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  request: vi.fn().mockResolvedValue({ task_ids: [], activity: [] }),
}))

vi.mock('../../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

// 중량 서브컴포넌트 모킹 — 렌더 비용 절감
vi.mock('../../components/roadmap/PersonaCard', () => ({ default: () => null }))
vi.mock('../../components/roadmap/MonthTimeline', () => ({ default: () => null }))
vi.mock('../../components/roadmap/GrassCalendar', () => ({ default: () => null }))
vi.mock('../../components/roadmap/RoadmapHeader', () => ({ default: () => null }))
vi.mock('../../components/roadmap/RerouteButton', () => ({ default: () => null }))
vi.mock('../../components/roadmap/RerouteModal', () => ({ default: () => null }))
vi.mock('../../components/roadmap/CareerSummaryModal', () => ({ default: () => null }))
vi.mock('../../components/auth/AuthModal', () => ({ default: () => null }))
vi.mock('../../components/qa/QAPanel', () => ({ default: () => null }))
vi.mock('../../components/common/Footer', () => ({ default: () => null }))
vi.mock('../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ logEvent: vi.fn() }) }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

import RoadmapPage from '../RoadmapPage'
import { loadRoadmapLocal } from '../../hooks/useRoadmapStream'
import { request } from '../../lib/api'

const MOCK_ROADMAP = {
  role: '백엔드 개발자',
  period: '1month',
  level: 'beginner',
  persona_title: '성장하는 백엔드 개발자',
  persona_subtitle: '1개월 로드맵',
  months: [
    {
      month: 1,
      theme: 'Python 기초',
      weeks: [
        { week: 1, tasks: [{ content: 'Python 설치', category: 'learn' }] },
      ],
    },
  ],
}

const ROADMAP_ID = '00000000-0000-4000-8000-000000000001'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/roadmap/${ROADMAP_ID}`]}>
      <Routes>
        <Route path="/roadmap/:id" element={<RoadmapPage />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  loadRoadmapLocal.mockReturnValue(MOCK_ROADMAP)
  request.mockResolvedValue({ task_ids: [], activity: [] })
})

describe('F4: 태스크 완료 피드백 토스트 — 통합', () => {
  it('태스크 체크 시 완료 토스트 메시지가 나타남', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Python 설치')).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkbox)
    })

    // 단일 태스크 → 주간 완료 → 특별 메시지
    await waitFor(() => {
      expect(screen.getByText('이번 주 완료! 다음 주도 화이팅!')).toBeInTheDocument()
    })
  })

  it('태스크 체크 시 토스트 status 요소가 visible 클래스를 가짐', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Python 설치')).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkbox)
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveClass('opacity-100')
    })
  })

  describe('토스트 2초 후 자동 소멸 (vi.useFakeTimers)', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('체크 후 2초 경과 시 토스트가 숨겨짐', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Python 설치')).toBeInTheDocument()
      })

      const checkbox = screen.getByRole('checkbox')
      await act(async () => {
        fireEvent.click(checkbox)
      })

      // 토스트 표시 확인
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('opacity-100')
      })

      // 2초 경과 → 토스트 소멸
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('opacity-0')
      })
    })
  })
})
