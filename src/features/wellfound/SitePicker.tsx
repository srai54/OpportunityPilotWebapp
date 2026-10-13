import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { FREE_SITES, PAID_SITES } from './allSitesModel'

/**
 * "Sites": one dropdown listing every site that can be searched, each a checkbox. Everything is on by default; switch off what you
 * do not want. The paid sites (JSearch) are greyed out when the server has no key for them.
 */
export function SitePicker({ off, onChange, paidReady }: Readonly<{ off: ReadonlySet<string>; onChange: (off: Set<string>) => void; paidReady: boolean }>) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const all = [...FREE_SITES.map((s) => s.id), ...(paidReady ? PAID_SITES.map((s) => s.id) : [])]
  const count = all.filter((id) => !off.has(id)).length

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

  return (
    <div className="site-picker" ref={root}>
      <button type="button" className="btn btn-secondary site-picker-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        Sites · {count} of {all.length} <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="site-picker-panel" id={panelId} role="group" aria-label="Sites to search">
          <div className="row"><strong className="site-picker-head">Free sites</strong><span className="grow" />
            <button type="button" className="btn-link" onClick={() => onChange(new Set([...off].filter((id) => !FREE_SITES.some((s) => s.id === id))))}>All</button>
            <button type="button" className="btn-link" onClick={() => onChange(new Set([...off, ...FREE_SITES.map((s) => s.id)]))}>None</button>
          </div>
          {FREE_SITES.map((s) => (
            <label key={s.id} className="check"><input type="checkbox" checked={!off.has(s.id)} onChange={() => toggle(s.id)} /> {s.label} <span className="muted-small">{s.note}</span></label>
          ))}
          <strong className="site-picker-head">LinkedIn, Indeed, SEEK</strong>
          {PAID_SITES.map((s) => (
            <label key={s.id} className="check"><input type="checkbox" disabled={!paidReady} checked={paidReady && !off.has(s.id)} onChange={() => toggle(s.id)} /> {s.label}</label>
          ))}
          <p className="muted-small">{paidReady ? 'Each one used uses 1 of your 200 free searches a month.' : 'Switched off: the server has no job-data key.'}</p>
        </div>
      )}
    </div>
  )
}
