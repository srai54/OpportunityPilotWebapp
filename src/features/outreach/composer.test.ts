import { describe, expect, it } from 'vitest'
import { composerTarget, unresolvedPlaceholder, webComposeUrl } from './composer'

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
