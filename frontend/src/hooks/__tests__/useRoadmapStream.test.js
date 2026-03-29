import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRoadmapStream } from '../useRoadmapStream'

// The hook imports streamSSE from '../lib/api' (relative to hooks/).
// From the test file in hooks/__tests__/, that same module is '../../lib/api'.
vi.mock('../../lib/api', () => ({
  streamSSE: vi.fn(),
}))
import { streamSSE } from '../../lib/api'

/**
 * Simulates a complete SSE stream where all content arrives as a single chunk.
 * The hook's onChunk receives already-parsed chunk text (streamSSE parses SSE internally),
 * so we call onChunk directly with the raw JSON string, then call onDone.
 */
function mockSSEWithDone(jsonString) {
  streamSSE.mockImplementation((_path, _body, onChunk, onDone, _onError, _headers) => {
    onChunk(jsonString)
    onDone()
    return { abort: vi.fn() }
  })
}

/**
 * Simulates an SSE connection/network error.
 */
function mockSSEWithError(error) {
  streamSSE.mockImplementation((_path, _body, _onChunk, _onDone, onError, _headers) => {
    onError(error)
    return { abort: vi.fn() }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useRoadmapStream — 종료 경로', () => {
  it('정상 JSON → onSaved 호출, onError 미호출', async () => {
    const onSaved = vi.fn()
    const onError = vi.fn()
    mockSSEWithDone('{"months":[]}')

    const { result } = renderHook(() => useRoadmapStream({ onSaved, onError }))
    await act(async () => {
      result.current.start({}, {})
    })

    expect(onSaved).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('SSE 연결 오류 → onError 호출, onSaved 미호출', async () => {
    const onSaved = vi.fn()
    const onError = vi.fn()
    mockSSEWithError(new Error('network error'))

    const { result } = renderHook(() => useRoadmapStream({ onSaved, onError }))
    await act(async () => {
      result.current.start({}, {})
    })

    expect(onError).toHaveBeenCalledOnce()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('truncated JSON(!endsWith }) → onError 호출, onSaved 미호출 [NF1]', async () => {
    const onSaved = vi.fn()
    const onError = vi.fn()
    // JSON that doesn't end with '}' — simulates a truncated stream
    mockSSEWithDone('{"months":[{"month":1')

    const { result } = renderHook(() => useRoadmapStream({ onSaved, onError }))
    await act(async () => {
      result.current.start({}, {})
    })

    expect(onError).toHaveBeenCalledOnce()
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.error).toBeTruthy()
    expect(result.current.error.message).toContain('너무 길어')
  })
})
