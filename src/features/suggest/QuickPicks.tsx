import { useState } from 'react'
import { defaultRegion, PLACES, POPULAR_ROLES, type Region } from './picks'

/** Tap a popular role or place instead of typing. India and outside India are one tap apart; the browser's own region goes first. */
export function QuickPicks({ onRole, onPlace, showRoles = true }: Readonly<{ onRole?: (role: string) => void; onPlace: (place: string) => void; showRoles?: boolean }>) {
  const [region, setRegion] = useState<Region>(() => defaultRegion(navigator.language || '', Intl.DateTimeFormat().resolvedOptions().timeZone || ''))
  return (
    <div className="picks stack-2">
      {showRoles && onRole && (
        <div className="chip-row" role="group" aria-label="Popular roles">
          <span className="muted-small picks-label">Roles</span>
          {POPULAR_ROLES.slice(0, 8).map((r) => <button key={r} type="button" className="chip-btn" onClick={() => onRole(r)}>{r}</button>)}
        </div>
      )}
      <div className="chip-row" role="group" aria-label="Popular places">
        <span className="muted-small picks-label">Places</span>
        <div className="segmented segmented-sm" role="group" aria-label="Region">
          <button type="button" className={region === 'india' ? 'active' : ''} aria-pressed={region === 'india'} onClick={() => setRegion('india')}>India</button>
          <button type="button" className={region === 'abroad' ? 'active' : ''} aria-pressed={region === 'abroad'} onClick={() => setRegion('abroad')}>Outside India</button>
        </div>
        {PLACES[region].map((p) => <button key={p} type="button" className="chip-btn" onClick={() => onPlace(p)}>{p}</button>)}
      </div>
    </div>
  )
}
