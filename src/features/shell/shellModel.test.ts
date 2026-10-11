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
  readNavCollapsed,
  readWorkspace,
  topbarHint,
  WORKSPACE_KEY,
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
  it('keeps every top-level route reachable, each once', () => {
    const routes = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to))
    expect([...routes].sort()).toEqual(
      ['/', '/approvals', '/campaigns', '/follow-ups', '/opportunities', '/outreach', '/profiles', '/settings', '/how-it-works', '/trends', '/wellfound'].sort(),
    )
  })

  it('groups Overview · Find · Decide · Act · Track · Set up', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([null, 'Find', 'Decide', 'Act', 'Track', 'Set up'])
  })

  it('has no placeholder screens marked as not built', () => {
    const notBuilt = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.notBuilt).map((i) => i.to)
    expect(notBuilt).toEqual([])
  })
})

describe('navCount', () => {
  it('shows a real positive count', () => {
    expect(navCount(item('/campaigns'), overview)).toBe(3)
  })

  it('hides zero, unknown and items without a count', () => {
    expect(navCount(item('/approvals'), overview)).toBeNull()
    expect(navCount(item('/approvals'), undefined)).toBeNull()
    expect(navCount(item('/opportunities'), overview)).toBeNull()
    expect(navCount(item('/'), overview)).toBeNull()
  })
})

describe('navAccessibleName', () => {
  it('says the count and the not-built state in words', () => {
    expect(navAccessibleName(item('/approvals'), 4)).toBe('Approvals (4 awaiting approval)')
    expect(navAccessibleName(item('/approvals'), null)).toBe('Approvals')
    expect(navAccessibleName(item('/outreach'), null)).toBe('Outreach')
  })
})

describe('navGroupFor / topbarHint', () => {
  it('finds the group for nested routes', () => {
    expect(navGroupFor('/campaigns/new')?.label).toBe('Find')
    expect(navGroupFor('/campaigns/abc/opportunities')?.label).toBe('Find')
    expect(navGroupFor('/research/123')?.label).toBe('Find')
    expect(navGroupFor('/profiles/abc')?.label).toBe('Set up')
    expect(navGroupFor('/nowhere')).toBeUndefined()
  })

  it('uses only counts the shell already has', () => {
    expect(topbarHint('/', 'candidate', overview)).toBe('Candidate workspace · 3 campaigns')
    expect(topbarHint('/', 'sales', undefined)).toBe('Sales workspace')
    expect(topbarHint('/approvals', 'candidate', overview)).toBe('Decide · Nothing waiting')
    expect(topbarHint('/approvals', 'candidate', undefined)).toBe('Decide')
    expect(topbarHint('/profiles', 'candidate', overview)).toBe('Set up · 1 profile')
    expect(topbarHint('/outreach', 'candidate', overview)).toBe('Act')
    expect(topbarHint('/follow-ups', 'candidate', overview)).toBe('Track')
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
    expect(readWorkspace(memoryStore())).toBe('candidate')
    expect(readWorkspace(memoryStore({ [WORKSPACE_KEY]: 'partners' }))).toBe('candidate')
    const s = memoryStore()
    writeWorkspace('sales', s)
    expect(readWorkspace(s)).toBe('sales')
  })

  it('falls back to defaults when storage throws or is missing', () => {
    expect(readNavCollapsed(throwingStore)).toBe(false)
    expect(readWorkspace(throwingStore)).toBe('candidate')
    expect(() => writeNavCollapsed(true, throwingStore)).not.toThrow()
    expect(() => writeWorkspace('sales', throwingStore)).not.toThrow()
    expect(readWorkspace(null)).toBe('candidate')
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
    const sales = navGroupsFor('sales').flatMap((g) => g.items.map((i) => i.label))
    expect(sales).toContain('Deals')
    expect(sales).toContain('Companies')
    expect(sales).not.toContain('Bids sent')
    expect(navGroupsFor('candidate')).toBe(NAV_GROUPS)
  })

  it('marks all sales destinations as built', () => {
    const notBuilt = navGroupsFor('sales').flatMap((g) => g.items).filter((i) => i.notBuilt).map((i) => i.to)
    expect(notBuilt).toEqual([])
    expect(navGroupsFor('sales').flatMap((g) => g.items).map((i) => i.to)).toContain('/staffing')
  })

  it('finds the Sales group for sales-only paths', () => {
    expect(navGroupFor('/staffing', navGroupsFor('sales'))?.label).toBe('Staffing')
  })
})
