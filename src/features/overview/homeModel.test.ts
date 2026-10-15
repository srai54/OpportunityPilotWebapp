import { describe, expect, it } from 'vitest'
import { greeting, heroFor, lastWeek, strongCount } from './homeModel'

const base = { sales: false, awaiting: 0, shortlistedNotApplied: 0, found: 0, qualified: 0, days: 30 }

describe('greeting', () => {
  it('follows the hour', () => {
    expect(greeting(8)).toBe('Good morning')
    expect(greeting(14)).toBe('Good afternoon')
    expect(greeting(20)).toBe('Good evening')
  })
})

describe('heroFor', () => {
  it('puts the approvals waiting first, in the workspace words', () => {
    expect(heroFor({ ...base, awaiting: 3 })).toEqual({ text: '3 jobs are waiting for your yes or no.', primary: { label: 'Review 3', to: '/opportunities?view=approvals' } })
    expect(heroFor({ ...base, sales: true, awaiting: 1 }).text).toBe('1 lead is waiting for your yes or no.')
  })
  it('then approved jobs not applied to (candidate only), then what was found, then a search', () => {
    expect(heroFor({ ...base, shortlistedNotApplied: 2 }).primary.label).toBe('Apply to them')
    expect(heroFor({ ...base, sales: true, shortlistedNotApplied: 2, found: 5, qualified: 4 }).text).toBe('5 found in the last 30 days, 4 of them qualified.')
    expect(heroFor(base).primary.to).toBe('/wellfound')
  })
})

describe('strongCount and lastWeek', () => {
  it('counts the 75+ bands and the last seven days', () => {
    expect(strongCount([{ from: 60, count: 4 }, { from: 70, count: 2 }, { from: 80, count: 3 }, { from: 90, count: 1 }])).toBe(4)
    const pts = Array.from({ length: 10 }, (_, i) => ({ date: `d${i}`, found: 0, qualified: 0, approved: 0, reached: i, replied: 0, sent: 1 }))
    expect(lastWeek(pts, 'reached')).toBe(3 + 4 + 5 + 6 + 7 + 8 + 9)
    expect(lastWeek(pts, 'sent')).toBe(7)
  })
})

import { averageFromBands } from './homeModel'
describe('averageFromBands', () => {
  it('weights band midpoints by count', () => { expect(averageFromBands([{ from: 0, to: 50, count: 1 }, { from: 50, to: 100, count: 3 }])).toBe(63) })
  it('is null with nothing scored', () => { expect(averageFromBands([{ from: 0, to: 50, count: 0 }])).toBeNull() })
})
