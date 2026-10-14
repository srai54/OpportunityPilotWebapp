/** Naukri has no public search API: these build the links and the campaign the desktop agent fills. */

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Naukri's own search page for a role and an optional place, e.g. /react-developer-jobs-in-pune?k=react%20developer&l=pune */
export function naukriSearchUrl(query: string, location = ''): string {
  const q = slug(query) || 'jobs'
  const l = slug(location)
  const p = new URLSearchParams({ k: query.trim() })
  if (location.trim()) p.set('l', location.trim())
  return `https://www.naukri.com/${q}-jobs${l ? `-in-${l}` : ''}?${p}`
}

/** A new campaign for this search with the Naukri board chosen, so the builder shows the agent's collect command. */
export function naukriCampaignPath(workspace: 'candidate' | 'sales', query: string, location: string): string {
  const p = new URLSearchParams({ board: 'Naukri', mode: workspace === 'sales' ? 'Customer' : 'Job', keywords: query.trim().slice(0, 200), name: `${query.trim().slice(0, 60)} — Naukri` })
  if (location.trim()) p.set('location', location.trim().slice(0, 100))
  return `/campaigns/new?${p}`
}
