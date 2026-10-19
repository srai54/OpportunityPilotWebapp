import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardSearchResult } from './boardModel'
import { asResult, BUILT_IN, saveSearch, savedSearches } from './savedResults'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
})
const job = (id: string) => ({ providerJobId: id, title: 'Dev', companyName: 'Acme', companyLogoUrl: null, boardUrl: `https://www.seek.com.au/job/${id}`, location: 'Sydney', isRemote: false, employmentType: null, salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null, postedAt: null, snippet: null })
const ready = (n: number): BoardSearchResult => ({ board: 'Indeed', status: 'Ready', jobs: Array.from({ length: n }, (_, i) => job(String(i))), providerResults: n, message: null, observedAt: null, fromCache: false, source: 'x' })

describe('saved board results', () => {
  it('keeps searches that found jobs, newest first, one per query and place', () => {
    saveSearch('Indeed', 'React', 'Pune', ready(3), new Date('2026-10-19T10:00:00Z'))
    saveSearch('Indeed', 'Java', '', ready(2), new Date('2026-10-19T11:00:00Z'))
    saveSearch('Indeed', 'react', 'pune', ready(5), new Date('2026-10-19T12:00:00Z'))
    saveSearch('Indeed', 'Empty', '', ready(0))
    const saved = savedSearches('Indeed')
    expect(saved.map((s) => [s.query, s.jobs.length])).toEqual([['react', 5], ['Java', 2]])
  })
  it('ships one real SEEK search and shows it as a saved result', () => {
    const seek = savedSearches('Seek')
    expect(seek.at(-1)?.builtIn).toBe(true)
    expect(BUILT_IN.Seek!.jobs.length).toBeGreaterThan(20)
    expect(BUILT_IN.Seek!.jobs.every((j) => j.boardUrl.startsWith('https://www.seek.com.au/job/'))).toBe(true)
    expect(asResult(seek.at(-1)!).fromCache).toBe(true)
  })
})
