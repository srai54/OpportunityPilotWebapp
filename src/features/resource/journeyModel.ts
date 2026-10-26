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
