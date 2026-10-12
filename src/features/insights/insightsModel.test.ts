import { describe, expect, it } from 'vitest'
import type { TrendPoint } from '../../lib/types'
import {
  clampGoal, delta, funnelRows, goalMetric, goalProgress, kpisFor, lastDays, linePoints, nearestIndex, niceMax, percent, seriesFor, sumOf, trendSummary,
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
