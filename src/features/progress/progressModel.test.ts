import { describe, expect, it } from 'vitest'
import { progressUrl, shownSummary, updateMailto } from './progressModel'

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
})
