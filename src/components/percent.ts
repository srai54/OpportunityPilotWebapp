/** Percent from a count, safe for zero totals. */
export function percentOf(done: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.max(0, (done / total) * 100))
}
