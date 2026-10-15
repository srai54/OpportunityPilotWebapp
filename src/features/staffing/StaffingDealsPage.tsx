import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { Card } from '../../components/cards'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { FORWARD, isClosed, money, percent, SOURCE_LABELS, STAGE_LABELS } from './staffingModel'
import { KpiBand, KpiCard } from '../../components/kpi/kpi'
import type { DealSource, DealStage, StaffingAccount, StaffingDeal, StaffingKpis } from './staffingTypes'

export function StaffingDealsPage() {
  const deals = useApi<StaffingDeal[]>('/api/v1/staffing/deals?take=200')
  const accounts = useApi<StaffingAccount[]>('/api/v1/staffing/accounts?take=200')
  const kpis = useApi<StaffingKpis>('/api/v1/staffing/kpis')
  const [stage, setStage] = useState<DealStage | ''>('')
  const [creating, setCreating] = useState(false)
  const [now] = useState(() => Date.now())

  const accountName = new Map((accounts.data ?? []).map((a) => [a.id, a.name]))
  const visible = (deals.data ?? []).filter((d) => !stage || d.stage === stage)
  const k = kpis.data

  function reload() { deals.reload(); accounts.reload(); kpis.reload() }

  return <div className="page page-wide stack-4">
    <PageHeader title="Staffing deals" subtitle="Requirement to signed placement."
      actions={<button className="btn btn-primary" type="button" onClick={() => setCreating((v) => !v)}>{creating ? 'Close' : '+ New deal'}</button>} />

    {deals.data && deals.data.length > 0 && (
      <Card title="By stage" subtitle={`${deals.data.length} ${deals.data.length === 1 ? 'deal' : 'deals'}, first contact to signed placement`}>
        <div className="stagebar" role="img" aria-label={`Deals by stage: ${[...FORWARD, 'OnHold', 'Lost', 'Disqualified'].map((s) => `${STAGE_LABELS[s as DealStage]} ${deals.data!.filter((d) => d.stage === s).length}`).join(', ')}`}>
          {[...FORWARD, 'OnHold', 'Lost', 'Disqualified'].map((s, i) => {
            const n = deals.data!.filter((d) => d.stage === s).length
            return n > 0 ? <i key={s} style={{ flex: n, background: `var(--op-seq-${(i % 5) + 1})` }} /> : null
          })}
        </div>
        <ul className="plain-list row wrap" aria-label="Stage legend">
          {[...FORWARD, 'OnHold', 'Lost', 'Disqualified'].map((s) => {
            const n = deals.data!.filter((d) => d.stage === s).length
            return n > 0 ? <li key={s} className="chip">{STAGE_LABELS[s as DealStage]} <strong>{n}</strong></li> : null
          })}
        </ul>
      </Card>
    )}

    {creating && <NewDealForm accounts={accounts.data ?? []} onCreated={() => { setCreating(false); reload() }} />}


    <section className="panel">
      <header className="panel-head">
        <h3 className="eyebrow">{visible.length} deals</h3><span className="grow" />
        <label className="pill-select"><span>Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as DealStage | '')}>
            <option value="">All</option>
            {[...FORWARD, 'OnHold', 'Lost', 'Disqualified'].map((s) => <option key={s} value={s}>{STAGE_LABELS[s as DealStage]}</option>)}
          </select>
        </label>
      </header>
      {deals.error ? <ErrorNotice error={deals.error} onRetry={deals.reload} what="deals" />
        : !deals.data ? <LoadingState label="Loading deals…" waking={deals.waking} />
        : deals.data.length === 0 ? <EmptyState title="No staffing deals yet">Create a deal for a client requirement, then add candidates, submissions and interviews to it.</EmptyState>
        : <div className="table-scroll"><table className="table">
          <thead><tr><th>Deal</th><th>Client</th><th>Stage</th><th>Source</th><th className="num">Value</th><th>Next action</th></tr></thead>
          <tbody>{visible.map((d) => {
            const overdue = d.nextActionAt && !isClosed(d.stage) && new Date(d.nextActionAt).getTime() < now
            return <tr key={d.id}>
              <td><Link to={`/staffing/deals/${d.id}`}><strong>{d.title}</strong></Link></td>
              <td>{accountName.get(d.accountId) ?? '—'}</td>
              <td><Badge tone={d.stage === 'Won' ? 'success' : isClosed(d.stage) ? 'neutral' : 'primary'}>{STAGE_LABELS[d.stage]}</Badge></td>
              <td>{SOURCE_LABELS[d.source]}</td>
              <td className="num op-numeric">{money(d.estimatedValue, d.currency)}</td>
              <td className={overdue ? 'text-danger' : undefined}>{d.nextAction ?? '—'}{d.nextActionAt ? ` · ${new Date(d.nextActionAt).toLocaleDateString()}` : ''}</td>
            </tr>
          })}</tbody>
        </table></div>}
    </section>

    {kpis.error ? <ErrorNotice error={kpis.error} onRetry={kpis.reload} what="staffing KPIs" /> : k && <section className="panel">
      <header className="panel-head"><h3 className="eyebrow">Funnel</h3><span className="grow" /><span className="muted-small">From stored records</span></header>
      <KpiBand six label="Staffing funnel">
        <KpiCard icon="projects" tone="blue" label="Open deals" value={k.openDeals} sub={k.overdueNextActions ? `${k.overdueNextActions} overdue` : 'none overdue'} />
        <KpiCard icon="outreach" tone="indigo" label="To send" value={k.messagesAwaitingSend} sub={`${k.repliesToClassify} replies · ${k.meetingsUpcoming} meetings`} to="/outreach" />
        <KpiCard icon="pay" tone="teal" label="Pipeline" value={k.openPipelineValue.map((m) => money(m.amount, m.currency)).join(' · ') || '—'} sub="open deals with a value" />
        <KpiCard icon="people" tone="amber" label="Submitted" value={k.submissionsSent} sub={`${k.submissionsApproved} approved · ${k.submissionsDraft} drafts`} />
        <KpiCard icon="calendar" tone="green" label="Interviews" value={k.interviewsUpcoming} sub={`upcoming · ${k.interviewsNotNotified} not told`} />
        <KpiCard icon="check" tone="neutral" label="Placements" value={k.placements} sub={`${k.offersExtended + k.offersAccepted} offers (${k.offersAccepted} accepted) · ${k.placementValue.map((m) => money(m.amount, m.currency)).join(' · ') || `${k.contractsSigned} signed`}`} />
      </KpiBand>
      <div className="panel-body">
        <details className="how-it-works"><summary>Stage-to-stage conversion</summary>
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Step</th><th className="num">Reached</th><th className="num">Then</th><th className="num">Conversion</th></tr></thead>
          <tbody>{k.conversions.map((c) => <tr key={c.from}>
            <td>{STAGE_LABELS[c.from as DealStage]} → {STAGE_LABELS[c.to as DealStage]}</td>
            <td className="num op-numeric">{c.fromCount}</td><td className="num op-numeric">{c.toCount}</td><td className="num op-numeric">{percent(c.rate)}</td>
          </tr>)}</tbody>
        </table></div>
        </details>
        <p className="muted-small">
          Average time in the current stage: {k.averageDaysInStage == null ? '—' : `${k.averageDaysInStage} days`}. Average time from contact to reply:{' '}
          {k.averageHoursToReply == null ? '—' : `${k.averageHoursToReply} hours`}. Candidates: {k.candidates} on the bench, {k.candidatesWithConsent} with consent, {k.candidatesAvailable} available.
        </p>
      </div>
    </section>}
  </div>
}

