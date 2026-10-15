import { describe, expect, it } from 'vitest'
import type { InterviewBoardRow } from '../staffing/staffingTypes'
import {
  candidateScheduleBody, draftUtc, emptyDraft, latestDealFor, locationText, mailtoLink, nextRound, notifiedStatus, salesScheduleBody, scheduleProblems,
  tellMessage, whenText, zoneChoices, type ScheduleDraft,
} from './scheduleModel'

const now = new Date('2026-10-15T06:00:00Z')
const base: ScheduleDraft = { ...emptyDraft('Asia/Kolkata', '98765 43210', 2), date: '2026-10-17', time: '15:00', mode: 'Phone' }

describe('draftUtc', () => {
  it('reads the date and time in the chosen zone', () => expect(draftUtc(base)).toBe('2026-10-17T09:30:00.000Z'))
  it('is null when incomplete', () => expect(draftUtc({ ...base, time: '' })).toBeNull())
})

describe('scheduleProblems', () => {
  it('passes a complete phone interview', () => expect(scheduleProblems(base, 'sales', now)).toEqual({}))
  it('asks for date and time', () => {
    const p = scheduleProblems({ ...base, date: '', time: '' }, 'sales', now)
    expect(p.date).toBeTruthy()
    expect(p.time).toBeTruthy()
  })
  it('refuses the past, a bad link and a bad round', () => {
    expect(scheduleProblems({ ...base, date: '2026-10-01' }, 'sales', now).date).toMatch(/future/)
    expect(scheduleProblems({ ...base, mode: 'Video', link: 'meet.google.com/x' }, 'sales', now).link).toMatch(/https/)
    expect(scheduleProblems({ ...base, round: '0' }, 'candidate', now).round).toBeTruthy()
  })
  it('needs a number to tell on WhatsApp (Sales only)', () => {
    expect(scheduleProblems({ ...base, phone: '' }, 'sales', now).phone).toMatch(/WhatsApp/)
    expect(scheduleProblems({ ...base, phone: '' }, 'candidate', now)).toEqual({})
    expect(scheduleProblems({ ...base, tell: 'Self', phone: '' }, 'sales', now)).toEqual({})
  })
})

describe('request bodies', () => {
  it('puts who calls and the number in the location for phone', () => {
    expect(locationText(base)).toBe('Client calls the candidate · +919876543210')
    expect(locationText({ ...base, mode: 'Video', link: ' https://meet.example/x ' })).toBe('https://meet.example/x')
    expect(locationText({ ...base, mode: 'Onsite', address: '' })).toBeNull()
  })
  it('builds the sales schedule body', () => {
    expect(salesScheduleBody(base, 3)).toEqual({
      scheduledAt: '2026-10-17T09:30:00.000Z', timeZone: 'Asia/Kolkata', durationMinutes: 45, mode: 'Phone',
      location: 'Client calls the candidate · +919876543210', candidateNotes: null, internalNotes: null, expectedVersion: 3,
    })
  })
  it('builds the candidate body with mode and length in the notes', () => {
    expect(candidateScheduleBody(base)).toEqual({ round: 2, scheduledAt: '2026-10-17T09:30:00.000Z', meetingUrl: null, notes: 'Phone · 45 min · They call me · +919876543210' })
    expect(candidateScheduleBody({ ...base, mode: 'Video', link: 'https://meet.example/x' })).toMatchObject({ meetingUrl: 'https://meet.example/x', notes: 'Video · 45 min' })
  })
})

describe('telling the candidate', () => {
  it('writes the WhatsApp message', () => {
    expect(tellMessage(base, { candidate: 'Priya Sharma', client: 'Infosys' }))
      .toBe('Hi Priya, round 2 with Infosys is set for Sat 17 Oct, 3:00 PM IST (45 min). They will call you on this number. All the best!')
  })
  it('adds the join link for video', () => {
    expect(tellMessage({ ...base, mode: 'Video', link: 'https://meet.example/x' }, { candidate: 'Priya', client: null })).toContain('Join here: https://meet.example/x')
  })
  it('maps how they were told to the notified status', () => {
    expect(notifiedStatus('WhatsApp')).toBe('NotifiedManually')
    expect(notifiedStatus('Email')).toBe('NotifiedByEmail')
    expect(notifiedStatus('Self')).toBeNull()
  })
  it('builds a mailto link', () => expect(mailtoLink('p@x.com', 'Round 2', 'Hi & bye')).toBe('mailto:p@x.com?subject=Round%202&body=Hi%20%26%20bye'))
  it('formats the time in the zone', () => expect(whenText('2026-10-17T09:30:00.000Z', 'UTC')).toBe('Sat 17 Oct, 9:30 AM UTC'))
})

describe('helpers', () => {
  it('adds the viewer zone when unusual', () => {
    expect(zoneChoices('Asia/Kolkata')[0].value).toBe('Asia/Kolkata')
    expect(zoneChoices('America/Sao_Paulo')[0]).toEqual({ value: 'America/Sao_Paulo', label: 'America/Sao Paulo' })
  })
  it('finds the latest deal of a candidate', () => {
    const row = (dealId: string, updatedAt: string) => ({
      candidateId: 'c1', candidateName: 'Priya', candidateEmail: null, dealTitle: 'Java Lead', client: 'Infosys', progressLinkActive: false, progressShowsInterviews: false,
      interview: { id: 'i', dealId, submissionId: `s-${dealId}`, updatedAt },
    }) as unknown as InterviewBoardRow
    expect(latestDealFor('c1', [row('d1', '2026-10-01'), row('d2', '2026-10-05')])).toEqual({ dealId: 'd2', submissionId: 's-d2', context: 'Infosys · Java Lead' })
    expect(latestDealFor('c2', [row('d1', '2026-10-01')])).toBeUndefined()
  })
  it('counts the next round', () => {
    expect(nextRound([])).toBe(1)
    expect(nextRound([1, 2])).toBe(3)
    expect(nextRound([20])).toBe(20)
  })
})
