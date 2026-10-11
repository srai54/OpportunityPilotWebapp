import type { IconName } from '../../components/icons'
import type { Capability, Overview } from '../../lib/types'

/** Which Overview figure a nav item shows, and how it looks. Only real API counts; never invented. */
export type NavCountKey = 'campaigns' | 'awaitingApproval' | 'needsManual'
/** `muted`: a plain figure. `attention`: something waiting on you — a badge, and a dot when the rail is collapsed. */
export type NavCountTone = 'muted' | 'attention'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** NavLink `end`: only active on the exact path. */
  end?: boolean
  count?: { key: NavCountKey; tone: NavCountTone; srLabel: string }
  /** The route is a "Not built yet" placeholder; the rail shows a "Soon" marker. */
  notBuilt?: boolean
}

export interface NavGroup {
  id: string
  /** Null for the ungrouped first item (Overview). */
  label: string | null
  items: NavItem[]
}

/** The Candidate rail, grouped by the job each destination does (design ShellStates / WorkspaceSwitcher). */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'home', label: null, items: [{ to: '/', label: 'Overview', icon: 'overview', end: true }] },
  {
    id: 'find',
    label: 'Find',
    items: [
      { to: '/campaigns', label: 'Campaigns', icon: 'campaigns', count: { key: 'campaigns', tone: 'muted', srLabel: 'campaigns' } },
      // No count: the Overview DTO has no total-opportunity figure (OQ-FE-039).
      { to: '/opportunities', label: 'Opportunities', icon: 'opportunities' },
      { to: '/wellfound', label: 'Job discovery', icon: 'opportunities' },
      { to: '/trends', label: 'Hiring trends', icon: 'overview' },
    ],
  },
  {
    id: 'decide',
    label: 'Decide',
    items: [
      {
        to: '/approvals',
        label: 'Approvals',
        icon: 'approvals',
        count: { key: 'awaitingApproval', tone: 'attention', srLabel: 'awaiting approval' },
      },
    ],
  },
  {
    id: 'act',
    label: 'Act',
    items: [
      { to: '/outreach', label: 'Outreach', icon: 'outreach' },
    ],
  },
  { id: 'track', label: 'Track', items: [{ to: '/follow-ups', label: 'Follow-ups', icon: 'followUps' }] },
  {
    id: 'setup',
    label: 'Set up',
    items: [
      { to: '/profiles', label: 'Profiles', icon: 'profiles' },
      { to: '/settings', label: 'Settings', icon: 'settings' },
      { to: '/how-it-works', label: 'How it works', icon: 'help' },
    ],
  },
]

const SETUP_GROUP = NAV_GROUPS[NAV_GROUPS.length - 1]

/**
 * The Sales rail (design WorkspaceSwitcher): genuinely different destinations, not a filter. Companies are the
 * opportunities a Customer campaign finds; proposals and placed-bid reporting still wait for later N5 slices.
 */
export const SALES_NAV_GROUPS: NavGroup[] = [
  NAV_GROUPS[0],
  {
    id: 'find',
    label: 'Find',
    items: [
      { to: '/campaigns', label: 'Campaigns', icon: 'campaigns', count: { key: 'campaigns', tone: 'muted', srLabel: 'campaigns' } },
      { to: '/wellfound', label: 'Hiring signals', icon: 'opportunities' },
      { to: '/trends', label: 'Hiring trends', icon: 'overview' },
      { to: '/opportunities', label: 'Companies', icon: 'opportunities' },
    ],
  },
  {
    id: 'decide',
    label: 'Decide',
    items: [
      { to: '/approvals', label: 'Approvals', icon: 'approvals', count: { key: 'awaitingApproval', tone: 'attention', srLabel: 'awaiting approval' } },
    ],
  },
  {
    id: 'act',
    label: 'Act',
    items: [
      { to: '/outreach', label: 'Outreach', icon: 'outreach' },
    ],
  },
  {
    id: 'track',
    label: 'Track',
    items: [
      { to: '/follow-ups', label: 'Follow-ups', icon: 'followUps' },
    ],
  },
  {
    id: 'staffing',
    label: 'Staffing',
    items: [
      { to: '/staffing', label: 'Deals', icon: 'bids' },
      { to: '/staffing/candidates', label: 'Candidates', icon: 'profiles' },
    ],
  },
  SETUP_GROUP,
]

export function navGroupsFor(workspace: Workspace): NavGroup[] {
  return workspace === 'sales' ? SALES_NAV_GROUPS : NAV_GROUPS
}

/** The figure to show next to a nav item, or null when there is nothing to show (unknown, zero, or no count). */
export function navCount(item: NavItem, overview: Overview | undefined): number | null {
  if (!item.count || !overview) return null
  const value = overview[item.count.key]
  return typeof value === 'number' && value > 0 ? value : null
}

/** Accessible name of a rail link when only its icon is visible. */
export function navAccessibleName(item: NavItem, count: number | null): string {
  if (item.notBuilt) return `${item.label} (not built yet)`
  if (item.count && count !== null) return `${item.label} (${count} ${item.count.srLabel})`
  return item.label
}

