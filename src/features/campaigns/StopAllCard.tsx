import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import type { CampaignSummary } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { stoppable, type RepeatSchedule } from './campaignModel'

/**
 * "Stop everything": cancels every run that is queued or running and pauses every repeating campaign, in one press. Nothing found so far is
 * deleted, and nothing already applied or sent is undone. Hidden when there is nothing to stop.
 */
export function StopAllCard() {
  const campaigns = useApi<CampaignSummary[]>('/api/v1/campaigns')
  const schedules = useApi<RepeatSchedule[]>('/api/v1/schedules')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState<Error>()
  if (!campaigns.data || !schedules.data) return null
  const { runs, repeating } = stoppable(campaigns.data, schedules.data)
  if (runs.length === 0 && repeating.length === 0 && !done) return null

  async function stop() {
    if (!window.confirm(`Stop ${runs.length} running search${runs.length === 1 ? '' : 'es'} and pause ${repeating.length} repeating campaign${repeating.length === 1 ? '' : 's'}? Results found so far are kept.`)) return
    setBusy(true); setError(undefined)
    try {
      await Promise.all([
        ...runs.filter((c) => c.lastJob).map((c) => api(`/api/v1/research-jobs/${encodeURIComponent(c.lastJob!.id)}/cancel`, { method: 'POST' })),
        ...repeating.map((s) => api(`/api/v1/campaigns/${s.campaignId}/schedule`, { method: 'PUT', body: JSON.stringify({ timeZone: s.timeZone, cadenceMinutes: s.cadenceMinutes, nextRunAt: s.nextRunAt, paused: true, expectedVersion: s.version }) })),
      ])
      setDone(`Stopped: ${runs.length} run${runs.length === 1 ? '' : 's'} cancelled, ${repeating.length} repeating campaign${repeating.length === 1 ? '' : 's'} paused.`)
      campaigns.reload(); schedules.reload()
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  return (
    <Card tone={done ? 'muted' : 'default'} title={done ? 'Stopped' : 'Running now'}
      subtitle={done || `${runs.length} search${runs.length === 1 ? '' : 'es'} running · ${repeating.length} repeating`}
      actions={!done && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void stop()}>{busy ? 'Stopping…' : 'Stop everything'}</button>}>
      {error && <ErrorNotice error={error} />}
      {!done && <p className="muted-small">Cancels running searches and pauses repeats. Nothing found is deleted and nothing already applied or sent is undone. Your agent on your computer stops with <code>Ctrl+C</code>. <Link to="/campaigns">See campaigns</Link></p>}
    </Card>
  )
}
