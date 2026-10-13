/**
 * The one progress bar: a filled track with its words ("6 of 10"). It animates smoothly (not with reduced motion), shimmers while
 * work is running, and is a real `progressbar` for screen readers. Use it wherever work has steps: queues, sends, runs, completeness.
 */
export function ProgressBar({ pct, label, text, tone = 'primary', size = 'md', active = false }: Readonly<{
  pct: number
  label: string
  text?: string
  tone?: 'primary' | 'success' | 'warning'
  size?: 'sm' | 'md'
  /** Work is in progress: the fill shimmers. */
  active?: boolean
}>) {
  const value = Math.round(Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0)))
  return (
    <div className={`pbar pbar-${tone} pbar-${size}${active ? ' is-active' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label} aria-valuetext={text ?? `${value}%`}>
      <div className="pbar-track"><i style={{ width: `${value}%` }} /></div>
      {text !== undefined && <span className="pbar-text op-numeric">{text}</span>}
    </div>
  )
}
