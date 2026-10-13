import type { EventLevel, ResearchCounts, ResearchJob, ResearchJobState, ResearchStage } from '../../lib/types'

export const STAGES: { stage: ResearchStage; label: string }[] = [
  { stage: 'Prepare', label: 'Prepare' },
  { stage: 'Gather', label: 'Gather sources' },
  { stage: 'Extract', label: 'Extract facts' },
  { stage: 'Filter', label: 'Filter' },
  { stage: 'Score', label: 'Score' },
  { stage: 'Complete', label: 'Complete' },
]

export const JOB_STATE_LABELS: Record<ResearchJobState, { text: string; tone: string }> = {
  Queued: { text: 'Queued', tone: 'neutral' },
  Running: { text: 'Running', tone: 'primary' },
  Completed: { text: 'Completed', tone: 'success' },
  CompletedWithGaps: { text: 'Completed with gaps', tone: 'warning' },
  Failed: { text: 'Failed', tone: 'danger' },
  Cancelled: { text: 'Cancelled', tone: 'neutral' },
}

export const EVENT_LEVEL_TONES: Record<EventLevel, string> = { Info: 'neutral', Warning: 'warning', Error: 'danger' }

export function isActive(state: ResearchJobState): boolean {
  return state === 'Queued' || state === 'Running'
}

export type StageStatus = 'done' | 'current' | 'pending' | 'stopped'

/**
 * Where each stage stands. A queued job has not started any stage; a finished job has done them all;
 * a failed or cancelled job stopped at the stage it was in, and nothing after it ran.
 */
export function stageProgress(job: Pick<ResearchJob, 'state' | 'stage'>): { stage: ResearchStage; label: string; status: StageStatus }[] {
  const found = STAGES.findIndex((s) => s.stage === job.stage)
  const index = found < 0 ? 0 : found
  return STAGES.map((s, i) => {
    let status: StageStatus
    switch (job.state) {
      case 'Queued':
        status = 'pending'
        break
      case 'Completed':
      case 'CompletedWithGaps':
        status = 'done'
        break
      case 'Failed':
      case 'Cancelled':
        status = i < index ? 'done' : i === index ? 'stopped' : 'pending'
        break
      default:
        // Reaching Complete while still Running means the final write is in flight.
        status = i < index ? 'done' : i === index ? 'current' : 'pending'
    }
    return { ...s, status }
  })
}

/** One line per stage from the persisted counts, shown only once the stage has been reached. */
export function stageDetail(stage: ResearchStage, c: ResearchCounts): string {
  switch (stage) {
    case 'Gather':
      return `${c.sourcesDone} of ${c.sources} sources · ${c.fetched} items fetched${c.sourcesFailed ? ` · ${c.sourcesFailed} failed` : ''}`
    case 'Extract':
      return `${c.candidates} candidates`
    case 'Filter':
      return `${c.qualified} qualified · ${c.needsVerification} to verify · ${c.excluded} excluded`
    default:
      return ''
  }
}

// ---------- Polling ----------

export const POLL_MIN_MS = 2_000
export const POLL_MAX_MS = 10_000
/** Stop checking automatically after this long; the user can resume. */
export const POLL_LIMIT_MS = 10 * 60_000

/**
 * Delay before the next status check. A job that keeps changing is checked every 2 s; one that has not
 * changed for a few checks, or a request that failed, backs off by 1.5× per step up to 10 s.
 */
export function nextPollDelay({ unchangedPolls, errors }: { unchangedPolls: number; errors: number }): number {
  const steps = Math.max(0, unchangedPolls - 2) + Math.max(0, errors) * 2
  return Math.min(POLL_MAX_MS, Math.round(POLL_MIN_MS * 1.5 ** steps))
}

export function shouldKeepPolling(state: ResearchJobState | undefined, elapsedMs: number): boolean {
  if (elapsedMs >= POLL_LIMIT_MS) return false
  return state === undefined || isActive(state)
}

/** What counts as "something changed" between two polls. */
export function jobSignature(job: ResearchJob): string {
  return JSON.stringify([job.state, job.stage, job.counts, job.events?.[0]?.at ?? null, job.events?.length ?? 0])
}

/** Plain-language explanation of each state, so a sleeping host is never read as an AI failure. */
export const STATE_EXPLANATIONS: Record<ResearchJobState, string> = {
  Queued:
    'Waiting to start. The free server sleeps when idle, so the first search after a quiet spell can take a minute.',
  Running: 'Reading the sites you chose. You can leave this page — the search keeps running.',
  Completed: 'Done. Everything you chose was read.',
  CompletedWithGaps: 'Finished, but at least one site did not answer. Results from the others are kept.',
  Failed: 'The run stopped on an unexpected error. Results written before it stopped are kept.',
  Cancelled: 'Cancelled at your request. Results found before the cancel are kept.',
}
