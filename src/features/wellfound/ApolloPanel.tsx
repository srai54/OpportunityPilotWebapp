import { useState, type FormEvent, type ReactNode } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { safeHref } from '../opportunities/opportunityModel'
import { COUNTRIES } from './allSitesModel'
import { leadSearchBody, SIZE_BANDS, sizeText, type LeadKind, type LeadSearchResult } from './apolloModel'

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
  const body = leadSearchBody({ keywords, titles, country, sizes, kind })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body || busy) return
    setBusy(true)
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
        {SIZE_BANDS.map((b) => <label key={b.value} className="chip-check" title="Not available with the current Apollo plan"><input type="checkbox" disabled checked={sizes.includes(b.value)} onChange={() => toggleSize(b.value)} /> {b.label}</label>)}
      </div>
      <p className="muted-small">Each search returns 25 people and uses 25 paid credits (one search a day). Company size is not available with the current Apollo plan; remote and contract are not in Apollo's data, use All sites for those.</p>
    </form>

    {busy && <LoadingState label="Asking Apollo…" rows={3} />}
    {!busy && result instanceof Error && <ErrorNotice error={result} what="Apollo search" />}
    {!busy && ok && ok.status !== 'Ready' && <Card tone="muted"><p>{ok.message ?? 'Apollo search is not available right now.'}</p></Card>}
    {!busy && ok?.status === 'Ready' && <section className="stack-3" aria-label="Apollo results">
      <Card tone="muted" title={`${ok.leads.length} ${people ? (ok.leads.length === 1 ? 'person' : 'people') : (ok.leads.length === 1 ? 'company' : 'companies')} from Apollo`}
        subtitle={ok.hidden > 0 ? `${ok.hidden} more ${ok.hidden === 1 ? 'was' : 'were'} outside the sizes you picked and ${ok.hidden === 1 ? 'is' : 'are'} hidden.` : 'Company data is Apollo\'s, shown as it came.'} />
      {ok.leads.length === 0 ? <Card tone="muted"><p>Nothing matched. Try fewer words, another country or more sizes.</p></Card>
        : <div className="table-scroll" role="region" aria-label="Apollo results table" tabIndex={0}><table className="table"><thead><tr>
          <th>{people ? 'Person' : 'Company'}</th>{people && <th>Title</th>}{people && <th>Company</th>}<th>Size</th><th>Location</th><th>Links</th>
        </tr></thead><tbody>{ok.leads.map((l, i) => <tr key={`${l.name}-${i}`}>
          <td>{l.name}</td>{people && <td>{l.title ?? '—'}</td>}{people && <td>{l.company ?? '—'}</td>}
          <td className="op-num">{sizeText(l)}</td><td>{l.location ?? '—'}</td>
          <td><div className="row wrap">
            {safeHref(l.website) && <a className="btn btn-ghost btn-sm" href={safeHref(l.website)!} target="_blank" rel="noopener noreferrer">Website ↗<span className="sr-only"> of {l.company ?? l.name}</span></a>}
            {safeHref(l.linkedIn) && <a className="btn btn-ghost btn-sm" href={safeHref(l.linkedIn)!} target="_blank" rel="noopener noreferrer">LinkedIn ↗<span className="sr-only"> of {l.name}</span></a>}
          </div></td>
        </tr>)}</tbody></table></div>}
    </section>}
  </>
}
