import { useEffect, useState } from 'react'
import { composerTarget, unresolvedPlaceholder } from './composer'
import { useShell } from '../shell/ShellContext'
import { SendPanel } from './SendPanel'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { BatchApproveDraftResult, DraftChannel, DraftListItem, DraftPage, DraftState, OutreachDraft } from '../../lib/types'
import { useApi } from '../../lib/useApi'

export function OutreachPage() {
  const drafts = useApi<DraftPage>('/api/v1/drafts?take=200')
  const [selected, setSelected] = useState<OutreachDraft>()
  const [checked, setChecked] = useState<string[]>([])
  const [channel, setChannel] = useState<DraftChannel | ''>('')
  const [state, setState] = useState<DraftState | ''>('')
  const [campaignId, setCampaignId] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<Error>()
  const [notice, setNotice] = useState('')
  const [sendTick, setSendTick] = useState(0)
  const { advanced } = useShell()
  const [adv, setAdv] = useState(advanced)

  const items = drafts.data?.items ?? []
  const filtered = items.filter((item) =>
    (!channel || item.channel === channel) && (!state || item.state === state) && (!campaignId || item.campaignId === campaignId))
  const eligible = filtered.filter((item) => item.state === 'Draft')
  const campaigns = [...new Map(items.map((item) => [item.campaignId, item.campaignName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))

  const [params] = useSearchParams()
  const wanted = params.get('draft')
  const firstId = (wanted && filtered.some((d) => d.id === wanted) ? wanted : null) ?? filtered[0]?.id
  useEffect(() => {
    if (!selected && firstId) void open({ id: firstId })
    // Opens the first draft once the list arrives so the editor is never an empty pane.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [firstId, selected])

  async function open(item: Pick<DraftListItem, 'id'>) {
    setError(undefined); setNotice('')
    try {
      const row = await api<OutreachDraft>(`/api/v1/drafts/${item.id}`)
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? '')
    } catch (e) { setError(e as Error) }
  }

  async function mutate(action: 'save' | 'approve' | 'revoke') {
    if (!selected) return
    setWorking(true); setError(undefined); setNotice('')
    try {
      const path = action === 'save' ? `/api/v1/drafts/${selected.id}` : `/api/v1/drafts/${selected.id}/${action === 'approve' ? 'approve' : 'revoke-approval'}`
      const init = action === 'save'
        ? { method: 'PUT', body: JSON.stringify({ recipient: recipient || null, subject: subject || null, body, expectedVersion: selected.version }) }
        : { method: 'POST', ...(action === 'approve' ? { body: JSON.stringify({ version: selected.version }) } : {}) }
      const row = await api<OutreachDraft>(path, init)
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? ''); drafts.reload()
    } catch (e) { setError(e as Error) }
    finally { setWorking(false) }
  }

  function toggle(id: string) {
    setChecked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function approveSelected() {
    const chosen = items.filter((item) => checked.includes(item.id))
    if (chosen.length === 0) return
    setWorking(true); setError(undefined); setNotice('')
    try {
      const results = await api<BatchApproveDraftResult[]>('/api/v1/drafts/batch-approve', {
        method: 'POST', body: JSON.stringify({ items: chosen.map((item) => ({ id: item.id, version: item.version })) }),
      })
      const approved = results.filter((result) => result.approved).length
      const stale = results.filter((result) => !result.approved && /stale|changed elsewhere|version/i.test(result.reason ?? '')).length
      const skipped = results.length - approved - stale
      setNotice(`${approved} approved · ${skipped} skipped · ${stale} stale`)
      setChecked([]); setSelected(undefined); drafts.reload()
    } catch (e) { setError(e as Error) }
    finally { setWorking(false) }
  }

  /** One click: save edits, approve this exact version, start the send record, then open the composer. The user sends and records a receipt. */
  async function approveAndSend() {
    if (!selected) return
    const left = unresolvedPlaceholder(body, subject)
    if (left) { setError(undefined); setNotice(`Replace ${left} in the message first — a draft with a placeholder cannot be approved.`); return }
    const target = composerTarget(selected.channel, { recipient, subject, body })
    // Open the tab inside the click so the browser does not block it; point it at the site once the server calls finish.
    const tab = target.kind === 'site' ? window.open('about:blank', '_blank') : null
    if (tab) tab.opener = null
    setWorking(true); setError(undefined); setNotice('')
    try {
      let row = selected
      const dirty = body !== row.body || recipient !== (row.recipient ?? '') || subject !== (row.subject ?? '')
      if (dirty) row = await api<OutreachDraft>(`/api/v1/drafts/${row.id}`, { method: 'PUT', body: JSON.stringify({ recipient: recipient || null, subject: subject || null, body, expectedVersion: row.version }) })
      if (row.state === 'Draft') row = await api<OutreachDraft>(`/api/v1/drafts/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ version: row.version }) })
      await api(`/api/v1/executions/drafts/${row.id}`, { method: 'POST', body: JSON.stringify({ version: row.version }) })
      if (target.copy) await navigator.clipboard.writeText(row.body).catch(() => undefined)
      if (target.kind === 'mailto' && target.url) window.location.href = target.url
      else if (tab && target.url) tab.location.href = target.url
      else tab?.close()
      setNotice(`${target.label}. Send it there, then paste a receipt below and click "I sent it".`)
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? ''); setSendTick((n) => n + 1); drafts.reload()
    } catch (e) { tab?.close(); setError(e as Error) }
    finally { setWorking(false) }
  }

  async function copyDraft() {
    if (!selected) return
    setError(undefined); setNotice('')
    try {
      await navigator.clipboard.writeText(body)
      await api(`/api/v1/opportunities/${selected.opportunityId}/activities`, {
        method: 'POST', body: JSON.stringify({ kind: 'Note', detail: `Copied ${selected.channel} draft version ${selected.version} for manual use.`, occurredAt: null }),
      })
      setNotice('Draft copied and recorded in the opportunity activity.')
    } catch (e) { setError(e as Error) }
  }

  return <div className="page page-wide stack-4">
    <PageHeader title="Outreach" subtitle="Review every message, edit it safely, and approve the exact version you intend to use." />
    {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
    {error && <ErrorNotice error={error} onRetry={() => setError(undefined)} what="the draft" />}
    {drafts.error && <ErrorNotice error={drafts.error} onRetry={drafts.reload} what="outreach drafts" />}
    {drafts.loading && !drafts.data && <LoadingState label="Loading outreach drafts…" waking={drafts.waking} rows={4} />}
    {drafts.data?.items.length === 0 && <EmptyState title="No outreach drafts yet"><p>Open an opportunity and create a cover note, email, LinkedIn message, or contact-form draft.</p><Link className="btn btn-primary" to="/opportunities">Browse opportunities</Link></EmptyState>}
    {drafts.data && drafts.data.items.length > 0 && <div className="outreach-grid">
      <section className="panel"><header className="panel-head"><h2 className="eyebrow">Draft inbox</h2><span className="grow" /><span className="muted-small">{filtered.length} shown · {drafts.data.total} total</span></header>
        <div className="panel-body"><button type="button" className="btn btn-ghost btn-sm" aria-expanded={adv} onClick={() => setAdv(!adv)}>{adv ? 'Hide advanced' : 'Advanced: filters, batch approve'}</button></div>
        {adv && (
        <div className="panel-body filters outreach-filters">
          <label className="field"><span>Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value as DraftChannel | '')}><option value="">All channels</option><option value="Email">Email</option><option value="CoverNote">Cover note</option><option value="LinkedInMessage">LinkedIn</option><option value="ContactForm">Contact form</option></select></label>
          <label className="field"><span>State</span><select value={state} onChange={(event) => setState(event.target.value as DraftState | '')}><option value="">All states</option><option value="Draft">Draft</option><option value="Approved">Approved</option><option value="Sent">Sent</option></select></label>
          <label className="field"><span>Campaign</span><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">All campaigns</option>{campaigns.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
          <div className="row wrap outreach-batch"><button className="btn btn-secondary btn-sm" type="button" disabled={eligible.length === 0} onClick={() => setChecked(eligible.map((item) => item.id))}>Select {eligible.length} eligible</button><button className="btn btn-primary btn-sm" type="button" disabled={working || checked.length === 0} onClick={approveSelected}>Approve selected ({checked.length})</button></div>
        </div>
        )}
        {filtered.length === 0 ? <div className="panel-body muted">No drafts match these filters.</div> : <ul className="inbox-list">{filtered.map((item) => <li className="inbox-row" key={item.id}>
{adv &&           <label className="inbox-check"><input type="checkbox" checked={checked.includes(item.id)} disabled={item.state !== 'Draft'} onChange={() => toggle(item.id)} /><span className="sr-only">Select {item.opportunityTitle} version {item.version}</span></label>}
          <button type="button" className={selected?.id === item.id ? 'inbox-item is-selected' : 'inbox-item'} onClick={() => open(item)}>
            <span><strong>{item.opportunityTitle}</strong><small>{item.organization || 'Unknown organisation'} · {item.campaignName} · {item.channel}</small>{item.recipient && <small>{item.recipientVerified ? 'Verified recipient' : 'Unverified recipient'}</small>}</span>
            <Badge tone={item.state === 'Sent' ? 'success' : item.state === 'Approved' ? 'primary' : 'warning'}>{item.state}</Badge>
          </button>
        </li>)}</ul>}
      </section>
      <section className="panel"><header className="panel-head"><h2 className="eyebrow">Editor</h2></header>
        {!selected ? <div className="panel-body muted">Select a draft to review it.</div> : <div className="panel-body stack-3">
          <div className="row wrap"><Badge>{selected.channel}</Badge><Badge tone={selected.state === 'Approved' ? 'success' : 'warning'}>{selected.state} · v{selected.version}</Badge><Link to={`/opportunities/${selected.opportunityId}`}>Open opportunity</Link></div>
          <label className="field"><span>Recipient</span><input value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={320} /><small>{selected.recipientVerified ? `Verified from stored evidence${selected.recipientEvidenceId ? ` · ${selected.recipientEvidenceId}` : ''}.` : 'User-entered recipient · not verified.'}</small></label>
          {selected.channel === 'Email' && <label className="field"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} /></label>}
          <label className="field" data-coach="out-editor"><span>Message</span><textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} /></label>
          {selected.channel === 'LinkedInMessage' && <p className={`muted-small${body.length > 300 ? ' text-danger' : ''}`}>
            {body.length}/300 characters — a LinkedIn connection note is short{body.length > 300 ? ' (LinkedIn will cut it)' : ''}. After they accept, <Link to={`/opportunities/${selected.opportunityId}`}>create the follow-up email</Link> and send it the same way.
          </p>}
          {selected.sendBlockers.length > 0 && <ul className="hint-list">{selected.sendBlockers.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="row wrap"><button className="btn btn-secondary" type="button" disabled={working || !body.trim()} onClick={() => mutate('save')}>Save new version</button>
            {selected.state === 'Sent' ? null : selected.state === 'Approved' ? <button className="btn btn-secondary" type="button" disabled={working} onClick={() => mutate('revoke')}>Revoke approval</button> : <button className="btn btn-primary" type="button" disabled={working || !body.trim()} onClick={() => mutate('approve')}>Approve version {selected.version}</button>}
            {selected.state === 'Draft' && <button className="btn btn-primary" type="button" data-coach="out-send" disabled={working || !body.trim()} onClick={() => void approveAndSend()}>Approve &amp; send →</button>}
            <button className="btn btn-secondary" type="button" disabled={working} onClick={copyDraft}>Copy text</button></div>
          <SendPanel key={`${selected.id}:${sendTick}`} draftId={selected.id} version={selected.version} state={selected.state} onChange={() => { drafts.reload(); void open(selected) }} />
        </div>}
      </section>
    </div>}
  </div>
}
