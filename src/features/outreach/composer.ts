import type { DraftChannel } from '../../lib/types'

export type ComposerTarget = {
  /** What happens on the one click: open the mail app, or copy the text and open a site. */
  kind: 'mailto' | 'site' | 'copy'
  url: string | null
  /** Short action label, e.g. "Open email app". */
  label: string
  /** Whether the message text must be copied to the clipboard first (sites cannot be pre-filled). */
  copy: boolean
}

const MAILTO_MAX = 1800

/** Where an email opens. The web options also cover an installed Outlook/Gmail app (a PWA), which is just that site in its own window. */
export type MailApp = 'default' | 'outlook' | 'outlookPersonal' | 'gmail'

export const MAIL_APPS: { value: MailApp; label: string; hint: string }[] = [
  { value: 'default', label: 'Default mail app', hint: 'Opens whatever your computer uses for email links.' },
  { value: 'outlook', label: 'Outlook (work or school) — web / installed app', hint: 'Opens a new message in Outlook on the web, or in the installed Outlook app if Edge hands it over.' },
  { value: 'outlookPersonal', label: 'Outlook.com (personal) — web / installed app', hint: 'For @outlook.com, @hotmail.com and @live.com accounts.' },
  { value: 'gmail', label: 'Gmail — web / installed app', hint: 'Opens a new message in Gmail on the web.' },
]

const MAIL_APP_KEY = 'op.mailApp'

export function readMailApp(): MailApp {
  try {
    const v = window.localStorage.getItem(MAIL_APP_KEY)
    return MAIL_APPS.some((m) => m.value === v) ? (v as MailApp) : 'default'
  } catch {
    return 'default'
  }
}

export function writeMailApp(app: MailApp): void {
  try { window.localStorage.setItem(MAIL_APP_KEY, app) } catch { /* the choice lasts for this page view only */ }
}

/** The compose link of a web mail app, or null for the default app. The body is left out when the link would be too long. */
export function webComposeUrl(app: MailApp, d: { recipient: string; subject: string; body: string }): { url: string; bodyIncluded: boolean } | null {
  if (app === 'default') return null
  const build = (withBody: boolean) => {
    const q = new URLSearchParams()
    if (app === 'gmail') { q.set('view', 'cm'); q.set('fs', '1'); if (d.recipient.trim()) q.set('to', d.recipient.trim()); if (d.subject.trim()) q.set('su', d.subject.trim()); if (withBody) q.set('body', d.body) }
    else { if (d.recipient.trim()) q.set('to', d.recipient.trim()); if (d.subject.trim()) q.set('subject', d.subject.trim()); if (withBody) q.set('body', d.body) }
    const base = app === 'gmail' ? 'https://mail.google.com/mail/?' : app === 'outlookPersonal' ? 'https://outlook.live.com/mail/0/deeplink/compose?' : 'https://outlook.office.com/mail/deeplink/compose?'
    return base + q.toString().replaceAll('+', '%20')
  }
  const full = build(true)
  return full.length <= MAILTO_MAX ? { url: full, bodyIncluded: true } : { url: build(false), bodyIncluded: false }
}

/** Where the one-click "Approve & send" takes the user. Nothing is sent by the app: the user sends, then records a receipt. */
export function composerTarget(channel: DraftChannel, d: { recipient: string; subject: string; body: string }, mailApp: MailApp = 'default'): ComposerTarget {
  const to = d.recipient.trim()
  if (channel === 'Email') {
    const web = webComposeUrl(mailApp, d)
    if (web) {
      const name = MAIL_APPS.find((m) => m.value === mailApp)?.label.split(' —')[0] ?? 'your mail app'
      return { kind: 'site', url: web.url, label: web.bodyIncluded ? `Open a new message in ${name}` : `Open a new message in ${name} (text copied)`, copy: !web.bodyIncluded }
    }
    const q = new URLSearchParams()
    if (d.subject.trim()) q.set('subject', d.subject.trim())
    q.set('body', d.body)
    const url = `mailto:${encodeURIComponent(to)}?${q.toString().replaceAll('+', '%20')}`
    // A very long body cannot travel in a mailto link: fall back to copy + empty composer.
    return url.length > MAILTO_MAX
      ? { kind: 'mailto', url: `mailto:${encodeURIComponent(to)}`, label: 'Open email app (text copied)', copy: true }
      : { kind: 'mailto', url, label: 'Open email app', copy: false }
  }
  if (channel === 'LinkedInMessage') return { kind: 'site', url: /^https:\/\/(www\.)?linkedin\.com\//i.test(to) ? to : 'https://www.linkedin.com/messaging/', label: 'Open LinkedIn Messages (text copied)', copy: true }
  if (channel === 'ContactForm') return { kind: 'site', url: /^https:\/\//i.test(to) ? to : null, label: 'Open the contact form (text copied)', copy: true }
  return { kind: 'copy', url: null, label: 'Copy the text', copy: true }
}

/** The first "[PLACEHOLDER]" left in the text, mirroring the server rule that blocks approval until it is replaced. */
export function unresolvedPlaceholder(...texts: string[]): string | null {
  for (const t of texts) {
    const open = t.indexOf('[')
    const close = open >= 0 ? t.indexOf(']', open + 1) : -1
    if (open >= 0 && close > open + 1) return t.slice(open, close + 1)
  }
  return null
}

export interface ReadyCheck {
  /** Which field to focus to fix it. */
  field: 'recipient' | 'subject' | 'body'
  label: string
  ok: boolean
  /** What to do when it is not OK. */
  fix: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SIGN_OFF = /^(kind |warm |best |with |many )?(regards|thanks|thank you|sincerely|cheers|best wishes|best|yours sincerely|yours faithfully)[,.!]?$/i

/** True when the last line of the message is a sign-off ("Regards,") with no name under it: the generated text had no name to use. */
export function endsWithoutName(body: string): boolean {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return lines.length > 0 && SIGN_OFF.test(lines[lines.length - 1])
}

/** What must be true before a message can be approved and sent, so the person is told up front instead of by a server error. */
export function readyChecks(channel: DraftChannel, d: { recipient: string; subject: string; body: string }): ReadyCheck[] {
  const checks: ReadyCheck[] = []
  if (channel === 'Email') {
    checks.push({ field: 'recipient', label: 'Recipient', ok: EMAIL.test(d.recipient.trim()), fix: 'Add the recipient email address (name@company.com).' })
    checks.push({ field: 'subject', label: 'Subject', ok: d.subject.trim().length > 0, fix: 'Add a subject line.' })
  }
  checks.push({ field: 'body', label: 'Message', ok: d.body.trim().length > 0, fix: 'Write the message.' })
  if (d.body.trim()) checks.push({ field: 'body', label: 'Signed with your name', ok: !endsWithoutName(d.body), fix: 'Add your name under the sign-off (for example "Regards, Asha"). Saving your profile fills it in next time.' })
  const left = unresolvedPlaceholder(d.body, d.subject)
  checks.push({ field: 'body', label: 'No placeholders', ok: left === null, fix: left ? `Replace ${left} with your own words.` : '' })
  if (channel === 'LinkedInMessage') checks.push({ field: 'body', label: 'Under 300 characters', ok: d.body.length <= 300, fix: 'Shorten it — LinkedIn cuts connection notes at 300 characters.' })
  return checks
}
