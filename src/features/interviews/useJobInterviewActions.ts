import { useState } from 'react'
import { api } from '../../lib/api'
import type { JobInterview, JobInterviewStatus } from '../../lib/types'
import { JOB_STATUS } from './interviewsModel'

/** Status change and removal, shared by the job card and the My interviews page. Returns the handlers and the last error. */
export function useJobInterviewActions(reload: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [said, setSaid] = useState('')
  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true); setError(undefined); setSaid('')
    try { await fn(); setSaid(done); reload() } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return {
    busy, error, said,
    setStatus: (i: JobInterview, s: JobInterviewStatus) => void run(
      () => api(`/api/v1/interviews/${i.id}/status`, { method: 'POST', body: JSON.stringify({ status: s, expectedVersion: i.version }) }),
      `Round ${i.round}: ${JOB_STATUS[s].text.toLowerCase()}.`),
    remove: (i: JobInterview) => {
      if (!window.confirm(`Remove round ${i.round} for ${i.title}?`)) return
      void run(() => api(`/api/v1/interviews/${i.id}`, { method: 'DELETE' }), `Round ${i.round} removed.`)
    },
  }
}
