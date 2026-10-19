import { describe, expect, it } from 'vitest'
import { FREE_SITES, PAID_SITES } from './allSitesModel'
import { groupSources, offForRegion, REGIONS, regionHasNoReadySource, SOURCES, sourcesFor } from './sourcesModel'

describe('source catalogue (J1, J2)', () => {
  it('covers every site All sites can search, once', () => {
    const ids = SOURCES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual([...FREE_SITES.map((s) => s.id), ...PAID_SITES.map((s) => s.id)].sort())
  })
  it('marks exactly the JSearch boards as paid', () => {
    expect(SOURCES.filter((s) => s.paid).map((s) => s.id).sort()).toEqual(PAID_SITES.map((s) => s.id).sort())
  })
  it('every region except All has its own list; All has everything', () => {
    expect(sourcesFor('all')).toHaveLength(SOURCES.length)
    expect(sourcesFor('anz').map((s) => s.id)).toEqual(expect.arrayContaining(['Seek', 'Adzuna', 'LinkedIn']))
    expect(sourcesFor('india').map((s) => s.id)).toEqual(expect.arrayContaining(['Instahyre', 'Naukri']))
    expect(sourcesFor('global-remote').map((s) => s.id)).not.toContain('Seek')
  })
  it('a region switches off every source outside it', () => {
    const off = offForRegion('india')
    expect(off.has('Instahyre')).toBe(false)
    expect(off.has('Jobicy')).toBe(true)
    expect(offForRegion('all').size).toBe(0)
  })
  it('groups by access and drops empty groups', () => {
    expect(groupSources('middle-east').map((g) => g.title)).toEqual(['Needs a server key', 'Uses credits'])
    expect(groupSources('all').map((g) => g.title)).toEqual(['Free', 'Needs a server key', 'Uses credits'])
  })
  it('says when a region has nothing to search without the job-data key', () => {
    // The Middle East now has Jooble and Careerjet (keys on the server) next to the credit boards.
    expect(regionHasNoReadySource('middle-east', false)).toBe(false)
    expect(regionHasNoReadySource('india', false)).toBe(false)
  })
  it('Global remote turns Remote only on and India preselects India', () => {
    expect(REGIONS.find((r) => r.id === 'global-remote')?.remote).toBe(true)
    expect(REGIONS.find((r) => r.id === 'india')?.country).toBe('India')
  })
})
