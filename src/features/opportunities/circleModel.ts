/** The people around a job or lead (API: /api/v1/opportunities/{id}/circle), found by the desktop agent on LinkedIn or added by hand. */

export type CircleRelation = 'Recruiter' | 'HiringManager' | 'Team' | 'Connection' | 'Other'
export interface CirclePerson { id: string; name: string; title: string | null; profileUrl: string; relation: CircleRelation; degree: number | null; source: string; foundAt: string }
export interface Circle { opportunityId: string; requestedAt: string | null; mappedAt: string | null; status: 'NotRequested' | 'Waiting' | 'Ready'; people: CirclePerson[] }

export const RELATIONS: { key: CircleRelation; job: string; sales: string }[] = [
  { key: 'Connection', job: 'People you know there', sales: 'People you know there' },
  { key: 'HiringManager', job: 'Hiring managers', sales: 'Decision makers' },
  { key: 'Recruiter', job: 'Recruiters', sales: 'Recruiters and HR' },
  { key: 'Team', job: 'The team', sales: 'The team' },
  { key: 'Other', job: 'Others', sales: 'Others' },
]

/** The circle grouped in the order a person would reach out: people they know first, then whoever decides, then recruiters. */
export function groupCircle(people: readonly CirclePerson[]): { relation: CircleRelation; people: CirclePerson[] }[] {
  return RELATIONS.map((r) => ({
    relation: r.key,
    people: people.filter((p) => p.relation === r.key).sort((a, b) => (a.degree ?? 9) - (b.degree ?? 9) || a.name.localeCompare(b.name)),
  })).filter((g) => g.people.length > 0)
}

/** "1st", "2nd", "3rd+" for LinkedIn connection degree. */
export function degreeLabel(d: number | null): string | null {
  if (d == null) return null
  return d === 1 ? '1st' : d === 2 ? '2nd' : '3rd+'
}

/** A LinkedIn profile link the API will accept (https://www.linkedin.com/in/…), or null. */
export function profileUrlProblem(url: string): string | null {
  const v = url.trim()
  if (!v) return 'Paste their LinkedIn profile link.'
  try {
    const u = new URL(v)
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname) || !u.pathname.toLowerCase().startsWith('/in/')) return 'Use a profile link that looks like https://www.linkedin.com/in/name.'
    return null
  } catch { return 'Use a profile link that looks like https://www.linkedin.com/in/name.' }
}
