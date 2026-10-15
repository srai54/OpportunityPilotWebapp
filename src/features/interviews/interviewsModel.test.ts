import { describe, expect, it } from 'vitest'
import type { JobInterview } from '../../lib/types'
import type { InterviewBoardRow } from '../staffing/staffingTypes'
import {
  boardCounts, isUpcoming, jobDraftBody, jobDraftProblems, jobStatusChoices, localInputToUtc, meetingUrlProblem, plural, progressLabel,
  salesActionRequest, salesActions, splitBoard, splitJobInterviews, toldLabel, utcToLocalInput, whenLabel,
} from './interviewsModel'

const NOW = new Date('2026-10-15T09:00:00Z')

function row(over: Partial<InterviewBoardRow['interview']> = {}, rest: Partial<InterviewBoardRow> = {}): InterviewBoardRow {
  return {
    interview: {
      id: over.id ?? 'i1', dealId: 'd1', submissionId: 's1', round: 1, state: 'Scheduled', scheduledAt: '2026-10-16T09:00:00Z', timeZone: 'UTC',
      durationMinutes: 45, mode: 'Video', location: null, candidateNotes: null, internalNotes: null, candidateNotification: 'NotNotified',
      candidateNotifiedAt: null, version: 3, updatedAt: '2026-10-14T09:00:00Z', ...over,
    },
    candidateId: 'c1', candidateName: 'Asha Rao', candidateEmail: null, dealTitle: '.NET developer', client: 'Contoso',
    progressLinkActive: false, progressShowsInterviews: false, ...rest,
  }
}

function job(over: Partial<JobInterview> = {}): JobInterview {
  return {
    id: 'j1', opportunityId: 'o1', title: 'Engineer', organization: 'Northwind', round: 1, scheduledAt: '2026-10-16T09:00:00Z', meetingUrl: null,
    notes: null, status: 'Scheduled', version: 1, createdAt: '2026-10-14T09:00:00Z', updatedAt: '2026-10-14T09:00:00Z', ...over,
  }
}

describe('whenLabel', () => {
  it('names today, tomorrow and yesterday, and dates otherwise', () => {
    expect(whenLabel('2026-10-15T15:30:00Z', NOW, 'UTC')).toBe('Today, 15:30')
    expect(whenLabel('2026-10-16T08:00:00Z', NOW, 'UTC')).toBe('Tomorrow, 08:00')
    expect(whenLabel('2026-10-14T08:00:00Z', NOW, 'UTC')).toBe('Yesterday, 08:00')
    expect(whenLabel('2026-10-20T15:00:00Z', NOW, 'UTC')).toBe('Tue 20 Oct, 15:00')
  })
  it('says when the time is not set', () => {
    expect(whenLabel(null, NOW)).toBe('Time not set')
    expect(whenLabel('nonsense', NOW)).toBe('Time not set')
  })
})

describe('local date inputs', () => {
  it('round-trips a local time through UTC', () => {
    const utc = localInputToUtc('2026-10-20T15:00')!
    expect(utc).toMatch(/Z$/)
    expect(utcToLocalInput(utc)).toBe('2026-10-20T15:00')
  })
  it('refuses partial or empty input', () => {
    expect(localInputToUtc('')).toBeNull()
    expect(localInputToUtc('2026-10-20')).toBeNull()
    expect(utcToLocalInput(null)).toBe('')
  })
})

describe('meetingUrlProblem', () => {
  it('accepts empty and http(s) links only', () => {
    expect(meetingUrlProblem('')).toBeNull()
    expect(meetingUrlProblem(' https://meet.example.com/x ')).toBeNull()
    expect(meetingUrlProblem('javascript:alert(1)')).toMatch(/https/)
    expect(meetingUrlProblem('meet.example.com')).toMatch(/https/)
    expect(meetingUrlProblem(`https://x.example/${'a'.repeat(1000)}`)).toMatch(/1,000/)
  })
})

describe('plural', () => {
  it('uses separators and the right word', () => {
    expect(plural(1, 'interview')).toBe('1 interview')
    expect(plural(0, 'interview')).toBe('0 interviews')
    expect(plural(1284, 'interview')).toBe('1,284 interviews')
  })
})

