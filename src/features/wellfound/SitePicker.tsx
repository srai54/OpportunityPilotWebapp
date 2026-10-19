import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { coverageLabel, groupSources, regionLabel, SOURCES, type RegionId, type Source } from './sourcesModel'

/**
 * "Sites": one dropdown with every site that can be searched, as small cards grouped by access (J2). Each card says what it costs,
 * where Remote and Contract come from, how many results it gave last time, and has an on/off switch. Only the chosen region's
 * sources are listed; the paid ones (JSearch credits) are switched off when the server has no key for them.
 */
export function SitePicker({ off, onChange, paidReady, region, counts }: Readonly<{
  off: ReadonlySet<string>
  onChange: (off: Set<string>) => void
  paidReady: boolean
  region: RegionId
  /** Results per source id from the last search; absent = not searched yet. */
  counts?: Readonly<Record<string, number | null>>
}>) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const groups = groupSources(region)
  const usable = (s: Source) => !s.paid || paidReady
  const listed = groups.flatMap((g) => g.sources).filter(usable)
  const count = listed.filter((s) => !off.has(s.id)).length

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key) }
  }, [open])

  function toggle(id: string) {
    const next = new Set(off)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }
  const setAll = (on: boolean) => {
    const ids = listed.map((s) => s.id)
    onChange(on ? new Set([...off].filter((id) => !ids.includes(id))) : new Set([...off, ...ids]))
  }

  return (
    <div className="site-picker" ref={root}>
      <button type="button" className="btn btn-secondary site-picker-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        Sites · {count} of {listed.length} <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="site-picker-panel site-picker-cards" id={panelId} role="group" aria-label={`Sites to search in ${regionLabel(region)}`}>
          <div className="row"><strong className="site-picker-head">{regionLabel(region)} · {listed.length} site{listed.length === 1 ? '' : 's'}</strong><span className="grow" />
            <button type="button" className="btn-link" onClick={() => setAll(true)}>All</button>
            <button type="button" className="btn-link" onClick={() => setAll(false)}>None</button>
          </div>
          {groups.map((g) => (
            <fieldset key={g.title} className="source-group">
              <legend className="site-picker-head">{g.title}</legend>
              <ul className="source-cards">
                {g.sources.map((s) => {
                  const ready = usable(s)
                  const last = counts?.[s.id]
                  return <li key={s.id} className={`source-card${!ready ? ' is-off' : ''}`}>
                    <label className="source-card-main">
                      <input type="checkbox" disabled={!ready} checked={ready && !off.has(s.id)} onChange={() => toggle(s.id)} />
                      <span className="source-card-name">{s.label}</span>
                      <span className={`chip${s.access === 'Free' ? ' chip-ok' : s.access === 'Credits' ? ' chip-warn' : ''}`}>{s.access}</span>
                    </label>
                    {s.kind && s.kind !== 'Job board' && <span className="muted-small">{s.kind === 'Data provider' ? 'Aggregator: the same job may also come from another site' : 'Freelance projects, not employee jobs'}</span>}
                    <span className="muted-small">Remote {coverageLabel(s.remote)} · Contract {coverageLabel(s.contract)}</span>
                    <span className="muted-small">{!ready ? 'Off: the server has no job-data key' : last === undefined ? 'Not searched yet' : last === null ? 'Did not answer last time' : `${last} last search`}</span>
                  </li>
                })}
              </ul>
            </fieldset>
          ))}
          {listed.length === 0 && <p className="muted-small" role="note">No site this server can search covers {regionLabel(region)} yet. LinkedIn and Indeed cover it once the job-data key is set.</p>}
          <p className="muted-small">{paidReady ? 'Each paid site used takes 1 of your free searches this month.' : `${SOURCES.filter((s) => s.paid).map((s) => s.label).join(', ')} are off: the server has no job-data key.`}</p>
        </div>
      )}
    </div>
  )
}
