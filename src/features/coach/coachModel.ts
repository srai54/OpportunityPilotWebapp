/** One tip: it points at the element carrying `data-coach="<target>"` and says one useful thing. */
export type CoachStep = { target: string; title: string; body: string }
export type CoachFlow = { id: string; label: string; steps: CoachStep[] }

export const COACH_OFF_KEY = 'op.coach.off'
export const COACH_PREFIX = 'op.coach.'
export const MAX_STEPS = 4

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStore(): Store | null {
  try { return window.localStorage } catch { return null }
}

export function flowDone(id: string, store: Store | null = safeStore()): boolean {
  try { return store?.getItem(COACH_PREFIX + id) === '1' } catch { return false }
}

export function markFlowDone(id: string, store: Store | null = safeStore()): void {
  try { store?.setItem(COACH_PREFIX + id, '1') } catch { /* tips may show again next visit */ }
}

export function tipsOff(store: Store | null = safeStore()): boolean {
  try { return store?.getItem(COACH_OFF_KEY) === '1' } catch { return false }
}

export function setTipsOff(off: boolean, store: Store | null = safeStore()): void {
  try { if (off) store?.setItem(COACH_OFF_KEY, '1'); else store?.removeItem(COACH_OFF_KEY) } catch { /* ignore */ }
}

/** Show tips again: clears every "seen" flag and the global off switch. */
export function resetAllTips(flowIds: string[], store: Store | null = safeStore()): void {
  try {
    store?.removeItem(COACH_OFF_KEY)
    for (const id of flowIds) store?.removeItem(COACH_PREFIX + id)
  } catch { /* ignore */ }
}

/** Should this flow start by itself? Only once, only if tips are on, and never when disabled. */
export function shouldAutoStart(id: string, store: Store | null = safeStore()): boolean {
  return !tipsOff(store) && !flowDone(id, store)
}

/** The steps whose target is on the page right now. A missing target is skipped, never shown floating. */
export function presentSteps(flow: CoachFlow, exists: (target: string) => boolean): CoachStep[] {
  return flow.steps.filter((s) => exists(s.target)).slice(0, MAX_STEPS)
}

/** Which flow belongs to a route, or null. The campaign form and the opportunity page are matched exactly. */
export function flowIdForPath(pathname: string): string | null {
  if (pathname === '/') return 'overview'
  if (pathname === '/wellfound') return 'find'
  if (pathname === '/campaigns/new') return 'campaign'
  if (pathname === '/opportunities') return 'opps'
  if (/^\/opportunities\/[^/]+$/.test(pathname)) return 'opp'
  if (pathname === '/outreach') return 'outreach'
  return null
}
