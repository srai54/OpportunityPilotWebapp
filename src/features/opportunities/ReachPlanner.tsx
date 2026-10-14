import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { OpportunityDetail, OutreachDraft } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import type { Integration } from '../connectors/integrationsModel'
import { reachRoutes, referralNote, signOffName, type ReachRoute } from './reachPlan'

interface FoundPerson { source?: string; name: string; title: string | null; email: string | null; emailConfidence: number | null; linkedinUrl: string | null; personId?: string | null; note: string | null }
interface FoundPeople { source: string; people: FoundPerson[]; creditsNote?: string | null }
interface FoundContacts { candidates: { kind: string; value: string; rank: number }[] }

/**
 * "How to reach them": the ways in, best first, for a lead whose recruiter email is usually unknown. Each button does one thing:
 * write the message (then it opens in Outreach to check and send), open LinkedIn on the right people, or look an address up.
 */
export function ReachPlanner({ o, onError }: Readonly<{ o: OpportunityDetail; onError: (e: Error) => void }>) {
  const navigate = useNavigate()
  const integrations = useApi<Integration[]>('/api/v1/integrations')
  const finders = (integrations.data ?? []).map((x) => ({ kind: x.kind as string, connected: x.connected }))
    .filter((x) => x.connected && (x.kind === 'Hunter' || x.kind === 'Apollo')).map((x) => x.kind as 'Hunter' | 'Apollo')
  const [publishedEmail, setPublishedEmail] = useState<string | null>(null)
  const [emailSearched, setEmailSearched] = useState(false)
  const [found, setFound] = useState<FoundPeople>()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // Hunter and Apollo search by the company's web domain; a job posting does not give one, so the person types it once.
  const [website, setWebsite] = useState('')
  const routes = reachRoutes({ mode: o.mode, organization: o.organization, title: o.title, url: o.url, applyUrl: o.applyUrl, platform: o.platform, publishedEmail, finders, emailSearched })

  async function draft(channel: 'Email' | 'LinkedInMessage' | 'ContactForm', recipient: string | null = null, referral = false) {
    const made = await api<OutreachDraft>(`/api/v1/opportunities/${o.id}/drafts`, { method: 'POST', body: JSON.stringify({ channel, recipient }) })
    if (referral) {
      await api<OutreachDraft>(`/api/v1/drafts/${made.id}`, { method: 'PUT', body: JSON.stringify({ recipient: null, subject: null, body: referralNote(o, signOffName(made.body)), expectedVersion: made.version }) })
    }
    navigate(`/outreach?draft=${made.id}`)
  }

  async function run(r: ReachRoute) {
    const a = r.action
    // A tab must open inside the click, before any awaited call, or the browser blocks it.
    if (a.kind === 'open' || a.kind === 'linkedin') window.open(a.href, '_blank', 'noopener')
    if (a.kind === 'open') return
    if (a.kind === 'connect-finder') { navigate('/connectors'); return }
    setBusy(r.id); setNote('')
    try {
      if (a.kind === 'draft') await draft(a.channel, a.channel === 'Email' ? publishedEmail : null)
      else if (a.kind === 'linkedin') await draft('LinkedInMessage', null, a.then === 'referral')
      else if (a.kind === 'find-email') {
        const res = await api<FoundContacts>(`/api/v1/opportunities/${o.id}/contacts/find`, { method: 'POST', body: '{}' })
        const best = res.candidates.filter((c) => c.kind === 'Email').sort((x, y) => y.rank - x.rank)[0]
        if (best) { setPublishedEmail(best.value); setNote(`Found ${best.value}, published by the company. It is now the first way in.`) }
        else { setEmailSearched(true); setNote('No address is published. LinkedIn or a referral is the way in, or connect Hunter or Apollo to look one up.') }
      } else if (a.kind === 'people') {
        setFound(await api<FoundPeople>(`/api/v1/opportunities/${o.id}/people/find`, { method: 'POST', body: JSON.stringify({ source: a.source, website: website.trim() || undefined }) }))
      }
    } catch (e) { onError(e as Error) } finally { setBusy(null) }
  }

  /** Apollo shows a work email only when asked, and each one uses one of the person's Apollo credits. */
  async function reveal(p: FoundPerson) {
    if (!p.personId || !found) return
    setBusy(`reveal-${p.personId}`)
    try {
      const res = await api<{ person: FoundPerson; creditsNote?: string }>(`/api/v1/opportunities/${o.id}/people/reveal`, { method: 'POST', body: JSON.stringify({ source: 'Apollo', personId: p.personId }) })
      setFound({ ...found, people: found.people.map((x) => (x.personId === p.personId ? { ...x, ...res.person } : x)) })
      if (!res.person.email) setNote(`Apollo has no work email for ${p.name}.`)
    } catch (e) { onError(e as Error) } finally { setBusy(null) }
  }
  const needsSite = o.mode === 'Job' && routes.some((r) => r.action.kind === 'people')

  return (
    <div className="stack-3">
      <p className="muted-small">Ways to reach {o.organization || 'them'}, best first. A button writes the message and opens it for you to check and send, or opens the right page. Nothing is sent by the app.</p>
      <ol className="reach-routes">
        {routes.map((r, i) => (
          <li key={r.id} className="reach-route">
            <div className="reach-text"><strong>{r.title}</strong><span className="muted-small">{r.why}</span></div>
            <button type="button" className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} disabled={busy !== null} onClick={() => void run(r)}>
              {busy === r.id ? 'Working…' : label(r)}<span className="sr-only"> ({r.title})</span>
            </button>
          </li>
        ))}
      </ol>
      {needsSite && (
        <label className="field"><span>Company website, for Hunter and Apollo</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" inputMode="url" autoComplete="off" />
        </label>
      )}
      {note && <p className="muted-small" role="status">{note}</p>}
      {found && (
        <div className="stack-2" role="status">
          <p className="small"><strong>{found.people.length} {found.people.length === 1 ? 'person' : 'people'} from {found.source}</strong> — {found.source}’s data, not checked by this app.{found.creditsNote ? ` ${found.creditsNote}` : ''}</p>
          <ul className="hint-list">
            {found.people.slice(0, 8).map((p) => (
              <li key={`${p.name}${p.email ?? p.linkedinUrl ?? ''}`}>
                <strong>{p.name}</strong>{p.title ? `, ${p.title}` : ''}{p.email ? ` · ${p.email}${p.emailConfidence != null ? ` (${p.emailConfidence}% sure)` : ''}` : ''}{' '}
                {p.email && <button type="button" className="btn-link" onClick={() => void draft('Email', p.email)}>Email them</button>}{' '}
                {!p.email && p.personId && found.source === 'Apollo' && <button type="button" className="btn-link" disabled={busy !== null} onClick={() => void reveal(p)}>{busy === `reveal-${p.personId}` ? 'Asking Apollo…' : 'Show email (uses 1 Apollo credit)'}</button>}{' '}
                {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
              </li>
            ))}
          </ul>
          {found.people.length === 0 && <p className="muted-small">Nobody found for this company. Try LinkedIn above.</p>}
        </div>
      )}
    </div>
  )
}

function label(r: ReachRoute): string {
  switch (r.action.kind) {
    case 'draft': return r.action.channel === 'ContactForm' ? 'Write it' : 'Write the email'
    case 'linkedin': return r.action.then === 'referral' ? 'Open connections + write request' : 'Open LinkedIn + write note'
    case 'open': return 'Open the posting ↗'
    case 'find-email': return 'Look for it'
    case 'people': return `Look up with ${r.action.source}`
    default: return 'Connect'
  }
}
