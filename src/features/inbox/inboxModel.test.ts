import { describe, expect, it } from 'vitest'
import { parseReply, replySubject } from './inboxModel'

const base = { at: '2026-10-14T09:15:00Z', kind: 'Replied', opportunityId: 'o1', title: 'Payroll', organization: 'Northwind' }

describe('parseReply', () => {
  it('reads the sender, time and subject that reply detection wrote', () => {
    const r = parseReply({ ...base, detail: 'Reply received from jonas@northwind.example on 2026-10-14 09:12:00 UTC: Re: Payroll for SMEs' })
    expect(r.from).toBe('jonas@northwind.example')
    expect(r.subject).toBe('Re: Payroll for SMEs')
    expect(r.receivedAt).toBe('2026-10-14T09:12:00.000Z')
  })
  it('keeps a reply the person typed in as plain text', () => {
    const r = parseReply({ ...base, detail: 'They called back and want a demo.' })
    expect(r.from).toBeNull()
    expect(r.text).toBe('They called back and want a demo.')
  })
})

describe('replySubject', () => {
  it('adds Re: once', () => {
    expect(replySubject('Payroll')).toBe('Re: Payroll')
    expect(replySubject('RE: Payroll')).toBe('RE: Payroll')
    expect(replySubject(null)).toBe('Re: your reply')
  })
})
