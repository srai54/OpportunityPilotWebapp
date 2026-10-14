import type { DonutSegment } from '../../components/charts/Donut'

/** How far a running search is, from its stage (the server runs them in this order). */
const STAGES = ['Gather', 'Extract', 'Filter', 'Score', 'Complete']
export function runPercent(stage: string | null | undefined): number {
  const i = STAGES.findIndex((s) => s.toLowerCase() === (stage ?? '').toLowerCase())
  return i < 0 ? 5 : Math.round(((i + 0.5) / STAGES.length) * 100)
}
export function runWords(stage: string | null | undefined): string {
  switch ((stage ?? '').toLowerCase()) {
    case 'gather': return 'Reading the sources'
    case 'extract': return 'Reading each posting'
    case 'filter': return 'Checking your must-haves'
    case 'score': return 'Scoring the matches'
    case 'complete': return 'Finishing'
    default: return 'Starting'
  }
}

export function campaignSegments(campaigns: readonly { id: string; lastJob: { state: string } | null }[], schedules: readonly { campaignId: string; paused: boolean }[]): DonutSegment[] {
  const running = campaigns.filter((c) => c.lastJob?.state === 'Queued' || c.lastJob?.state === 'Running')
  const repeating = campaigns.filter((c) => !running.includes(c) && schedules.some((s) => s.campaignId === c.id && !s.paused))
  const paused = campaigns.filter((c) => !running.includes(c) && schedules.some((s) => s.campaignId === c.id && s.paused))
  return [
    { key: 'running', label: 'Running now', value: running.length, tone: 'primary', live: true },
    { key: 'repeating', label: 'Repeating on a schedule', value: repeating.length, tone: 'teal' },
    { key: 'paused', label: 'Paused', value: paused.length, tone: 'warning' },
    { key: 'idle', label: 'Run when you press Run', value: campaigns.length - running.length - repeating.length - paused.length, tone: 'neutral' },
  ]
}

export function outreachSegments(drafts: readonly { state: string }[], replies: number): DonutSegment[] {
  return [
    { key: 'review', label: 'To review', value: drafts.filter((d) => d.state === 'Draft').length, tone: 'warning' },
    { key: 'approved', label: 'Approved, to send', value: drafts.filter((d) => d.state === 'Approved').length, tone: 'indigo' },
    { key: 'sent', label: 'Sent', value: Math.max(0, drafts.filter((d) => d.state === 'Sent').length - replies), tone: 'primary' },
    { key: 'replied', label: 'Replied', value: replies, tone: 'success' },
  ]
}
