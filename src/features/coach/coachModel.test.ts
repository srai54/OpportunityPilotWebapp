import { describe, expect, it } from 'vitest'
import { COACH_FLOWS } from './coachFlows'
import { MAX_STEPS, withWorkspace, flowDone, flowIdForPath, markFlowDone, presentSteps, resetAllTips, setTipsOff, shouldAutoStart, tipsOff } from './coachModel'

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v }, removeItem: (k: string) => { delete data[k] } }
}
const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }

describe('coach flows', () => {
  it('keeps every flow to the pattern limit of four steps, each with plain text', () => {
    for (const f of COACH_FLOWS) {
      expect(f.steps.length).toBeGreaterThanOrEqual(1)
      expect(f.steps.length).toBeLessThanOrEqual(MAX_STEPS)
      for (const s of f.steps) { expect(s.title.length).toBeGreaterThan(3); expect(s.body.length).toBeLessThan(260); expect(s.target).toMatch(/^[a-z-]+$/) }
    }
  })
  it('uses each target id once per flow and gives every flow a route', () => {
    for (const f of COACH_FLOWS) expect(new Set(f.steps.map((s) => s.target)).size).toBe(f.steps.length)
    expect(['/', '/profiles/new', '/profiles/abc', '/wellfound', '/campaigns/new', '/research/abc', '/opportunities', '/opportunities/abc', '/outreach', '/follow-ups'].map(flowIdForPath))
      .toEqual(['overview', 'profile', 'profile', 'find', 'campaign', 'run', 'opps', 'opp', 'outreach', 'followups'])
    expect(flowIdForPath('/settings')).toBeNull()
    expect(flowIdForPath('/opportunities/abc/edit')).toBeNull()
  })
})

describe('Sales wording', () => {
  it('swaps in Sales text only where a step has it, and leaves Candidate untouched', () => {
    const opp = COACH_FLOWS.find((f) => f.id === 'opp')!
    expect(withWorkspace(opp, 'candidate')).toBe(opp)
    const sales = withWorkspace(opp, 'sales')
    expect(sales.steps[0].title).toBe('1. Approve this lead')
    expect(sales.steps[1].title).toBe(opp.steps[1].title)
    expect(sales.steps).toHaveLength(opp.steps.length)
  })
})

describe('coach state', () => {
  it('starts a flow once, never when tips are off, and can be reset', () => {
    const s = memoryStore()
    expect(shouldAutoStart('find', s)).toBe(true)
    markFlowDone('find', s)
    expect(flowDone('find', s)).toBe(true)
    expect(shouldAutoStart('find', s)).toBe(false)
    expect(shouldAutoStart('opps', s)).toBe(true)
    setTipsOff(true, s)
    expect(tipsOff(s)).toBe(true)
    expect(shouldAutoStart('opps', s)).toBe(false)
    resetAllTips(['find', 'opps'], s)
    expect(tipsOff(s)).toBe(false)
    expect(shouldAutoStart('find', s)).toBe(true)
  })
  it('survives a blocked store without throwing', () => {
    expect(shouldAutoStart('find', throwing)).toBe(true)
    expect(() => { markFlowDone('find', throwing); setTipsOff(true, throwing); resetAllTips(['find'], throwing) }).not.toThrow()
  })
  it('skips steps whose target is not on the page', () => {
    const find = COACH_FLOWS.find((f) => f.id === 'find')!
    expect(presentSteps(find, (t) => t !== 'find-campaign').map((s) => s.target)).toEqual(['find-search', 'find-filters', 'find-tabs'])
  })
})
