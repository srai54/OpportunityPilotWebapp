import { describe, expect, it } from 'vitest'
import { donutArcs } from '../../components/charts/donutModel'
import { campaignSegments, outreachSegments, runPercent, runWords } from './progressCharts'

describe('donutArcs', () => {
  it('splits the circle by value, in order, and draws nothing for an empty total', () => {
    const arcs = donutArcs([{ value: 1 }, { value: 3 }])
    const c = 2 * Math.PI * 54
    expect(arcs[0].length).toBeCloseTo(c / 4)
    expect(arcs[1].offset).toBeCloseTo(c / 4)
    expect(donutArcs([{ value: 0 }]).every((a) => a.length === 0)).toBe(true)
  })
})

describe('progress segments', () => {
  it('counts each campaign once: running beats repeating beats paused', () => {
    const segs = campaignSegments(
      [{ id: 'a', lastJob: { state: 'Running' } }, { id: 'b', lastJob: null }, { id: 'c', lastJob: { state: 'Completed' } }, { id: 'd', lastJob: null }],
      [{ campaignId: 'a', paused: false }, { campaignId: 'b', paused: false }, { campaignId: 'c', paused: true }])
    expect(Object.fromEntries(segs.map((s) => [s.key, s.value]))).toEqual({ running: 1, repeating: 1, paused: 1, idle: 1 })
  })
  it('splits sent messages into replied and still waiting', () => {
    const segs = outreachSegments([{ state: 'Draft' }, { state: 'Approved' }, { state: 'Sent' }, { state: 'Sent' }, { state: 'Sent' }], 1)
    expect(segs.map((s) => s.value)).toEqual([1, 1, 2, 1])
  })
  it('turns a run stage into a share and plain words', () => {
    expect(runPercent('Score')).toBe(70)
    expect(runPercent('nonsense')).toBe(5)
    expect(runWords('Filter')).toBe('Checking your must-haves')
  })
})
