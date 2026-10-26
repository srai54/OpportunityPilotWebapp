import { writeMyProgress } from '../progress/progressModel'
import { useState } from 'react'
import { api, ApiError } from '../../lib/api'
import { ErrorNotice } from '../../components/ErrorNotice'
import { pendingResearchJob, samplePath, sampleNotDeployed, sampleSummary, stillRunning } from './sampleModel'

/**
 * One button that fills the workspace with labelled sample records (POST /api/v1/sample-data), says what was added and reloads the
 * list it sits in. Used in Settings and in empty states. Sample records are marked as sample by the API.
 */
export function SampleDataButton({ onLoaded, primary = false, workspace }: Readonly<{ onLoaded?: () => void; primary?: boolean; workspace?: 'Sales' | 'Candidate' }>) {
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  async function load() {
    setBusy(true); setError(null); setMissing(false); setDone(null)
    try {
      const r = await api<unknown>(samplePath(workspace), { method: 'POST' })
      // The sample candidate's private link (shares everything): the Candidate view opens it straight away.
      const sampleToken = (r as { progressToken?: string | null } | null)?.progressToken
      if (sampleToken) writeMyProgress(sampleToken)
      setDone(sampleSummary(r))
      const jobId = pendingResearchJob(r)
      // The sample job search is only queued: once it has found jobs, call again to add the two sample job interviews.
      if (jobId) void finishJobInterviews(jobId)
      // A moment to read what was added before the list refills (the empty state it sits in then goes away).
      if (onLoaded) setTimeout(onLoaded, 1500)
    } catch (e) {
      if (e instanceof ApiError && sampleNotDeployed(e.status)) setMissing(true)
      else setError(e instanceof Error ? e : new Error('Could not add sample data.'))
    } finally { setBusy(false) }
  }

  async function finishJobInterviews(jobId: string) {
    setWaiting(true)
    try {
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const job = await api<{ state: string }>(`/api/v1/research-jobs/${jobId}`)
        if (!stillRunning(job.state)) break
      }
      const again = await api<{ jobInterviews?: number }>(samplePath('Candidate'), { method: 'POST' })
      if (again.jobInterviews) setDone((d) => `${d ?? 'Sample data added.'} Plus ${again.jobInterviews} job interview${again.jobInterviews === 1 ? '' : 's'}.`)
      onLoaded?.()
    } catch { /* the jobs and interviews can be added later by pressing the button again */ } finally { setWaiting(false) }
  }

  return (
    <div className="sample-data">
      <button type="button" className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} onClick={() => void load()}>
        {busy ? 'Adding sample data…' : 'Load sample data'}
      </button>
      <span role="status" aria-live="polite" className="sample-data-note">
        {done && <span className="notice notice-success">{done}{waiting ? ' Finding sample jobs…' : ''}</span>}
        {missing && <span className="notice notice-warning">Sample data is not on the server yet. Try again after the next update.</span>}
      </span>
      {error && <ErrorNotice error={error} />}
    </div>
  )
}
