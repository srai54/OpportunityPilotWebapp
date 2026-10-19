import { useSyncExternalStore } from 'react'
import { api } from '../../lib/api'
import type { BatchApproveDraftResult, Campaign, DraftPage, OpportunityPage, ProfileSummary, ResearchJob } from '../../lib/types'
import { campaignPayload, newDraft, quickSourceBodies, salesBoardFor, suggestedMode } from '../campaigns/campaignModel'
import type { Mailbox } from '../mail/mailModel'
import type { BatchSendResult } from '../outreach/sendAll'
import { isEcho, isYes, speak, voiceEpoch, type AssistantAction, type AssistantReply } from './assistantModel'
import { candidateInterviewBody, pickDealSlot, salesScheduleBody, scheduleLine, schedulePlan, scheduleProblem, scheduleQuestion, type SchedulePlan } from './scheduleModel'

/**
 * Voice flows: what a confirmed voice command does, step by step, shown live in the voice pill. They run through the same API calls as
 * the screens. Sending email and approving jobs to apply always stop at a "confirm" step first: that yes is the batch approval.
 */
export type FlowPhase = 'idle' | 'listening' | 'thinking' | 'running' | 'confirm' | 'done' | 'error'
export interface FlowStep { label: string; state: 'todo' | 'now' | 'done' }
export interface FlowState {
  phase: FlowPhase
  title: string
  detail?: string
  steps: FlowStep[]
  /** 0–100 while running. */
  progress?: number
  /** Where "Open" goes when the flow is done. */
  link?: { to: string; label: string }
  /** The question asked in the confirm phase, answered with yes/no. */
  /** tapOnly: the step sends something (email), so only a tap confirms it — a spoken yes never does (D2, 2026-10-16). */
  confirm?: { yes: string; run: () => Promise<void>; tapOnly?: boolean }
  /** What can come next, offered as buttons when a step is done (the assistant keeps going instead of disappearing). */
  next?: { label: string; to?: string; run?: () => Promise<void> }[]
}

const IDLE: FlowState = { phase: 'idle', title: '', steps: [] }
let state: FlowState = IDLE
const listeners = new Set<() => void>()
function set(next: Partial<FlowState>) { state = { ...state, ...next }; listeners.forEach((l) => l()) }
export function setFlow(next: FlowState) { state = next; listeners.forEach((l) => l()) }
export function resetFlow() { setFlow(IDLE) }
export function getFlow(): FlowState { return state }

/** The conversation with the assistant, kept while the app is open so "it" and "yes" refer to what was said before. */
export interface Turn { role: 'you' | 'assistant'; text: string }
let turns: Turn[] = []
const turnListeners = new Set<() => void>()
export function addTurn(t: Turn) { turns = [...turns, t].slice(-20); turnListeners.forEach((l) => l()) }
export function clearTurns() { turns = []; turnListeners.forEach((l) => l()) }
export function useTurns(): Turn[] {
  return useSyncExternalStore((l) => { turnListeners.add(l); return () => turnListeners.delete(l) }, () => turns, () => turns)
}

/** One line for the assistant about what is running or just finished, so it can answer "is it done?" and suggest the next step. */
export function flowContext(): string {
  const f = state
  if (f.phase === 'idle') return lastCampaign() ? 'Nothing is running. The last voice campaign has finished.' : 'Nothing is running.'
  const steps = f.steps.map((s) => `${s.label}: ${s.state}`).join(', ')
  return `Voice task "${f.title}" is ${f.phase}${f.progress != null ? ` (${f.progress}%)` : ''}. ${f.detail ?? ''} ${steps}`.slice(0, 400)
}

/** Says the result aloud, records it in the conversation, and a spoken "yes" runs the suggested next step. */
function announce(text: string, next?: () => Promise<void>) {
  addTurn({ role: 'assistant', text })
  const started = voiceEpoch()
  speak(text, () => {
    if (!next || voiceEpoch() !== started) return
    // Wait a moment so the end of its own voice is not recorded, then one short listen for a yes.
    setTimeout(() => {
      if (voiceEpoch() !== started) return
      void import('./whisper').then(({ hearOnce }) => hearOnce((heard) => { if (voiceEpoch() === started && !isEcho(heard) && isYes(heard)) void next() }))
    }, 600)
  })
}

export function useFlow(): FlowState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => state, () => state)
}

const LAST = 'op.voice.campaign'
export function lastCampaign(): string | null { try { return localStorage.getItem(LAST) } catch { return null } }
function remember(id: string) { try { localStorage.setItem(LAST, id) } catch { /* optional */ } }

