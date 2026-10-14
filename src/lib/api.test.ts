import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, ApiUnreachableError, configureApiAuth, fallbackMessage, isDegraded, fieldReasons, sameAuthIdentity } from './api'

afterEach(() => {
  configureApiAuth(async () => ({}), () => {})
  vi.unstubAllGlobals()
})

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

describe('sameAuthIdentity', () => {
  it('recognises the same bearer or dev identity', () => {
    expect(sameAuthIdentity({ Authorization: 'Bearer one' }, { Authorization: 'Bearer one' })).toBe(true)
    expect(sameAuthIdentity({ 'X-Dev-User': 'alice' }, { 'X-Dev-User': 'alice' })).toBe(true)
  })

  it('rejects a stale anonymous or bearer request after the session changes', () => {
    expect(sameAuthIdentity({}, { Authorization: 'Bearer new-session' })).toBe(false)
    expect(sameAuthIdentity({ Authorization: 'Bearer old' }, { Authorization: 'Bearer new' })).toBe(false)
  })

  it('does not clear a session created while an anonymous request was in flight', async () => {
    let currentToken: string | null = null
    let unauthorizedCalls = 0
    configureApiAuth(
      async (): Promise<Record<string, string>> => currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
      () => { unauthorizedCalls += 1 },
    )
    vi.stubGlobal('fetch', vi.fn(async () => {
      currentToken = 'new-session'
      return new Response(null, { status: 401 })
    }))

    await expect(api('/protected')).rejects.toMatchObject({ status: 401 })
    expect(unauthorizedCalls).toBe(0)
  })
})
