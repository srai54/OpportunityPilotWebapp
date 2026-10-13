import { describe, expect, it } from 'vitest'
import { changeWords, countUpValue, growthTiles } from './growthModel'

describe('countUpValue', () => {
  it('starts at 0, ends at the target and only goes up', () => {
    expect(countUpValue(40, 0)).toBe(0)
    expect(countUpValue(40, 1)).toBe(40)
    expect(countUpValue(40, 2)).toBe(40)
    expect(countUpValue(40, 0.3)).toBeLessThanOrEqual(countUpValue(40, 0.6))
  })
})

describe('growthTiles', () => {
  const pts = [{ date: '2026-10-12', found: 1, qualified: 1, approved: 0, reached: 0, replied: 0, sent: 0 }, { date: '2026-10-13', found: 4, qualified: 3, approved: 2, reached: 1, replied: 0, sent: 1 }]
  const totals = { found: 5, qualified: 4, approved: 2, reached: 1, replied: 0, sent: 1 }
  it('makes four tiles with their series and a place to go', () => {
    const t = growthTiles(pts, totals, { found: 2, qualified: 0, approved: 0, reached: 0, replied: 0, sent: 0 }, false)
    expect(t.map((x) => x.label)).toEqual(['Jobs found', 'Jobs approved', 'Applied', 'Replies'])
    expect(t[0]).toMatchObject({ value: 5, previous: 2, series: [1, 4], to: '/opportunities' })
    expect(growthTiles(pts, totals, totals, true)[2].label).toBe('Contacted')
  })
  it('words the change', () => {
    expect(changeWords(5, 2).text).toBe('3 more than before')
    expect(changeWords(1, 4).tone).toBe('down')
    expect(changeWords(0, 0).text).toBe('nothing yet')
  })
})
