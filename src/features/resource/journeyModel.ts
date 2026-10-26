/** Candidate journey and Sales resource 360 (2026-10-26): types from the API and the small rules both views share. */
export interface TimelineItem { kind: string; title: string; detail: string | null; at: string; source: string; entryId: string | null }
export interface Fit { role: string; score: number }
export type BenchStatus = 'available' | 'interviewing' | 'mapped' | 'training'
export interface Journey {
  candidateId: string; name: string; headline: string | null; skills: string | null; joinedAt: string; day: number; salesperson: string | null
  priority: boolean; status: BenchStatus; resumeStrength: number | null; bestFit: Fit | null; certifications: string[]; learningHours: number
  timeline: TimelineItem[]; upcoming: TimelineItem[]
}
export interface BenchRow {
  candidateId: string; name: string; headline: string | null; day: number; salesperson: string | null; priority: boolean; status: BenchStatus
  resumeStrength: number | null; bestFit: Fit | null; certifications: string[]; next: TimelineItem | null
}
export interface Bench { rows: BenchRow[]; averageStrength: number | null }

type Tone = 'neutral' | 'indigo' | 'teal' | 'amber' | 'primary' | 'green' | 'danger'
export const KIND: Record<string, { label: string; tone: Tone }> = {
  Joined: { label: 'Joined', tone: 'neutral' },
  Learning: { label: 'Learning', tone: 'indigo' },
  Certification: { label: 'Certification', tone: 'teal' },
  Project: { label: 'Project', tone: 'amber' },
  InterviewPrep: { label: 'Interview prep', tone: 'neutral' },
  Note: { label: 'Note', tone: 'neutral' },
  Interview: { label: 'Interview', tone: 'primary' },
  Resume: { label: 'Resume', tone: 'green' },
  Offer: { label: 'Offer', tone: 'danger' },
}
export const kindOf = (kind: string) => KIND[kind] ?? { label: kind, tone: 'neutral' as Tone }

/** What a candidate or the team can log by hand (the rest comes from the pipeline). */
export const LOG_KINDS = [
  { value: 'Learning', label: 'Learning (course, reading)' },
  { value: 'Certification', label: 'Certification (passed or booked)' },
  { value: 'Project', label: 'Project I built' },
  { value: 'InterviewPrep', label: 'Interview prep or mock' },
  { value: 'Note', label: 'Note' },
] as const

export const STATUS: Record<BenchStatus | 'priority', { label: string; hint: string; tone: Tone }> = {
  priority: { label: 'Priority', hint: 'Strong profile and a fitting role: put forward first', tone: 'danger' },
  available: { label: 'Available now', hint: 'On the bench, ready to submit', tone: 'green' },
  interviewing: { label: 'Interviewing', hint: 'Submitted, interviews running', tone: 'primary' },
  mapped: { label: 'Mapped / onboarding', hint: 'Offer accepted: going to a project', tone: 'amber' },
  training: { label: 'In training', hint: 'Learning or certifying before submission', tone: 'indigo' },
}

export type GroupBy = 'status' | 'skill' | 'sales'
export interface BenchGroup { id: string; name: string; hint: string; tone: Tone; rows: BenchRow[] }

/** The headline's main technology ("Senior .NET developer" → ".NET"), for grouping by skill. */
export function mainSkill(headline: string | null): string {
  const h = (headline ?? '').trim()
  if (!h) return 'Other'
  const known = ['.NET', 'Java', 'Python', 'React', 'Angular', 'Node', 'Data', 'DevOps', 'QA', 'Android', 'iOS', 'Salesforce', 'SAP', 'Cloud', 'Azure', 'AWS']
  return known.find((k) => h.toLowerCase().includes(k.toLowerCase())) ?? h.split(/\s+/).slice(-2).join(' ')
}

/** The bench grouped for a quick decision: by status (priority first), main skill or salesperson. Empty groups are left out. */
export function groupBench(rows: readonly BenchRow[], by: GroupBy): BenchGroup[] {
  if (by === 'status') {
    const order: (BenchStatus | 'priority')[] = ['priority', 'available', 'interviewing', 'mapped', 'training']
    return order.map((id) => ({
      id, name: STATUS[id].label, hint: STATUS[id].hint, tone: STATUS[id].tone,
      rows: rows.filter((r) => (id === 'priority' ? r.priority : !r.priority && r.status === id)),
    })).filter((g) => g.rows.length > 0)
  }
  const key = (r: BenchRow) => (by === 'skill' ? mainSkill(r.headline) : r.salesperson?.trim() || 'Not assigned')
  const names = [...new Set(rows.map(key))].sort((a, b) => a.localeCompare(b))
  return names.map((n) => ({ id: n, name: n, hint: by === 'skill' ? 'Grouped by main skill' : 'Resources this salesperson looks after', tone: 'primary' as Tone, rows: rows.filter((r) => key(r) === n) }))
}

