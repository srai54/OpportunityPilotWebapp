import { describe, expect, it } from 'vitest'
import type { TrendPoint } from '../../lib/types'
import {
  activityLine, activityPath, activityVerb, hasMore, axisTicks, trimBands, clampGoal, delta, funnelRows, goalMetric, goalProgress, kpisFor, lastDays, linePoints, nearestIndex, niceMax, percent, seriesFor, sumOf, trendSummary,
} from './insightsModel'

const pt = (date: string, o: Partial<TrendPoint> = {}): TrendPoint => ({ date, found: 0, qualified: 0, approved: 0, reached: 0, replied: 0, sent: 0, ...o })
const zero = { found: 0, qualified: 0, approved: 0, reached: 0, replied: 0, sent: 0 }

describe('series and kpis', () => {
  it('uses at most four chart series, in a fixed order, with workspace wording', () => {
    expect(seriesFor('candidate').map((s) => s.key)).toEqual(['found', 'approved', 'reached', 'replied'])
    expect(seriesFor('candidate')[2].label).toBe('Applied')
    expect(seriesFor('sales')[2].label).toBe('Contacted')
    expect(kpisFor('sales').map((k) => k.key)).toEqual(['found', 'qualified', 'approved', 'reached', 'sent', 'replied'])
  })
})

describe('delta', () => {
  it('says up, down or same, without percentages', () => {
    expect(delta(5, 2)).toEqual({ text: 'up 3', tone: 'up' })
    expect(delta(1, 4)).toEqual({ text: 'down 3', tone: 'down' })
    expect(delta(2, 2)).toEqual({ text: 'same as before', tone: 'flat' })
  })
})

describe('chart maths', () => {
  it('picks a friendly axis maximum that is never below the data', () => {
    expect(niceMax(0)).toBe(5)
    expect(niceMax(5)).toBe(5)
    expect(niceMax(6)).toBe(10)
    expect(niceMax(13)).toBe(20)
    expect(niceMax(41)).toBe(50)
    expect(niceMax(101)).toBe(200)
  })
  it('maps values to svg points inside the padding, clamping to the max', () => {
    const pad = { l: 10, r: 10, t: 10, b: 10 }
    expect(linePoints([0, 10], 110, 110, pad, 10)).toBe('10.0,100.0 100.0,10.0')
    expect(linePoints([99], 110, 110, pad, 10)).toBe('55.0,10.0')
    expect(linePoints([], 110, 110, pad, 10)).toBe('')
  })
  it('finds the nearest point to a pointer position', () => {
    expect(nearestIndex(10, 5, 110, 10, 10)).toBe(0)
    expect(nearestIndex(100, 5, 110, 10, 10)).toBe(4)
    expect(nearestIndex(55, 5, 110, 10, 10)).toBe(2)
    expect(nearestIndex(999, 5, 110, 10, 10)).toBe(4)
    expect(nearestIndex(5, 1, 110, 10, 10)).toBe(0)
  })
  it('sums and slices the recent days', () => {
    const pts = [pt('a', { sent: 1 }), pt('b', { sent: 2 }), pt('c', { sent: 4 })]
    expect(sumOf(pts, 'sent')).toBe(7)
    expect(sumOf(lastDays(pts, 2), 'sent')).toBe(6)
    expect(lastDays(pts, 10)).toHaveLength(3)
  })
})

describe('axis ticks and bands', () => {
  it('gives whole-number, evenly spaced gridlines for every nice maximum', () => {
    expect(axisTicks(5)).toEqual([0, 1, 2, 3, 4, 5])
    expect(axisTicks(10)).toEqual([0, 2, 4, 6, 8, 10])
    expect(axisTicks(20)).toEqual([0, 5, 10, 15, 20])
    expect(axisTicks(50)).toEqual([0, 10, 20, 30, 40, 50])
    expect(axisTicks(100)).toEqual([0, 25, 50, 75, 100])
    expect(axisTicks(200)).toEqual([0, 50, 100, 150, 200])
    for (const m of [5, 10, 20, 50, 100, 200, 500, 1000]) expect(axisTicks(m).every(Number.isInteger)).toBe(true)
  })
  it('trims empty bands at the ends only', () => {
    const b = [0, 0, 2, 0, 5, 0, 0].map((count) => ({ count }))
    expect(trimBands(b).map((x) => x.count)).toEqual([2, 0, 5])
    expect(trimBands([{ count: 0 }, { count: 0 }])).toHaveLength(1)
  })
})

