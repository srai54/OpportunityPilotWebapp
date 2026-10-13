import { describe, expect, it } from 'vitest'
import {
  activeGuestToken,
  authScreenFor,
  formatCountdown,
  isAuthOnlyPath,
  passwordStrength,
  resendSecondsLeft, factorName, needsMfa, normalizeTotp, validTotp } from './authModel'

describe('account screens', () => {
  it('maps URLs to screens; anything else is sign-in so deep links survive', () => {
    expect(authScreenFor('/signup')).toBe('signup')
    expect(authScreenFor('/verify/')).toBe('verify')
    expect(authScreenFor('/reset')).toBe('reset')
    expect(authScreenFor('/reset/new')).toBe('new-password')
    expect(authScreenFor('/opportunities/42')).toBe('signin')
  })

  it('knows which paths only exist while signed out', () => {
    expect(isAuthOnlyPath('/signup')).toBe(true)
    expect(isAuthOnlyPath('/reset/new')).toBe(true)
    expect(isAuthOnlyPath('/')).toBe(false)
    expect(isAuthOnlyPath('/settings')).toBe(false)
  })

  it('rates passwords by length, then variety', () => {
    expect(passwordStrength('short').label).toBe('Too short')
    expect(passwordStrength('alllowercaseletters').label).toBe('Weak')
    expect(passwordStrength('LowercaseAndUpper').label).toBe('Fair')
    expect(passwordStrength('Abcdefgh1234').label).toBe('Fair')
    expect(passwordStrength('Abcdefgh12345678').label).toBe('Good')
    expect(passwordStrength('Abcdefgh1234!xyz').label).toBe('Strong')
  })

  it('counts down the resend cooldown', () => {
    expect(resendSecondsLeft(0, 18_000)).toBe(42)
    expect(resendSecondsLeft(0, 90_000)).toBe(0)
    expect(formatCountdown(42)).toBe('0:42')
    expect(formatCountdown(75)).toBe('1:15')
  })

  it('accepts only an unexpired server-issued guest session', () => {
    const now = Date.parse('2026-10-06T10:00:00Z')
    expect(activeGuestToken({ token: 'valid', expiresAt: '2026-10-06T10:01:00Z' }, now)).toBe('valid')
    expect(activeGuestToken({ token: 'expired', expiresAt: '2026-10-06T09:59:00Z' }, now)).toBeNull()
    expect(activeGuestToken({ token: 'bad-date', expiresAt: 'not-a-date' }, now)).toBeNull()
    expect(activeGuestToken(null, now)).toBeNull()
  })
})

describe('two-factor helpers', () => {
  it('asks for the code only when a factor exists and this session has not used it', () => {
    expect(needsMfa({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true)
    expect(needsMfa({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false)
    expect(needsMfa({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false)
    expect(needsMfa(null)).toBe(false)
  })
  it('accepts six digits with or without spaces and nothing else', () => {
    expect(validTotp('123456')).toBe(true)
    expect(validTotp(' 123 456 ')).toBe(true)
    expect(normalizeTotp('123 456')).toBe('123456')
    expect(validTotp('12345')).toBe(false)
    expect(validTotp('12345a')).toBe(false)
    expect(validTotp('1234567')).toBe(false)
  })
  it('gives each setup attempt its own name', () => {
    expect(factorName(new Date('2026-10-13T09:05:00Z'))).toBe('Authenticator 2026-10-13 09:05')
  })
})