function steps(labels: string[], at: number): FlowStep[] {
  return labels.map((label, i) => ({ label, state: i < at ? 'done' : i === at ? 'now' : 'todo' }))
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Runs the action the assistant proposed and the person confirmed. */
export async function runAction(action: NonNullable<AssistantReply['action']>, sales: boolean): Promise<void> {
  try {
    const target = action.campaignId ?? null
    if (action.kind === 'launch') await launch(action.query ?? '', action.location, action.days ?? null, sales)
    else if (action.kind === 'outreach') await outreach(target)
    else if (action.kind === 'apply') await apply(target)
    else if (action.kind === 'review') review(sales, target)
    else if (action.kind === 'schedule') await scheduleFlow(action, sales)
  } catch (e) {
    set({ phase: 'error', title: 'That did not work', detail: (e as Error).message })
  }
}

/** Start a campaign by voice: create it with the search, add the sites, run it and report what it found. */
export async function launch(query: string, location: string | null, days: number | null, sales: boolean): Promise<void> {
  const labels = ['Create the campaign', sales ? 'Search for companies hiring' : 'Search job sites', 'Score the results', 'Ready to review']
  const where = location ? ` in ${location}` : ''
  setFlow({ phase: 'running', title: `${query}${where}`, detail: days ? `Posted in the last ${days} day${days === 1 ? '' : 's'}` : undefined, steps: steps(labels, 0), progress: 5 })
  const profiles = await api<ProfileSummary[]>('/api/v1/profiles')
  let profile: Pick<ProfileSummary, 'id' | 'type'> | undefined = profiles.find((p) => (p.type === 'Candidate') === !sales)
  let starter = false
  if (!profile) {
    // No profile yet: start one from what was said, so the campaign runs now; skills can be added later for sharper matches.
    profile = await api<ProfileSummary>('/api/v1/profiles', { method: 'POST', body: JSON.stringify({
      type: sales ? 'Services' : 'Candidate', name: sales ? 'My services' : 'My profile',
      data: { fields: sales ? { offer: `Services for companies hiring ${query}`, idealCustomer: `Companies hiring ${query}` } : { offer: query }, confirmations: {} }, confirmed: true,
    }) })
    starter = true
  }
  const mode = suggestedMode(profile.type)
  const draft = newDraft()
  draft.name = `${query}${where}`.slice(0, 80) + ' — voice'
  draft.goal = `Find ${query}${where}.`
  draft.criteria = { ...draft.criteria, keywords: [query.slice(0, 200)], locations: location ? [location.slice(0, 100)] : [], maxPostingAgeDays: mode === 'Job' ? days : null }
  draft.autoSuggestMinScore = mode === 'Job' ? 40 : null
  const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: profile.id, mode, ...campaignPayload(draft, mode), autoApproveMinScore: GOOD_MATCH }) })
  remember(campaign.id)
  await Promise.all(quickSourceBodies(sales ? salesBoardFor(location) : 'FreeFeeds', '').map((body) => api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify(body) })))
  const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
  set({ steps: steps(labels, 1), progress: 20 })
  for (let i = 0; i < 180; i++) {
    const job = await api<ResearchJob>(`/api/v1/research-jobs/${jobId}`)
    const c = job.counts
    const done = c.sources > 0 ? c.sourcesDone + c.sourcesFailed : 0
    set({ steps: steps(labels, c.candidates > 0 ? 2 : 1), progress: Math.min(90, 20 + Math.round((done / Math.max(1, c.sources)) * 70)), detail: `${c.fetched} read · ${c.candidates} found · ${c.qualified} good` })
    if (job.state !== 'Queued' && job.state !== 'Running') {
      const nextStep = sales ? () => outreach(campaign.id, true) : () => apply(campaign.id)
      setFlow({
        phase: 'done', title: `${c.candidates} found · ${c.qualified} good match${c.qualified === 1 ? '' : 'es'}`,
        detail: starter ? `${query}${where}. I started a profile for you — add your skills to rank the matches better.` : `${query}${where}`,
        steps: steps(labels, 4), progress: 100, link: { to: `/opportunities?campaign=${campaign.id}`, label: 'Review' },
        confirm: c.qualified > 0 ? { yes: sales ? 'Approve and write emails' : 'Approve the best', run: nextStep } : undefined,
        next: sales
          ? [{ label: 'Message my LinkedIn connections', to: '/outreach#linkedin' }, { label: 'Search wider', to: '/wellfound' }]
          : [{ label: 'Tailor my resume', to: `/opportunities?campaign=${campaign.id}` }, { label: 'Search wider', to: '/wellfound' }],
      })
      announce(
        `Done. Your ${query} campaign found ${c.candidates} ${sales ? 'companies' : 'jobs'}, ${c.qualified} good match${c.qualified === 1 ? '' : 'es'}. ` +
        (c.qualified > 0 ? (sales ? 'Shall I approve the good matches and write their emails?' : 'Shall I approve the best ones so your agent applies?') : 'Want to review them, or search wider?'),
        c.qualified > 0 ? nextStep : undefined,
      )
      return
    }
    await wait(2000)
  }
  setFlow({ phase: 'done', title: 'Still running', detail: 'It keeps going in the background.', steps: steps(labels, 2), link: { to: `/research/${jobId}`, label: 'Watch it' } })
}

