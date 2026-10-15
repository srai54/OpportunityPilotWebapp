import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import type { Campaign, OpportunityDetail, Profile } from '../../lib/types'
import { confirmFilledClaims, normalizeData } from './profileFields'

/**
 * Replaces the dead-end "Confirm the campaign profile…" error with one button that confirms the profile (the person's own
 * saved claims) and carries on. If the profile has nothing to confirm, it says so and links to it instead.
 */
export function ProfileConfirmNotice({ opportunityId, onConfirmed }: Readonly<{ opportunityId: string; onConfirmed: () => void }>) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Error>()
  const [profileId, setProfileId] = useState<string>()
  const [empty, setEmpty] = useState(false)

  async function confirm() {
    setBusy(true); setProblem(undefined)
    try {
      const opp = await api<OpportunityDetail>(`/api/v1/opportunities/${opportunityId}`)
      const campaign = await api<Campaign>(`/api/v1/campaigns/${opp.campaignId}`)
      setProfileId(campaign.profileId)
      const profile = await api<Profile>(`/api/v1/profiles/${campaign.profileId}`)
      const data = confirmFilledClaims(profile.type, normalizeData(profile.data))
      if (!Object.values(data.confirmations).some(Boolean)) { setEmpty(true); return }
      const saved = profile.confirmedAt ? profile
        : await api<Profile>(`/api/v1/profiles/${profile.id}`, { method: 'PUT', body: JSON.stringify({ name: profile.name, data, confirmed: true, expectedVersion: profile.version }) })
      // Never leave the button spinning on a profile the server still treats as unconfirmed: say so and point at it.
      if (!saved.confirmedAt) throw new Error('The profile was saved but is still not confirmed: a required field is empty. Open the profile, fill it in and save.')
      onConfirmed()
    } catch (e) { setProblem(e as Error) } finally { setBusy(false) }
  }

  return (
    <div className="notice notice-warning stack-2" role="alert">
      <span><strong>Your profile needs one confirmation first.</strong> Messages are written from your profile, and only claims you have confirmed are used. Confirming marks what you have already written there as accurate.</span>
      <div className="row wrap">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void confirm()}>{busy ? 'Confirming…' : 'Confirm my profile and continue'}</button>
        <Link className="btn btn-ghost btn-sm" to={profileId ? `/profiles/${profileId}` : '/profiles'}>Review my profile first</Link>
      </div>
      {empty && <div className="stack-2"><span>Your profile has no skills yet. Add a few (e.g. "Python, SQL, 4 years"), save, then come back.</span>
        <Link className="btn btn-primary btn-sm" to={profileId ? `/profiles/${profileId}` : '/profiles'}>Add my skills</Link></div>}
      {problem && <ErrorNotice error={problem} />}
    </div>
  )
}
