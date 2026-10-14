import { describe, expect, it } from 'vitest'
import { ApiError, ApiUnreachableError, fallbackMessage, isDegraded, fieldReasons } from './api'

describe('fallbackMessage', () => {
  it('explains a rate limit in words', () => expect(fallbackMessage(429)).toMatch(/Too many requests/))
  it('keeps the status for anything else', () => expect(fallbackMessage(502)).toBe('Request failed (502)'))
})

describe('isDegraded', () => {
  it('is true only for server errors', () => {
    expect(isDegraded(new ApiError(503, 'db down'))).toBe(true)
    expect(isDegraded(new ApiError(429, 'slow down'))).toBe(false)
    expect(isDegraded(new ApiUnreachableError('asleep'))).toBe(false)
  })
})

describe('fieldReasons', () => {
  it('joins the per-field reasons so a form shows why, not "Validation failed"', () => {
    expect(fieldReasons({ url: ['Slack refused the address.'], token: ['Paste the token.'] })).toBe('Slack refused the address. Paste the token.')
    expect(fieldReasons({})).toBeUndefined()
    expect(fieldReasons(undefined)).toBeUndefined()
  })
})
