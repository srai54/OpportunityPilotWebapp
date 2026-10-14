import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { useAuth } from './AuthContext'
import { validTotp } from './authModel'
import { HankoSecurityCard } from './HankoElements'
import { confirmTotp, listTotpFactors, removeTotp, startTotpSetup, type TotpFactor } from './mfa'

/** Settings → Security: Hanko's own profile for Hanko accounts, the Supabase authenticator-app card for Supabase ones. */
export function SecurityCard() {
  const { user } = useAuth()
  return user?.provider === 'hanko' ? <HankoSecurityCard /> : <SupabaseSecurityCard />
}

/** Turn the Supabase authenticator-app code on or off. Only shown for real Supabase accounts (not guests). */
function SupabaseSecurityCard() {
  const { mode, user, refreshMfa } = useAuth()
  const [factors, setFactors] = useState<TotpFactor[] | null>(null)
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const [done, setDone] = useState<string>()
  const real = mode === 'supabase' && user?.provider === 'supabase'

  const load = useCallback(async () => {
    try { setFactors(await listTotpFactors()) } catch (e) { setError(e as Error) }
  }, [])
  useEffect(() => {
    if (!real) return
    let live = true
    listTotpFactors().then((f) => { if (live) setFactors(f) }).catch((e: Error) => { if (live) setError(e) })
    return () => { live = false }
  }, [real])
  if (!real) return null

  async function begin() {
    setBusy(true); setError(undefined); setDone(undefined)
    try { setSetup(await startTotpSetup()) } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  async function confirm(e: FormEvent) {
    e.preventDefault()
    if (!setup || !validTotp(code)) return
    setBusy(true); setError(undefined)
    try {
      await confirmTotp(setup.factorId, code)
      setSetup(null); setCode(''); setDone('Authenticator app is on. You will be asked for a code each time you sign in.')
      await load(); await refreshMfa()
    } catch (err) { setError(err as Error) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true); setError(undefined); setDone(undefined)
    try { await removeTotp(id); setDone('Authenticator app removed.'); await load(); await refreshMfa() } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  return (
    <Card title="Security">
      <div className="stack-3">
        <p className="muted-small">Add a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password) on top of your password or provider sign-in. Free, and nothing to install on our side.</p>
        {done && <p className="notice notice-success" role="status">{done}</p>}
        {error && <ErrorNotice error={error} />}
        {factors?.length ? (
          <ul className="plain-list mailbox-list">
            {factors.map((f) => (
              <li key={f.id} className="mailbox-row">
                <strong>Authenticator app</strong><Badge tone="success">On</Badge>
                <span className="grow" />
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void remove(f.id)}>Turn off<span className="sr-only"> authenticator app</span></button>
              </li>
            ))}
          </ul>
        ) : setup ? (
          <form onSubmit={confirm} className="stack-3">
            <p><strong>1.</strong> Scan this with your authenticator app.</p>
            <img className="totp-qr" src={setup.qrCode} alt="QR code to add OpportunityPilot to your authenticator app" width={176} height={176} />
            <p className="muted-small">Cannot scan? Type this key instead: <code>{setup.secret}</code></p>
            <div className="field">
              <label htmlFor="setup-code"><strong>2.</strong> Enter the 6-digit code it shows</label>
              <input id="setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="row wrap">
              <button className="btn btn-primary" type="submit" disabled={busy || !validTotp(code)}>{busy ? 'Checking…' : 'Turn on'}</button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setSetup(null); setCode('') }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="row wrap">
            <button className="btn btn-secondary" type="button" disabled={busy || factors === null} onClick={() => void begin()}>Set up authenticator app</button>
            <span className="muted-small">Not on yet.</span>
          </div>
        )}
      </div>
    </Card>
  )
}
