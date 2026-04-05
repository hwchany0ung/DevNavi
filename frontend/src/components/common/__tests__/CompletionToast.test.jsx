import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import CompletionToast from '../CompletionToast'

// 2초 타이머를 포함한 wrapper 컴포넌트 (fake timers 테스트용)
function ToastWrapper({ initialVisible = false }) {
  const [visible, setVisible] = useState(initialVisible)
  const show = () => {
    setVisible(true)
    setTimeout(() => setVisible(false), 2000)
  }
  return (
    <>
      <button onClick={show}>show</button>
      <CompletionToast message="완료! 꾸준히 하면 반드시 됩니다." visible={visible} />
    </>
  )
}

describe('CompletionToast', () => {
  it('visible=true 이면 메시지가 렌더링됨', () => {
    render(<CompletionToast message="완료! 꾸준히 하면 반드시 됩니다." visible={true} />)
    expect(screen.getByText('완료! 꾸준히 하면 반드시 됩니다.')).toBeInTheDocument()
  })

  it('visible=false 이면 DOM에 존재하지만 숨김 클래스가 적용됨', () => {
    render(<CompletionToast message="완료! 꾸준히 하면 반드시 됩니다." visible={false} />)
    const el = screen.getByRole('status')
    expect(el).toHaveClass('opacity-0')
    expect(el).toHaveClass('pointer-events-none')
  })

  it('visible=true 이면 표시 클래스가 적용됨', () => {
    render(<CompletionToast message="이번 주 완료! 다음 주도 화이팅!" visible={true} />)
    const el = screen.getByRole('status')
    expect(el).toHaveClass('opacity-100')
    expect(el).not.toHaveClass('opacity-0')
  })

  it('주간 완료 특별 메시지가 렌더링됨', () => {
    render(<CompletionToast message="이번 주 완료! 다음 주도 화이팅!" visible={true} />)
    expect(screen.getByText('이번 주 완료! 다음 주도 화이팅!')).toBeInTheDocument()
  })

  describe('2초 후 자동 소멸 (vi.useFakeTimers)', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('show 후 2초 경과 시 visible이 false로 전환됨', async () => {
      render(<ToastWrapper />)

      // show 버튼 클릭 → visible=true, setTimeout(2000) 등록
      await act(async () => {
        screen.getByText('show').click()
      })

      // 표시 확인
      expect(screen.getByRole('status')).toHaveClass('opacity-100')

      // 2초 경과
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // 숨김 확인
      expect(screen.getByRole('status')).toHaveClass('opacity-0')
    })
  })
})