/** The group a path belongs to, for the top-bar hint. Longest matching route wins; `/` only matches itself. */
export function navGroupFor(pathname: string, groups: NavGroup[] = NAV_GROUPS): NavGroup | undefined {
  let best: { group: NavGroup; length: number } | undefined
  for (const group of groups)
    for (const item of group.items) {
      const match = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/')
      if (match && (!best || item.to.length > best.length)) best = { group, length: item.to.length }
    }
  // Research runs belong to a campaign, so they sit under Find.
  if (!best && pathname.startsWith('/research/')) return NAV_GROUPS.find((g) => g.id === 'find')
  return best?.group
}

/* ---- Workspace ------------------------------------------------------------ */

/**
 * A client-side preference only: which side of the product the user is working on. Nothing is stored in the API
 * and no data is filtered by it yet (R1); pages may read it to choose wording (R2+).
 */
export type Workspace = 'candidate' | 'sales'

export const WORKSPACES: Record<Workspace, { label: string; tagline: string; option: string; status: string; icon: IconName }> = {
  candidate: { label: 'Candidate', tagline: 'Finding roles for you', option: 'Roles you could apply to', status: 'Built', icon: 'candidate' },
  sales: {
    label: 'Sales',
    tagline: 'Finding businesses to sell to',
    option: 'Companies, projects and tenders to bid on',
    status: 'Built — you send',
    icon: 'sales',
  },
}

/** Top-bar line under the title: the pipeline group, plus a real count where the shell already has one. */
export function topbarHint(pathname: string, workspace: Workspace, overview: Overview | undefined): string | null {
  const group = navGroupFor(pathname, navGroupsFor(workspace))
  const known = (n: number | undefined) => typeof n === 'number'
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (pathname === '/') {
    const ws = `${WORKSPACES[workspace].label} workspace`
    return overview && known(overview.campaigns) ? `${ws} · ${plural(overview.campaigns, 'campaign', 'campaigns')}` : ws
  }
  let detail: string | null = null
  if (overview) {
    if (pathname === '/campaigns') detail = plural(overview.campaigns, 'campaign', 'campaigns')
    else if (pathname === '/approvals')
      detail = overview.awaitingApproval > 0 ? `${overview.awaitingApproval} waiting on you` : 'Nothing waiting'
    else if (pathname === '/applications' && overview.needsManual > 0) detail = `${overview.needsManual} need you`
    else if (pathname === '/profiles' || pathname.startsWith('/profiles/'))
      detail = plural(overview.profiles, 'profile', 'profiles')
  }
  if (!group?.label) return detail
  return detail ? `${group.label} · ${detail}` : group.label
}

/* ---- Stored preferences ----------------------------------------------------- */

export const NAV_COLLAPSED_KEY = 'op.navCollapsed'
export const WORKSPACE_KEY = 'op.workspace'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** localStorage can be missing or throw (private mode, blocked site data); preferences then fall back to defaults. */
function safeStore(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readNavCollapsed(store: Store | null = safeStore()): boolean {
  try {
    return store?.getItem(NAV_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeNavCollapsed(collapsed: boolean, store: Store | null = safeStore()): void {
  try {
    store?.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // Not stored; the choice lasts for this page view only.
  }
}

export function readWorkspace(store: Store | null = safeStore()): Workspace {
  try {
    return store?.getItem(WORKSPACE_KEY) === 'sales' ? 'sales' : 'candidate'
  } catch {
    return 'candidate'
  }
}

export function writeWorkspace(workspace: Workspace, store: Store | null = safeStore()): void {
  try {
    store?.setItem(WORKSPACE_KEY, workspace)
  } catch {
    // Not stored; the choice lasts for this page view only.
  }
}

/* ---- Status wording ----------------------------------------------------------- */

export type ApiStatus = 'checking' | 'waking' | 'ready' | 'degraded'
export type DotTone = 'success' | 'warning' | 'danger' | 'neutral'

/** Rail footer wording for the API. The colour is never shown without these words. */
export const API_STATUS_LABELS: Record<ApiStatus, { text: string; tone: DotTone }> = {
  checking: { text: 'API · checking', tone: 'neutral' },
  waking: { text: 'API · starting', tone: 'warning' },
  ready: { text: 'API · online', tone: 'success' },
  degraded: { text: 'API · database unavailable', tone: 'danger' },
}

export function gmailLabel(gmail: Pick<Capability, 'status'>): { text: string; tone: DotTone } {
  if (gmail.status === 'Ready') return { text: 'Gmail · connected', tone: 'success' }
  if (gmail.status === 'Disabled') return { text: 'Gmail · disabled', tone: 'neutral' }
  return { text: 'Gmail · not connected', tone: 'warning' }
}

/** The AI mode pill in the top bar. "Configured" is a key that has not been verified by a real call. */
export function aiModeLabel(gemini: Pick<Capability, 'status'>): { text: string; tone: 'primary' | 'neutral' } {
  if (gemini.status === 'Ready') return { text: 'Gemini active', tone: 'primary' }
  if (gemini.status === 'Configured') return { text: 'Gemini key set · unverified', tone: 'primary' }
  return { text: 'Rules mode · no AI key', tone: 'neutral' }
}

/** Two-letter avatar initials from an email or a dev/guest name. */
export function initials(email: string): string {
  const name = email.split('@')[0]
  const parts = name.split(/[._\s-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}
