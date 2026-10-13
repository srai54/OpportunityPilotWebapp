import { supabase } from '../../lib/supabase'
import { factorName, normalizeTotp } from './authModel'

function client() {
  if (!supabase) throw new Error('Accounts are not switched on for this deployment yet.')
  return supabase
}

export interface TotpFactor { id: string; friendlyName: string | null; createdAt: string }

/** Verified authenticator-app factors of the signed-in person (unfinished setups are not listed). */
export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await client().auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return data.totp.map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null, createdAt: f.created_at }))
}

/** Starts setup: the QR code (an SVG data address) and the secret to type by hand. Nothing is active until a code is confirmed. */
export async function startTotpSetup(): Promise<{ factorId: string; qrCode: string; secret: string }> {
  const auth = client().auth.mfa
  // A setup that was abandoned half-way leaves an unverified factor behind; remove it so a new one can be made.
  const { data: all } = await auth.listFactors()
  for (const f of all?.all ?? []) if (f.factor_type === 'totp' && f.status === 'unverified') await auth.unenroll({ factorId: f.id })
  const { data, error } = await auth.enroll({ factorType: 'totp', friendlyName: factorName(new Date()) })
  if (error) throw new Error(error.message)
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Checks a six-digit code against a factor (used to finish setup and to sign in). Throws with Supabase's message on a wrong code. */
export async function confirmTotp(factorId: string, code: string): Promise<void> {
  const auth = client().auth.mfa
  const challenge = await auth.challenge({ factorId })
  if (challenge.error) throw new Error(challenge.error.message)
  const verified = await auth.verify({ factorId, challengeId: challenge.data.id, code: normalizeTotp(code) })
  if (verified.error) throw new Error(verified.error.message)
}

export async function removeTotp(factorId: string): Promise<void> {
  const { error } = await client().auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}
