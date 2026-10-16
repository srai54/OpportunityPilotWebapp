import type { RepeatSchedule } from '../campaigns/campaignModel'

/**
 * Autopilot controls as pure functions: the repeat choice for a campaign and the PUT /campaigns/{id}/schedule body it needs, the
 * auto-approve score body for PUT /campaigns/{id}, the "Next runs" list and the "Ran today" list. No React, no fetch.
 */
export type RepeatChoice = 'off' | 'daily' | 'weekly' | 'custom'
export const REPEAT_MINUTES = { daily: 1440, weekly: 10080 } as const
export const AUTO_APPROVE_CHOICES = [null, 50, 60, 70, 80] as const

/** What the repeat select shows: Off when there is no schedule or it is paused; Custom for a cadence set in the builder. */
export function repeatChoice(s: Pick<RepeatSchedule, 'cadenceMinutes' | 'paused'> | undefined): RepeatChoice {
  if (!s || s.paused) return 'off'
  if (s.cadenceMinutes === REPEAT_MINUTES.daily) return 'daily'
  if (s.cadenceMinutes === REPEAT_MINUTES.weekly) return 'weekly'
  return 'custom'
}

/**
 * The schedule body for a new choice, or null when nothing needs saving (Off with no schedule, or the same choice again).
 * Off pauses and keeps the schedule. A new cadence, or a next run already in the past, starts one interval from now.
 */
export function repeatBody(choice: Exclude<RepeatChoice, 'custom'>, s: RepeatSchedule | undefined, now: Date, timeZone: string): object | null {
  if (choice === repeatChoice(s)) return null
  if (choice === 'off') {
    if (!s) return null
    return { timeZone: s.timeZone, cadenceMinutes: s.cadenceMinutes, nextRunAt: s.nextRunAt, paused: true, expectedVersion: s.version }
  }
  const minutes = REPEAT_MINUTES[choice]
  const keep = s && s.cadenceMinutes === minutes && new Date(s.nextRunAt).getTime() > now.getTime()
  return {
    timeZone: s?.timeZone ?? timeZone,
    cadenceMinutes: minutes,
    nextRunAt: keep ? s.nextRunAt : new Date(now.getTime() + minutes * 60_000).toISOString(),
    paused: false,
    expectedVersion: s?.version ?? null,
  }
}

/** The campaign as the API stores it, enough to send an unchanged edit with a new auto-approve score. */
export interface CampaignForEdit { name: string; goal: string; criteria: object; weights: Record<string, number>; resultLimit: number; version: number }

/** PUT /api/v1/campaigns/{id}: the stored fields unchanged plus the score (null = off). autoSuggestMinScore is left out, so it is kept. */
export function autoApproveBody(c: CampaignForEdit, score: number | null): object {
  return { name: c.name, goal: c.goal, criteria: c.criteria, weights: c.weights, resultLimit: c.resultLimit, autoApproveMinScore: score, expectedVersion: c.version }
}

export interface NextRun { campaignId: string; name: string; at: string; cadenceMinutes: number }

/** Schedules that are on, soonest first, named after their campaign. */
export function nextRuns(schedules: readonly RepeatSchedule[], campaigns: readonly { id: string; name: string }[]): NextRun[] {
  const names = new Map(campaigns.map((c) => [c.id, c.name]))
  return schedules
    .filter((s) => !s.paused && names.has(s.campaignId))
    .map((s) => ({ campaignId: s.campaignId, name: names.get(s.campaignId)!, at: s.nextRunAt, cadenceMinutes: s.cadenceMinutes }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

/** "in 25 min", "in 3 h", "tomorrow 9:00", or a date — for a run time relative to now. */
export function runWhen(iso: string, now: Date): string {
  const at = new Date(iso)
  const mins = Math.round((at.getTime() - now.getTime()) / 60_000)
  if (mins <= 0) return 'due now'
  if (mins < 60) return `in ${mins} min`
  if (mins < 6 * 60) return `in ${Math.round(mins / 60)} h`
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(at, now)) return `today ${time}`
  if (sameDay(at, new Date(now.getTime() + 86_400_000))) return `tomorrow ${time}`
  return at.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Campaigns whose latest research run finished (or is still going) today, newest first. */
export function ranToday<T extends { lastJob: { id: string; state: string; finishedAt: string | null } | null }>(campaigns: readonly T[], now: Date): T[] {
  const today = now.toDateString()
  const when = (c: T) => (c.lastJob?.finishedAt ? new Date(c.lastJob.finishedAt).getTime() : now.getTime())
  return campaigns
    .filter((c) => c.lastJob && (c.lastJob.state === 'Queued' || c.lastJob.state === 'Running' || (c.lastJob.finishedAt && new Date(c.lastJob.finishedAt).toDateString() === today)))
    .sort((a, b) => when(b) - when(a))
}
