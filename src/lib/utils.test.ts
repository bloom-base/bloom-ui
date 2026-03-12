import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { timeAgo, validatePassword, isPasswordStrong } from './utils'

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for < 60 seconds', () => {
    expect(timeAgo('2026-02-28T11:59:30Z')).toBe('just now')
  })

  it('returns minutes for < 60 minutes', () => {
    expect(timeAgo('2026-02-28T11:45:00Z')).toBe('15m ago')
  })

  it('returns hours for < 24 hours', () => {
    expect(timeAgo('2026-02-28T06:00:00Z')).toBe('6h ago')
  })

  it('returns days for < 7 days', () => {
    expect(timeAgo('2026-02-25T12:00:00Z')).toBe('3d ago')
  })

  it('returns weeks for < 30 days', () => {
    expect(timeAgo('2026-02-14T12:00:00Z')).toBe('2w ago')
  })

  it('returns months for < 12 months', () => {
    expect(timeAgo('2025-11-28T12:00:00Z')).toBe('3mo ago')
  })

  it('returns years for >= 12 months', () => {
    expect(timeAgo('2024-02-28T12:00:00Z')).toBe('2y ago')
  })

  it('handles edge case: exactly 1 minute ago', () => {
    expect(timeAgo('2026-02-28T11:59:00Z')).toBe('1m ago')
  })

  it('handles edge case: exactly 1 hour ago', () => {
    expect(timeAgo('2026-02-28T11:00:00Z')).toBe('1h ago')
  })

  it('handles edge case: exactly 1 day ago', () => {
    expect(timeAgo('2026-02-27T12:00:00Z')).toBe('1d ago')
  })
})

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('Short1')).toContain('8 characters')
  })

  it('rejects passwords without uppercase', () => {
    expect(validatePassword('lowercase1')).toContain('uppercase')
  })

  it('rejects passwords without lowercase', () => {
    expect(validatePassword('UPPERCASE1')).toContain('lowercase')
  })

  it('rejects passwords without numbers', () => {
    expect(validatePassword('NoNumbers')).toContain('number')
  })

  it('accepts strong passwords', () => {
    expect(validatePassword('Strong1Pass')).toBeNull()
  })

  it('accepts password with exactly 8 characters meeting all rules', () => {
    expect(validatePassword('Abcdef1x')).toBeNull()
  })
})

describe('isPasswordStrong', () => {
  it('returns false for weak passwords', () => {
    expect(isPasswordStrong('weak')).toBe(false)
  })

  it('returns true for strong passwords', () => {
    expect(isPasswordStrong('Strong1Pass')).toBe(true)
  })
})
