import { describe, expect, it } from 'vitest'
import { createErrorGate, feedbackProblem, ignorable, pageOf } from './feedbackModel'

describe('feedback model', () => {
  it('asks for a few words and caps the length', () => {
    expect(feedbackProblem(' hi ')).toMatch(/a little more/)
    expect(feedbackProblem('The chart is empty')).toBeNull()
    expect(feedbackProblem('x'.repeat(2001))).toMatch(/under 2000/)
  })

  it('never reports a progress link token', () => {
    expect(pageOf({ pathname: '/progress/abc123secret' })).toBe('/progress/…')
    expect(pageOf({ pathname: '/progress/abc123secret/resume' })).toBe('/progress/…/resume')
    expect(pageOf({ pathname: '/settings' })).toBe('/settings')
  })

  it('ignores errors the app cannot act on', () => {
    expect(ignorable('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(ignorable('Script error.')).toBe(true)
    expect(ignorable('TypeError: x', 'at chrome-extension://abc/x.js')).toBe(true)
    expect(ignorable("TypeError: Cannot read properties of undefined (reading 'map')")).toBe(false)
  })

  it('sends each message once and at most the limit per page load', () => {
    const gate = createErrorGate(2)
    expect(gate('a')).toBe(true)
    expect(gate('a')).toBe(false)
    expect(gate('b')).toBe(true)
    expect(gate('c')).toBe(false)
  })
})
