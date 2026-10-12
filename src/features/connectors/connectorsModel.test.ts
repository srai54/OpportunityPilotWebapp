import { describe, expect, it } from 'vitest'
import { CATEGORIES, CONNECTORS, filterConnectors, toggleWant } from './connectorsModel'

describe('catalog', () => {
  it('has unique ids, every category in use, and nothing claims to be live', () => {
    expect(new Set(CONNECTORS.map((c) => c.id)).size).toBe(CONNECTORS.length)
    for (const cat of CATEGORIES) expect(CONNECTORS.some((c) => c.category === cat)).toBe(true)
    for (const c of CONNECTORS) {
      expect(['Next up', 'Planned']).toContain(c.status)
      expect(c.does.length).toBeGreaterThan(20)
      expect(c.needs.length).toBeGreaterThan(10)
    }
  })
  it('puts Outlook and Gmail first in the queue', () => {
    expect(CONNECTORS.filter((c) => c.status === 'Next up').map((c) => c.id)).toEqual(['outlook', 'gmail'])
  })
})

describe('filterConnectors', () => {
  const all = { query: '', category: 'All', audience: 'All' } as const
  it('returns everything without a filter', () => expect(filterConnectors(CONNECTORS, all)).toHaveLength(CONNECTORS.length))
  it('searches name and description, ignoring case', () => {
    expect(filterConnectors(CONNECTORS, { ...all, query: 'HUBSPOT' }).map((c) => c.id)).toEqual(['hubspot'])
    expect(filterConnectors(CONNECTORS, { ...all, query: 'authenticator' }).map((c) => c.id)).toContain('totp')
  })
  it('filters by category', () => {
    expect(filterConnectors(CONNECTORS, { ...all, category: 'Email' }).map((c) => c.id)).toEqual(['outlook', 'gmail'])
  })
  it('shows Both-audience items to everyone and role-only items to that role', () => {
    const sales = filterConnectors(CONNECTORS, { ...all, audience: 'Sales' }).map((c) => c.id)
    expect(sales).toContain('hubspot')
    expect(sales).toContain('outlook')
    expect(sales).not.toContain('google-drive')
    expect(filterConnectors(CONNECTORS, { ...all, audience: 'Candidate' }).map((c) => c.id)).not.toContain('hubspot')
  })
  it('returns nothing for gibberish', () => expect(filterConnectors(CONNECTORS, { ...all, query: 'zzzqqq' })).toEqual([]))
})

describe('toggleWant', () => {
  it('adds and removes an id without mutating', () => {
    const a = ['x']
    expect(toggleWant(a, 'y')).toEqual(['x', 'y'])
    expect(toggleWant(['x', 'y'], 'x')).toEqual(['y'])
    expect(a).toEqual(['x'])
  })
})
