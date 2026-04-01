import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResetPasswordPage from '../ResetPasswordPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Capture the onAuthStateChange callback so tests can trigger auth events
let mockAuthStateCallback = null
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()
const mockUpdatePassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      // Capture the callback so tests can fire auth events manually
      onAuthStateChange: vi.fn((cb) => {
        mockAuthStateCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      getSession: (...args) => mockGetSession(...args),
      signOut: (...args) => mockSignOut(...args),
    },
  },
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: mockUpdatePassword,
  }),
}))

function renderWithUrl(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthStateCallback = null
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSignOut.mockResolvedValue({})
  mockUpdatePassword.mockResolvedValue(true)
})

describe('ResetPasswordPage', () => {
  it('redirects to / when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows spinner initially when code is present', () => {
    renderWithUrl('?code=valid-code')
    expect(screen.getByText('링크 확인 중…')).toBeInTheDocument()
  })

  it('shows form when PASSWORD_RECOVERY event fires via onAuthStateChange', async () => {
    renderWithUrl('?code=valid-code')
    // Wait for the subscription to be registered
    await waitFor(() => expect(mockAuthStateCallback).not.toBeNull())
    // Simulate Supabase auto-exchange completing and firing PASSWORD_RECOVERY
    mockAuthStateCallback('PASSWORD_RECOVERY', { user: { id: '123' }, access_token: 'tok' })
    await waitFor(() =>
      expect(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
    )
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toBeInTheDocument()
  })

  it('shows form when getSession returns session (race condition path)', async () => {
    // Session already established before subscription fires
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=valid-code')
    await waitFor(() =>
      expect(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
    )
  })

  it('prevents submit when passwords do not match', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'Different1!' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('prevents submit when password does not meet policy', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'nospecia' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'nospecia' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('비밀번호는 8자 이상, 영문자·숫자·특수문자를 각 1개 이상 포함해야 합니다')).toBeInTheDocument()
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('redirects to / on successful password update', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: '123' }, access_token: 'tok' } },
      error: null,
    })
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'NewPass1!' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})
