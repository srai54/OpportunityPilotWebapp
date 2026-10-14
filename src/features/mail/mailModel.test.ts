import { describe, expect, it } from 'vitest'
import { canConnectOne, mailboxState, returnNotice, sendable, sendName, smtpFormProblem, type Mailbox } from './mailModel'

const mb = (over: Partial<Mailbox>): Mailbox => ({ provider: 'Google', configured: true, connected: false, emailAddress: null, status: null, connectedAt: null, lastUsedAt: null, ...over })

describe('mailbox states', () => {
  it('says not configured only when the server has no credentials', () => {
    expect(mailboxState(mb({ configured: false })).text).toBe('Not configured on this server')
    expect(mailboxState(mb({})).text).toBe('Not connected')
    expect(mailboxState(mb({ connected: true, status: 'Connected', emailAddress: 'me@x.test' })).text).toBe('Connected as me@x.test')
    expect(mailboxState(mb({ connected: true, status: 'NeedsReconnect' })).tone).toBe('warning')
  })
  it('only a connected, configured, healthy mailbox can send', () => {
    const list = [mb({ connected: true, status: 'Connected' }), mb({ provider: 'Microsoft', connected: true, status: 'NeedsReconnect' }), mb({ provider: 'Microsoft', configured: false })]
    expect(sendable(list).map((m) => m.provider)).toEqual(['Google'])
    expect(sendable(undefined)).toEqual([])
  })
  it('hints at connecting only when one could be connected and none is', () => {
    expect(canConnectOne([mb({}), mb({ provider: 'Microsoft', configured: false })])).toBe(true)
    expect(canConnectOne([mb({ configured: false })])).toBe(false)
    expect(canConnectOne([mb({ connected: true, status: 'Connected' })])).toBe(false)
  })
})

describe('return notice', () => {
  it('words each outcome and ignores anything else', () => {
    expect(returnNotice('?mailbox=connected&provider=Microsoft')?.text).toContain('Outlook is connected')
    expect(returnNotice('?mailbox=declined&provider=Google')?.tone).toBe('warning')
    expect(returnNotice('?mailbox=hacked&provider=Google')).toBeNull()
    expect(returnNotice('?mailbox=connected&provider=Evil')).toBeNull()
    expect(returnNotice('')).toBeNull()
  })
})

describe('email with an app password', () => {
  it('names the mailbox as your email on send buttons', () => {
    expect(sendName('Smtp')).toBe('your email')
    expect(sendName('Google')).toBe('Gmail')
  })
  it('says what is missing before the form is sent', () => {
    const ok = { preset: 'gmail', host: '', username: 'me@gmail.com', password: 'abcd efgh' }
    expect(smtpFormProblem(ok)).toBeNull()
    expect(smtpFormProblem({ ...ok, username: 'me' })).toContain('email address')
    expect(smtpFormProblem({ ...ok, password: ' ' })).toContain('app password')
    expect(smtpFormProblem({ ...ok, preset: 'custom' })).toContain('mail server')
    expect(smtpFormProblem({ ...ok, preset: 'custom', host: 'smtp.example.com' })).toBeNull()
  })
  it('knows the Smtp return notice provider', () => {
    expect(returnNotice('?mailbox=connected&provider=Smtp')?.text).toContain('Email (app password) is connected')
  })
})