describe('sales tracker', () => {
  it('treats asked-for and booked interviews as upcoming until an hour after the start', () => {
    expect(isUpcoming({ state: 'Requested', scheduledAt: null }, NOW)).toBe(true)
    expect(isUpcoming({ state: 'Scheduled', scheduledAt: '2026-10-15T08:30:00Z' }, NOW)).toBe(true)
    expect(isUpcoming({ state: 'Scheduled', scheduledAt: '2026-10-15T07:30:00Z' }, NOW)).toBe(false)
    expect(isUpcoming({ state: 'Completed', scheduledAt: '2026-10-16T09:00:00Z' }, NOW)).toBe(false)
  })

  it('splits the board: upcoming soonest first with undated last, then the rest newest first', () => {
    const later = row({ id: 'later', scheduledAt: '2026-10-18T09:00:00Z' })
    const sooner = row({ id: 'sooner', scheduledAt: '2026-10-15T12:00:00Z' })
    const asked = row({ id: 'asked', state: 'Requested', scheduledAt: null })
    const old = row({ id: 'old', state: 'Completed', updatedAt: '2026-10-01T00:00:00Z' })
    const recent = row({ id: 'recent', state: 'NoShow', updatedAt: '2026-10-10T00:00:00Z' })
    const { upcoming, past } = splitBoard([later, old, asked, sooner, recent], NOW)
    expect(upcoming.map((r) => r.interview.id)).toEqual(['sooner', 'later', 'asked'])
    expect(past.map((r) => r.interview.id)).toEqual(['recent', 'old'])
  })

  it('counts upcoming, this week, not told and done', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b', scheduledAt: '2026-10-30T09:00:00Z', candidateNotification: 'NotifiedManually' }),
      row({ id: 'c', state: 'Requested', scheduledAt: null }),
      row({ id: 'd', state: 'Completed' }),
    ]
    expect(boardCounts(rows, NOW)).toEqual({ upcoming: 3, next7Days: 1, notTold: 1, completed: 1 })
    expect(boardCounts([], NOW)).toEqual({ upcoming: 0, next7Days: 0, notTold: 0, completed: 0 })
  })

  it('offers only the actions the API allows', () => {
    const scheduled = row()
    expect(salesActions(scheduled, [scheduled])).toEqual(['told', 'done', 'noShow', 'cancel'])
    const told = row({ candidateNotification: 'NotifiedByEmail' })
    expect(salesActions(told, [told])).toEqual(['done', 'noShow', 'cancel'])
    const asked = row({ state: 'Requested', scheduledAt: null })
    expect(salesActions(asked, [asked])).toEqual(['cancel'])
    const done = row({ state: 'Completed' })
    expect(salesActions(done, [done])).toEqual(['nextRound'])
    const round2 = row({ id: 'i2', round: 2, state: 'Requested' })
    expect(salesActions(done, [done, round2])).toEqual([])
    expect(salesActions(row({ state: 'NoShow' }), [])).toEqual([])
  })

  it('builds the existing deal interview calls with the loaded version', () => {
    const r = row()
    expect(salesActionRequest(r, 'done')).toEqual({ path: '/api/v1/staffing/deals/d1/interviews/i1/finish', body: { outcome: 'Completed', expectedVersion: 3 } })
    expect(salesActionRequest(r, 'noShow').body).toEqual({ outcome: 'NoShow', expectedVersion: 3 })
    expect(salesActionRequest(r, 'told')).toEqual({ path: '/api/v1/staffing/deals/d1/interviews/i1/notified', body: { status: 'NotifiedManually', expectedVersion: 3 } })
    expect(salesActionRequest(r, 'nextRound')).toEqual({ path: '/api/v1/staffing/deals/d1/interviews', body: { submissionId: 's1' } })
  })

  it('says whether the candidate knows and what the progress link shows', () => {
    expect(toldLabel(row().interview)?.text).toBe('Candidate not told')
    expect(toldLabel(row({ candidateNotification: 'NotifiedManually' }).interview)?.text).toBe('Candidate told')
    expect(toldLabel(row({ state: 'Requested' }).interview)).toBeNull()
    expect(progressLabel({ progressLinkActive: false, progressShowsInterviews: false })).toBe('No progress link yet')
    expect(progressLabel({ progressLinkActive: true, progressShowsInterviews: true })).toBe('Shown on the progress link')
    expect(progressLabel({ progressLinkActive: true, progressShowsInterviews: false })).toBe('Progress link shows the stage only')
  })
})

describe('candidate interviews', () => {
  it('splits upcoming (soonest first) from past (latest first)', () => {
    const rows = [
      job({ id: 'late', scheduledAt: '2026-10-20T09:00:00Z' }),
      job({ id: 'soon', scheduledAt: '2026-10-15T10:00:00Z' }),
      job({ id: 'undated', scheduledAt: null }),
      job({ id: 'done', status: 'Completed', scheduledAt: '2026-10-10T09:00:00Z' }),
      job({ id: 'missed', status: 'NoShow', scheduledAt: '2026-10-12T09:00:00Z' }),
      job({ id: 'gone', scheduledAt: '2026-10-01T09:00:00Z' }),
    ]
    const { upcoming, past } = splitJobInterviews(rows, NOW)
    expect(upcoming.map((r) => r.id)).toEqual(['soon', 'late', 'undated'])
    expect(past.map((r) => r.id)).toEqual(['missed', 'done', 'gone'])
  })

  it('offers done or missed only once there is a time, and undo once closed', () => {
    expect(jobStatusChoices({ status: 'Scheduled', scheduledAt: '2026-10-16T09:00:00Z' })).toEqual(['Completed', 'NoShow', 'Cancelled'])
    expect(jobStatusChoices({ status: 'Scheduled', scheduledAt: null })).toEqual(['Cancelled'])
    expect(jobStatusChoices({ status: 'Completed', scheduledAt: '2026-10-16T09:00:00Z' })).toEqual(['Scheduled'])
  })

  it('checks the form before sending and builds the body', () => {
    expect(jobDraftProblems({ when: '', link: '', notes: '', round: '' })).toEqual({})
    expect(Object.keys(jobDraftProblems({ when: '2026-10', link: 'ftp://x', notes: 'x'.repeat(2001), round: '21' })).sort())
      .toEqual(['link', 'notes', 'round', 'when'])
    expect(jobDraftBody({ when: '', link: ' ', notes: ' ', round: '' })).toEqual({ round: null, scheduledAt: null, meetingUrl: null, notes: null })
    const body = jobDraftBody({ when: '2026-10-20T15:00', link: 'https://meet.example.com/x', notes: 'Bring ID', round: '2' }, 4) as Record<string, unknown>
    expect(body).toMatchObject({ round: 2, meetingUrl: 'https://meet.example.com/x', notes: 'Bring ID', expectedVersion: 4 })
    expect(body.scheduledAt).toMatch(/Z$/)
  })
})
