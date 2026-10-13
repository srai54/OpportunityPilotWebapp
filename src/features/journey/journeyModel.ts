import type { Overview } from '../../lib/types'
import type { Workspace } from '../shell/shellModel'

/** The five steps of the journey, the same for both workspaces; only the words differ. */
export type StepId = 'profile' | 'find' | 'review' | 'reach' | 'follow'

export interface JourneyStep {
  id: StepId
  /** Short name for the journey bar. */
  label: string
  /** Where the bar's link goes. */
  to: string
  /** True when the person has already done this step (from real counts, never invented). */
  done: boolean
}

export interface NextStep {
  step: StepId
  /** Button text. */
  action: string
  to: string
  /** One plain sentence about why. */
  text: string
}

const LABELS: Record<Workspace, Record<StepId, string>> = {
  candidate: { profile: 'Profile', find: 'Find jobs', review: 'Review', reach: 'Apply & reach out', follow: 'Follow up' },
  sales: { profile: 'Profile', find: 'Find companies', review: 'Review leads', reach: 'Reach out', follow: 'Follow up' },
}

const TARGETS: Record<StepId, string> = {
  profile: '/profiles',
  find: '/wellfound',
  review: '/opportunities',
  reach: '/outreach',
  follow: '/follow-ups',
}
const ORDER: StepId[] = ['profile', 'find', 'review', 'reach', 'follow']

/** Fields added later in the API may be missing on an older server, so every count defaults to 0. */
const n = (v: number | undefined) => (typeof v === 'number' ? v : 0)

export function journeySteps(workspace: Workspace, o: Overview | undefined): JourneyStep[] {
  const done: Record<StepId, boolean> = {
    profile: n(o?.profiles) > 0,
    find: n(o?.campaigns) > 0,
    review: n(o?.shortlisted) > 0 || n(o?.applied) > 0,
    reach: n(o?.draftsSent) > 0 || n(o?.applied) > 0,
    // Follow-up is an ongoing habit, not a one-off: it counts as done once something is open and nothing is overdue.
    follow: n(o?.followUpsOpen) > 0 && n(o?.followUpsDue) === 0,
  }
  return ORDER.map((id) => ({ id, label: LABELS[workspace][id], to: TARGETS[id], done: done[id] }))
}

/** Which step a page belongs to, or null (Home, Settings…). Used to highlight "you are here". */
export function stepForPath(pathname: string): StepId | null {
  if (pathname.startsWith('/profiles')) return 'profile'
  if (pathname === '/wellfound' || pathname.startsWith('/campaigns') || pathname.startsWith('/research')) return 'find'
  if (pathname.startsWith('/opportunities') || pathname === '/approvals') return 'review'
  if (pathname === '/outreach') return 'reach'
  if (pathname === '/follow-ups') return 'follow'
  return null
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The single next thing to do, chosen from real counts only. Order matters: people finish what is closest to
 * done (send what is approved) before starting something new. Returns null until the counts are known.
 */
export function nextStep(workspace: Workspace, o: Overview | undefined): NextStep | null {
  if (!o) return null
  const sales = workspace === 'sales'
  const thing = (c: number) => (sales ? plural(c, 'lead', 'leads') : plural(c, 'job', 'jobs'))

  if (n(o.profiles) === 0)
    return {
      step: 'profile', action: 'Create your profile', to: '/profiles/new',
      text: sales ? 'Say what you sell, in a few words. Everything else uses it.' : 'Say what you offer and your skills. Matching uses it.',
    }
  if (n(o.campaigns) === 0)
    return {
      step: 'find', action: sales ? 'Find companies' : 'Find jobs', to: '/campaigns/new',
      text: sales ? 'Search a role; each company that is hiring becomes a scored lead.' : 'Search a role and place; the best matches come back scored.',
    }
  if (n(o.awaitingApproval) > 0)
    return {
      step: 'review', action: `Review ${thing(o.awaitingApproval)}`, to: '/opportunities?view=approvals',
      text: `${thing(o.awaitingApproval)} ${o.awaitingApproval === 1 ? 'is' : 'are'} waiting for your yes or no.`,
    }
  if (n(o.draftsAwaitingReview) > 0)
    return {
      step: 'reach', action: `Review ${plural(o.draftsAwaitingReview, 'message', 'messages')}`, to: '/outreach',
      text: 'Edit the draft, approve it, and send it yourself.',
    }
  if (n(o.draftsApproved) > 0)
    return {
      step: 'reach', action: `Send ${plural(n(o.draftsApproved), 'approved message', 'approved messages')}`, to: '/outreach',
      text: 'Approved and ready. Send it, then paste the receipt so it is counted.',
    }
  if (n(o.followUpsDue) > 0)
    return {
      step: 'follow', action: `Follow up (${n(o.followUpsDue)} due)`, to: '/follow-ups',
      text: 'These are due now. A short nudge works best.',
    }
  if (n(o.shortlisted) > 0 && n(o.draftsSent) === 0 && n(o.applied) === 0)
    return {
      step: 'reach', action: sales ? 'Reach out to a lead' : 'Apply or reach out', to: '/opportunities',
      text: sales ? 'Open an approved lead and draft a LinkedIn note or an email.' : 'Open an approved job: apply on its page, or message the recruiter.',
    }
  if (n(o.qualifiedToReview) > 0)
    return {
      step: 'review', action: `Review ${thing(o.qualifiedToReview ?? 0)}`, to: '/opportunities',
      text: sales ? 'Approve the companies worth contacting. Nothing is sent by approving.' : 'Approve the jobs worth your time. Nothing is applied by approving.',
    }
  if (n(o.draftsSent) > 0 || n(o.applied) > 0)
    return {
      step: 'follow', action: 'See what you sent', to: '/follow-ups',
      text: n(o.followUpsOpen) > 0 ? 'A nudge is scheduled. If someone replied, update that lead.' : 'Sent. If someone replied, update that lead; otherwise nudge them in a few days.',
    }
  return {
    step: 'find', action: sales ? 'Find more companies' : 'Find more jobs', to: '/wellfound',
    text: 'Nothing is waiting. Search again to bring in new matches.',
  }
}