function review(sales: boolean, campaignId: string | null = null) {
  const id = campaignId ?? lastCampaign()
  setFlow({ phase: 'done', title: 'Your results', detail: id ? 'From your latest voice campaign' : 'Everything found so far', steps: [], link: { to: id ? `/opportunities?campaign=${id}` : '/opportunities', label: sales ? 'Review leads' : 'Review jobs' } })
}

/** The least score voice (and new voice campaigns) approve on their own — decided 2026-10-16 (U17-13b). Only Qualified matches count. */
export const GOOD_MATCH = 50

/** At most this many emails are sent from the mailbox in one go (the server's batch limit). */
export const SEND_CAP = 25

/**
 * What voice may send: only emails written by this flow for the target campaigns (S1). toSend is everything this flow wrote that is not
 * sent; withAddress the part that has an address (the rest is sent from Gmail by the person).
 */
export function sendableFromFlow<T extends { id: string; campaignId: string; channel: string; state: string; recipient: string | null }>(
  drafts: readonly T[], campaignIds: readonly string[], writtenNow: ReadonlySet<string>,
): { toSend: T[]; withAddress: T[] } {
  const toSend = drafts.filter((d) => writtenNow.has(d.id) && campaignIds.includes(d.campaignId) && d.channel === 'Email' && d.state !== 'Sent')
  return { toSend, withAddress: toSend.filter((d) => Boolean(d.recipient?.trim())) }
}

/** Which campaigns "send the outreach" covers: the one named, else the one of the lead on screen, else every Sales campaign. */
async function outreachCampaigns(campaignId: string | null): Promise<string[]> {
  if (campaignId) return [campaignId]
  const onLead = /^\/opportunities\/([0-9a-f-]{36})/i.exec(window.location.pathname)?.[1]
  if (onLead) { try { return [(await api<{ campaignId: string }>(`/api/v1/opportunities/${onLead}`)).campaignId] } catch { /* fall through */ } }
  const all = await api<{ id: string; mode: string }[]>('/api/v1/campaigns')
  return all.filter((c) => c.mode !== 'Job').map((c) => c.id)
}

/**
 * Sales: write an email for every approved company that has none yet (with or without a known address), then — after a yes — send the
 * ones with an address from the connected mailbox; the rest open in Outreach to send through Gmail, where the address is typed.
 */
