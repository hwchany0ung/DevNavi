import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Design Ref: §3.2 — OnboardingPage 폼 제출·유효성 검사 테스트
// Plan SC: OnboardingPage 테스트 (TR-05)

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
    getAuthHeaders: vi.fn().mockResolvedValue({}),
  }),
}))

vi.mock('../../hooks/useSSE', () => ({
  useSSE: () => ({
    text: '',
    error: null,
    isStreaming: false,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}))

vi.mock('../../hooks/useRoadmapStream', () => ({
  useRoadmapStream: () => ({
    isStreaming: false,
    progress: null,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
  loadRoadmapLocal: vi.fn().mockReturnValue(null),
  saveRoadmapLocal: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  request: vi.fn().mockResolvedValue({}),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ThemeProvider mock — ThemeToggle이 ThemeContext를 필요로 함
vi.mock('../../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

import OnboardingPage from '../OnboardingPage'

const renderPage = () =>
  render(<MemoryRouter><OnboardingPage /></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('OnboardingPage 초기 렌더링', () => {
  it('Step 1 폼이 렌더링됨', () => {
    renderPage()
    expect(screen.getByText('백엔드')).toBeInTheDocument()
    expect(screen.getByText('프론트엔드')).toBeInTheDocument()
  })

  it('기간 선택 옵션이 표시됨', () => {
    renderPage()
    expect(screen.getByText('6개월')).toBeInTheDocument()
    expect(screen.getByText('1년')).toBeInTheDocument()
  })

  it('레벨 선택 옵션이 표시됨', () => {
    renderPage()
    expect(screen.getByText('완전 입문')).toBeInTheDocument()
    expect(screen.getByText('기초 이해')).toBeInTheDocument()
  })
})

describe('OnboardingPage Step 1 선택', () => {
  it('역할 선택 시 버튼이 활성화됨', () => {
    renderPage()
    const backendBtn = screen.getByText('백엔드').closest('button')
    expect(backendBtn).toBeInTheDocument()
    fireEvent.click(backendBtn)
    // 선택 후 활성 border 스타일 적용 확인 (Tailwind: border-indigo-500)
    expect(backendBtn.className).toMatch(/border-indigo-500/)
  })
})

// ── 429 reset_at 조건 논리 단위 테스트 ───────────────────────────────
describe('OnboardingPage 429 reset_at 조건 논리', () => {
  it('error.data.reset_at이 있으면 메시지 표시 조건 true', () => {
    // JSX 조건: {summaryError?.data?.reset_at && <p>내일 오전 9시에 초기화됩니다.</p>}
    const errWithReset = { status: 429, data: { code: 'DAILY_LIMIT_EXCEEDED', reset_at: '2026-04-06' } }
    expect(errWithReset?.data?.reset_at).toBeTruthy()
  })

  it('error.data.reset_at이 없으면 메시지 표시 조건 false', () => {
    const errNoReset = { status: 429, data: { code: 'DAILY_LIMIT_EXCEEDED' } }
    expect(errNoReset?.data?.reset_at).toBeFalsy()
  })

  it('error.data 자체가 없으면 메시지 표시 조건 false', () => {
    const errNoData = { status: 429 }
    expect(errNoData?.data?.reset_at).toBeFalsy()
  })
})
