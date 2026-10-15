import { useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { zonedToUtc } from '../staffing/staffingModel'
import { CADENCES, cadenceLabel } from './campaignModel'

type Schedule = {
  id: string; campaignId: string; timeZone: string; cadenceMinutes: number; nextRunAt: string; paused: boolean
  lastQueuedAt: string | null; lastSafeError: string | null; version: number; lastMissedRuns: number; totalMissedRuns: number
}

/** Research on a cadence: the server queues one run when due (never twice), and counts slots it missed while down. */
export function SchedulePanel({ campaignId }: { campaignId: string }) {
  const all = useApi<Schedule[]>('/api/v1/schedules')
  const current = all.data?.find((s) => s.campaignId === campaignId)
  const [cadence, setCadence] = useState<number | null>(null)
  const [first, setFirst] = useState('')
  const [zone, setZone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const tz = zone ?? current?.timeZone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const every = cadence ?? current?.cadenceMinutes ?? 1440

  async function save(paused: boolean, nextRunAt?: string) {
    setBusy(true); setError(undefined)
    try {
      await api(`/api/v1/campaigns/${campaignId}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ timeZone: tz, cadenceMinutes: every, nextRunAt: nextRunAt ?? current?.nextRunAt ?? nowIso(), paused, expectedVersion: current?.version ?? null }),
      })
      setFirst(''); all.reload()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  const firstUtc = first ? zonedToUtc(first, tz) : null
  if (!all.data) return null
  return <section className="panel">
    <header className="panel-head"><h3 className="eyebrow">Repeat this search</h3>
      {current && <Badge tone={current.paused ? 'neutral' : 'success'}>{current.paused ? 'Paused' : cadenceLabel(current.cadenceMinutes)}</Badge>}</header>
    <div className="panel-body stack-2">
      {current && <p className="small">
        {current.paused ? 'Paused.' : `Next run ${new Date(current.nextRunAt).toLocaleString(undefined, { timeZone: current.timeZone })} (${current.timeZone}).`}
        {current.lastQueuedAt ? ` Last queued ${new Date(current.lastQueuedAt).toLocaleString()}.` : ' Not run yet.'}
        {current.lastMissedRuns > 0 && ` ${current.lastMissedRuns} run${current.lastMissedRuns === 1 ? ' was' : 's were'} missed while the server was asleep; they were not run late.`}
      </p>}
      {current?.lastSafeError && <p className="notice notice-warning">Last scheduled run was not queued: {current.lastSafeError}</p>}
      <div className="filters">
        <label className="field"><span>How often</span><select value={every} onChange={(e) => setCadence(Number(e.target.value))}>
          {CADENCES.map((c) => <option key={c.minutes} value={c.minutes}>{c.label}</option>)}</select></label>
        <label className="field"><span>{current ? 'Move next run to' : 'First run'}</span><input type="datetime-local" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
        <label className="field"><span>Time zone</span><input value={tz} onChange={(e) => setZone(e.target.value)} /></label>
      </div>
      <details className="more-info"><summary>Details</summary><p className="hint">On free hosting the server sleeps when idle, so a run happens at the first check after it wakes. Each run is queued once, like pressing Run now.</p></details>
      {error && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button className="btn btn-primary btn-sm" type="button" disabled={busy || (!current && !firstUtc) || (first !== '' && !firstUtc)}
          onClick={() => void save(false, firstUtc ?? undefined)}>{current ? (current.paused ? 'Resume with these settings' : 'Save schedule') : 'Turn on schedule'}</button>
        {current && !current.paused && <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => void save(true)}>Pause</button>}
        {first && !firstUtc && <small className="text-danger">Unknown time zone.</small>}
      </div>
    </div>
  </section>
}

/** Only called from event handlers, never during render. */
function nowIso(): string { return new Date().toISOString() }
