import { useRef, useState } from 'react'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import type { ProfileData, ProfileType } from '../../lib/types'
import { FIELDS } from './profileFields'

interface Suggestion { key: string; text: string; why: string }
interface ImproveResult { suggestions: Suggestion[]; source: string; fallbackReason: string | null }

/** Shrinks a picture to a 160 px square JPEG data URL (about 10 KB), small enough to keep inside the profile. */
async function toSmallPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const side = Math.min(img.width, img.height)
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160
    canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally { URL.revokeObjectURL(url) }
}

/**
 * The top of the profile editor: a photo (add, change, remove) and "Improve with AI", which suggests clearer wording for the person's own
 * fields — never new facts — each with Use. Nothing is saved until the person presses Save.
 */
export function ProfileExtras({ type, data, setField }: Readonly<{ type: ProfileType; data: ProfileData; setField: (key: string, value: string) => void }>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImproveResult>()
  const [error, setError] = useState<Error>()
  const photo = data.fields.photo
  const labels = Object.fromEntries(FIELDS[type].map((f) => [f.key, f.label]))

  async function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError(new Error('Choose a picture (JPG or PNG).')); return }
    try { setField('photo', await toSmallPhoto(file)); setError(undefined) } catch { setError(new Error('That picture could not be read. Try another one.')) }
  }
  async function improve() {
    setBusy(true); setError(undefined); setResult(undefined)
    try {
      const fields = Object.fromEntries(Object.entries(data.fields).filter(([k, v]) => k !== 'photo' && v?.trim()))
      setResult(await api<ImproveResult>('/api/v1/profiles/improve', { method: 'POST', body: JSON.stringify({ type, fields }) }))
    } catch (e) { setError(e as Error) } finally { setBusy(false) }
  }

  return (
    <div className="profile-extras grid-wide">
      <div className="profile-photo">
        <span className="profile-avatar" aria-hidden={!photo}>{photo ? <img src={photo} alt="Your profile photo" /> : (data.fields.outreachIdentity?.trim()?.[0] ?? '+')}</span>
        <div className="stack-1">
          <strong>Photo</strong>
          <div className="row wrap">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>{photo ? 'Change' : 'Add a photo'}</button>
            {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setField('photo', '')}>Remove</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </div>
      </div>
      <div className="profile-improve stack-2">
        <div className="row wrap">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void improve()}>{busy ? 'Reading your profile…' : '✨ Improve with AI'}</button>
          <span className="muted-small">Clearer wording for what you wrote. It never adds facts.</span>
        </div>
        {error && <ErrorNotice error={error} />}
        {result && (result.suggestions.length === 0
          ? <p className="muted-small" role="status">Looks good already — nothing to change.</p>
          : <ul className="plain-list profile-suggestions" role="status">
            {result.suggestions.map((s) => (
              <li key={s.key} className="profile-suggestion">
                <div className="grow"><strong>{labels[s.key] ?? s.key}</strong>{s.why && <span className="muted-small"> · {s.why}</span>}<p className="small">{s.text}</p></div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setField(s.key, s.text); setResult((r) => r && { ...r, suggestions: r.suggestions.filter((x) => x.key !== s.key) }) }}>Use<span className="sr-only"> for {labels[s.key] ?? s.key}</span></button>
              </li>
            ))}
          </ul>)}
        {result?.source === 'Rules' && result.suggestions.length > 0 && <p className="muted-small">AI is off right now, so these are tidy-ups only.</p>}
      </div>
    </div>
  )
}
