import { describe, expect, it } from 'vitest'
import { composerTarget, endsWithoutName, readyChecks, unresolvedPlaceholder, webComposeUrl } from './composer'

describe('composerTarget', () => {
  it('pre-fills an email in the mail app', () => {
    const t = composerTarget('Email', { recipient: 'a@b.co', subject: 'Hello there', body: 'Hi A' })
    expect(t.kind).toBe('mailto')
    expect(t.url).toBe('mailto:a%40b.co?subject=Hello%20there&body=Hi%20A')
    expect(t.copy).toBe(false)
  })
  it('falls back to copy for a very long email body', () => {
    const t = composerTarget('Email', { recipient: 'a@b.co', subject: '', body: 'x'.repeat(3000) })
    expect(t.copy).toBe(true)
    expect(t.url).toBe('mailto:a%40b.co')
  })
  it('opens LinkedIn Messages with the text copied, or a LinkedIn profile link when given', () => {
    expect(composerTarget('LinkedInMessage', { recipient: '', subject: '', body: 'Hi' })).toMatchObject({ kind: 'site', url: 'https://www.linkedin.com/messaging/', copy: true })
    expect(composerTarget('LinkedInMessage', { recipient: 'https://www.linkedin.com/in/x', subject: '', body: 'Hi' }).url).toBe('https://www.linkedin.com/in/x')
    expect(composerTarget('LinkedInMessage', { recipient: 'Nikhil Malhotra', subject: '', body: 'Hi' }).url).toBe('https://www.linkedin.com/search/results/people/?keywords=Nikhil%20Malhotra')
  })
  it('never opens a non-https recipient as a site', () => {
    expect(composerTarget('ContactForm', { recipient: 'javascript:alert(1)', subject: '', body: 'Hi' }).url).toBeNull()
  })
})

describe('web mail apps (Outlook PWA, Gmail)', () => {
  const d = { recipient: 'a@b.co', subject: 'Hello there', body: 'Hi A' }
  it('keeps mailto for the default app', () => {
    expect(webComposeUrl('default', d)).toBeNull()
    expect(composerTarget('Email', d, 'default').kind).toBe('mailto')
  })
  it('opens a pre-filled Outlook compose window', () => {
    const t = composerTarget('Email', d, 'outlook')
    expect(t).toMatchObject({ kind: 'site', copy: false, label: 'Open a new message in Outlook (work or school)' })
    expect(t.url).toBe('https://outlook.office.com/mail/deeplink/compose?to=a%40b.co&subject=Hello%20there&body=Hi%20A')
  })
  it('has personal Outlook and Gmail links', () => {
    expect(webComposeUrl('outlookPersonal', d)?.url).toMatch(/^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=a%40b\.co/)
    expect(webComposeUrl('gmail', d)?.url).toBe('https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.co&su=Hello%20there&body=Hi%20A')
  })
  it('drops the body and copies the text when the link would be too long', () => {
    const t = composerTarget('Email', { ...d, body: 'x'.repeat(3000) }, 'outlook')
    expect(t.copy).toBe(true)
    expect(t.url).not.toContain('body=')
    expect(t.url).toContain('to=a%40b.co')
  })
  it('does not change LinkedIn', () => {
    expect(composerTarget('LinkedInMessage', d, 'outlook').url).toBe('https://www.linkedin.com/messaging/')
  })
})

describe('unresolvedPlaceholder', () => {
  it('finds a bracketed placeholder and ignores plain text', () => {
    expect(unresolvedPlaceholder('Regards, [Your name]')).toBe('[Your name]')
    expect(unresolvedPlaceholder('all good', 'also fine')).toBeNull()
    expect(unresolvedPlaceholder('[]')).toBeNull()
  })
})

describe('readyChecks', () => {
  const ok = { recipient: 'a@b.co', subject: 'Hi', body: 'Hello' }
  it('passes a complete email', () => expect(readyChecks('Email', ok).every((c) => c.ok)).toBe(true))
  it('says what is missing, in order', () => {
    const bad = readyChecks('Email', { recipient: 'not-an-email', subject: ' ', body: 'Regards, [Your name]' }).filter((c) => !c.ok)
    expect(bad.map((c) => c.label)).toEqual(['Recipient', 'Subject', 'No placeholders'])
    expect(bad[2].fix).toContain('[Your name]')
  })
  it('does not ask a LinkedIn note for a recipient or subject', () => {
    expect(readyChecks('LinkedInMessage', { recipient: '', subject: '', body: 'Hi' }).every((c) => c.ok)).toBe(true)
    expect(readyChecks('LinkedInMessage', { recipient: '', subject: '', body: 'x'.repeat(301) }).filter((c) => !c.ok).map((c) => c.label)).toEqual(['Under 300 characters'])
  })
})

describe('sign-off', () => {
  it('blocks a message that ends on a sign-off with no name', () => {
    for (const body of ['Hello team,\n\nWe can help.\n\nRegards,', 'Hi,\nThanks\n', 'Hello\nBest regards,\n  ']) expect(endsWithoutName(body)).toBe(true)
    const checks = readyChecks('Email', { recipient: 'a@b.co', subject: 'Hi', body: 'Hello\n\nRegards,' })
    expect(checks.find((c) => c.label === 'Signed with your name')?.ok).toBe(false)
  })
  it('lets a signed message through', () => {
    expect(endsWithoutName('Hello\n\nRegards,\nAsha')).toBe(false)
    expect(endsWithoutName('Thanks for the update, I will reply by Friday.')).toBe(false)
    expect(readyChecks('Email', { recipient: 'a@b.co', subject: 'Hi', body: 'Hello\n\nRegards,\nAsha' }).every((c) => c.ok)).toBe(true)
  })
})
