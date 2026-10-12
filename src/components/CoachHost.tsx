import { useCallback, useEffect, useRef, useState } from 'react'
import { COACH_FLOWS, flowById } from '../features/coach/coachFlows'
import { flowIdForPath, markFlowDone, shouldAutoStart, withWorkspace, type CoachFlow } from '../features/coach/coachModel'
import type { Workspace } from '../features/shell/shellModel'

type Placement = 'right' | 'below' | 'sheet'
type Spot = { top: number; left: number; placement: Placement; arrow: number }

const WIDTH = 330

function targetEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-coach="${id}"]`)
}

function visible(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/** Places the tip beside its target; on a phone it becomes a sheet at the bottom. */
function place(rect: DOMRect, height: number): Spot {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw < 640) return { top: vh - height - 12, left: 12, placement: 'sheet', arrow: 0 }
  // A wide target (a bar across the page) gets its tip centred underneath, not squeezed against a screen edge over the content.
  if (rect.width > vw * 0.55) {
    const left = Math.min(Math.max(rect.left + rect.width / 2 - WIDTH / 2, 12), vw - WIDTH - 12)
    const below = rect.bottom + 14
    const top = below + height < vh ? below : Math.max(rect.top - height - 14, 12)
    return { top, left, placement: 'below', arrow: Math.min(Math.max(rect.left + rect.width / 2 - left, 18), WIDTH - 18) }
  }
  if (rect.right + WIDTH + 24 < vw && rect.top > 8) {
    const top = Math.min(Math.max(rect.top, 12), vh - height - 12)
    return { top, left: rect.right + 14, placement: 'right', arrow: Math.min(Math.max(rect.top + rect.height / 2 - top, 18), height - 18) }
  }
  const left = Math.min(Math.max(rect.left, 12), vw - WIDTH - 12)
  const below = rect.bottom + 14
  const top = below + height < vh ? below : Math.max(rect.top - height - 14, 12)
  return { top, left, placement: 'below', arrow: Math.min(Math.max(rect.left + rect.width / 2 - left, 18), WIDTH - 18) }
}

/**
 * Coachmarks: a small, non-blocking tip beside the thing it explains. Three or four per screen, shown once, skippable in one
 * click, replayable with the Help button. The page stays usable underneath; there is no full-screen dim.
 */
export function CoachHost({ pathname, replay, guide, guideTick, workspace, onSkip }: Readonly<{ pathname: string; replay: number; guide: boolean; guideTick: number; workspace: Workspace; onSkip: () => void }>) {
  const [flow, setFlow] = useState<CoachFlow | null>(null)
  const [index, setIndex] = useState(0)
  const [spot, setSpot] = useState<Spot | null>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const forced = useRef(false)
  const lastReplay = useRef(replay)
  const guideRef = useRef(guide)
  // Declared before the start effect so it already holds the new value when that effect runs in the same commit.
  useEffect(() => { guideRef.current = guide }, [guide])

  const close = useCallback((markDone: boolean) => {
    setFlow((f) => {
      if (f && markDone && !forced.current) markFlowDone(f.id)
      return null
    })
    setSpot(null)
    document.querySelectorAll('[data-coach-active]').forEach((e) => e.removeAttribute('data-coach-active'))
    const back = returnFocus.current
    returnFocus.current = null
    if (back?.isConnected) back.focus()
  }, [])

  // Start a flow when the route changes (once per screen) or when Help asks for it.
  useEffect(() => {
    const id = flowIdForPath(pathname)
    const wantsReplay = replay !== lastReplay.current
    lastReplay.current = replay
    const base = flowById(id)
    const candidate = base ? withWorkspace(base, workspace) : undefined
    if (!candidate || (!wantsReplay && !(guideRef.current && shouldAutoStart(candidate.id)))) { queueMicrotask(() => close(false)); return }
    forced.current = wantsReplay
    let tries = 0
    // Wait (up to about four seconds) for the screen to draw its first target, then start; otherwise stay quiet.
    const timer = setInterval(() => {
      tries += 1
      const firstReady = candidate.steps.some((s) => visible(targetEl(s.target)))
      if (firstReady) {
        clearInterval(timer)
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const first = candidate.steps.findIndex((s) => visible(targetEl(s.target)))
        setFlow(candidate)
        setIndex(first)
      } else if (tries > 16) clearInterval(timer)
    }, 250)
    return () => { clearInterval(timer); close(false) }
  }, [pathname, replay, guideTick, workspace, close])

  // Position the tip and ring the target; keep it in place on scroll and resize.
  useEffect(() => {
    if (!flow) return
    const step = flow.steps[index]
    const el = targetEl(step.target)
    if (!visible(el)) return
    document.querySelectorAll('[data-coach-active]').forEach((e) => e.removeAttribute('data-coach-active'))
    el.setAttribute('data-coach-active', '')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const r0 = el.getBoundingClientRect()
    if (r0.top < 60 || r0.bottom > window.innerHeight - 60) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    const update = () => {
      const r = el.getBoundingClientRect()
      setSpot(place(r, popRef.current?.offsetHeight ?? 190))
    }
    update()
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); el.removeAttribute('data-coach-active') }
  }, [flow, index])

  const shown = flow !== null && spot !== null
  useEffect(() => {
    if (shown) headingRef.current?.focus({ preventScroll: true })
  }, [shown, index])

  useEffect(() => {
    if (!flow) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(true) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flow, close])

  if (!flow || !spot) return null
  const present = flow.steps.map((s, i) => ({ s, i })).filter(({ s, i }) => i === index || visible(targetEl(s.target)))
  const pos = present.findIndex(({ i }) => i === index)
  const step = flow.steps[index]
  const isLast = pos === present.length - 1
  const go = (delta: number) => { const n = present[pos + delta]; if (n) setIndex(n.i) }

  return (
    <div
      ref={popRef}
      className={`coach coach-${spot.placement}`}
      style={{ top: spot.top, left: spot.left, width: spot.placement === 'sheet' ? 'calc(100vw - 24px)' : WIDTH, ['--coach-arrow' as string]: `${spot.arrow}px` }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="coach-title"
      aria-describedby="coach-body"
    >
      <div className="coach-count" aria-hidden="true">{pos + 1} of {present.length}</div>
      <h3 id="coach-title" ref={headingRef} tabIndex={-1} className="coach-title">{step.title}</h3>
      <p id="coach-body" className="coach-body">{step.body}</p>
      <div className="coach-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onSkip(); close(false) }}>Turn guide off</button>
        <span className="grow" />
        {pos > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(-1)}>Back</button>}
        {isLast
          ? <button type="button" className="btn btn-primary btn-sm" onClick={() => close(true)}>Got it</button>
          : <button type="button" className="btn btn-primary btn-sm" onClick={() => go(1)}>Next</button>}
      </div>
      <span className="sr-only" role="status">Tip {pos + 1} of {present.length}: {step.title}</span>
    </div>
  )
}

export const COACH_FLOW_COUNT = COACH_FLOWS.length
