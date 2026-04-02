import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Design Ref: §8 Frontend 단위 테스트 — QAPanel, QAButton, QAInput, useQA

// ── 모듈 모킹 ──────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: null,
}))

vi.mock('../lib/api', () => ({
  streamSSE: vi.fn(),
  request: vi.fn(),
}))

vi.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}))

import { streamSSE } from '../lib/api'
import QAPanel from '../components/qa/QAPanel'
import QAButton from '../components/qa/QAButton'
import QAInput from '../components/qa/QAInput'

// ── 공통 픽스처 ─────────────────────────────────────────────────────────────

const TASK_CONTEXT = {
  taskId: '1-1-0',
  taskName: 'Docker 네트워킹 설정하기',
  jobType: 'backend',
  month: 1,
  week: 1,
  category: '기초',
}

beforeEach(() => {
  vi.clearAllMocks()
  // 기본 streamSSE stub — 즉시 onDone 호출
  streamSSE.mockImplementation((_path, _body, _onChunk, onDone) => {
    onDone?.()
    return { abort: vi.fn() }
  })
})

// ── Test Suite 1: QAButton ──────────────────────────────────────────────────

describe('QAButton', () => {
  it('renders with aria-label including task name', () => {
    const onOpen = vi.fn()
    render(
      <QAButton
        taskId="1-1-0"
        taskName="Docker 네트워킹 설정하기"
        taskContext={{ jobType: 'backend', month: 1, week: 1, category: '기초' }}
        onOpen={onOpen}
      />
    )
    expect(screen.getByRole('button', { name: /Docker 네트워킹/i })).toBeInTheDocument()
  })

  it('calls onOpen with taskId and taskContext when clicked', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(
      <QAButton
        taskId="1-1-0"
        taskName="Docker 네트워킹 설정하기"
        taskContext={{ jobType: 'backend', month: 1, week: 1, category: '기초' }}
        onOpen={onOpen}
      />
    )
    await user.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledWith('1-1-0', expect.objectContaining({ taskName: 'Docker 네트워킹 설정하기' }))
  })

  it('displays "?" text', () => {
    render(
      <QAButton
        taskId="1-1-0"
        taskName="Test Task"
        taskContext={{ jobType: 'backend', month: 1, week: 1, category: '기초' }}
        onOpen={vi.fn()}
      />
    )
    expect(screen.getByRole('button')).toHaveTextContent('?')
  })
})

// ── Test Suite 2: QAInput ──────────────────────────────────────────────────

describe('QAInput', () => {
  it('submits on Enter key (not Shift+Enter)', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<QAInput onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '질문입니다')
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('질문입니다')
  })

  it('does NOT submit on Shift+Enter (newline only)', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<QAInput onSubmit={onSubmit} disabled={false} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '질문입니다')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables textarea and button when disabled=true', () => {
    render(<QAInput onSubmit={vi.fn()} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('submit button is disabled when input is empty', () => {
    render(<QAInput onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('submit button is enabled when text is entered', async () => {
    const user = userEvent.setup()
    render(<QAInput onSubmit={vi.fn()} disabled={false} />)
    await user.type(screen.getByRole('textbox'), '안녕')
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})

// ── Test Suite 3: QAPanel ─────────────────────────────────────────────────

describe('QAPanel', () => {
  it('is not visible when isOpen=false (translated off-screen)', () => {
    const { container } = render(
      <QAPanel isOpen={false} taskContext={TASK_CONTEXT} onClose={vi.fn()} />
    )
    const panel = container.querySelector('[role="dialog"]')
    expect(panel).toHaveClass('translate-x-full')
  })

  it('is visible when isOpen=true (translateX(0))', () => {
    const { container } = render(
      <QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />
    )
    const panel = container.querySelector('[role="dialog"]')
    expect(panel).toHaveClass('translate-x-0')
  })

  it('calls onClose when X button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /패널 닫기/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('displays task name in header', () => {
    render(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)
    expect(screen.getByText('Docker 네트워킹 설정하기')).toBeInTheDocument()
  })

  it('shows empty state prompt when no messages', () => {
    render(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)
    expect(screen.getByText(/궁금하신가요/i)).toBeInTheDocument()
  })

  it('calls streamSSE and displays user message after submit', async () => {
    const user = userEvent.setup()
    render(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Docker란 무엇인가요?')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(streamSSE).toHaveBeenCalledOnce()
    })
    expect(screen.getByText('Docker란 무엇인가요?')).toBeInTheDocument()
  })

  it('passes correct task_id and task_context to streamSSE', async () => {
    const user = userEvent.setup()
    render(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)

    await user.type(screen.getByRole('textbox'), '테스트 질문')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(streamSSE).toHaveBeenCalledOnce()
    })

    const [path, body] = streamSSE.mock.calls[0]
    expect(path).toBe('/ai/qa')
    expect(body.task_id).toBe('1-1-0')
    expect(body.task_context.job_type).toBe('backend')
    expect(body.task_context.task_name).toBe('Docker 네트워킹 설정하기')
  })
})

// ── Test Suite 4: useQA session memory ────────────────────────────────────

describe('useQA session memory', () => {
  it('restores previous conversation when same taskId is re-opened', async () => {
    // useQA를 직접 테스트하려면 컴포넌트를 통해 간접 검증
    // QAPanel을 마운트/언마운트/재마운트하여 대화 이력 복원 확인
    streamSSE.mockImplementation((_path, _body, onChunk, onDone) => {
      onChunk?.('이전 답변입니다')
      onDone?.()
      return { abort: vi.fn() }
    })

    const user = userEvent.setup()
    const { unmount, rerender } = render(
      <QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />
    )

    // 질문 전송
    await user.type(screen.getByRole('textbox'), '첫 번째 질문')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByText('첫 번째 질문')).toBeInTheDocument()
    })

    // useQA는 hook 인스턴스가 QAPanel 내부에 있으므로
    // 같은 컴포넌트 인스턴스에서 패널 닫기/열기 시 Map 상태 유지 여부 확인
    // isOpen false → true 전환
    rerender(<QAPanel isOpen={false} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)
    rerender(<QAPanel isOpen={true} taskContext={TASK_CONTEXT} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('첫 번째 질문')).toBeInTheDocument()
    })
  })
})
