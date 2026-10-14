import { describe, expect, it } from 'vitest'
import { agoText, countdown, journey, progressUrl, shownSummary, stagePercent, updateMailto } from './progressModel'

describe('progress link helpers', () => {
  it('builds the link from the site address and token', () => {
    expect(progressUrl('https://app.example/', 'abc_-1')).toBe('https://app.example/progress/abc_-1')
  })
  it('prepares an email only when the candidate has an address, and puts the link in it', () => {
    expect(updateMailto({ name: 'Priya Sharma', email: null }, 'https://x/progress/t')).toBeNull()
    const m = updateMailto({ name: 'Priya Sharma', email: 'priya@example.test' }, 'https://x/progress/t')!
    expect(m.startsWith('mailto:priya%40example.test?subject=')).toBe(true)
    expect(decodeURIComponent(m)).toContain('Hi Priya,')
    expect(decodeURIComponent(m)).toContain('https://x/progress/t')
  })
  it('says what is shown', () => {
    expect(shownSummary([])).toBe('the stage only')
    expect(shownSummary(['Client', 'Offer'])).toBe('the stage, plus client name, offer status (never the pay)')
  })
  it('puts each stage on a bar from preparing to accepted', () => {
    expect(stagePercent('We are preparing your profile')).toBeLessThan(stagePercent('Your profile was sent to the client'))
    expect(stagePercent('Interview scheduled')).toBeLessThan(stagePercent('An offer was made'))
    expect(stagePercent('Offer accepted')).toBe(100)
    expect(stagePercent('Withdrawn')).toBe(0)
  })
})

describe('journey', () => {
  it('puts each server stage on the five steps with the current one marked', () => {
    const j = journey('The client asked for an interview')
    expect(j.steps.map((s) => s.state)).toEqual(['done', 'done', 'now', 'todo', 'todo'])
    expect(j.next).toMatch(/agreeing a time/)
    expect(journey('Offer accepted').steps.every((s) => s.state === 'done')).toBe(true)
    expect(journey('We are preparing your profile').steps[0].state).toBe('now')
  })
  it('marks a stopped path instead of pretending it moved on', () => {
    const j = journey('Interview cancelled')
    expect(j.stopped).toBe(true)
    expect(j.steps[2].state).toBe('stopped')
    expect(journey('Withdrawn').steps[1].state).toBe('stopped')
  })
})

describe('countdown and live marker', () => {
  const now = new Date('2026-10-14T10:00:00Z')
  it('counts down to the interview', () => {
    expect(countdown('2026-10-17T10:00:00Z', now)).toBe('in 3 days')
    expect(countdown('2026-10-15T13:00:00Z', now)).toBe('in 1 day 3 h')
    expect(countdown('2026-10-14T12:20:00Z', now)).toBe('in 2 h 20 min')
    expect(countdown('2026-10-14T10:03:00Z', now)).toBe('starting now')
    expect(countdown('2026-10-14T08:00:00Z', now)).toBeNull()
  })
  it('says how fresh the page is', () => {
    expect(agoText(0, 3000)).toBe('just now')
    expect(agoText(0, 42_000)).toBe('42 s ago')
    expect(agoText(0, 180_000)).toBe('3 min ago')
  })
})
