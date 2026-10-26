import { api } from '../../lib/api'
import type { Campaign, OpportunityPage, ProfileSummary, ResearchJob } from '../../lib/types'
import { campaignPayload, newDraft, suggestedMode } from '../campaigns/campaignModel'
import type { BoardJob } from './boardModel'

/** A posting link without query or trailing slash, so the same job matches however the board wrote its address. */
export function sameLink(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (u: string | null | undefined) => (u ?? '').trim().toLowerCase().split('?')[0].replace(/\/+$/, '')
  return norm(a) !== '' && norm(a) === norm(b)
}

/** Company names compared without case, punctuation or legal suffixes (Ltd, Pvt, Pty, Inc, GmbH, AB…), so "Infosys Ltd" and "infosys" are one company. */
export function sameCompany(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\b(pvt|pty|private|ltd|limited|inc|llc|llp|corp|corporation|co|gmbh|ab|ag|bv)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  return norm(a) !== '' && norm(a) === norm(b)
}

export interface BulkResult { campaignId: string; approved: number; found: number }

/**
 * The chosen results as a pasted list, the format a campaign's "Paste" source reads (one block per entry, "---" between): jobs keep
 * their title, company, place and board link (so the desktop agent can still apply on LinkedIn/Naukri); for Sales one block per company
 * with the roles it is hiring for.
 */
export function pickedAsPaste(sales: boolean, picked: readonly BoardJob[]): string {
  if (sales) {
    const groups: { company: string; jobs: BoardJob[] }[] = []
    for (const j of picked) {
      if (!j.companyName.trim()) continue
      const g = groups.find((x) => sameCompany(x.company, j.companyName))
      if (g) g.jobs.push(j); else groups.push({ company: j.companyName.trim(), jobs: [j] })
    }
    return groups.map((g) => [g.company, `Company: ${g.company}`, g.jobs[0].location ? `Location: ${g.jobs[0].location}` : null,
      `URL: ${g.jobs[0].boardUrl}`, `Hiring: ${[...new Set(g.jobs.map((j) => j.title))].slice(0, 5).join(', ')}.`].filter(Boolean).join('\n')).join('\n---\n')
  }
  return picked.map((j) => [j.title, j.companyName ? `Company: ${j.companyName}` : null, j.location ? `Location: ${j.location}` : null,
    `URL: ${j.boardUrl}`, j.snippet ?? null].filter(Boolean).join('\n')).join('\n---\n')
}

/**
 * Bulk action from results already on screen: the chosen jobs (Candidate) or hiring companies (Sales) go straight into a new campaign as
 * a pasted list, are scored against the profile and approved. Nothing is searched again, so no search credit is used and it is quick.
 */
export async function bulkFromSearch(o: {
  sales: boolean; board: string; boardName: string; query: string; location: string; picked: BoardJob[]; profiles: ProfileSummary[]
  onStep?: (text: string) => void
}): Promise<BulkResult> {
  if (o.picked.length === 0) throw new Error(o.sales ? 'Tick the companies to add first.' : 'Tick the jobs to add first.')
  let profile: Pick<ProfileSummary, 'id' | 'type'> | undefined = o.profiles.find((p) => (p.type === 'Candidate') === !o.sales)
  if (!profile) {
    // No profile yet (a first-time visitor): start one from the search, as the voice flow does, so the leads are scored now.
    o.onStep?.('Starting a profile from your search…')
    profile = await api<ProfileSummary>('/api/v1/profiles', { method: 'POST', body: JSON.stringify({
      type: o.sales ? 'Services' : 'Candidate', name: o.sales ? 'My services' : 'My profile',
      data: { fields: o.sales ? { offer: `Services for companies hiring ${o.query.trim()}`, idealCustomer: `Companies hiring ${o.query.trim()}` } : { offer: o.query.trim() }, confirmations: {} }, confirmed: true,
    }) })
  }
  if (o.picked.length === 0) throw new Error(o.sales ? 'Tick the companies to add first.' : 'Tick the jobs to add first.')
  const mode = suggestedMode(profile.type)
  const draft = newDraft()
  draft.name = `${o.query.trim().slice(0, 60)} — ${o.boardName} ${o.sales ? 'companies' : 'picks'}`
  draft.goal = o.sales ? `Companies hiring ${o.query.trim()} on ${o.boardName}.` : `Apply to chosen ${o.boardName} jobs for ${o.query.trim()}.`
  draft.criteria = { ...draft.criteria, keywords: [o.query.trim().slice(0, 200)], locations: o.location.trim() ? [o.location.trim().slice(0, 100)] : [] }
  o.onStep?.('Creating the campaign…')
  const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: profile.id, mode, ...campaignPayload(draft, mode) }) })
  await api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'Paste', name: `${o.boardName} picks`, text: pickedAsPaste(o.sales, o.picked) }) })
  const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
  o.onStep?.(o.sales ? 'Adding the companies…' : 'Adding the jobs…')
  for (let i = 0; i < 60; i++) {
    const job = await api<ResearchJob>(`/api/v1/research-jobs/${jobId}`)
    if (job.state !== 'Queued' && job.state !== 'Running') break
    await new Promise((r) => setTimeout(r, 1500))
  }
  const page = await api<OpportunityPage>(`/api/v1/campaigns/${campaign.id}/opportunities?take=200`)
  o.onStep?.(`Approving ${page.items.length}…`)
  let approved = 0
  for (const opp of page.items) {
    if (opp.status === 'Shortlisted') { approved++; continue }
    try { await api(`/api/v1/opportunities/${opp.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Shortlisted' }) }); approved++ } catch { /* a status that cannot move is skipped */ }
  }
  return { campaignId: campaign.id, approved, found: page.items.length }
}
