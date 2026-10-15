import { useState, type FormEvent } from 'react'
import { Avatar, Card } from '../../components/cards'
import { CallButton } from '../../components/CallButton'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { displayPhone, normalisePhone, toWhatsApp } from '../../lib/phone'
import type { StaffingContact } from '../staffing/staffingTypes'

/** Sales deal page: the client contact with one-tap Call, WhatsApp and Email (all through the person's own phone and mail app). */
export function ContactCallCard({ contact, client, dealId, onSaved }: Readonly<{ contact: StaffingContact; client: string | null; dealId: string; onSaved?: () => void }>) {
  const phone = contact.phone ?? null
  const wa = toWhatsApp(phone)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const invalid = value.trim() !== '' && !normalisePhone(value)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true); setError(undefined)
    try {
      await api(`/api/v1/staffing/accounts/${contact.accountId}/contacts/${contact.id}`, { method: 'PUT', body: JSON.stringify({
        name: contact.name, title: contact.title, email: contact.email, emailVerified: contact.emailVerified, linkedInUrl: contact.linkedInUrl,
        evidence: contact.evidence, phone: value.trim() || null, expectedVersion: contact.version,
      }) })
      setEditing(false)
      onSaved?.()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }

  return <Card title="Client contact" actions={onSaved && !editing ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
    {phone ? 'Change number' : 'Add number'}<span className="sr-only"> for {contact.name}</span></button> : undefined}>
    <div className="contact-call">
      <Avatar name={contact.name} />
      <div className="contact-call-main">
        <strong>{contact.name}</strong>
        <span className="muted-small">{[contact.title, client].filter(Boolean).join(' · ') || 'Contact'}</span>
        {contact.email && <span className="small contact-call-line">{contact.email}</span>}
        {phone && <span className="small op-numeric">{displayPhone(phone)}</span>}
      </div>
    </div>
    {editing && <form className="stack-2" onSubmit={(e) => void save(e)}>
      <div className="field">
        <label htmlFor={`contact-phone-${contact.id}`}>Phone</label>
        <input id={`contact-phone-${contact.id}`} type="tel" inputMode="tel" autoComplete="tel" value={value} maxLength={320} onChange={(e) => setValue(e.target.value)}
          placeholder="+91 98765 43210" aria-invalid={invalid || undefined} aria-describedby={invalid ? `contact-phone-${contact.id}-err` : undefined} />
        {invalid && <span className="field-error" id={`contact-phone-${contact.id}-err`}>Use a phone number, like +91 98765 43210.</span>}
      </div>
      {error && <ErrorNotice error={error} />}
      <div className="row wrap">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || invalid}>{busy ? 'Saving…' : 'Save number'}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setValue(phone ?? ''); setError(undefined) }}>Cancel</button>
      </div>
    </form>}
    {!editing && ((phone || contact.email) ? <div className="row wrap">
      <CallButton phone={phone} who={contact.name} entityType="contact" entityId={contact.id} label="Call"
        context={{ dealId, contactId: contact.id, context: client }} />
      {wa && <a className="btn btn-secondary btn-sm" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp<span className="sr-only"> {contact.name} (opens in a new tab)</span></a>}
      {contact.email && <a className="btn btn-secondary btn-sm" href={`mailto:${contact.email}`}>Email<span className="sr-only"> {contact.name}</span></a>}
    </div> : <p className="muted-small">No phone or email saved for {contact.name}.</p>)}
  </Card>
}
