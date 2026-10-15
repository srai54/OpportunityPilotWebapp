/**
 * "Load sample data": what POST /api/v1/sample-data answered, in one short line. The answer is read loosely (a `message`, an `added`
 * object of counts, or counts at the top level) so a small change in its shape still reads well. Pure: no React, no fetch.
 */
export const SAMPLE_DATA_PATH = '/api/v1/sample-data'

/** "candidates" → "candidates"; "staffingDeals" → "staffing deals"; a count of 1 drops a trailing "s". */
export function countLabel(key: string, n: number): string {
  const words = key.replace(/Count$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return n === 1 && words.endsWith('s') && !words.endsWith('ss') ? words.slice(0, -1) : words
}

export function sampleSummary(body: unknown): string {
  if (!body || typeof body !== 'object') return 'Sample data added.'
  const o = body as Record<string, unknown>
  const counts = (o.added && typeof o.added === 'object' ? o.added : o) as Record<string, unknown>
  const parts = Object.entries(counts)
    .filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] > 0 && e[0] !== 'version')
    .map(([k, n]) => `${n.toLocaleString('en')} ${countLabel(k, n)}`)
  if (parts.length) return `Added ${parts.join(', ')}.`
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim().slice(0, 200)
  return 'Sample data added.'
}

/** 404/405: the API does not have the endpoint yet. */
export function sampleNotDeployed(status: number | undefined): boolean {
  return status === 404 || status === 405
}

/** POST path for one workspace ("Sales" or "Candidate"), or both when none is given. */
export function samplePath(workspace?: 'Sales' | 'Candidate'): string {
  return workspace ? `${SAMPLE_DATA_PATH}?workspace=${workspace}` : SAMPLE_DATA_PATH
}

/** The research run to wait for before the job interviews can be added (call again once it is done); null when none is pending. */
export function pendingResearchJob(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const o = body as { jobInterviewsPending?: unknown; researchJobId?: unknown }
  return o.jobInterviewsPending === true && typeof o.researchJobId === 'string' && o.researchJobId ? o.researchJobId : null
}

/** A research run that is still queued or running. */
export function stillRunning(state: string | undefined): boolean {
  return state === 'Queued' || state === 'Running'
}
