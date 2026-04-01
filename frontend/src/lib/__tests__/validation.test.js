import { describe, it, expect } from 'vitest'
import { validatePassword } from '../validation'

describe('validatePassword', () => {
  it('accepts 8+ chars with letter, digit, and special char', () => {
    expect(validatePassword('Abcdef1!')).toBe(true)
    expect(validatePassword('Hello1@world')).toBe(true)
    expect(validatePassword('Abc12345#')).toBe(true)
  })

  it('rejects fewer than 8 chars even with special char', () => {
    expect(validatePassword('Ab1!')).toBe(false)
    expect(validatePassword('123456!')).toBe(false)
  })

  it('rejects 8+ chars without special char', () => {
    expect(validatePassword('abcdefgh')).toBe(false)
    expect(validatePassword('12345678')).toBe(false)
    expect(validatePassword('Abcdefgh')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validatePassword('')).toBe(false)
  })
})
