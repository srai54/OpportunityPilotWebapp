/** Geometry of the donut chart: radius 54 in a 140×140 box. */
export const DONUT_RADIUS = 54
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

/** Each segment's arc length and start, in order, over the circle. Zero totals give no arcs. */
export function donutArcs(segments: readonly { value: number }[]): { length: number; offset: number }[] {
  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0)
  let start = 0
  return segments.map((s) => {
    const length = total > 0 ? (Math.max(0, s.value) / total) * DONUT_CIRCUMFERENCE : 0
    const arc = { length, offset: start }
    start += length
    return arc
  })
}
