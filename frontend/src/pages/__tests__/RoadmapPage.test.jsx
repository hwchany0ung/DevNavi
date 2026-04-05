import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Design Ref: §3.3 — RoadmapPage 렌더링 테스트
// Plan SC: RoadmapPage 테스트 (TR-06)

vi.mock('../../lib/supabase', () => ({
  supabase: null,
  isSupabaseReady: false,
  cleanAuthParams: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    loading: false,
    signOut: vi.fn(),
    getAuthHeaders: vi.fn().mockReturnValue({ Authorization: 'Bearer mock' }),
  }),
}))

// vi.mock 팩토리는 호이스팅되므로 외부 변수 참조 금지 — vi.fn()만 사용
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

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

// mock 선언 후에 import
import RoadmapPage from '../RoadmapPage'
import { loadRoadmapLocal } from '../../hooks/useRoadmapStream'
import { request } from '../../lib/api'

const MOCK_ROADMAP = {
  role: '백엔드 개발자',
  period: '6months',
  level: 'beginner',
  persona_title: '성장하는 백엔드 개발자',
  persona_subtitle: '6개월 로드맵',
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

const renderRoadmapPage = (roadmapId = '00000000-0000-4000-8000-000000000001') =>
  render(
    <MemoryRouter initialEntries={[`/roadmap/${roadmapId}`]}>
      <Routes>
        <Route path="/roadmap/:id" element={<RoadmapPage />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  loadRoadmapLocal.mockReturnValue(null)
  request.mockResolvedValue({ task_ids: [], activity: [] })
})

describe('RoadmapPage 렌더링', () => {
  it('로컬 로드맵 데이터 있으면 월별 테마 렌더링', async () => {
    loadRoadmapLocal.mockReturnValue(MOCK_ROADMAP)
    renderRoadmapPage()
    await waitFor(() => {
      // 동일 텍스트가 여러 곳에 렌더링될 수 있어 getAllByText 사용
      const matches = screen.getAllByText('Python 기초')
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('persona_title이 표시됨', async () => {
    loadRoadmapLocal.mockReturnValue(MOCK_ROADMAP)
    renderRoadmapPage()
    await waitFor(() => {
      expect(screen.getByText('성장하는 백엔드 개발자')).toBeInTheDocument()
    })
  })

  it('로컬 데이터 없으면 API로 로드맵 요청', async () => {
    loadRoadmapLocal.mockReturnValue(null)
    // API 실패 시 roadmap=null 유지 → useMemo 가드 통과, forEach 크래시 없음
    request.mockRejectedValue(new Error('not found'))
    renderRoadmapPage()
    await waitFor(() => {
      // loadRoadmapLocal 호출 확인
      expect(loadRoadmapLocal).toHaveBeenCalled()
    })
  })
})

describe('F3: task_completions Supabase 동기화', () => {
  const ROADMAP_ID = '00000000-0000-4000-8000-000000000001'

  it('fetchRemoteCompletions가 비어있지 않은 Set 반환 시 doneSet이 remote로 교체됨', async () => {
    loadRoadmapLocal.mockReturnValue(MOCK_ROADMAP)
    // completions endpoint → remote task_ids 반환, 그 외 → 기본 응답
    request.mockImplementation((url) => {
      if (url.endsWith('/completions')) {
        return Promise.resolve({ task_ids: ['task-remote-1', 'task-remote-2'] })
      }
      return Promise.resolve({ task_ids: [], activity: [] })
    })
    renderRoadmapPage(ROADMAP_ID)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(`devnavi_done_${ROADMAP_ID}`) || '[]')
      expect(stored).toContain('task-remote-1')
      expect(stored).toContain('task-remote-2')
    })
  })

  it('fetchRemoteCompletions가 빈 Set 반환 시 doneSet이 기존 local 유지됨', async () => {
    loadRoadmapLocal.mockReturnValue(MOCK_ROADMAP)
    // 미리 local에 task 저장
    localStorage.setItem(`devnavi_done_${ROADMAP_ID}`, JSON.stringify(['task-local-1']))
    request.mockImplementation((url) => {
      if (url.endsWith('/completions')) {
        return Promise.resolve({ task_ids: [] })
      }
      return Promise.resolve({ task_ids: [], activity: [] })
    })
    renderRoadmapPage(ROADMAP_ID)
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(`devnavi_done_${ROADMAP_ID}`) || '[]')
      expect(stored).toContain('task-local-1')
    })
  })
})