describe('funnel', () => {
  it('shows each step as a share of the one before, and null where there is nothing to divide', () => {
    const rows = funnelRows('candidate', { ...zero, found: 40, qualified: 20, approved: 5, reached: 0, replied: 0 })
    expect(rows.map((r) => r.fromPrevious)).toEqual([null, 50, 25, 0, null])
    expect(rows[3].label).toBe('Applied')
    expect(funnelRows('sales', zero)[3].label).toBe('Contacted')
  })
  it('percent is a whole number or null', () => {
    expect(percent(1, 3)).toBe(33)
    expect(percent(0, 0)).toBeNull()
  })
})

describe('weekly goal', () => {
  it('counts applications for Candidate and messages for Sales', () => {
    expect(goalMetric('candidate').key).toBe('reached')
    expect(goalMetric('sales').key).toBe('sent')
  })
  it('keeps the goal within bounds and caps progress at 100%', () => {
    expect(clampGoal(0)).toBe(1)
    expect(clampGoal(5000)).toBe(200)
    expect(clampGoal(Number.NaN)).toBe(10)
    expect(clampGoal(7.6)).toBe(8)
    expect(goalProgress(3, 10)).toEqual({ pct: 30, text: '3 of 10' })
    expect(goalProgress(25, 10).pct).toBe(100)
  })
})

describe('trendSummary', () => {
  it('says nothing was recorded rather than inventing a trend', () => {
    expect(trendSummary('candidate', 30, zero, zero)).toBe('Nothing recorded in the last 30 days yet.')
  })
  it('states the numbers and the change in words', () => {
    const s = trendSummary('sales', 14, { ...zero, found: 6, approved: 2, reached: 1 }, { ...zero, found: 2 })
    expect(s).toBe('Last 14 days: 6 companies found (up 4), 2 leads approved, 1 contacted, 0 replies.')
  })
})

describe('activity lines', () => {
  const item = { title: 'Backend Engineer', organization: 'Stripe', detail: 'Applied by you' }
  it('says who did what in plain words', () => {
    expect(activityLine({ ...item, kind: 'Approved' }, false)).toBe('You approved Backend Engineer · Stripe')
    expect(activityLine({ ...item, kind: 'Approved' }, true)).toBe('You approved Stripe')
    expect(activityLine({ ...item, kind: 'StatusChanged' }, false)).toBe('Updated Backend Engineer · Stripe — Applied by you')
  })
  it('shows an unknown kind as written', () => {
    expect(activityVerb('Mystery')).toBe('Mystery')
  })
})

describe('activity feed paths and lines', () => {
  const now = new Date('2026-10-13T10:00:00Z')
  it('asks for one workspace, the chosen kinds, a start date and the paging cursor', () => {
    const path = activityPath(true, 'messages', 7, '2026-10-12T09:00:00.000Z', now)
    const q = new URLSearchParams(path.split('?')[1])
    expect(q.get('workspace')).toBe('Sales')
    expect(q.get('kinds')).toBe('DraftCreated,DraftEdited,DraftApproved')
    expect(q.get('from')).toBe('2026-10-06T10:00:00.000Z')
    expect(q.get('before')).toBe('2026-10-12T09:00:00.000Z')
    const all = new URLSearchParams(activityPath(false, 'all', 0, null, now).split('?')[1])
    expect(all.get('workspace')).toBe('Candidate')
    expect(all.has('kinds')).toBe(false)
    expect(all.has('from')).toBe(false)
  })
  it('shows the stored sentence for what the person did themselves, with the lead when there is one', () => {
    expect(activityLine({ kind: 'Searched', title: '', organization: '', detail: 'Searched all free sites for "react": 12 results', opportunityId: null }, false)).toBe('Searched all free sites for "react": 12 results')
    expect(activityLine({ kind: 'DraftApproved', title: 'Backend Engineer', organization: 'Stripe', detail: 'Approved the email draft (version 2)', opportunityId: 'o1' }, true)).toBe('Approved the email draft (version 2): Stripe')
  })
  it('says there is more only when the page was full', () => {
    expect(hasMore(20)).toBe(true)
    expect(hasMore(7)).toBe(false)
  })
})
