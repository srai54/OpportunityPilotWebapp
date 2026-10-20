/**
 * The source catalogue behind the "Sites" picker on Find (J1, J2): every site All sites can read, the regions it covers, what it
 * costs, and whether its own data says remote or contract. Pure data and helpers, no React.
 */

export type RegionId = 'all' | 'global-remote' | 'india' | 'europe' | 'uk' | 'us-canada' | 'middle-east' | 'anz' | 'apac'

export type Region = { id: RegionId; label: string; /** Country preselected for the search, '' = any. */ country: string; /** Picking it turns Remote only on. */ remote?: boolean }

export const REGIONS: readonly Region[] = [
  { id: 'all', label: 'All regions', country: '' },
  { id: 'global-remote', label: 'Global remote', country: '', remote: true },
  { id: 'india', label: 'India', country: 'India' },
  { id: 'europe', label: 'Europe', country: '' },
  { id: 'uk', label: 'UK', country: 'United Kingdom' },
  { id: 'us-canada', label: 'US & Canada', country: '' },
  { id: 'middle-east', label: 'Middle East', country: '' },
  { id: 'anz', label: 'Australia & NZ', country: '' },
  { id: 'apac', label: 'Asia-Pacific', country: '' },
]

export type Access = 'Free' | 'Credits' | 'Needs key'
/** Three lists, so the same vacancy from several APIs is recognised and every lead shows where it came from. */
export type SourceKind = 'Job board' | 'Data provider' | 'Freelance marketplace'
/**
 * Where remote / contract comes from today: the site's own field (Field), or our reading of the posting's title and text (Text,
 * see jobSignals.ts). The free feeds' own job-type fields are not mapped yet (TASKS S4), so they are Text until that lands.
 */
export type Coverage = 'Field' | 'Text' | 'None'

export type Source = {
  id: string
  label: string
  /** Regions this source has postings for ('all' is implied for every source). */
  regions: readonly Exclude<RegionId, 'all'>[]
  access: Access
  remote: Coverage
  contract: Coverage
  /** Paid board (JSearch / RapidAPI credits): only searchable when the server has the key. */
  paid: boolean
  /** Job board by default; aggregators and freelance marketplaces are kept apart. */
  kind?: SourceKind
}

export const SOURCES: readonly Source[] = [
  { id: 'Arbeitnow', label: 'Arbeitnow', regions: ['europe', 'global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'Jobicy', label: 'Jobicy', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'WeWorkRemotely', label: 'We Work Remotely', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'Remotive', label: 'Remotive', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'RemoteOk', label: 'Remote OK', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'Himalayas', label: 'Himalayas', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'WorkingNomads', label: 'Working Nomads', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Text', paid: false },
  { id: 'HackerNews', label: 'HN Who is hiring', regions: ['global-remote', 'us-canada', 'europe'], access: 'Free', remote: 'Text', contract: 'Text', paid: false },
  { id: 'TheMuse', label: 'The Muse', regions: ['us-canada'], access: 'Free', remote: 'Text', contract: 'Text', paid: false },
  { id: 'Instahyre', label: 'Instahyre', regions: ['india'], access: 'Free', remote: 'Text', contract: 'Text', paid: false },
  { id: 'Adzuna', label: 'Adzuna', regions: ['india', 'europe', 'uk', 'us-canada', 'anz', 'apac'], access: 'Needs key', remote: 'Text', contract: 'Text', paid: false, kind: 'Data provider' },
  { id: 'Jooble', label: 'Jooble', regions: ['india', 'europe', 'uk', 'us-canada', 'middle-east', 'anz', 'apac'], access: 'Needs key', remote: 'Text', contract: 'Field', paid: false, kind: 'Data provider' },
  { id: 'Careerjet', label: 'Careerjet', regions: ['india', 'europe', 'uk', 'us-canada', 'middle-east', 'anz', 'apac'], access: 'Needs key', remote: 'Text', contract: 'Text', paid: false, kind: 'Data provider' },
  { id: 'Findwork', label: 'Findwork', regions: ['global-remote', 'us-canada', 'europe'], access: 'Needs key', remote: 'Field', contract: 'Field', paid: false },
  { id: 'UsaJobs', label: 'USAJOBS', regions: ['us-canada'], access: 'Needs key', remote: 'Text', contract: 'Field', paid: false },
  { id: 'Freelancer', label: 'Freelancer.com', regions: ['global-remote'], access: 'Free', remote: 'Field', contract: 'Field', paid: false, kind: 'Freelance marketplace' },
  { id: 'Reed', label: 'Reed', regions: ['uk'], access: 'Needs key', remote: 'Text', contract: 'Text', paid: false },
  { id: 'Arbeitsagentur', label: 'Bundesagentur für Arbeit', regions: ['europe'], access: 'Free', remote: 'Text', contract: 'Text', paid: false },
  { id: 'LinkedIn', label: 'LinkedIn', regions: ['india', 'europe', 'uk', 'us-canada', 'middle-east', 'anz', 'apac', 'global-remote'], access: 'Credits', remote: 'Field', contract: 'Field', paid: true, kind: 'Data provider' },
  { id: 'Indeed', label: 'Indeed', regions: ['india', 'europe', 'uk', 'us-canada', 'middle-east', 'anz', 'apac'], access: 'Credits', remote: 'Field', contract: 'Field', paid: true },
  { id: 'Seek', label: 'SEEK', regions: ['anz'], access: 'Credits', remote: 'Field', contract: 'Field', paid: true },
  { id: 'Naukri', label: 'Naukri', regions: ['india'], access: 'Credits', remote: 'Text', contract: 'Text', paid: true },
]

export const regionLabel = (id: RegionId) => REGIONS.find((r) => r.id === id)?.label ?? 'All regions'

/** The sources a region uses; every source for "All regions". */
export function sourcesFor(region: RegionId): Source[] {
  return region === 'all' ? [...SOURCES] : SOURCES.filter((s) => (s.regions as readonly string[]).includes(region))
}

/** The "off" set for a region: every source outside it is switched off, every source inside it is on. */
export function offForRegion(region: RegionId): Set<string> {
  const inside = new Set(sourcesFor(region).map((s) => s.id))
  return new Set(SOURCES.filter((s) => !inside.has(s.id)).map((s) => s.id))
}

/** Sources grouped for the picker: the region's own sources first (in catalogue order), then a group per access kind. */
export function groupSources(region: RegionId): { title: string; sources: Source[] }[] {
  const list = sourcesFor(region)
  return [
    { title: 'Free', sources: list.filter((s) => s.access === 'Free') },
    { title: 'Needs a server key', sources: list.filter((s) => s.access === 'Needs key') },
    { title: 'Uses credits', sources: list.filter((s) => s.access === 'Credits') },
  ].filter((g) => g.sources.length > 0)
}

export const coverageLabel = (c: Coverage) => (c === 'Field' ? 'from the site' : c === 'Text' ? 'from the text' : 'not shown')

/** True when no source the server can search right now covers the region (e.g. the Middle East without the job-data key). */
export function regionHasNoReadySource(region: RegionId, paidReady: boolean): boolean {
  return sourcesFor(region).every((s) => s.paid && !paidReady)
}
