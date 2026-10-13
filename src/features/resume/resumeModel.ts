import { SKILLS } from '../suggest/catalog'

/** Skills too short or too common as words to find by name in free text. */
const SKIP = new Set(['C', 'R', 'Go', 'QA'])

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function skillRegex(skill: string): RegExp {
  // Not glued to a letter, digit, "+", "#" or "." on either side, so "Java" does not match inside "JavaScript" and ".NET" is found.
  return new RegExp(`(?<![A-Za-z0-9+#.])${escape(skill)}(?![A-Za-z0-9+#])`, skill.length <= 3 ? '' : 'i')
}

const REGEXES = SKILLS.filter((s) => !SKIP.has(s)).map((s) => ({ skill: s, re: skillRegex(s) }))

/** Catalog skills named in a text, in the order they first appear. */
export function skillsIn(text: string): string[] {
  const found: { skill: string; at: number }[] = []
  for (const { skill, re } of REGEXES) {
    const m = re.exec(text)
    if (m) found.push({ skill, at: m.index })
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.skill)
}

export interface Suggestion { kind: 'order' | 'missing' | 'title' | 'years' | 'skills-line'; text: string }

export interface ResumeAnalysis {
  asked: string[]
  have: string[]
  missing: string[]
  suggestions: Suggestion[]
}

const yearsAsked = (jobText: string): number | null => {
  const m = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?years?/i.exec(jobText)
  return m ? Number(m[1]) : null
}

/** Compares a job posting with a resume. It only reports; nothing here adds a skill the resume does not already name. */
export function analyzeResume(resume: string, jobTitle: string, jobText: string): ResumeAnalysis {
  const asked = skillsIn(`${jobTitle}\n${jobText}`).slice(0, 25)
  const inResume = new Set(skillsIn(resume))
  const have = asked.filter((s) => inResume.has(s))
  const missing = asked.filter((s) => !inResume.has(s))
  const suggestions: Suggestion[] = []
  if (have.length > 0) suggestions.push({ kind: 'order', text: `Put these first in your skills and in the top of your experience, because the job asks for them: ${have.slice(0, 8).join(', ')}.` })
  if (missing.length > 0) {
    for (const s of missing.slice(0, 6)) suggestions.push({ kind: 'missing', text: `The job asks for ${s}, and your resume does not mention it. Add it only if you really have it.` })
  }
  const titleWords = jobTitle.toLowerCase().split(/[^a-z0-9#+.]+/).filter((w) => w.length > 2)
  const head = resume.slice(0, 240).toLowerCase()
  if (titleWords.length > 0 && !titleWords.some((w) => head.includes(w))) suggestions.push({ kind: 'title', text: `Say what you are in the first line, in the job's words: "${jobTitle}".` })
  const years = yearsAsked(jobText)
  if (years !== null && !/\d{1,2}\s*\+?\s*years?/i.test(resume)) suggestions.push({ kind: 'years', text: `The job mentions ${years}+ years. Make your years of experience easy to see (for example in your first line).` })
  if (!/^\s*(?:technical |key |core )?skills?\s*[:\-–]/im.test(resume)) suggestions.push({ kind: 'skills-line', text: 'Add a line starting "Skills:" so job-matching software and recruiters find your skills quickly.' })
  return { asked, have, missing, suggestions }
}

export interface Tailored { text: string; changes: string[] }

/**
 * The safe changes only: a headline with the job's title and the matching skills the resume already names, and the Skills line
 * reordered so the job's skills come first. Nothing is added that the resume does not already say.
 */
export function tailorResume(resume: string, jobTitle: string, a: ResumeAnalysis): Tailored {
  const changes: string[] = []
  const lines = resume.split(/\r?\n/)
  const at = lines.findIndex((l) => /^\s*(?:technical |key |core )?skills?\s*[:\-–]/i.test(l))
  if (at >= 0 && a.have.length > 0) {
    const m = /^(\s*[A-Za-z ]+?\s*[:\-–]\s*)(.*)$/.exec(lines[at])
    if (m) {
      const items = m[2].split(/\s*[,;|•·]\s*/).filter(Boolean)
      const wanted = new Set(a.have.map((s) => s.toLowerCase()))
      // In the order the job lists them, so what it asks for first comes first.
      const first = a.have.map((s) => items.find((i) => i.toLowerCase() === s.toLowerCase())).filter((i): i is string => Boolean(i))
      const rest = items.filter((i) => !wanted.has(i.toLowerCase()))
      if (first.length > 0 && first.join() !== items.slice(0, first.length).join()) {
        lines[at] = `${m[1]}${[...first, ...rest].join(', ')}`
        changes.push(`Moved ${first.join(', ')} to the front of your Skills line.`)
      }
    }
  }
  let text = lines.join('\n')
  if (a.have.length > 0 && jobTitle.trim()) {
    text = `${jobTitle.trim()} — ${a.have.slice(0, 6).join(', ')}\n\n${text}`
    changes.push(`Added a headline with the job's title and the matching skills you already list.`)
  }
  return { text, changes }
}

/** The note a sales team member can send a candidate: what to change, in plain sentences. */
export function suggestionsEmail(name: string, jobTitle: string, a: ResumeAnalysis): string {
  const first = name.split(' ')[0] || name
  const lines = a.suggestions.map((s) => `- ${s.text}`)
  return `Hi ${first},\n\nBefore we put you forward for "${jobTitle}", here is what would make your resume fit better:\n\n${lines.join('\n') || '- It already fits well.'}\n\nPlease change only what is true for you, and send the updated resume back.\n`
}
