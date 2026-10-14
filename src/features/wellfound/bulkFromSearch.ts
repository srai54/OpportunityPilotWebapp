import { api } from '../../lib/api'
import type { Campaign, OpportunityPage, ProfileSummary, ResearchJob } from '../../lib/types'
import { campaignPayload, newDraft, suggestedMode } from '../campaigns/campaignModel'
import type { BoardJob, JobBoard } from './boardModel'

/** A posting link without query or trailing slash, so the same job matches however the board wrote its address. */
export function sameLink(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (u: string | null | undefined) => (u ?? '').trim().toLowerCase().split('?')[0].replace(/\/+$/, '')
  return norm(a) !== '' && norm(a) === norm(b)
}

/** Company names compared without case, punctuation or "Ltd/Pvt/Inc", so "Infosys Ltd" and "infosys" are one company. */
export function sameCompany(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llc|llp|corp|corporation|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return norm(a) !== '' && norm(a) === norm(b)
}

export interface BulkResult { campaignId: string; approved: number; found: number }

/**
 * Bulk action from live board results. The same search runs as a campaign source (so every job keeps its board and the desktop agent
 * can apply on it), then only what the person ticked is approved: the chosen jobs for a candidate, the chosen hiring companies for Sales.
 */
export async function bulkFromSearch(o: {
  sales: boolean; board: JobBoard; boardName: string; query: string; location: string; picked: BoardJob[]; profiles: ProfileSummary[]
  onStep?: (text: string) => void
}): Promise<BulkResult> {
  const profile = o.profiles.find((p) => (p.type === 'Candidate') === !o.sales)
  if (!profile) throw new Error(o.sales ? 'Create a Product or Services profile first (Profiles), so leads can be scored.' : 'Create your profile first (Profiles), so jobs can be scored and applied to.')
  const mode = suggestedMode(profile.type)
  const draft = newDraft()
  draft.name = `${o.query.trim().slice(0, 60)} — ${o.boardName} ${o.sales ? 'companies' : 'picks'}`
  draft.goal = o.sales ? `Companies hiring ${o.query.trim()} on ${o.boardName}.` : `Apply to chosen ${o.boardName} jobs for ${o.query.trim()}.`
  draft.criteria = { ...draft.criteria, keywords: [o.query.trim().slice(0, 200)], locations: o.location.trim() ? [o.location.trim().slice(0, 100)] : [] }
  o.onStep?.('Creating the campaign…')
  const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: profile.id, mode, ...campaignPayload(draft, mode) }) })
  await api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'JobSearch', url: o.board }) })
  const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
  o.onStep?.(o.sales ? 'Scoring the companies…' : 'Scoring the jobs…')
  for (let i = 0; i < 75; i++) {
    const job = await api<ResearchJob>(`/api/v1/research-jobs/${jobId}`)
    if (job.state !== 'Queued' && job.state !== 'Running') break
    await new Promise((r) => setTimeout(r, 2000))
  }
  const page = await api<OpportunityPage>(`/api/v1/campaigns/${campaign.id}/opportunities?take=200`)
  const chosen = page.items.filter((opp) => o.sales
    ? o.picked.some((j) => sameCompany(j.companyName, opp.organization))
    : o.picked.some((j) => sameLink(j.boardUrl, opp.applyUrl) || sameLink(j.boardUrl, opp.url)))
  o.onStep?.(`Approving ${chosen.length}…`)
  let approved = 0
  for (const opp of chosen) {
    if (opp.status === 'Shortlisted') { approved++; continue }
    try { await api(`/api/v1/opportunities/${opp.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Shortlisted' }) }); approved++ } catch { /* a status that cannot move is skipped */ }
  }
  return { campaignId: campaign.id, approved, found: page.items.length }
}
