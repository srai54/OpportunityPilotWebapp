import { useState, type FormEvent, type ReactNode } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { safeHref } from '../opportunities/opportunityModel'
import { COUNTRIES } from './allSitesModel'
import { SAVED_LEADS, SAVED_SEARCH } from './apolloSample'
import { leadSearchBody, SIZE_BANDS, sizeText, type Lead, type LeadKind, type LeadSearchResult } from './apolloModel'

/**
 * Sales: companies (or the people at them) from Apollo, by keyword, country and company size. Paid per result on the server's
 * RapidAPI plan, so it is signed-in only, 10 results a search and capped per day; nothing is saved until the person adds a lead.
 */
export function ApolloPanel({ tabs }: Readonly<{ tabs: ReactNode }>) {
  const [keywords, setKeywords] = useState('')
  const [titles, setTitles] = useState('')
  const [country, setCountry] = useState('')
  const [sizes, setSizes] = useState<string[]>([])
  const [kind, setKind] = useState<LeadKind>('people')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<LeadSearchResult | Error>()
  const [saved, setSaved] = useState(false)
  const body = leadSearchBody({ keywords, titles, country, sizes, kind })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body || busy) return
    setBusy(true); setSaved(false)
    setResult(await api<LeadSearchResult>('/api/v1/sales/lead-search', { method: 'POST', body: JSON.stringify(body) }).catch((err: Error) => err))
    setBusy(false)
  }
  const toggleSize = (v: string) => setSizes((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))
  const ok = result && !(result instanceof Error) ? result : undefined
  const people = kind === 'people'

  return <>
    <form className="search-hero" onSubmit={submit} aria-label="Search Apollo">
      {tabs}
      <div className="segmented" role="group" aria-label="Find">
        <button type="button" className={!people ? 'active' : ''} aria-pressed={!people} onClick={() => setKind('companies')}>Companies</button>
        <button type="button" className={people ? 'active' : ''} aria-pressed={people} onClick={() => setKind('people')}>People</button>
      </div>
      <div className="search-bar">
        <label className="search-field search-field-main"><span className="sr-only">Industry or keywords</span>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Industry or keywords, e.g. SaaS, fintech" /></label>
        {people && <label className="search-field"><span className="sr-only">Job titles</span>
          <input value={titles} onChange={(e) => setTitles(e.target.value)} placeholder="Titles, e.g. CTO, Head of Engineering" /></label>}
        <label className="search-field"><span className="sr-only">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Any country</option>
            <optgroup label="US">{COUNTRIES.filter((c) => c.group === 'US').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>
            <optgroup label="Europe">{COUNTRIES.filter((c) => c.group === 'Europe').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</optgroup></select></label>
        <button className="btn btn-primary" type="submit" disabled={busy || !body}>{busy ? 'Searching…' : 'Search Apollo'}</button>
      </div>
      <div className="search-tools row wrap" role="group" aria-label="Company size">
        {SIZE_BANDS.map((b) => <label key={b.value} className="chip-check"><input type="checkbox" checked={sizes.includes(b.value)} onChange={() => toggleSize(b.value)} /> {b.label}</label>)}
      </div>
      <p className="muted-small">Apollo is asked first (25 people, 25 paid credits, one search a day). If it has no credits or finds nothing, the backup source (Apify Leads Finder, up to 10 people) runs with the same filters, including company size. Remote and contract are not in this data; use All sites for those.</p>
    </form>

    {busy && <LoadingState label="Asking Apollo…" rows={3} />}
    {!busy && result instanceof Error && <ErrorNotice error={result} what="Apollo search" />}
    {!busy && !saved && (result instanceof Error || (ok && ok.status !== 'Ready')) && <Card tone="muted">
      {ok && <p>{ok.message ?? 'Apollo search is not available right now.'}</p>}
      <div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setSaved(true)}>Show saved results from {SAVED_SEARCH.when} (demo)</button></div>
    </Card>}
    {!busy && saved && <section className="stack-3" aria-label="Saved Apollo results">
      <Card tone="muted" title={`Saved results: ${SAVED_SEARCH.what}`} subtitle={`Not live. ${SAVED_LEADS.length} of ${SAVED_SEARCH.total.toLocaleString()} matches from a real Apollo search on ${SAVED_SEARCH.when}. Names are hidden in this demo; live searches show them.`}
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaved(false)}>Hide</button>} />
      <LeadTable leads={SAVED_LEADS} people />
    </section>}
    {!busy && ok?.status === 'Ready' && <section className="stack-3" aria-label="Apollo results">
      <Card tone="muted" title={`${ok.leads.length} ${people ? (ok.leads.length === 1 ? 'person' : 'people') : (ok.leads.length === 1 ? 'company' : 'companies')} from ${ok.leads[0]?.source ?? 'Apollo'}`}
        subtitle={ok.message ?? (ok.hidden > 0 ? `${ok.hidden} more ${ok.hidden === 1 ? 'was' : 'were'} outside the sizes you picked and ${ok.hidden === 1 ? 'is' : 'are'} hidden.` : 'Company data is shown as the source gave it.')} />
      {ok.leads.length === 0 ? <Card tone="muted"><p>Nothing matched. Try fewer words, another country or more sizes.</p></Card>
        : <LeadTable leads={ok.leads} people={people} />}
    </section>}
  </>
}

function LeadTable({ leads, people }: Readonly<{ leads: readonly Lead[]; people: boolean }>) {
  return <div className="table-scroll" role="region" aria-label="Apollo results table" tabIndex={0}><table className="table"><thead><tr>
    <th>{people ? 'Person' : 'Company'}</th>{people && <th>Title</th>}{people && <th>Company</th>}<th>Size</th><th>Location</th><th>Links</th>
  </tr></thead><tbody>{leads.map((l, i) => <tr key={`${l.name}-${l.company}-${i}`}>
    <td>{l.name}</td>{people && <td>{l.title ?? '—'}</td>}{people && <td>{l.company ?? '—'}</td>}
    <td className="op-num">{sizeText(l)}</td><td>{l.location ?? '—'}</td>
    <td><div className="row wrap">
      {safeHref(l.website) && <a className="btn btn-ghost btn-sm" href={safeHref(l.website)!} target="_blank" rel="noopener noreferrer">Website ↗<span className="sr-only"> of {l.company ?? l.name}</span></a>}
      {safeHref(l.linkedIn) && <a className="btn btn-ghost btn-sm" href={safeHref(l.linkedIn)!} target="_blank" rel="noopener noreferrer">LinkedIn ↗<span className="sr-only"> of {l.company ?? l.name}</span></a>}
    </div></td>
  </tr>)}</tbody></table></div>
}