/** approveGood: first approve the campaign's good matches — the person said "approve and write" right after it ran, so it never stops at "nothing approved". */
async function outreach(campaignId: string | null = null, approveGood = false): Promise<void> {
  const ids = await outreachCampaigns(campaignId)
  if (ids.length === 0) throw new Error('Start a campaign first, then approve the companies you want to email.')
  const labels = ['Write the emails', 'Your OK', 'Send']
  setFlow({ phase: 'running', title: 'Writing emails', steps: steps(labels, 0), progress: 20 })
  const existing = await api<DraftPage>('/api/v1/drafts?take=200')
  const hasDraft = new Set(existing.items.filter((d) => d.channel === 'Email' && d.state !== 'Sent').map((d) => d.opportunityId))
  let approved = 0, written = 0
  // Only what this flow writes, for these campaigns, may be sent from here (S1); older drafts wait in Outreach.
  const writtenNow = new Set<string>()
  for (const id of ids) {
    const page = await api<OpportunityPage>(`/api/v1/campaigns/${id}/opportunities?take=200`)
    if (approveGood) {
      for (const o of page.items.filter((x) => (x.status === 'New' || x.status === 'Suggested') && x.outcome === 'Qualified' && x.score >= GOOD_MATCH)) {
        try { await api(`/api/v1/opportunities/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Shortlisted' }) }); o.status = 'Shortlisted' } catch { /* a status that cannot move is skipped */ }
      }
    }
    for (const o of page.items.filter((x) => x.status === 'Shortlisted')) {
      approved++
      if (hasDraft.has(o.id)) continue
      try { const d = await api<{ id: string }>(`/api/v1/opportunities/${o.id}/drafts`, { method: 'POST', body: JSON.stringify({ channel: 'Email', recipient: null }) }); writtenNow.add(d.id); written++ } catch { /* e.g. profile not confirmed: shown in Outreach */ }
      set({ progress: Math.min(80, 20 + written * 5), detail: `${written} written` })
    }
  }
  if (approved === 0) {
    setFlow({ phase: 'done', title: 'No approved companies yet', detail: 'Approve the companies you want to email, then say "send the outreach".', steps: steps(labels, 3), link: { to: '/opportunities', label: 'Review leads' } })
    return
  }
  const page = await api<DraftPage>('/api/v1/drafts?take=200')
  const { toSend, withAddress } = sendableFromFlow(page.items, ids, writtenNow)
  const boxes = await api<Mailbox[]>('/api/v1/mailboxes').catch(() => [] as Mailbox[])
  const box = boxes.find((b) => b.connected)
  if (!box || withAddress.length === 0) {
    setFlow({ phase: 'done', title: `${toSend.length} email${toSend.length === 1 ? '' : 's'} ready`, detail: 'Open Outreach: each one opens in Gmail with the text filled in — add the address there and press Send.', steps: steps(labels, 2), progress: 100, link: { to: '/outreach', label: 'Send them in Gmail' }, next: [{ label: 'Message my LinkedIn connections', to: '/outreach#linkedin' }, { label: 'Follow-ups', to: '/follow-ups' }] })
    announce(`${toSend.length} email${toSend.length === 1 ? ' is' : 's are'} ready. Open Outreach and each one opens in Gmail for you to send.`)
    return
  }
  setFlow({
    phase: 'confirm', title: `${withAddress.length} email${withAddress.length === 1 ? '' : 's'} ready`,
    detail: `Tap Send to send ${Math.min(withAddress.length, SEND_CAP)} from ${box.emailAddress ?? 'your mailbox'}.${withAddress.length > SEND_CAP ? ` ${withAddress.length - SEND_CAP} more wait in Outreach (${SEND_CAP} at a time).` : ''}${toSend.length - withAddress.length ? ` ${toSend.length - withAddress.length} without an address wait in Outreach for Gmail.` : ''}`, steps: steps(labels, 1),
    link: { to: '/outreach', label: 'Read them first' },
    confirm: {
      yes: `Send ${Math.min(withAddress.length, SEND_CAP)}`,
      tapOnly: true,
      run: async () => {
        setFlow({ phase: 'running', title: 'Sending', steps: steps(labels, 2), progress: 60 })
        const toApprove = withAddress.filter((d) => d.state === 'Draft').map((d) => ({ id: d.id, version: d.version }))
        const approvedNow = toApprove.length ? await api<BatchApproveDraftResult[]>('/api/v1/drafts/batch-approve', { method: 'POST', body: JSON.stringify({ items: toApprove }) }) : []
        const versions = new Map(approvedNow.filter((a) => a.approved && a.draft).map((a) => [a.id, a.draft!.version]))
        const items = withAddress.filter((d) => d.state === 'Approved' || versions.has(d.id)).slice(0, SEND_CAP).map((d) => ({ id: d.id, version: versions.get(d.id) ?? d.version }))
        const out = await api<BatchSendResult[]>('/api/v1/drafts/send-via-mailbox-batch', { method: 'POST', body: JSON.stringify({ provider: box.provider, items }) })
        const sent = out.filter((o) => o.outcome === 'Sent').length
        setFlow({ phase: 'done', title: `${sent} sent`, detail: sent < items.length ? `${items.length - sent} not sent — see Outreach.` : 'Replies show up in your Inbox.', steps: steps(labels, 3), progress: 100, link: { to: '/outreach', label: 'Open Outreach' }, next: [{ label: 'Message my LinkedIn connections', to: '/outreach#linkedin' }, { label: 'Follow-ups', to: '/follow-ups' }] })
        announce(`Done. ${sent} email${sent === 1 ? '' : 's'} sent. Replies show up in Follow up. Want to message your LinkedIn connections too?`)
      },
    },
  })
}

/** Candidate: approve the best matches of the latest campaign (after a yes) so the desktop agent applies to them. */
async function apply(campaignId: string | null = null): Promise<void> {
  const id = campaignId ?? lastCampaign()
  if (!id) throw new Error('Start a campaign first, then I can approve its best matches.')
  const labels = ['Pick the best matches', 'Your OK', 'Approve for the agent']
  setFlow({ phase: 'running', title: 'Picking the best matches', steps: steps(labels, 0), progress: 30 })
  const page = await api<OpportunityPage>(`/api/v1/campaigns/${id}/opportunities?take=200`)
  const best = page.items.filter((o) => (o.status === 'New' || o.status === 'Suggested') && o.outcome === 'Qualified' && o.score >= GOOD_MATCH).sort((a, b) => b.score - a.score).slice(0, 10)
  if (best.length === 0) {
    setFlow({ phase: 'done', title: 'No strong matches yet', detail: `Nothing scored ${GOOD_MATCH} or more. Review them yourself.`, steps: steps(labels, 3), link: { to: `/opportunities?campaign=${id}`, label: 'Review jobs' } })
    return
  }
  setFlow({
    phase: 'confirm', title: `${best.length} strong match${best.length === 1 ? '' : 'es'}`, detail: `Approve them for applying? (${[...new Set(best.map((o) => o.organization))].slice(0, 3).join(', ')}${new Set(best.map((o) => o.organization)).size > 3 ? '…' : ''})`, steps: steps(labels, 1),
    link: { to: `/opportunities?campaign=${id}`, label: 'Review first' },
    confirm: {
      yes: `Approve ${best.length}`,
      run: async () => {
        setFlow({ phase: 'running', title: 'Approving', steps: steps(labels, 2), progress: 60 })
        let ok = 0
        for (const o of best) {
          try { await api(`/api/v1/opportunities/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Shortlisted' }) }); ok++ } catch { /* a status that cannot move is skipped */ }
        }
        setFlow({ phase: 'done', title: `${ok} approved to apply`, detail: 'Your desktop agent applies to them on its next run.', steps: steps(labels, 3), progress: 100, link: { to: `/opportunities?campaign=${id}`, label: 'See them' }, next: [{ label: 'Desktop agent status', to: '/campaigns' }, { label: 'Find more jobs', to: '/wellfound' }] })
        announce(`Done. ${ok} job${ok === 1 ? '' : 's'} approved. Your desktop agent applies to them on its next run. Anything else?`)
      },
    },
  })
}

