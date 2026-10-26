import { useState } from 'react'
import { useApi } from '../../lib/useApi'
import type { Journey } from './journeyModel'

/** The candidate's journey through their private link (when shared), plus the latest copy after they log progress. */
export function useMyJourney(token: string) {
  const url = `/api/v1/public/progress/${encodeURIComponent(token)}/journey`
  const res = useApi<Journey>(url)
  const [latest, setLatest] = useState<Journey>()
  return { url, journey: latest ?? res.data, setLatest }
}
