import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthCallbackPage from '../AuthCallbackPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Capture the onAuthStateChange callback so tests can trigger auth events
let mockAuthStateCallback = null
const mockGetSession = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        mockAuthStateCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      getSession: (...args) => mockGetSession(...args),
    },
  },
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

function renderWithUrl(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockAuthStateCallback = null
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  // JSDOM에서 window.close()는 document를 파괴하므로 mock으로 대체
  vi.spyOn(window, 'close').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthCallbackPage', () => {
  it('redirects immediately when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows processing spinner while waiting for auth event', async () => {
    renderWithUrl('?code=abc')
    await waitFor(() => expect(screen.getByText('이메일 인증 중…')).toBeInTheDocument())
  })

  it('shows success when getSession returns session (race condition path)', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=valid-code')
    await waitFor(() =>
      expect(screen.getByText('이메일 인증 완료!')).toBeInTheDocument()
    )
  })

  it('shows success and auto-redirects to / after 3 seconds via onAuthStateChange', async () => {
    renderWithUrl('?code=valid-code')
    await waitFor(() => expect(mockAuthStateCallback).not.toBeNull())
    // Simulate Supabase auto-exchange completing and firing SIGNED_IN
    mockAuthStateCallback('SIGNED_IN', { user: { id: '123' }, access_token: 'tok' })

    await waitFor(() =>
      expect(screen.getByText('이메일 인증 완료!')).toBeInTheDocument()
    )

    act(() => vi.advanceTimersByTime(1500))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows error UI when error query param is present', async () => {
    renderWithUrl('?error=access_denied&error_description=Token+expired')
    await waitFor(() =>
      expect(screen.getByText('인증에 실패했습니다')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument()
  })
})
