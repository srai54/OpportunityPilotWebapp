import { describe, expect, it } from 'vitest'
import { avatarSlot, initialsOf, leadChips, MATCH_WORDS, matchBand, ringDash, selectedLabel } from './cardModel'

describe('initialsOf / avatarSlot', () => {
  it('uses one or two capitals and never an empty avatar', () => {
    expect(initialsOf('Stripe')).toBe('S')
    expect(initialsOf('Contoso Retail')).toBe('CR')
    expect(initialsOf('  the  ibm corp ')).toBe('TI')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('---')).toBe('?')
  })
  it('gives the same tint for the same name, within six slots', () => {
    expect(avatarSlot('Stripe')).toBe(avatarSlot('stripe'))
    for (const n of ['A', 'Stripe', 'IBM', 'Contoso Retail', 'Ünïcode']) {
      expect(avatarSlot(n)).toBeGreaterThanOrEqual(0)
      expect(avatarSlot(n)).toBeLessThan(6)
    }
  })
})

describe('matchBand', () => {
  it('bands a score and says not scored for a missing one', () => {
    expect(matchBand(95)).toBe('strong')
    expect(matchBand(70)).toBe('strong')
    expect(matchBand(50)).toBe('fair')
    expect(matchBand(10)).toBe('weak')
    expect(matchBand(null)).toBe('none')
    expect(matchBand(Number.NaN)).toBe('none')
    expect(MATCH_WORDS.fair).toBe('Fair match')
  })
  it('never calls a score a chance of success', () => {
    for (const w of Object.values(MATCH_WORDS)) expect(w.toLowerCase()).not.toContain('chance')
  })
})

describe('ringDash', () => {
  it('fills the right share of the circle and clamps', () => {
    const half = ringDash(50)
    expect(half.dash).toBeCloseTo(half.circumference / 2)
    expect(ringDash(150).dash).toBeCloseTo(ringDash(100).circumference)
    expect(ringDash(-5).dash).toBe(0)
    expect(ringDash(Number.NaN).dash).toBe(0)
  })
})

describe('leadChips / selectedLabel', () => {
  it('shows only what is known', () => {
    expect(leadChips({ location: 'Remote - US', platformLabel: 'LinkedIn', ageDays: 1 })).toEqual(['Remote', 'LinkedIn', 'New'])
    expect(leadChips({ location: 'London', platformLabel: null, ageDays: 20 })).toEqual([])
    expect(leadChips({ location: null, remote: true })).toEqual(['Remote'])
  })
  it('counts selections in words', () => {
    expect(selectedLabel(1, { one: 'lead', many: 'leads' })).toBe('1 lead selected')
    expect(selectedLabel(3, { one: 'lead', many: 'leads' })).toBe('3 leads selected')
  })
})
