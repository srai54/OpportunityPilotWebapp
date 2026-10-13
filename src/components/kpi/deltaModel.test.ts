import { describe, expect, it } from 'vitest'
import { formatDelta, sparkPoints } from './deltaModel'

describe('formatDelta', () => {
  it('is null when there is no previous period (never invented)', () => {
    expect(formatDelta(5, null)).toBeNull()
    expect(formatDelta(5, undefined)).toBeNull()
    expect(formatDelta(5, Number.NaN)).toBeNull()
  })
  it('says up, down or no change, with words for screen readers', () => {
    expect(formatDelta(8, 5)).toEqual({ tone: 'up', text: '+3', sr: 'up 3' })
    expect(formatDelta(2, 5)).toEqual({ tone: 'down', text: '−3', sr: 'down 3' })
    expect(formatDelta(4, 4)).toEqual({ tone: 'flat', text: '0', sr: 'no change' })
  })
  it('rounds fractions to one decimal', () => {
    expect(formatDelta(2.34, 1)?.text).toBe('+1.3')
  })
})

describe('sparkPoints', () => {
  it('needs two points and stays inside the box', () => {
    expect(sparkPoints([3], 100, 20)).toBe('')
    const pts = sparkPoints([0, 5, 10], 100, 20).split(' ').map((p) => p.split(',').map(Number))
    expect(pts[0]).toEqual([0, 20])
    expect(pts[2]).toEqual([100, 0])
    for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(20) }
  })
})
