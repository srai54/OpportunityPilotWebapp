import { describe, expect, it } from 'vitest'
import { ANSWER_LABEL, agoText, openRoles, SHOW_OPTIONS, countdown, interviewIcs, joinUrl, journey, nextInterview, progressUrl, shownSummary, stagePercent, updateMailto } from './progressModel'

describe('progress link helpers', () => {
  it('builds the link from the site address and token', () => {
    expect(progressUrl('https://app.example/', 'abc_-1')).toBe('https://app.example/progress/abc_-1')
  })
  it('prepares an email only when the candidate has an address, and puts the link in it', () => {
    expect(updateMailto({ name: 'Priya Sharma', email: null }, 'https://x/progress/t')).toBeNull()
    const m = updateMailto({ name: 'Priya Sharma', email: 'priya@example.test' }, 'https://x/progress/t')!
    expect(m.startsWith('mailto:priya%40example.test?subject=')).toBe(true)
    expect(decodeURIComponent(m)).toContain('Hi Priya,')
    expect(decodeURIComponent(m)).toContain('https://x/progress/t')
  })
  it('says what is shown', () => {
    expect(shownSummary([])).toBe('the stage only')
    expect(shownSummary(['Client', 'Offer'])).toBe('the stage, plus client name, offer status (never the pay)')
  })
  it('puts each stage on a bar from preparing to accepted', () => {
    expect(stagePercent('We are preparing your profile')).toBeLessThan(stagePercent('Your profile was sent to the client'))
    expect(stagePercent('Interview scheduled')).toBeLessThan(stagePercent('An offer was made'))
    expect(stagePercent('Offer accepted')).toBe(100)
    expect(stagePercent('Withdrawn')).toBe(0)
  })
})

describe('journey', () => {
  it('puts each server stage on the five steps with the current one marked', () => {
    const j = journey('The client asked for an interview')
    expect(j.steps.map((s) => s.state)).toEqual(['done', 'done', 'now', 'todo', 'todo'])
    expect(j.next).toMatch(/agreeing a time/)
    expect(journey('Offer accepted').steps.every((s) => s.state === 'done')).toBe(true)
    expect(journey('We are preparing your profile').steps[0].state).toBe('now')
  })
  it('marks a stopped path instead of pretending it moved on', () => {
    const j = journey('Interview cancelled')
    expect(j.stopped).toBe(true)
    expect(j.steps[2].state).toBe('stopped')
    expect(journey('Withdrawn').steps[1].state).toBe('stopped')
  })
})

describe('countdown and live marker', () => {
  const now = new Date('2026-10-14T10:00:00Z')
  it('counts down to the interview', () => {
    expect(countdown('2026-10-17T10:00:00Z', now)).toBe('in 3 days')
    expect(countdown('2026-10-15T13:00:00Z', now)).toBe('in 1 day 3 h')
    expect(countdown('2026-10-14T12:20:00Z', now)).toBe('in 2 h 20 min')
    expect(countdown('2026-10-14T10:03:00Z', now)).toBe('starting now')
    expect(countdown('2026-10-14T08:00:00Z', now)).toBeNull()
  })
  it('says how fresh the page is', () => {
    expect(agoText(0, 3000)).toBe('just now')
    expect(agoText(0, 42_000)).toBe('42 s ago')
    expect(agoText(0, 180_000)).toBe('3 min ago')
  })
})

describe('next interview, join link and calendar file', () => {
  const now = new Date('2026-10-15T10:00:00Z')
  const item = (client: string, at: string, location: string | null = null) => ({
    client, role: 'Java Lead', stage: 'Interview scheduled', updatedAt: at,
    interview: { round: 2, scheduledAt: at, timeZone: 'Asia/Kolkata', mode: 'Video', location, minutes: 45, notes: null },
  })
  it('picks the soonest interview that has not passed', () => {
    const items = [item('Late', '2026-10-20T10:00:00Z'), item('Past', '2026-10-14T10:00:00Z'), item('Soon', '2026-10-16T10:00:00Z'), { ...item('None', ''), interview: null }]
    expect(nextInterview(items, now)?.client).toBe('Soon')
    expect(nextInterview([], now)).toBeNull()
  })
  it('only treats web links as a join link', () => {
    expect(joinUrl('https://meet.example.com/abc')).toBe('https://meet.example.com/abc')
    expect(joinUrl('Office, 3rd floor')).toBeNull()
    expect(joinUrl('javascript:alert(1)')).toBeNull()
    expect(joinUrl(null)).toBeNull()
  })
  it('builds a calendar event with the time, length, title and join link', () => {
    const ics = interviewIcs(item('Acme, Inc', '2026-10-16T09:30:00Z', 'https://meet.example.com/abc'), now)
    expect(ics).toContain('DTSTART:20261016T093000Z')
    expect(ics).toContain('DTEND:20261016T101500Z')
    expect(ics).toContain('SUMMARY:Interview round 2 with Acme\\, Inc')
    expect(ics).toContain('URL:https://meet.example.com/abc')
    expect(ics).toContain('DTSTAMP:20261015T100000Z')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('shared extras (2026-10-22)', () => {
  it('suggests only open roles', () => {
    const deals = [{ id: 'a', stage: 'New' }, { id: 'b', stage: 'Won' }, { id: 'c', stage: 'Interviewing' }, { id: 'd', stage: 'Lost' }, { id: 'e', stage: 'OnHold' }, { id: 'f', stage: 'Disqualified' }]
    expect(openRoles(deals).map((d) => d.id)).toEqual(['a', 'c'])
  })
  it('labels the candidate answers in plain words', () => {
    expect(ANSWER_LABEL.Interested).toBe('Interested')
    expect(ANSWER_LABEL.NotForMe).toBe('Not for me')
    expect(ANSWER_LABEL.None).toBe('No answer yet')
  })
  it('keeps the old default of three things shared and adds the extras as options', () => {
    expect(SHOW_OPTIONS.map((o) => o.key)).toEqual(['Client', 'Role', 'Interviews', 'Offer', 'Note', 'Prep', 'Roles'])
    expect(shownSummary(['Note', 'Roles'])).toBe('the stage, plus a note from you, suggested roles')
  })
})
