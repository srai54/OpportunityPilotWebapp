import { useSyncExternalStore } from 'react'
import { api } from '../../lib/api'
import type { BatchApproveDraftResult, Campaign, DraftPage, OpportunityPage, ProfileSummary, ResearchJob } from '../../lib/types'
import { campaignPayload, newDraft, quickSourceBodies, suggestedMode } from '../campaigns/campaignModel'
import type { Mailbox } from '../mail/mailModel'
import type { BatchSendResult } from '../outreach/sendAll'
import { isYes, speak, type AssistantReply } from './assistantModel'

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
  confirm?: { yes: string; run: () => Promise<void> }
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
  speak(text, () => {
    if (!next) return
    void import('./whisper').then(({ hearOnce }) => hearOnce((heard) => { if (isYes(heard)) void next() }))
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
  const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: profile.id, mode, ...campaignPayload(draft, mode) }) })
  remember(campaign.id)
  await Promise.all(quickSourceBodies(sales ? 'LinkedIn' : 'FreeFeeds', '').map((body) => api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify(body) })))
  const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
  set({ steps: steps(labels, 1), progress: 20 })
  for (let i = 0; i < 180; i++) {
    const job = await api<ResearchJob>(`/api/v1/research-jobs/${jobId}`)
    const c = job.counts
    const done = c.sources > 0 ? c.sourcesDone + c.sourcesFailed : 0
    set({ steps: steps(labels, c.candidates > 0 ? 2 : 1), progress: Math.min(90, 20 + Math.round((done / Math.max(1, c.sources)) * 70)), detail: `${c.fetched} read · ${c.candidates} found · ${c.qualified} good` })
    if (job.state !== 'Queued' && job.state !== 'Running') {
      const nextStep = sales ? () => outreach(campaign.id) : () => apply(campaign.id)
      setFlow({
        phase: 'done', title: `${c.candidates} found · ${c.qualified} good match${c.qualified === 1 ? '' : 'es'}`,
        detail: starter ? `${query}${where}. I started a profile for you — add your skills to rank the matches better.` : `${query}${where}`,
        steps: steps(labels, 4), progress: 100, link: { to: `/opportunities?campaign=${campaign.id}`, label: 'Review' },
        confirm: c.qualified > 0 ? { yes: sales ? 'Write the emails' : 'Approve the best', run: nextStep } : undefined,
      })
      announce(
        `Done. Your ${query} campaign found ${c.candidates} ${sales ? 'companies' : 'jobs'}, ${c.qualified} good match${c.qualified === 1 ? '' : 'es'}. ` +
        (c.qualified > 0 ? (sales ? 'Shall I write the emails for the approved companies?' : 'Shall I approve the best ones so your agent applies?') : 'Want to review them, or search wider?'),
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

/** Sales: write emails for the approved leads of the latest campaign, then (after a yes) approve and send them from the connected mailbox. */
async function outreach(campaignId: string | null = null): Promise<void> {
  const id = campaignId ?? lastCampaign()
  if (!id) throw new Error('Start a campaign first, then approve the companies you want to email.')
  const labels = ['Write the emails', 'Your OK', 'Send from your mailbox']
  setFlow({ phase: 'running', title: 'Writing emails', steps: steps(labels, 0), progress: 30 })
  const r = await api<{ written: number; skipped: number; items: { draftId: string | null }[] }>(`/api/v1/campaigns/${id}/drafts/prepare`, { method: 'POST' })
  const ids = new Set(r.items.map((x) => x.draftId).filter(Boolean) as string[])
  const page = await api<DraftPage>('/api/v1/drafts?take=200')
  const ready = page.items.filter((d) => d.campaignId === id && d.channel === 'Email' && d.recipient && d.state !== 'Sent' && (ids.has(d.id) || d.state === 'Draft' || d.state === 'Approved'))
  if (ready.length === 0) {
    setFlow({ phase: 'done', title: 'No emails to send', detail: r.skipped ? `${r.skipped} approved lead${r.skipped === 1 ? ' has' : 's have'} no published address yet.` : 'Approve some companies first.', steps: steps(labels, 3), link: { to: '/outreach', label: 'Open Outreach' } })
    return
  }
  const boxes = await api<Mailbox[]>('/api/v1/mailboxes')
  const box = boxes.find((b) => b.connected)
  if (!box) {
    setFlow({ phase: 'done', title: `${ready.length} email${ready.length === 1 ? '' : 's'} written`, detail: 'Connect your mailbox to send them from here, or send each from Outreach.', steps: steps(labels, 1), link: { to: '/outreach', label: 'Check and send' } })
    return
  }
  setFlow({
    phase: 'confirm', title: `${ready.length} email${ready.length === 1 ? '' : 's'} ready`, detail: `Send them from ${box.emailAddress ?? 'your mailbox'}?`, steps: steps(labels, 1),
    link: { to: '/outreach', label: 'Read them first' },
    confirm: {
      yes: `Send ${ready.length}`,
      run: async () => {
        setFlow({ phase: 'running', title: 'Sending', steps: steps(labels, 2), progress: 60 })
        const toApprove = ready.filter((d) => d.state === 'Draft').map((d) => ({ id: d.id, version: d.version }))
        const approved = toApprove.length ? await api<BatchApproveDraftResult[]>('/api/v1/drafts/batch-approve', { method: 'POST', body: JSON.stringify({ items: toApprove }) }) : []
        const versions = new Map(approved.filter((a) => a.approved && a.draft).map((a) => [a.id, a.draft!.version]))
        const items = ready.filter((d) => d.state === 'Approved' || versions.has(d.id)).slice(0, 25).map((d) => ({ id: d.id, version: versions.get(d.id) ?? d.version }))
        const out = await api<BatchSendResult[]>('/api/v1/drafts/send-via-mailbox-batch', { method: 'POST', body: JSON.stringify({ provider: box.provider, items }) })
        const sent = out.filter((o) => o.outcome === 'Sent').length
        setFlow({ phase: 'done', title: `${sent} sent`, detail: sent < items.length ? `${items.length - sent} not sent — see Outreach.` : 'Replies show up in your Inbox.', steps: steps(labels, 3), progress: 100, link: { to: '/outreach', label: 'Open Outreach' } })
        announce(`Done. ${sent} email${sent === 1 ? '' : 's'} sent. I will tell you when replies come in; check your Inbox.`)
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
  const best = page.items.filter((o) => (o.status === 'New' || o.status === 'Suggested') && o.score >= 60).sort((a, b) => b.score - a.score).slice(0, 10)
  if (best.length === 0) {
    setFlow({ phase: 'done', title: 'No strong matches yet', detail: 'Nothing scored 60 or more. Review them yourself.', steps: steps(labels, 3), link: { to: `/opportunities?campaign=${id}`, label: 'Review jobs' } })
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
        setFlow({ phase: 'done', title: `${ok} approved to apply`, detail: 'Your desktop agent applies to them on its next run.', steps: steps(labels, 3), progress: 100, link: { to: `/opportunities?campaign=${id}`, label: 'See them' } })
        announce(`Done. ${ok} job${ok === 1 ? '' : 's'} approved. Your desktop agent applies to them on its next run. Anything else?`)
      },
    },
  })
}
