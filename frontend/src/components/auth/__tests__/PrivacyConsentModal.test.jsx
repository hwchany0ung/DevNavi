import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrivacyConsentModal from '../PrivacyConsentModal'

describe('PrivacyConsentModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PrivacyConsentModal open={false} onAgree={vi.fn()} onDisagree={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows modal content when open', () => {
    render(<PrivacyConsentModal open={true} onAgree={vi.fn()} onDisagree={vi.fn()} />)
    expect(screen.getByText('개인정보 수집 및 이용 동의')).toBeInTheDocument()
    expect(screen.getByText(/이메일 주소/)).toBeInTheDocument()
    expect(screen.getByText(/회원 식별 및 서비스 제공/)).toBeInTheDocument()
    expect(screen.getByText(/회원 탈퇴 시까지/)).toBeInTheDocument()
    expect(screen.getByText(/동의를 거부할 권리/)).toBeInTheDocument()
  })

  it('calls onAgree when 동의하기 is clicked', () => {
    const onAgree = vi.fn()
    render(<PrivacyConsentModal open={true} onAgree={onAgree} onDisagree={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '동의하기' }))
    expect(onAgree).toHaveBeenCalledOnce()
  })

  it('calls onDisagree when 동의하지 않음 is clicked', () => {
    const onDisagree = vi.fn()
    render(<PrivacyConsentModal open={true} onAgree={vi.fn()} onDisagree={onDisagree} />)
    fireEvent.click(screen.getByRole('button', { name: '동의하지 않음' }))
    expect(onDisagree).toHaveBeenCalledOnce()
  })
})
