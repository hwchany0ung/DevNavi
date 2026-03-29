import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthModal from '../AuthModal'

vi.mock('../../../lib/supabase', () => ({
  supabase: null,
  isSupabaseReady: true,
  cleanAuthParams: vi.fn(),
}))

const mockResetPasswordForEmail = vi.fn()
const mockSignInWithEmail = vi.fn()
const mockSignUpWithEmail = vi.fn()
const mockSignInWithGoogle = vi.fn()

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: vi.fn(),
    resetPasswordForEmail: mockResetPasswordForEmail,
    updatePassword: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthModal forgot mode', () => {
  it('shows "비밀번호를 잊으셨나요?" link in login mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('비밀번호를 잊으셨나요?')).toBeInTheDocument()
  })

  it('switches to forgot mode when link clicked', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    expect(screen.getByText('비밀번호 재설정')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('이메일')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '재설정 링크 보내기' })).toBeInTheDocument()
  })

  it('always shows the same success message regardless of email existence (prevent enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue(true)
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'any@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))
    await waitFor(() => {
      expect(screen.getByText('재설정 링크를 이메일로 보냈습니다. 이메일을 확인해주세요.')).toBeInTheDocument()
    })
  })

  it('shows back to login link in forgot mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('비밀번호를 잊으셨나요?'))
    expect(screen.getByText('로그인으로 돌아가기')).toBeInTheDocument()
  })
})

describe('AuthModal password policy', () => {
  it('shows updated password placeholder in signup mode', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    // Switch to signup
    fireEvent.click(screen.getByText('회원가입'))
    expect(screen.getByPlaceholderText('비밀번호 (8자 이상, 특수문자 포함)')).toBeInTheDocument()
  })

  it('rejects signup with password missing special char', async () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('비밀번호 (8자 이상, 특수문자 포함)'), { target: { value: 'abcdefgh' } })
    fireEvent.change(screen.getByPlaceholderText('비밀번호 확인'), { target: { value: 'abcdefgh' } })
    // Check agreeTerms and agreePrivacy checkboxes so form is not disabled
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(cb => fireEvent.click(cb))
    const submitBtn = screen.getByRole('button', { name: '가입하기' })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('비밀번호는 8자 이상, 특수문자를 1개 이상 포함해야 합니다')).toBeInTheDocument()
    })
    expect(mockSignUpWithEmail).not.toHaveBeenCalled()
  })
})

describe('AuthModal privacy modal integration', () => {
  it('opens privacy consent modal when privacy link clicked', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    // Click the privacy label text to open modal
    fireEvent.click(screen.getByText('개인정보처리방침'))
    expect(screen.getByText('개인정보 수집 및 이용 동의')).toBeInTheDocument()
  })

  it('sets agreePrivacy=true when 동의하기 clicked in modal', () => {
    render(<AuthModal open={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('회원가입'))
    fireEvent.click(screen.getByText('개인정보처리방침'))
    fireEvent.click(screen.getByRole('button', { name: '동의하기' }))
    // Privacy modal should be closed
    expect(screen.queryByText('개인정보 수집 및 이용 동의')).not.toBeInTheDocument()
    // agreePrivacy checkbox should be checked
    const privacyCheckbox = screen.getAllByRole('checkbox')[1]
    expect(privacyCheckbox).toBeChecked()
  })
})
