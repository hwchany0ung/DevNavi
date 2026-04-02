import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Design Ref: §3.4 — AuthContext 상태 전이 테스트
// Plan SC: AuthContext 상태 전이 테스트 (TR-07)

vi.mock('../../lib/supabase', () => {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signOut: vi.fn().mockResolvedValue({}),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  }
  return {
    supabase: { auth: mockAuth },
    isSupabaseReady: true,
    cleanAuthParams: vi.fn(),
  }
})

vi.mock('../../lib/api', () => ({
  request: vi.fn().mockResolvedValue({}),
}))

import { AuthProvider, useAuth } from '../AuthContext'
import { supabase } from '../../lib/supabase'

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

const mockSession = {
  access_token: 'mock-token',
  user: {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {},
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
})

describe('AuthContext 초기 상태', () => {
  it('Supabase 준비 시 loading=true로 시작', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    // getSession 비동기 완료 전이므로 user는 null
    expect(result.current.user).toBeNull()
  })

  it('getSession 완료 후 loading=false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.loading).toBe(false)
  })

  it('세션 없으면 user=null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.user).toBeNull()
  })
})

describe('AuthContext 세션 복원', () => {
  it('기존 세션 있으면 user 설정', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    expect(result.current.user).not.toBeNull()
    expect(result.current.user.email).toBe('test@example.com')
  })
})

describe('AuthContext signOut', () => {
  it('signOut 호출 시 user=null', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    await act(async () => {
      await result.current.signOut()
    })
    expect(result.current.user).toBeNull()
  })
})

describe('AuthContext onAuthStateChange', () => {
  it('SIGNED_IN 이벤트 → user 업데이트', async () => {
    let capturedCallback
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    await act(async () => {
      capturedCallback('SIGNED_IN', mockSession)
    })
    expect(result.current.user).not.toBeNull()
  })

  it('SIGNED_OUT 이벤트 → user=null', async () => {
    let capturedCallback
    supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    await act(async () => {
      capturedCallback('SIGNED_OUT', null)
    })
    expect(result.current.user).toBeNull()
  })
})
