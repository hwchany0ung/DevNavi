import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import Step2Form from '../Step2Form'

// ── 기본 props ─────────────────────────────────────────────────────────
const defaultValues = {
  skills:         [],
  certifications: [],
  company_type:   '',
  daily_study_hours: '',
  extra_profile:  { has_deployment: false, coding_test_level: 'none', team_project_count: 0 },
}

const noop = () => {}

// ── fetch mock 헬퍼 ────────────────────────────────────────────────────
function mockFetchSuccess(skills, certs) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ skills, certs }),
  })
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

function mockFetchEmpty() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ skills: [], certs: [] }),
  })
}

// ── 테스트 ────────────────────────────────────────────────────────────
describe('Step2Form — API 연동', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete global.fetch
  })

  it('로딩 중 스켈레톤 UI가 표시됨', async () => {
    // fetch를 절대 resolve하지 않는 pending Promise
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    render(<Step2Form values={defaultValues} onChange={noop} role="backend" />)

    // aria-busy 스켈레톤이 렌더링되어야 함
    const skeletons = screen.getAllByLabelText('추천 항목 로딩 중')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('API 성공 시 반환된 스킬 버튼이 렌더링됨', async () => {
    mockFetchSuccess(['Java', 'Python', 'Docker'], ['정보처리기사', 'SQLD'])

    render(<Step2Form values={defaultValues} onChange={noop} role="backend" />)

    await waitFor(() => {
      expect(screen.getByText('Java')).toBeInTheDocument()
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('정보처리기사')).toBeInTheDocument()
    })
  })

  it('API 실패 시 fallback 하드코딩 스킬 표시', async () => {
    mockFetchFailure()

    render(<Step2Form values={defaultValues} onChange={noop} role="backend" />)

    await waitFor(() => {
      // fallback: ROLE_SKILLS.backend 첫 항목
      expect(screen.getByText('Java')).toBeInTheDocument()
      expect(screen.getByText('Spring Boot')).toBeInTheDocument()
    })
  })

  it('API 빈 배열 반환 시 fallback 하드코딩 스킬 표시', async () => {
    mockFetchEmpty()

    render(<Step2Form values={defaultValues} onChange={noop} role="frontend" />)

    await waitFor(() => {
      // fallback: ROLE_SKILLS.frontend 첫 항목
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('React')).toBeInTheDocument()
    })
  })

  it('role prop 변경 시 API를 재호출하며 새 role URL을 사용함', async () => {
    // fetch를 단일 spy로 유지 — 첫 번째 backend, 두 번째 frontend 응답
    let callCount = 0
    global.fetch = vi.fn().mockImplementation((url) => {
      callCount++
      if (url.includes('role=frontend')) {
        return Promise.resolve({ ok: true, json: async () => ({ skills: ['TypeScript', 'React'], certs: ['정보처리기사'] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ skills: ['Java', 'Python'], certs: ['정보처리기사'] }) })
    })

    const { rerender } = render(
      <Step2Form values={defaultValues} onChange={noop} role="backend" />
    )

    // backend 로드 완료 대기
    await waitFor(() => expect(screen.getByText('Java')).toBeInTheDocument())

    // role → frontend 로 변경
    await act(async () => {
      rerender(<Step2Form values={defaultValues} onChange={noop} role="frontend" />)
    })

    // frontend 데이터 렌더링 대기
    await waitFor(() => expect(screen.getByText('TypeScript')).toBeInTheDocument())

    // 두 번째 호출이 frontend URL로 이루어졌는지 확인
    const calls = global.fetch.mock.calls
    const frontendCall = calls.find(c => c[0].includes('role=frontend'))
    expect(frontendCall).toBeTruthy()
  })

  it('API 호출 URL에 role 파라미터가 포함됨', async () => {
    mockFetchSuccess(['Kotlin', 'Swift'], ['정보처리기사'])

    render(<Step2Form values={defaultValues} onChange={noop} role="ios_android" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('role=ios_android'),
        expect.any(Object),
      )
    })
  })
})

describe('Step2Form — 기본 렌더링', () => {
  beforeEach(() => {
    mockFetchSuccess(['Java', 'Python'], ['정보처리기사'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete global.fetch
  })

  it('Q4·Q5·Q6·Q7 섹션이 모두 렌더링됨', async () => {
    render(<Step2Form values={defaultValues} onChange={noop} role="backend" />)
    expect(screen.getByText(/Q4/)).toBeInTheDocument()
    expect(screen.getByText(/Q5/)).toBeInTheDocument()
    expect(screen.getByText(/Q6/)).toBeInTheDocument()
    expect(screen.getByText(/Q7/)).toBeInTheDocument()
  })
})
