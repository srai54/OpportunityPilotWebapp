import { describe, expect, it } from 'vitest'
import { ALWAYS_TRUE, FLOW_STEPS } from './guideModel'

describe('how it works guide', () => {
  it('has the five steps of the top bar, in order', () => {
    expect(FLOW_STEPS.map((s) => s.title)).toEqual(['Profile', 'Find', 'Review', 'Reach out', 'Follow up'])
  })
  it('stays short and links only to routes that exist', () => {
    const routes = ['/profiles/new', '/wellfound', '/opportunities', '/outreach', '/follow-ups']
    for (const s of FLOW_STEPS) {
      expect(routes).toContain(s.to)
      expect(s.candidate.length).toBeLessThan(70)
      expect(s.sales.length).toBeLessThan(70)
    }
    expect(ALWAYS_TRUE.length).toBeLessThanOrEqual(3)
  })
})