/**
 * Schedule an interview by voice. Asks first ("Interview R2 with Acme, Thu 3 pm, 45 min, Video — schedule it?") unless the person
 * already said yes to that same line in the assistant sheet, then saves it through the same endpoints as the screens.
 */
export async function scheduleFlow(action: AssistantAction, sales: boolean, confirmed = false): Promise<void> {
  const now = new Date()
  const problem = scheduleProblem(action, now)
  const plan = schedulePlan(action, sales)
  if (problem || !plan) { setFlow({ phase: 'error', title: 'Not scheduled', detail: problem ?? 'Say the company and the time.', steps: [] }); return }
  const labels = ['Your OK', 'Save the interview', 'In your interviews']
  const run = () => saveInterview(plan, labels)
  if (confirmed) { await run(); return }
  setFlow({ phase: 'confirm', title: 'Schedule this interview?', detail: scheduleQuestion(plan, now), steps: steps(labels, 0), confirm: { yes: 'Yes, schedule', run } })
}

async function saveInterview(plan: SchedulePlan, labels: string[]): Promise<void> {
  setFlow({ phase: 'running', title: 'Scheduling', detail: scheduleLine(plan, new Date()), steps: steps(labels, 1), progress: 50 })
  let to = '/interviews'
  if (plan.targetType === 'deal') {
    const base = `/api/v1/staffing/deals/${plan.targetId}`
    const work = await api<{ submissions: { id: string; state: string }[]; interviews: { id: string; submissionId: string; state: string; round: number; version: number }[] }>(`${base}/work`)
    let slot = pickDealSlot(work, plan.round)
    if (!slot) throw new Error('Send a candidate to the client on this deal first; interviews follow a sent submission.')
    if ('submissionId' in slot) {
      const created = await api<{ id: string; version: number }>(`${base}/interviews`, { method: 'POST', body: JSON.stringify({ submissionId: slot.submissionId }) })
      slot = { interviewId: created.id, version: created.version }
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    await api(`${base}/interviews/${slot.interviewId}/schedule`, { method: 'POST', body: JSON.stringify(salesScheduleBody(plan, zone, slot.version)) })
    to = '/staffing/interviews'
  } else {
    await api(`/api/v1/opportunities/${plan.targetId}/interviews`, { method: 'POST', body: JSON.stringify(candidateInterviewBody(plan)) })
  }
  setFlow({ phase: 'done', title: 'Interview scheduled', detail: scheduleLine(plan, new Date()), steps: steps(labels, 3), progress: 100, link: { to, label: 'See interviews' } })
  announce("Done. It's in your interviews.")
}
