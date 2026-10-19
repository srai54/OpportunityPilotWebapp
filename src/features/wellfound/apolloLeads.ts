import { api } from '../../lib/api'
import type { Campaign, OpportunityPage, ProfileSummary, ResearchJob } from '../../lib/types'
import { campaignPayload, newDraft, suggestedMode } from '../campaigns/campaignModel'
import type { Lead } from './apolloModel'

/**
 * The chosen Apollo leads as a pasted list (one block per lead, "---" between), the format a Sales campaign's "Paste" source reads:
 * the company is the title line; the contact's title and name go in the description so the email can address them. Costs no Apollo
 * credits: nothing is searched again.
 */
export function leadsAsPaste(leads: readonly Pick<Lead, 'name' | 'company' | 'title' | 'location' | 'website' | 'linkedIn'>[]): string {
  return leads
    .filter((l) => (l.company ?? l.name).trim())
    .map((l) => {
      const company = (l.company ?? l.name).trim()
      const contact = [l.name && !l.name.startsWith('Name hidden') ? l.name : null, l.title].filter(Boolean).join(', ')
      return [
        company,
        `Company: ${company}`,
        l.location ? `Location: ${l.location}` : null,
        l.website ? `Website: ${l.website}` : null,
        l.linkedIn || l.website ? `URL: ${l.linkedIn ?? l.website}` : null,
        contact ? `Contact from Apollo: ${contact}.` : null,
      ].filter(Boolean).join('\n')
    })
    .join('\n---\n')
}

/**
 * Turns the chosen leads into an approved Sales campaign: create it, add them as a pasted list, score them, then approve every one
 * (the person picked them). Returns the campaign, ready for "write the emails". Throws a plain message when there is no Sales profile.
 */
export async function leadsToCampaign(leads: readonly Lead[], label: string, profiles: readonly ProfileSummary[], onStep?: (t: string) => void): Promise<{ campaignId: string; approved: number }> {
  const profile = profiles.find((p) => p.type !== 'Candidate')
  if (!profile) throw new Error('Create a Product or Services profile first (Profiles), so the emails can say what you offer.')
  const mode = suggestedMode(profile.type)
  const draft = newDraft()
  draft.name = `Apollo: ${label}`.slice(0, 80)
  draft.goal = `Reach ${label} found on Apollo.`
  draft.criteria = { ...draft.criteria, keywords: [label.slice(0, 200)] }
  onStep?.('Creating the campaign…')
  const campaign = await api<Campaign>('/api/v1/campaigns', { method: 'POST', body: JSON.stringify({ profileId: profile.id, mode, ...campaignPayload(draft, mode) }) })
  await api(`/api/v1/campaigns/${campaign.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'Paste', name: 'Apollo leads', text: leadsAsPaste(leads) }) })
  const { jobId } = await api<{ jobId: string }>(`/api/v1/campaigns/${campaign.id}/research`, { method: 'POST' })
  onStep?.('Adding the leads…')
  for (let i = 0; i < 60; i++) {
    const job = await api<ResearchJob>(`/api/v1/research-jobs/${jobId}`)
    if (job.state !== 'Queued' && job.state !== 'Running') break
    await new Promise((r) => setTimeout(r, 1500))
  }
  const page = await api<OpportunityPage>(`/api/v1/campaigns/${campaign.id}/opportunities?take=200`)
  onStep?.(`Approving ${page.items.length}…`)
  let approved = 0
  for (const opp of page.items) {
    if (opp.status === 'Shortlisted') { approved++; continue }
    try { await api(`/api/v1/opportunities/${opp.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Shortlisted' }) }); approved++ } catch { /* a status that cannot move is skipped */ }
  }
  return { campaignId: campaign.id, approved }
}