export const PATH = ['Joined', 'Learning', 'Certified', 'Resume ready', 'Interviewing', 'Selected', 'Onboarding'] as const

/** Where the candidate is on the seven-step path. */
export function pathIndex(j: Pick<Journey, 'status' | 'certifications' | 'timeline'>): number {
  if (j.status === 'mapped') return 6
  if (j.timeline.some((t) => t.kind === 'Offer')) return 5
  if (j.status === 'interviewing') return 4
  if (j.timeline.some((t) => t.kind === 'Resume')) return 3
  if (j.certifications.length > 0) return 2
  if (j.timeline.some((t) => t.kind === 'Learning')) return 1
  return 0
}

export interface CalendarCell { key: string; day: number | null; today: boolean; items: TimelineItem[] }

/** A month grid (weeks start Monday) with the journey's items on their days, in the viewer's time zone. */
export function monthCells(year: number, month: number, items: readonly TimelineItem[], now: Date = new Date()): CalendarCell[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: CalendarCell[] = Array.from({ length: lead }, (_, i) => ({ key: `b${i}`, day: null, today: false, items: [] }))
  for (let d = 1; d <= days; d++) {
    cells.push({
      key: `d${d}`, day: d,
      today: now.getFullYear() === year && now.getMonth() === month && now.getDate() === d,
      items: items.filter((t) => { const at = new Date(t.at); return at.getFullYear() === year && at.getMonth() === month && at.getDate() === d }),
    })
  }
  return cells
}

export const when = (iso: string, withTime = false) => {
  try { return new Date(iso).toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }) } catch { return iso }
}

// ---------- Candidate dashboard analytics (2026-10-26) ----------

export const ACTIVITY_KINDS = ['Learning', 'Certification', 'Project', 'InterviewPrep', 'Interview'] as const
export interface WeekBar { label: string; start: string; counts: Record<string, number>; total: number; hours: number }

/** Activity per week since joining (at most the last `weeks`), counted by kind; hours from logged learning. */
export function weeklyActivity(items: readonly TimelineItem[], joinedAt: string, now: Date = new Date(), weeks = 8): WeekBar[] {
  const day = 86_400_000
  const joined = new Date(joinedAt).getTime()
  const span = Math.max(1, Math.min(weeks, Math.ceil((now.getTime() - joined) / (7 * day))))
  const start = now.getTime() - span * 7 * day
  const bars: WeekBar[] = Array.from({ length: span }, (_, i) => {
    const s = new Date(start + i * 7 * day)
    return { label: s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), start: s.toISOString(), counts: {}, total: 0, hours: 0 }
  })
  for (const t of items) {
    const at = new Date(t.at).getTime()
    if (at < start || at > now.getTime()) continue
    const kind = t.kind === 'Resume' || t.kind === 'Offer' || t.kind === 'Note' || t.kind === 'Joined' ? null : t.kind
    if (!kind) continue
    const b = bars[Math.min(span - 1, Math.floor((at - start) / (7 * day)))]
    b.counts[kind] = (b.counts[kind] ?? 0) + 1
    b.total++
    const h = /(\d+)\s*h\b/.exec(t.detail ?? '')
    if (h) b.hours += Number(h[1])
  }
  return bars
}

/** How the journey splits by kind (for the mix donut). */
export function activityMix(items: readonly TimelineItem[]): { kind: string; count: number }[] {
  return ACTIVITY_KINDS.map((kind) => ({ kind, count: items.filter((t) => t.kind === kind).length })).filter((m) => m.count > 0)
}

export interface ReadinessItem { label: string; done: boolean }

/** What makes a candidate ready to submit: each item is something the candidate (or recruiter) can see and act on. */
export function readiness(j: Pick<Journey, 'headline' | 'resumeStrength' | 'certifications' | 'learningHours' | 'timeline' | 'upcoming'>): ReadinessItem[] {
  const has = (k: string) => j.timeline.some((t) => t.kind === k) || j.upcoming.some((t) => t.kind === k)
  return [
    { label: 'Title line on your profile', done: Boolean(j.headline?.trim()) },
    { label: 'Resume written for a role', done: j.timeline.some((t) => t.kind === 'Resume') },
    { label: 'Resume scored 75 or more', done: (j.resumeStrength ?? 0) >= 75 },
    { label: 'At least one certification', done: j.certifications.length > 0 },
    { label: '20+ hours of learning logged', done: j.learningHours >= 20 },
    { label: 'A project you built', done: has('Project') },
    { label: 'Interview prep logged', done: has('InterviewPrep') },
  ]
}
