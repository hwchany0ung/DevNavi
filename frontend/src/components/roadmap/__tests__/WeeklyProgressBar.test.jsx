import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WeeklyProgressBar from '../WeeklyProgressBar'

// 테스트용 로드맵 months 데이터
const mockMonths = [
  {
    month: 1,
    theme: '기초 다지기',
    weeks: [
      {
        week: 1,
        tasks: [
          { content: '태스크 A' },
          { content: '태스크 B' },
          { content: '태스크 C' },
          { content: '태스크 D' },
        ],
      },
      {
        week: 2,
        tasks: [
          { content: '태스크 E' },
          { content: '태스크 F' },
          { content: '태스크 G' },
          { content: '태스크 H' },
        ],
      },
      {
        week: 3,
        tasks: [
          { content: '태스크 I' },
          { content: '태스크 J' },
          { content: '태스크 K' },
          { content: '태스크 L' },
        ],
      },
    ],
  },
]

describe('WeeklyProgressBar', () => {
  it('빈 doneSet 시 모든 주차 0% 표시', () => {
    render(
      <WeeklyProgressBar
        months={mockMonths}
        activeMonth={1}
        doneSet={new Set()}
      />
    )

    // 헤더
    expect(screen.getByText('📊 주간 진도율')).toBeInTheDocument()

    // 각 주차 0% 표시
    const bars = screen.getAllByRole('progressbar')
    expect(bars).toHaveLength(3)
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute('aria-valuenow', '0')
    })

    // 수치 텍스트
    const zeroLabels = screen.getAllByText('0% (0/4)')
    expect(zeroLabels).toHaveLength(3)
  })

  it('완료율 계산 로직 검증 — 1주차 75% (3/4), 2주차 50% (2/4), 3주차 0%', () => {
    // 1주차: task 0,1,2 완료 (3/4 = 75%)
    // 2주차: task 0,1 완료 (2/4 = 50%)
    // 3주차: 미완료 (0/4 = 0%)
    const doneSet = new Set(['1-1-0', '1-1-1', '1-1-2', '1-2-0', '1-2-1'])

    render(
      <WeeklyProgressBar
        months={mockMonths}
        activeMonth={1}
        doneSet={doneSet}
      />
    )

    expect(screen.getByText('75% (3/4)')).toBeInTheDocument()
    expect(screen.getByText('50% (2/4)')).toBeInTheDocument()
    expect(screen.getByText('0% (0/4)')).toBeInTheDocument()

    const bars = screen.getAllByRole('progressbar')
    expect(bars[0]).toHaveAttribute('aria-valuenow', '75')
    expect(bars[1]).toHaveAttribute('aria-valuenow', '50')
    expect(bars[2]).toHaveAttribute('aria-valuenow', '0')
  })

  it('모든 태스크 완료 주차에 체크 표시(✓) 렌더링', () => {
    // 1주차 전체 완료
    const doneSet = new Set(['1-1-0', '1-1-1', '1-1-2', '1-1-3'])

    render(
      <WeeklyProgressBar
        months={mockMonths}
        activeMonth={1}
        doneSet={doneSet}
      />
    )

    expect(screen.getByText('100% (4/4)')).toBeInTheDocument()
    // ✓ 표시 확인 (완료된 주차)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('존재하지 않는 activeMonth 시 null 반환 (아무것도 렌더링 안 함)', () => {
    const { container } = render(
      <WeeklyProgressBar
        months={mockMonths}
        activeMonth={99}
        doneSet={new Set()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('months가 비어있을 때 null 반환', () => {
    const { container } = render(
      <WeeklyProgressBar
        months={[]}
        activeMonth={1}
        doneSet={new Set()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('주차 레이블이 올바르게 표시됨', () => {
    render(
      <WeeklyProgressBar
        months={mockMonths}
        activeMonth={1}
        doneSet={new Set()}
      />
    )

    expect(screen.getByText('1주차')).toBeInTheDocument()
    expect(screen.getByText('2주차')).toBeInTheDocument()
    expect(screen.getByText('3주차')).toBeInTheDocument()
  })
})
