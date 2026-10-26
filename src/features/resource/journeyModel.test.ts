import { describe, expect, it } from 'vitest'
import { groupBench, mainSkill, monthCells, pathIndex, type BenchRow, type TimelineItem } from './journeyModel'

const row = (over: Partial<BenchRow>): BenchRow => ({
  candidateId: Math.random().toString(), name: 'X', headline: 'Senior .NET developer', day: 10, salesperson: 'Meera', priority: false, status: 'available',
  resumeStrength: null, bestFit: null, certifications: [], next: null, ...over,
})
const item = (kind: string, at = '2026-10-10T09:00:00Z'): TimelineItem => ({ kind, title: kind, detail: null, at, source: 'Candidate', entryId: null })

describe('bench grouping', () => {
  it('puts priority first and leaves empty groups out', () => {
    const g = groupBench([row({ priority: true, status: 'interviewing' }), row({ status: 'interviewing' }), row({ status: 'training' })], 'status')
    expect(g.map((x) => [x.id, x.rows.length])).toEqual([['priority', 1], ['interviewing', 1], ['training', 1]])
  })
  it('groups by main skill or salesperson', () => {
    expect(mainSkill('Senior .NET developer')).toBe('.NET')
    expect(mainSkill('React and Node.js engineer')).toBe('React')
    expect(mainSkill(null)).toBe('Other')
    const bySales = groupBench([row({ salesperson: 'Meera' }), row({ salesperson: null }), row({ salesperson: 'Arjun' })], 'sales')
    expect(bySales.map((x) => x.name)).toEqual(['Arjun', 'Meera', 'Not assigned'])
  })
})

describe('candidate path and calendar', () => {
  it('places the candidate on the seven-step path', () => {
    expect(pathIndex({ status: 'available', certifications: [], timeline: [item('Joined')] })).toBe(0)
    expect(pathIndex({ status: 'training', certifications: [], timeline: [item('Learning')] })).toBe(1)
    expect(pathIndex({ status: 'available', certifications: ['AZ-900'], timeline: [] })).toBe(2)
    expect(pathIndex({ status: 'available', certifications: [], timeline: [item('Resume')] })).toBe(3)
    expect(pathIndex({ status: 'interviewing', certifications: [], timeline: [] })).toBe(4)
    expect(pathIndex({ status: 'mapped', certifications: [], timeline: [] })).toBe(6)
  })
  it('builds a Monday-first month with items on their days', () => {
    const cells = monthCells(2026, 9, [item('Interview', '2026-10-30T09:30:00Z')], new Date(2026, 9, 26))
    expect(cells.filter((c) => c.day === null)).toHaveLength(3) // 1 Oct 2026 is a Thursday
    expect(cells.find((c) => c.day === 26)?.today).toBe(true)
    expect(cells.find((c) => c.day === 30)?.items).toHaveLength(1)
  })
})
