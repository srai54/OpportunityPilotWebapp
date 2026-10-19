import { safeHref } from './opportunityModel'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { OpportunityDetail, OutreachDraft } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { degreeLabel, groupCircle, profileUrlProblem, RELATIONS, type Circle, type CirclePerson, type CircleRelation } from './circleModel'
import { referralNote, signOffName } from './reachPlan'

interface AgentStatus { connected: boolean; online: boolean }

/**
 * JD circle: the people around this job or lead — people you know there, the hiring manager or decision makers, recruiters, the
 * team. The desktop agent finds them on LinkedIn in your own browser; you can also add someone by hand. One click writes a note to
 * one person; it goes out only after you approve it (and, for LinkedIn, the agent sends it from your account).
 */
export function JdCircle({ o }: Readonly<{ o: OpportunityDetail }>) {
  const circle = useApi<Circle>(`/api/v1/opportunities/${o.id}/circle`)
  const agent = useApi<AgentStatus>('/api/v1/agent-keys/status')
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [relation, setRelation] = useState<CircleRelation>('Recruiter')
  const [formError, setFormError] = useState('')
  const job = o.mode === 'Job'
  const c = circle.data

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key); setError(undefined)
    try { await fn() } catch (e) { setError(e as Error) } finally { setBusy(null) }
  }
  const request = () => act('request', async () => { await api(`/api/v1/opportunities/${o.id}/circle/request`, { method: 'POST' }); circle.reload() })
  const remove = (p: CirclePerson) => act(`rm-${p.id}`, async () => { await api(`/api/v1/opportunities/${o.id}/circle/${p.id}`, { method: 'DELETE' }); circle.reload() })
  /** A LinkedIn note addressed to this person's profile; a 1st-degree connection gets a referral or introduction request. */
  const write = (p: CirclePerson) => act(`note-${p.id}`, async () => {
    const made = await api<OutreachDraft>(`/api/v1/opportunities/${o.id}/drafts`, { method: 'POST', body: JSON.stringify({ channel: 'LinkedInMessage', recipient: p.profileUrl }) })
    if (p.degree === 1 || p.relation === 'Connection') {
      await api<OutreachDraft>(`/api/v1/drafts/${made.id}`, { method: 'PUT', body: JSON.stringify({ recipient: p.profileUrl, subject: null, body: referralNote(o, signOffName(made.body)).replace(/^Hi,/, `Hi ${p.name.split(' ')[0]},`), expectedVersion: made.version }) })
    }
    navigate(`/outreach?draft=${made.id}`)
  })
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const problem = !name.trim() ? 'Add their name.' : profileUrlProblem(url)
    if (problem) { setFormError(problem); return }
    setFormError('')
    await act('add', async () => {
      await api(`/api/v1/opportunities/${o.id}/circle`, { method: 'POST', body: JSON.stringify({ name: name.trim(), profileUrl: url.trim(), relation }) })
      setName(''); setUrl(''); setAdding(false); circle.reload()
    })
  }

  const groups = c ? groupCircle(c.people) : []
  const status = !c ? null : c.status === 'Ready' ? { tone: 'success' as const, text: `${c.people.length} found` } : c.status === 'Waiting' ? { tone: 'warning' as const, text: 'Waiting for the agent' } : { tone: 'neutral' as const, text: 'Not mapped yet' }

  return (
    <Card title="People around this job" subtitle={job ? 'Who you know there, the hiring manager, recruiters and the team, from your own LinkedIn.' : 'Who you know there, the decision makers and their team, from your own LinkedIn.'}
      actions={status && <Badge tone={status.tone}>{status.text}</Badge>}>
      <div className="stack-3">
        {error && <ErrorNotice error={error} />}
        {circle.error && <ErrorNotice error={circle.error} onRetry={circle.reload} what="the people" />}
        {c && c.status !== 'Ready' && (
          <div className="stack-2">
            <p className="muted-small">
              {c.status === 'Waiting'
                ? agent.data?.online ? 'Your desktop agent is running and will map them on its next round (a few minutes).' : 'Asked. Start the desktop agent on your computer (npm run agent -- circle linkedin, or leave cycle running) and they appear here.'
                : 'The desktop agent searches LinkedIn in your own logged-in browser for people at this company and lists them here. Nothing is sent.'}
            </p>
            {c.status === 'NotRequested' && <div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void request()}>{busy === 'request' ? 'Asking…' : 'Find these people on my LinkedIn'}</button></div>}
            {agent.data && !agent.data.connected && <p className="muted-small">No desktop agent yet: connect it from Home (Desktop agent card).</p>}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.relation} className="stack-2" aria-label={RELATIONS.find((r) => r.key === g.relation)?.[job ? 'job' : 'sales']}>
            <h4 className="eyebrow">{RELATIONS.find((r) => r.key === g.relation)?.[job ? 'job' : 'sales']} · {g.people.length}</h4>
            <ul className="circle-list">
              {g.people.map((p) => (
                <li key={p.id} className="circle-person">
                  <Avatar name={p.name} />
                  <div className="circle-text">
                    <span className="circle-name"><strong>{p.name}</strong>{degreeLabel(p.degree) && <span className="chip">{degreeLabel(p.degree)}<span className="sr-only"> connection</span></span>}</span>
                    {p.title && <span className="muted-small">{p.title}</span>}
                  </div>
                  <div className="row wrap circle-actions">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void write(p)}>
                      {busy === `note-${p.id}` ? 'Writing…' : p.degree === 1 || p.relation === 'Connection' ? 'Ask for a referral' : 'Write a note'}<span className="sr-only"> to {p.name}</span>
                    </button>
                    <a className="btn btn-ghost btn-sm" href={safeHref(p.profileUrl) ?? undefined} target="_blank" rel="noopener noreferrer">LinkedIn ↗<span className="sr-only"> {p.name} (opens in a new tab)</span></a>
                    {p.source === 'Manual' && <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void remove(p)}>Remove<span className="sr-only"> {p.name}</span></button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {adding ? (
          <form className="stack-2" onSubmit={(e) => void add(e)} aria-label="Add a person">
            <div className="circle-form">
              <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
              <label className="field"><span>LinkedIn profile link</span><input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false} /></label>
              <label className="field"><span>Who they are</span>
                <select value={relation} onChange={(e) => setRelation(e.target.value as CircleRelation)}>{RELATIONS.map((r) => <option key={r.key} value={r.key}>{r[job ? 'job' : 'sales']}</option>)}</select>
              </label>
            </div>
            {formError && <p className="field-error" role="alert">{formError}</p>}
            <div className="row wrap">
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy !== null}>{busy === 'add' ? 'Adding…' : 'Add'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        ) : <div className="row wrap"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>Add someone you know there</button></div>}
        <details className="more-info"><summary>Details</summary><p className="muted-small">A note goes out only after you approve it. With the desktop agent, LinkedIn notes are sent from your own account (a dry run unless you switch sending on).</p></details>
      </div>
    </Card>
  )
}