function NewDealForm({ accounts, onCreated }: { accounts: StaffingAccount[]; onCreated: () => void }) {
  const [accountId, setAccountId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState<DealSource>('Manual')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [nextAction, setNextAction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try {
      let id = accountId
      if (!id) {
        const created = await api<StaffingAccount>('/api/v1/staffing/accounts', { method: 'POST', body: JSON.stringify({ name: accountName.trim(), source: accountSource(source) }) })
        id = created.id
      }
      await api<StaffingDeal>(`/api/v1/staffing/accounts/${id}/deals`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), source, estimatedValue: value ? Number(value) : null, currency: value ? currency : null, nextAction: nextAction.trim() || null }),
      })
      onCreated()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  return <form className="panel stack-3" onSubmit={(e) => void submit(e)}>
    <header className="panel-head"><h3 className="eyebrow">New deal</h3></header>
    <div className="panel-body filters">
      <label className="field"><span>Client</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">New client…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      {!accountId && <label className="field"><span>Client name</span><input required value={accountName} maxLength={300} onChange={(e) => setAccountName(e.target.value)} placeholder="Acme Logistics" /></label>}
      <label className="field field-wide"><span>Requirement</span><input required value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="3 senior .NET engineers, 6 months" /></label>
      <label className="field"><span>Source</span><select value={source} onChange={(e) => setSource(e.target.value as DealSource)}>{Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="field"><span>Estimated value</span><input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} /></label>
      <label className="field"><span>Currency</span><input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
      <label className="field field-wide"><span>Next action</span><input value={nextAction} maxLength={500} onChange={(e) => setNextAction(e.target.value)} placeholder="Call the hiring manager" /></label>
    </div>
    {error && <ErrorNotice error={error} />}
    <div className="panel-foot"><button className="btn btn-primary" type="submit" disabled={busy || !title.trim() || (!accountId && !accountName.trim())}>{busy ? 'Creating…' : 'Create deal'}</button></div>
  </form>
}

/** A client only knows these sources; a deal from LinkedIn (assisted) creates a client recorded as found on the public web. */
function accountSource(source: DealSource): string {
  return ['Manual', 'Import', 'PublicWeb', 'Upwork', 'Freelancer', 'Tender', 'Referral'].includes(source) ? source : 'PublicWeb'
}
