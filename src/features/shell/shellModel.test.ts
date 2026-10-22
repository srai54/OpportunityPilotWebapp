import { describe, expect, it } from 'vitest'
import type { Overview } from '../../lib/types'
import {
  aiModeLabel,
  gmailLabel,
  initials,
  NAV_COLLAPSED_KEY,
  NAV_GROUPS,
  navGroupsFor,
  navAccessibleName,
  navCount,
  navGroupFor,
  readAdvanced,
  readNavCollapsed,
  readWorkspace,
  topbarHint,
  WORKSPACE_KEY,
  writeAdvanced,
  writeNavCollapsed,
  writeWorkspace,
  type NavItem,
} from './shellModel'

const overview: Overview = { profiles: 1, applied: 4, needsManual: 2, campaigns: 3, shortlisted: 5, awaitingApproval: 0, draftsAwaitingReview: 0, followUpsDue: 0 }
const item = (to: string): NavItem => {
  const found = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === to)
  if (!found) throw new Error(`no nav item ${to}`)
  return found
}

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}
const throwingStore = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('NAV_GROUPS', () => {
  const labels = (advanced: boolean, ws: 'candidate' | 'sales' = 'candidate') => navGroupsFor(ws, advanced).flatMap((g) => g.items.map((i) => i.label))

  it('keeps the simple menu to the essentials', () => {
    expect(labels(false)).toEqual(['Overview', 'Find jobs', 'Opportunities', 'Outreach', 'Follow up', 'Profiles', 'Settings'])
    expect(labels(false, 'sales')).toEqual(['Overview', 'Find companies', 'Companies', 'Outreach', 'Follow up', 'Profiles', 'Settings'])
  })

  it('adds campaigns, follow-ups, insights, staffing and help only with Advanced on, each route once', () => {
    expect(labels(true)).toEqual(['Overview', 'Find jobs', 'Opportunities', 'Outreach', 'Follow up', 'Campaigns', 'My interviews', 'Autopilot', 'Insights', 'Profiles', 'Settings', 'Connectors', 'How it works'])
    expect(labels(true, 'sales')).toContain('Deals')
    expect(labels(true, 'sales')).toContain('Interviews')
    expect(labels(true, 'sales')).not.toContain('My interviews')
    expect(labels(false, 'sales')).not.toContain('Interviews')
    expect(labels(false, 'sales')).not.toContain('Deals')
    const routes = navGroupsFor('candidate', true).flatMap((g) => g.items.map((i) => i.to))
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('drops a group whose items are all advanced', () => {
    expect(navGroupsFor('sales', false).map((g) => g.label)).toEqual([null, 'Work', 'Set up'])
    expect(navGroupsFor('sales', true).map((g) => g.label)).toEqual([null, 'Work', 'Staffing', 'Set up'])
  })

  it('has no placeholder screens marked as not built', () => {
    expect(NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.notBuilt)).toEqual([])
  })
})

describe('navCount', () => {
  it('shows a real positive count', () => {
    expect(navCount(item('/campaigns'), overview)).toBe(3)
    expect(navCount(item('/opportunities'), { ...overview, awaitingApproval: 5 })).toBe(5)
  })

  it('hides zero, unknown and items without a count', () => {
    expect(navCount(item('/opportunities'), overview)).toBeNull()
    expect(navCount(item('/opportunities'), undefined)).toBeNull()
    expect(navCount(item('/outreach'), overview)).toBeNull()
    expect(navCount(item('/'), overview)).toBeNull()
  })
})

describe('navAccessibleName', () => {
  it('says the count in words', () => {
    expect(navAccessibleName(item('/opportunities'), 4)).toBe('Opportunities (4 awaiting approval)')
    expect(navAccessibleName(item('/opportunities'), null)).toBe('Opportunities')
    expect(navAccessibleName(item('/outreach'), null)).toBe('Outreach')
  })
})

describe('navGroupFor / topbarHint', () => {
  const all = navGroupsFor('candidate', true)
  it('finds the group for nested routes', () => {
    expect(navGroupFor('/campaigns/new', all)?.label).toBe('Work')
    expect(navGroupFor('/campaigns/abc/opportunities', all)?.label).toBe('Work')
    expect(navGroupFor('/research/123')?.label).toBe('Work')
    expect(navGroupFor('/profiles/abc', all)?.label).toBe('Set up')
    expect(navGroupFor('/nowhere', all)).toBeUndefined()
  })

  it('uses only counts the shell already has', () => {
    expect(topbarHint('/', 'candidate', overview)).toBe('Candidate workspace · 3 campaigns')
    expect(topbarHint('/', 'sales', undefined)).toBe('Sales workspace')
    expect(topbarHint('/profiles', 'candidate', overview)).toBe('Set up · 1 profile')
    expect(topbarHint('/outreach', 'candidate', overview)).toBe('Work')
    expect(topbarHint('/campaigns', 'candidate', overview)).toBe('Work · 3 campaigns')
    // Sales-only pages opened from the Candidate workspace have no rail group: no "undefined" label.
    expect(topbarHint('/staffing', 'candidate', overview)).toBeNull()
    expect(topbarHint('/staffing', 'sales', overview)).toBe('Staffing')
    expect(topbarHint('/nowhere', 'candidate', overview)).toBeNull()
  })
})

describe('stored preferences', () => {
  it('reads and writes the collapsed rail', () => {
    const s = memoryStore()
    expect(readNavCollapsed(s)).toBe(false)
    writeNavCollapsed(true, s)
    expect(s.data[NAV_COLLAPSED_KEY]).toBe('1')
    expect(readNavCollapsed(s)).toBe(true)
  })

  it('defaults the workspace to Candidate and ignores unknown values', () => {
    expect(readWorkspace(memoryStore(), true)).toBe('candidate')
    expect(readWorkspace(memoryStore({ [WORKSPACE_KEY]: 'partners' }), true)).toBe('candidate')
    const s = memoryStore()
    writeWorkspace('sales', s)
    expect(readWorkspace(s, true)).toBe('sales')
  })

  it('falls back to defaults when storage throws or is missing', () => {
    expect(readNavCollapsed(throwingStore)).toBe(false)
    expect(readWorkspace(throwingStore, true)).toBe('candidate')
    expect(() => writeNavCollapsed(true, throwingStore)).not.toThrow()
    expect(() => writeWorkspace('sales', throwingStore)).not.toThrow()
    expect(readWorkspace(null, true)).toBe('candidate')
  })
})

describe('labels', () => {
  it('words every Gmail state', () => {
    expect(gmailLabel({ status: 'Ready' }).text).toBe('Gmail · connected')
    expect(gmailLabel({ status: 'Disabled' }).text).toBe('Gmail · disabled')
    expect(gmailLabel({ status: 'NotConfigured' }).text).toBe('Gmail · not connected')
  })

  it('never calls an unverified key active', () => {
    expect(aiModeLabel({ status: 'Ready' }).text).toBe('Gemini active')
    expect(aiModeLabel({ status: 'Configured' }).text).toBe('Gemini key set · unverified')
    expect(aiModeLabel({ status: 'NotConfigured' }).text).toBe('Rules mode · no AI key')
  })

  it('builds avatar initials', () => {
    expect(initials('first.last@example.com')).toBe('FL')
    expect(initials('guest')).toBe('G')
    expect(initials('')).toBe('?')
  })
})

describe('workspace rails', () => {
  it('gives Sales its own destinations and keeps Candidate unchanged', () => {
    const sales = navGroupsFor('sales', true).flatMap((g) => g.items.map((i) => i.label))
    expect(sales).toContain('Deals')
    expect(sales).toContain('Companies')
    expect(navGroupsFor('candidate', true)).toBe(NAV_GROUPS)
  })

  it('marks all sales destinations as built', () => {
    expect(navGroupsFor('sales', true).flatMap((g) => g.items).filter((i) => i.notBuilt)).toEqual([])
    expect(navGroupsFor('sales', true).flatMap((g) => g.items).map((i) => i.to)).toContain('/staffing')
  })

  it('finds the Sales group for sales-only paths', () => {
    expect(navGroupFor('/staffing', navGroupsFor('sales', true))?.label).toBe('Staffing')
  })
})

describe('advanced preference', () => {
  it('is off by default, stored as 1/0, and survives a blocked store', () => {
    const s = memoryStore()
    expect(readAdvanced(s)).toBe(false)
    writeAdvanced(true, s)
    expect(readAdvanced(s)).toBe(true)
    writeAdvanced(false, s)
    expect(readAdvanced(s)).toBe(false)
    expect(readAdvanced(throwingStore)).toBe(false)
    expect(() => writeAdvanced(true, throwingStore)).not.toThrow()
  })
})

describe('Sales portal (VITE_SALES_ONLY=true, 2026-10-22)', () => {
  it('is always the Sales workspace, whatever was saved', () => {
    expect(readWorkspace(memoryStore(), false)).toBe('sales')
    expect(readWorkspace(memoryStore({ [WORKSPACE_KEY]: 'candidate' }), false)).toBe('sales')
  })
})
