import { describe, expect, it } from 'vitest'
import type { Capabilities } from '../../lib/types'
import { readinessChecks, readyCount, sourcesNeedingWork } from './readinessModel'

const caps = (o: Partial<Capabilities>): Capabilities => ({ environment: 'Production', databaseProvider: 'Postgres', aiMode: 'Groq', setupRequired: [], guestSignIn: true, temporaryStorage: false,
  items: [{ key: 'a', name: 'Jobicy', category: 'Sources', status: 'Ready', detail: '', can: [], cannot: [] }, { key: 'b', name: 'SEEK', category: 'Sources', status: 'NotConfigured', detail: 'No key', can: [], cannot: [] }], ...o })

describe('readiness', () => {
  it('reports AI, data, setup and sources from the server only', () => {
    const checks = readinessChecks(caps({}))
    expect(checks.map((c) => c.ok)).toEqual([true, true, true, false])
    expect(checks[3].text).toBe('1 of 2 live')
    expect(readyCount(checks)).toBe(3)
  })
  it('flags rules-only AI, temporary storage and setup gaps', () => {
    const checks = readinessChecks(caps({ aiMode: 'Rules', temporaryStorage: true, setupRequired: ['Mail__TokenKey is not set.'] }))
    expect(checks.slice(0, 3).every((c) => !c.ok)).toBe(true)
  })
  it('lists the sources that are not live, and nothing before the answer', () => {
    expect(sourcesNeedingWork(caps({})).map((s) => s.name)).toEqual(['SEEK'])
    expect(readinessChecks(undefined)).toEqual([])
  })
})
