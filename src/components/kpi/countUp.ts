import { useEffect, useState } from 'react'

/** Ease-out cubic: fast start, gentle landing (DESIGN.md motion). */
export function easeOut(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - x, 3)
}

/** Splits "1,250 jobs" into 1250 plus its prefix/suffix so only the number animates; null when there is no number. */
export function splitNumber(text: string): { prefix: string; value: number; suffix: string; decimals: number } | null {
  const m = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(text)
  if (!m) return null
  const raw = m[2].replace(/,/g, '')
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return { prefix: m[1], value, suffix: m[3], decimals: raw.includes('.') ? raw.split('.')[1].length : 0 }
}

export function formatCount(value: number, decimals: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Counts from 0 to `target` when it first appears; instant with reduced motion. */
export function useCountUp(target: number | null, ms = 700): number | null {
  const skip = target === null || target === 0 || prefersReducedMotion()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (skip || target === null) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = easeOut((now - t0) / ms)
      setV(target * k)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, skip])
  return skip ? target : v
}
