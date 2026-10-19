import type { ApplicationItem, ApplicationPlatform, ApplicationStatus } from '../../lib/types'

export const PAGE_SIZE = 50

/** Status colour is always paired with words; a dry run must never read as a sent application. */
export const STATUS_LABELS: Record<ApplicationStatus, { text: string; tone: string }> = {
  Applied: { text: 'Applied', tone: 'success' },
  DryRun: { text: 'Dry run · not submitted', tone: 'primary' },
  NeedsManual: { text: 'Needs you', tone: 'warning' },
  Skipped: { text: 'Skipped', tone: 'neutral' },
  Failed: { text: 'Failed', tone: 'danger' },
}

export const STATUS_FILTERS: { value: ApplicationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Applied', label: 'Applied' },
  { value: 'NeedsManual', label: 'Needs you' },
  { value: 'DryRun', label: 'Dry run' },
  { value: 'Skipped', label: 'Skipped' },
  { value: 'Failed', label: 'Failed' },
]

// Instahyre is in the API enum but the agent does not support it yet, so it is not offered as a filter.
export interface ApplicationFilters {
  status: ApplicationStatus | ''
  platform: ApplicationPlatform | ''
}

export function applicationsPath(filters: ApplicationFilters, skip: number, take = PAGE_SIZE): string {
  const query = new URLSearchParams()
  if (filters.status) query.set('status', filters.status)
  if (filters.platform) query.set('platform', filters.platform)
  query.set('take', String(take))
  query.set('skip', String(skip))
  return `/api/v1/applications?${query}`
}

/** Offset paging shifts when the agent reports new rows between pages, so the next page can repeat items. */
export function appendUnique(existing: ApplicationItem[], next: ApplicationItem[]): ApplicationItem[] {
  const seen = new Set(existing.map((i) => i.id))
  return [...existing, ...next.filter((i) => !seen.has(i.id))]
}

interface FormatOptions {
  now?: Date
  locale?: string
  timeZone?: string
}

/** "1 Oct, 14:05"; the year is added only when it is not the current one. */
export function formatWhen(iso: string, { now = new Date(), locale, timeZone }: FormatOptions = {}): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const yearOf = (d: Date) => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(d))
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: yearOf(date) === yearOf(now) ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date)
}
