import { useEffect, useState } from 'react'
import { composerTarget, MAIL_APPS, readMailApp, readyChecks, writeMailApp, type MailApp } from './composer'
import { useShell } from '../shell/ShellContext'
import { ContactFinder } from './ContactFinder'
import { PrepareEmailsCard } from './PrepareEmailsCard'
import { LinkedInQueueCard } from './LinkedInQueueCard'
import { RewriteBox } from './RewriteBox'
import { SendAllCard } from './SendAllCard'
import { SendPanel } from './SendPanel'
import { Link, useSearchParams } from 'react-router-dom'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import { Card, CardList, MessageCard } from '../../components/cards'
import { parseQueue, queuePath } from '../opportunities/bulkDraft'
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
  async function removeDraft() {
    if (!selected || !window.confirm('Delete this message? A sent message stays on record in the lead history.')) return
    try { await api<void>(`/api/v1/drafts/${selected.id}`, { method: 'DELETE' }); setSelected(undefined); drafts.reload(); setNotice('Message deleted.') } catch (e) { setError(e as Error) }
  }
  const [loadError, setLoadError] = useState(false)
  const [tried, setTried] = useState(false)
  const [mailApp, setMailAppState] = useState<MailApp>(readMailApp)
  const setMailApp = (m: MailApp) => { setMailAppState(m); writeMailApp(m) }
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
  const [sendOpen, setSendOpen] = useState(false)
  const { advanced, workspace } = useShell()
  const sales = workspace === 'sales'
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
    setError(undefined); setNotice(''); setLoadError(false); setTried(false)
    try {
      const row = await api<OutreachDraft>(`/api/v1/drafts/${item.id}`)
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? '')
    } catch (e) { setLoadError(true); setError(e as Error) }
  }

  const checks = selected ? readyChecks(selected.channel, { recipient, subject, body }) : []
  /** Tell the person what is missing, point at the first field to fix, and stop before a server round trip. */
  function blocked(): boolean {
    const first = checks.find((c) => !c.ok)
    if (!first) return false
    setTried(true); setError(undefined)
    setNotice(`Before this can be approved: ${first.fix}`)
    document.getElementById(`out-${first.field}`)?.focus()
    return true
  }

  async function mutate(action: 'save' | 'approve' | 'revoke') {
    if (!selected) return
    if (action === 'approve' && blocked()) return
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
    if (blocked()) return
    const target = composerTarget(selected.channel, { recipient, subject, body }, mailApp)
    // Open the tab inside the click so the browser does not block it; point it at the site once the server calls finish.
    const tab = target.kind === 'site' ? window.open('about:blank', '_blank') : null
    if (tab) tab.opener = null
    setWorking(true); setError(undefined); setNotice('')
    try {
      let row = selected
      const dirty = body !== row.body || recipient !== (row.recipient ?? '') || subject !== (row.subject ?? '')
      if (dirty) row = await api<OutreachDraft>(`/api/v1/drafts/${row.id}`, { method: 'PUT', body: JSON.stringify({ recipient: recipient || null, subject: subject || null, body, expectedVersion: row.version }) })
      if (row.state === 'Draft') row = await api<OutreachDraft>(`/api/v1/drafts/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ version: row.version }) })
      const started = await api<{ state: string; reused: boolean }>(`/api/v1/executions/drafts/${row.id}`, { method: 'POST', body: JSON.stringify({ version: row.version }) })
      if (started.reused && started.state === 'Succeeded') {
        // Exactly these words were already sent: the app will not record a duplicate send. Change something to send another.
        tab?.close()
        setNotice('This exact message was already sent. Change a few words (or the recipient) to send another one.')
        setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? ''); drafts.reload()
        return
      }
      if (target.copy) await navigator.clipboard.writeText(row.body).catch(() => undefined)
      if (target.kind === 'mailto' && target.url) window.location.href = target.url
      else if (tab && target.url) tab.location.href = target.url
      else tab?.close()
      setNotice(`${target.label}. Press Send there, then come back and click "I pressed Send".`)
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? ''); setSendTick((n) => n + 1); drafts.reload()
    } catch (e) { tab?.close(); setError(e as Error) }
    finally { setWorking(false) }
  }

  /** Open the mail app (or the site) again for a message whose send is already started. Starts nothing new, so nothing can be recorded twice. */
  async function openAgain() {
    if (!selected) return
    const target = composerTarget(selected.channel, { recipient: selected.recipient ?? recipient, subject: selected.subject ?? subject, body: selected.body }, mailApp)
    if (target.copy) await navigator.clipboard.writeText(selected.body).catch(() => undefined)
    if (target.kind === 'mailto' && target.url) window.location.href = target.url
    else if (target.url) window.open(target.url, '_blank', 'noopener')
    setNotice(`${target.label}. Press Send there, then come back and click "I pressed Send".`)
  }

  /**
   * Send the same message on another channel: reuse this lead's unsent draft of that channel, or write a new one. The person
   * reviews it before it goes anywhere.
   */
  async function switchChannel(to: 'Email' | 'LinkedInMessage') {
    if (!selected) return
    setError(undefined)
    const existing = items.find((d) => d.opportunityId === selected.opportunityId && d.channel === to && d.state !== 'Sent')
    try {
      const row = existing
        ? await api<OutreachDraft>(`/api/v1/drafts/${existing.id}`)
        : await api<OutreachDraft>(`/api/v1/opportunities/${selected.opportunityId}/drafts`, { method: 'POST', body: JSON.stringify({ channel: to, recipient: null }) })
      drafts.reload()
      setSelected(row); setBody(row.body); setRecipient(row.recipient ?? ''); setSubject(row.subject ?? ''); setTried(false)
      setNotice(to === 'Email' ? 'Email ready. Add the address (or use Find a contact), check it, then Approve & send.' : 'LinkedIn note ready (300 characters). Check it, then Approve & send opens LinkedIn.')
    } catch (e) { setError(e as Error) }
  }

  /** A sent message cannot change, so "edit and send again" reopens it as a new editable version (the earlier send stays on record). */
  async function resendAsNew() {
    if (!selected) return
    setWorking(true); setError(undefined); setNotice('')
    try {
      const copy = await api<OutreachDraft>(`/api/v1/drafts/${selected.id}/reopen`, { method: 'POST' })
      drafts.reload()
      setSelected(copy); setBody(copy.body); setRecipient(copy.recipient ?? ''); setSubject(copy.subject ?? ''); setTried(false)
      setNotice('Ready to edit. Change what you need, then Approve & send. The earlier send stays on record.')
    } catch (e) { setError(e as Error) } finally { setWorking(false) }
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

  // Send queue: ?queue=id1,id2,… steps through several drafts, one at a time.
  const queueIds = parseQueue(params.get('queue')).filter((id) => items.some((d) => d.id === id) || !drafts.data)
  const position = selected ? queueIds.indexOf(selected.id) : -1
  const inQueue = position >= 0
  const goTo = (id: string | undefined) => { if (id) void open({ id }) }
  const nextInQueue = () => goTo(queueIds[position + 1])
  const readyToSend = items.filter((d) => d.state === 'Draft' || d.state === 'Approved')
  const stateOf = (st: DraftState) => ({ text: st === 'Draft' ? 'To send' : st, tone: st === 'Sent' ? 'success' : st === 'Approved' ? 'primary' : 'warning' })
  const appLabel = MAIL_APPS.find((m) => m.value === mailApp)?.label.split(' —')[0]

  return <div className="page page-wide stack-4">
    <PageHeader title="Outreach" subtitle="Review, send, track. Nothing leaves without your OK." />
    {drafts.data && drafts.data.items.length > 0 && (
      <KpiBand label="Your messages">
        <KpiCard icon="outreach" tone="amber" label="To review" value={items.filter((d) => d.state === 'Draft').length} sub="drafts waiting for you" />
        <KpiCard icon="approvals" tone="green" label="Approved" value={items.filter((d) => d.state === 'Approved').length} sub="ready for you to send" />
        <KpiCard icon="mail" tone="indigo" label="Sent by you" value={items.filter((d) => d.state === 'Sent').length} sub="recorded as sent" />
        <KpiCard icon="trend" tone="teal" label="Reply rate" value="—" sub="Replies found in your inbox show on Follow-ups" to="/follow-ups" />
      </KpiBand>
    )}
    {notice && <p className="notice" role="status" aria-live="polite">{notice}</p>}
    {error && (loadError
      ? <ErrorNotice error={error} onRetry={() => { setError(undefined); setLoadError(false) }} what="the draft" />
      : <ErrorNotice error={error} />)}
    {drafts.error && <ErrorNotice error={drafts.error} onRetry={drafts.reload} what="outreach drafts" />}
    {drafts.loading && !drafts.data && <LoadingState label="Loading outreach drafts…" waking={drafts.waking} rows={4} />}
    {sales && drafts.data && <PrepareEmailsCard onDone={drafts.reload} primary={drafts.data.items.length === 0} />}
    {sales && <LinkedInQueueCard signOff={null} />}
    {drafts.data?.items.length === 0 && <EmptyState title="No messages yet" actions={<Link className="btn btn-primary" to="/opportunities">Choose who to contact</Link>}><p>Select one or several leads and press Draft messages, or open one and press Reach out.</p></EmptyState>}

    {drafts.data && drafts.data.items.length > 0 && <>
      {inQueue ? (
        <Card tone="signature" coach="out-queue" title={`Send queue · message ${position + 1} of ${queueIds.length}`}
          subtitle="Check recipient, approve, send — then the next one."
          actions={<>
            <button type="button" className="btn btn-secondary btn-sm" disabled={position === 0} onClick={() => goTo(queueIds[position - 1])}>← Back</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={position >= queueIds.length - 1} onClick={nextInQueue}>Skip →</button>
            <Link className="btn btn-ghost btn-sm" to="/outreach">Leave queue</Link>
          </>}>
          <div className="queue-dots" role="img" aria-label={`Message ${position + 1} of ${queueIds.length}`}>
            {queueIds.map((id, i) => <i key={id} className={i < position ? 'is-done' : i === position ? 'is-now' : ''} />)}
          </div>
        </Card>
      ) : readyToSend.length >= 2 && (
        <Card tone="signature" title={`${readyToSend.length} messages are ready to send`} subtitle="Step through them one by one: check, send, next."
          actions={<Link className="btn btn-primary" to={queuePath(readyToSend.map((d) => d.id))}>Start send queue</Link>} />
      )}

      <SendAllCard items={items} onDone={drafts.reload} />

      <div className="outreach-cards">
        <section className="stack-3" aria-label="Messages">
          <div className="row wrap">
            <h2 className="eyebrow">Messages · {filtered.length}</h2>
            <span className="grow" />
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={adv} onClick={() => setAdv(!adv)}>{adv ? 'Hide filters' : 'Filters & bulk approve'}</button>
          </div>
          {adv && (
            <Card tone="muted">
              <div className="filters outreach-filters">
                <label className="field"><span>Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value as DraftChannel | '')}><option value="">All channels</option><option value="Email">Email</option><option value="CoverNote">Cover note</option><option value="LinkedInMessage">LinkedIn</option><option value="ContactForm">Contact form</option></select></label>
                <label className="field"><span>State</span><select value={state} onChange={(event) => setState(event.target.value as DraftState | '')}><option value="">All states</option><option value="Draft">To send</option><option value="Approved">Approved</option><option value="Sent">Sent</option></select></label>
                <label className="field"><span>Campaign</span><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">All campaigns</option>{campaigns.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
                <div className="row wrap outreach-batch"><button className="btn btn-secondary btn-sm" type="button" disabled={eligible.length === 0} onClick={() => setChecked(eligible.map((item) => item.id))}>Select {eligible.length} to send</button><button className="btn btn-primary btn-sm" type="button" disabled={working || checked.length === 0} onClick={approveSelected}>Approve selected ({checked.length})</button></div>
              </div>
            </Card>
          )}
          {filtered.length === 0 ? <p className="muted">No messages match these filters.</p> : (
            <CardList label="Messages">
              {filtered.map((item) => (
                <MessageCard
                  key={item.id}
                  company={item.organization || item.opportunityTitle}
                  title={item.opportunityTitle}
                  channel={item.channel === 'LinkedInMessage' ? 'LinkedIn' : item.channel === 'CoverNote' ? 'Cover note' : item.channel === 'ContactForm' ? 'Contact form' : item.channel}
                  recipient={item.recipient}
                  state={stateOf(item.state)}
                  open={selected?.id === item.id}
                  onOpen={() => void open(item)}
                  position={queueIds.includes(item.id) ? `${queueIds.indexOf(item.id) + 1} of ${queueIds.length}` : undefined}
                  checked={checked.includes(item.id)}
                  onCheck={adv && item.state === 'Draft' ? () => toggle(item.id) : undefined}
                  checkLabel={`Select ${item.opportunityTitle} version ${item.version}`}
                />
              ))}
            </CardList>
          )}
        </section>

        <div className="stack-3">
          {!selected ? <Card tone="muted"><p className="muted">Choose a message to review it.</p></Card> : <>
            <Card
              title={selected.channel === 'LinkedInMessage' ? 'LinkedIn note' : selected.channel === 'Email' ? 'Email' : selected.channel === 'CoverNote' ? 'Cover note' : 'Contact form message'}
              subtitle={<><Badge tone={selected.state === 'Sent' ? 'success' : selected.state === 'Approved' ? 'primary' : 'warning'}>{selected.state === 'Draft' ? 'To send' : selected.state} · v{selected.version}</Badge> <Link to={`/opportunities/${selected.opportunityId}`}>Open {sales ? 'lead' : 'job'}</Link></>}
            >
              <label className="field"><span>To</span><input id="out-recipient" readOnly={selected.state === 'Sent'} value={recipient} aria-invalid={tried && checks.some((c) => c.field === 'recipient' && !c.ok) ? true : undefined} onChange={(e) => setRecipient(e.target.value)} maxLength={320} placeholder={selected.channel === 'Email' ? 'name@company.com' : undefined} /><small>{selected.recipientVerified ? `Verified from stored evidence${selected.recipientEvidenceId ? ` · ${selected.recipientEvidenceId}` : ''}.` : 'Typed by you · not verified.'}</small></label>
              {selected.channel === 'Email' && selected.state !== 'Sent' && <ContactFinder opportunityId={selected.opportunityId} onUse={setRecipient} />}
              {selected.channel === 'Email' && <label className="field"><span>Subject</span><input id="out-subject" readOnly={selected.state === 'Sent'} value={subject} aria-invalid={tried && checks.some((c) => c.field === 'subject' && !c.ok) ? true : undefined} onChange={(e) => setSubject(e.target.value)} maxLength={300} /></label>}
              <label className="field" data-coach="out-editor"><span>Message</span><textarea id="out-body" rows={12} readOnly={selected.state === 'Sent'} value={body} aria-invalid={tried && checks.some((c) => c.field === 'body' && !c.ok) ? true : undefined} onChange={(e) => setBody(e.target.value)} maxLength={10000} /></label>
              {selected.state === 'Draft' && <RewriteBox draftId={selected.id} version={selected.version}
                dirty={body !== selected.body || recipient !== (selected.recipient ?? '') || subject !== (selected.subject ?? '')}
                onUse={(x) => { setBody(x.body); if (x.subject) setSubject(x.subject); setNotice('Rewrite placed in the editor. Read it, then Save or Approve & send.') }} />}
              {selected.state !== 'Sent' && <ul className="ready-list" aria-label="Before you send" data-coach="out-checks">
                {checks.map((c) => <li key={c.label}>{c.ok
                  ? <span className="ready-chip is-ok"><span aria-hidden="true">✓</span> {c.label}</span>
                  : <button type="button" className="ready-chip is-todo" onClick={() => { setTried(true); document.getElementById(`out-${c.field}`)?.focus() }} title={c.fix}><span aria-hidden="true">○</span> {c.label}<span className="sr-only"> — {c.fix}</span></button>}</li>)}
              </ul>}
              {tried && checks.filter((c) => !c.ok).map((c) => <p key={c.label} className="field-error">{c.fix}</p>)}
              {selected.channel === 'LinkedInMessage' && <p className={`muted-small${body.length > 300 ? ' text-danger' : ''}`}>
                {body.length}/300 characters — a LinkedIn connection note is short{body.length > 300 ? ' (LinkedIn will cut it)' : ''}. After they accept, <Link to={`/opportunities/${selected.opportunityId}`}>create the follow-up email</Link> and send it the same way.
              </p>}
              {advanced && selected.state !== 'Sent' && selected.sendBlockers.length > 0 && <ul className="hint-list">{selected.sendBlockers.map((x) => <li key={x}>{x}</li>)}</ul>}
            </Card>

            {selected.state === 'Sent' ? (
              <Card tone="signature" coach="out-resend" title="Sent" subtitle="Sent and locked. Edit and send again to follow up."
                footer={<>
                  <button className="btn btn-primary" type="button" disabled={working} onClick={() => void resendAsNew()}>{working ? 'Reopening…' : 'Edit & send again'}</button>
                  <Link className="btn btn-ghost" to="/follow-ups">See my follow-up reminder</Link>
                  {inQueue && position < queueIds.length - 1 && <button type="button" className="btn btn-secondary" onClick={nextInQueue}>Next message →</button>}
                </>}>
                <SendPanel key={`${selected.id}:${sendTick}`} draftId={selected.id} version={selected.version} state={selected.state} appLabel={appLabel} onChange={() => { drafts.reload() }} />
              </Card>
            ) : (
              <Card tone="signature" title={selected.state === 'Approved' ? 'Ready: send it' : 'Send it'} coach="out-send-card">
                {selected.channel === 'Email' && <label className="field" data-coach="out-mailapp"><span>Open email in</span>
                  <select value={mailApp} onChange={(e) => setMailApp(e.target.value as MailApp)}>{MAIL_APPS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                  <span className="hint">{MAIL_APPS.find((m) => m.value === mailApp)?.hint} You press Send there.</span></label>}
                <div className="row wrap">
                  {!sendOpen && <button className="btn btn-primary btn-lg" type="button" data-coach="out-send" disabled={working || !body.trim()} onClick={() => void approveAndSend()}>{working ? 'Opening…' : selected.state === 'Draft' ? 'Approve & send →' : 'Open to send →'}</button>}
                  <button className="btn btn-secondary" type="button" disabled={working || !body.trim()} onClick={() => mutate('save')}>Save</button>
                  {selected.state === 'Approved' ? <button className="btn btn-ghost" type="button" disabled={working} onClick={() => mutate('revoke')}>Revoke approval</button> : <button className="btn btn-ghost" type="button" disabled={working || !body.trim()} onClick={() => mutate('approve')}>Approve only</button>}
                  <button className="btn btn-ghost" type="button" disabled={working} onClick={copyDraft}>Copy text</button>
                  <button className="btn btn-ghost text-danger" type="button" disabled={working} onClick={() => void removeDraft()}>Delete</button>
                </div>
                <SendPanel key={`${selected.id}:${sendTick}`} draftId={selected.id} version={selected.version} state={selected.state} appLabel={selected.channel === 'Email' ? appLabel : 'LinkedIn'} onOpenAgain={() => void openAgain()}
                  channel={selected.channel} onSwitchChannel={(to) => void switchChannel(to)} onPending={setSendOpen}
                  onChange={() => { drafts.reload(); void open(selected) }}
                  onSent={() => { if (inQueue && position < queueIds.length - 1) setTimeout(nextInQueue, 600) }} />
              </Card>
            )}
          </>}
        </div>
      </div>
    </>}
  </div>
}
