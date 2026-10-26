import { jdMatch, parseDoc, type ResumeDoc } from './resumeDoc'

/** What "Tailor to this job" returns (2026-10-26): the rewritten resume for review, who wrote it, what changed and what was left out. */
export interface TailorResult { data: string; provider: string; model: string | null; changes: string[]; notAdded: string[] }

export interface TailorPreview { doc: ResumeDoc; before: number | null; after: number | null; changes: string[]; notAdded: string[]; by: string }

/** The tailored resume with the job-description match before and after, or null when the answer is not a resume. */
export function previewOf(current: ResumeDoc, result: TailorResult, jd: string | null): TailorPreview | null {
  const doc = parseDoc(result.data)
  if (!doc) return null
  return {
    doc,
    before: jdMatch(current, jd).score,
    after: jdMatch(doc, jd).score,
    changes: result.changes,
    notAdded: result.notAdded,
    by: result.model ? `${result.provider} (${result.model})` : result.provider,
  }
}

/** One line for the result: "JD match 40% → 70%", or nothing to compare. */
export function matchLine(p: Pick<TailorPreview, 'before' | 'after'>): string | null {
  if (p.after === null) return null
  return p.before === null || p.before === p.after ? `JD match ${p.after}%` : `JD match ${p.before}% → ${p.after}%`
}
