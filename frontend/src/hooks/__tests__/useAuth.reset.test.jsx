import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock supabase BEFORE importing useAuth
vi.mock('../../lib/supabase', () => {
  const mockAuth = {
    getSession:          vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange:   vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    resetPasswordForEmail: vi.fn(),
    updateUser:          vi.fn(),
  }
  return {
    supabase:         { auth: mockAuth },
    isSupabaseReady:  true,
    cleanAuthParams:  vi.fn(),
  }
})

import { useAuth } from '../useAuth'
import { AuthProvider } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
})

describe('resetPasswordForEmail', () => {
  it('calls supabase with correct redirectTo and returns true on success', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('user@example.com')
    })

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: `${window.location.origin}/reset-password` }
    )
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns true even when email does not exist (prevent enumeration)', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('nonexistent@example.com')
    })
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns false and sets error on API failure', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: 'rate limit exceeded' },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.resetPasswordForEmail('user@example.com')
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('rate limit exceeded')
  })
})

describe('updatePassword', () => {
  it('calls supabase.auth.updateUser with new password and returns true', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.updatePassword('NewPass1!')
    })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPass1!' })
    expect(ok).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('returns false and sets error on failure', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    let ok
    await act(async () => {
      ok = await result.current.updatePassword('NewPass1!')
    })
    expect(ok).toBe(false)
    expect(result.current.error).toBe('Auth session missing!')
  })
})
