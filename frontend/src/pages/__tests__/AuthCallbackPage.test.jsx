import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthCallbackPage from '../AuthCallbackPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockExchangeCodeForSession = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args) => mockExchangeCodeForSession(...args),
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
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
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthCallbackPage', () => {
  it('redirects immediately when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('redirects immediately when already authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=abc')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows processing state while exchanging code', async () => {
    mockExchangeCodeForSession.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithUrl('?code=abc')
    await waitFor(() => expect(screen.getByText('이메일 인증 중…')).toBeInTheDocument())
  })

  it('shows success and auto-redirects to / after 3 seconds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    renderWithUrl('?code=valid-code')

    await waitFor(() =>
      expect(screen.getByText('이메일 인증 완료!')).toBeInTheDocument()
    )

    act(() => vi.advanceTimersByTime(3000))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows error UI when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })
    renderWithUrl('?code=expired-code')

    await waitFor(() =>
      expect(screen.getByText('인증에 실패했습니다')).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument()
  })

  it('shows error UI when error query param is present', async () => {
    renderWithUrl('?error=access_denied&error_description=Token+expired')
    await waitFor(() =>
      expect(screen.getByText('인증에 실패했습니다')).toBeInTheDocument()
    )
  })
})
