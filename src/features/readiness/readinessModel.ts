import type { Capabilities, Capability } from '../../lib/types'

/**
 * "Demo readiness": one honest look, before a demo or judging, at what will work live. Built only from GET /api/v1/capabilities
 * (no guesses): AI on or rules-only, real database or temporary storage, setup gaps, and every source's own status.
 */
export type Check = { label: string; ok: boolean; text: string }

const READY = new Set(['Ready', 'Configured'])

export function readinessChecks(c: Capabilities | undefined): Check[] {
  if (!c) return []
  const rulesOnly = /rule|off|none/i.test(c.aiMode ?? '')
  const sources = c.items.filter((i) => i.category === 'Sources')
  const live = sources.filter((s) => READY.has(s.status))
  return [
    { label: 'AI', ok: !rulesOnly, text: rulesOnly ? `Rules only (${c.aiMode}). Set the AI key on the API server so judges see AI answers.` : `On (${c.aiMode})` },
    { label: 'Data', ok: !c.temporaryStorage, text: c.temporaryStorage ? 'Temporary storage: data resets when the server restarts.' : `Saved in ${c.databaseProvider}` },
    { label: 'Setup', ok: c.setupRequired.length === 0, text: c.setupRequired.length === 0 ? 'Nothing missing' : c.setupRequired.join(' ') },
    { label: 'Sources', ok: sources.length > 0 && live.length === sources.length, text: sources.length === 0 ? 'No source status reported.' : `${live.length} of ${sources.length} live` },
  ]
}

/** Sources that are not live, with the server's own reason, so they can be fixed (or left out of the demo). */
export function sourcesNeedingWork(c: Capabilities | undefined): Capability[] {
  return (c?.items ?? []).filter((i) => i.category === 'Sources' && !READY.has(i.status))
}

export const readyCount = (checks: readonly Check[]) => checks.filter((x) => x.ok).length
