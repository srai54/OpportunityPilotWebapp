/** What a typed or spoken instruction means. The app only ever reads it as: what to look for, where, and what you want to do next. */
export type CommandNext = 'review' | 'apply' | 'send'

export interface ParsedCommand {
  query: string
  location: string
  remoteOnly: boolean
  /** What you said you want after the search. It never happens by itself: it only decides which step you land on. */
  next: CommandNext
  /** Minutes between repeats, when you said "every day" or "weekly"; 0 for none. */
  repeat: number
  /** Only postings from the last N days ("past 3 days", "last week", "today"); null when not said. */
  days?: number | null
}

const LEAD_IN = /^(?:please\s+)?(?:(?:can|could) you\s+)?(?:find(?: me)?|search(?: for)?|look(?:ing)? for|show(?: me)?|get(?: me)?|launch|start|run)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:(?:new\s+)?campaign\s+(?:of|for|to find)\s+)?/i
const FILLER = /\b(?:jobs?|roles?|positions?|openings?|vacancies|companies|company|leads?|customers?|clients?|that are hiring|who(?:'s| is| are) hiring|hiring)\b/gi

/** Turns "find react developers in Berlin remote and apply every day" into a campaign request. Pure; the words are never sent anywhere. */
export function parseCommand(text: string, workspace: 'candidate' | 'sales'): ParsedCommand | null {
  let t = text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  if (!t) return null

  let repeat = 0
  if (/\b(?:every ?day|daily|each day)\b/i.test(t)) repeat = 1440
  else if (/\b(?:every ?week|weekly|each week)\b/i.test(t)) repeat = 10080
  t = t.replace(/\b(?:and )?(?:repeat )?(?:every ?day|daily|each day|every ?week|weekly|each week)\b/gi, ' ')

  let next: CommandNext = 'review'
  if (/\b(?:then|and|after(?:wards)?)\s+(?:apply|submit)\b|\bapply (?:to|for) (?:them|all|those|the best)\b/i.test(t)) next = 'apply'
  else if (/\b(?:then|and|after(?:wards)?)\s+(?:send|reach out|email|message|contact)\b|\bsend (?:the )?outreach\b/i.test(t)) next = 'send'
  t = t.replace(/\b(?:then|and|after(?:wards)?)\s+(?:apply|submit|send|reach out|email|message|contact)\b.*$/i, ' ')
  // "apply" with no search words after it is the whole point of the sentence, not a keyword.
  if (workspace === 'sales' && next === 'apply') next = 'send'

  let days: number | null = null
  const age = /\b(?:past|last)\s+(\d{1,3})\s+days?\b/i.exec(t)
  if (age) days = Math.min(365, Math.max(1, Number(age[1])))
  else if (/\b(?:past|last)\s+week\b/i.test(t)) days = 7
  else if (/\btoday\b/i.test(t)) days = 1
  t = t.replace(/\b(?:in |from )?(?:the )?(?:past|last)\s+(?:\d{1,3}\s+days?|week)\b/gi, ' ').replace(/\b(?:posted )?today\b/gi, ' ').replace(/\s+/g, ' ')

  const remoteOnly = /\bremote(?:ly)?\b/i.test(t)
  t = t.replace(/\b(?:fully |100% )?remote(?:ly)?\b/gi, ' ')

  let location = ''
  const place = /\b(?:in|near|around|at|based in)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,60})$/i.exec(t.trim())
  if (place) {
    location = place[1].trim()
    t = t.slice(0, place.index)
  }

  t = t.replace(LEAD_IN, ' ').replace(FILLER, ' ').replace(/\b(?:a|an|the|for|me|to)\b\s*$/i, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return { query: t.slice(0, 200), location: location.slice(0, 100), remoteOnly, next, repeat, ...(days ? { days } : {}) }
}

/** The sentence shown before anything runs, so you can see exactly what will happen. */
export function describeCommand(c: ParsedCommand, workspace: 'candidate' | 'sales'): string {
  const where = c.location ? ` in ${c.location}` : c.remoteOnly ? ' (remote)' : ''
  const what = workspace === 'sales' ? `companies hiring “${c.query}”` : `“${c.query}” jobs`
  const sites = workspace === 'sales' ? 'LinkedIn' : 'all the free job sites'
  const then = c.next === 'apply' ? 'Then you approve the good ones and apply from a queue, one posting at a time.'
    : c.next === 'send' ? 'Then you approve the good ones and send drafted messages, which you approve first.'
    : 'Then you review the matches.'
  const recent = c.days ? ` Only postings from the last ${c.days} day${c.days === 1 ? '' : 's'}.` : ''
  const again = c.repeat === 1440 ? ' It will repeat every day.' : c.repeat === 10080 ? ' It will repeat every week.' : ''
  return `I will search ${sites} for ${what}${where}.${recent} ${then}${again} Nothing is sent or applied until you approve it.`
}

/** The link that starts the quick campaign with everything filled in and runs it once confirmed. */
export function commandPath(c: ParsedCommand, workspace: 'candidate' | 'sales'): string {
  const p = new URLSearchParams({ keywords: c.query, auto: '1', then: c.next })
  if (c.location) p.set('location', c.location)
  else if (c.remoteOnly) p.set('location', 'Remote')
  if (c.repeat) p.set('repeat', String(c.repeat))
  p.set('board', workspace === 'sales' ? 'LinkedIn' : 'FreeFeeds')
  return `/campaigns/new?${p}`
}
