import { percentOf } from '../percent'

/** A ring for "n of N" with the number inside; the words say what it counts, so colour never carries it alone. */
export function GoalRing({ value, goal, label, caption }: Readonly<{ value: number; goal: number; label: string; caption?: string }>) {
  const pct = Math.round(percentOf(value, goal))
  return (
    <div className="goal" role="img" aria-label={`${label}: ${value} of ${goal}`}>
      <div className="gr" style={{ ['--p' as string]: pct }}>
        <b className="op-numeric">{value}<small>of {goal}</small></b>
      </div>
      <div className="gt"><b>{label}</b>{caption && <p>{caption}</p>}</div>
    </div>
  )
}
