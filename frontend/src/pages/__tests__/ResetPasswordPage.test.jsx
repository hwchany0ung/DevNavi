import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResetPasswordPage from '../ResetPasswordPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockExchangeCodeForSession = vi.fn()
const mockGetSession = vi.fn()
const mockUpdatePassword = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...args) => mockExchangeCodeForSession(...args),
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  mockExchangeCodeForSession.mockResolvedValue({ error: null })
  mockUpdatePassword.mockResolvedValue(true)
})

describe('ResetPasswordPage', () => {
  it('redirects to / when no code param', async () => {
    renderWithUrl('')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows new password form after successful code exchange', async () => {
    renderWithUrl('?code=valid-code')
    await waitFor(() =>
      expect(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
    )
    expect(screen.getByPlaceholderText('새 비밀번호 확인')).toBeInTheDocument()
  })

  it('shows expired link error when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })
    renderWithUrl('?code=expired')
    await waitFor(() =>
      expect(screen.getByText('링크가 만료됐습니다. 다시 요청해 주세요.')).toBeInTheDocument()
    )
  })

  it('prevents submit when passwords do not match', async () => {
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
    renderWithUrl('?code=valid')
    await waitFor(() => screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'))
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 (8자 이상, 특수문자 포함)'), {
      target: { value: 'nospecia' },
    })
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), {
      target: { value: 'nospecia' },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다')).toBeInTheDocument()
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('redirects to / on successful password update', async () => {
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
