import { useMemo, useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { Badge } from '../../components/StatusBadge'
import { api, ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { emptyProject, fileName, gaps, jdMatch, parseDoc, resumeDocx, startDoc, type ResumeDoc } from './resumeDoc'

interface ResumeState { id: string | null; dealId: string; data: string; matchScore: number | null; status: 'Draft' | 'Submitted' | 'Reviewed'; salesScore: number | null; salesFeedback: string | null; updatedAt: string | null }
interface Job { dealId: string; title: string; client: string | null; jobDescription: string | null; resume: ResumeState }
interface Workspace { name: string; headline: string | null; skills: string | null; jobs: Job[] }

async function download(d: ResumeDoc, role: string) {
  const url = URL.createObjectURL(await resumeDocx(d))
  const a = document.createElement('a'); a.href = url; a.download = fileName(d, role); a.click(); URL.revokeObjectURL(url)
}

/** One role: the JD beside a form in the agency's format, a live JD match, save, Word download and submit. */
function Editor({ token, ws, job, onSaved }: Readonly<{ token: string; ws: Workspace; job: Job; onSaved: () => void }>) {
  const [doc, setDoc] = useState<ResumeDoc>(() => parseDoc(job.resume.data) ?? startDoc(ws.name, ws.headline, ws.skills))
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<Error>()
  const match = useMemo(() => jdMatch(doc, job.jobDescription), [doc, job.jobDescription])
  const missing = gaps(doc)
  const set = (patch: Partial<ResumeDoc>) => { setDoc((d) => ({ ...d, ...patch })); setNote('') }
  const id = (k: string) => `rb-${job.dealId}-${k}`

  async function save(submit: boolean) {
    setBusy(submit ? 'Submitting…' : 'Saving…'); setError(undefined)
    try {
      const base = `/api/v1/public/progress/${encodeURIComponent(token)}/resumes/${job.dealId}`
      await api(base, { method: 'PUT', body: JSON.stringify({ data: JSON.stringify(doc), matchScore: match.score }) })
      if (submit) await api(`${base}/submit`, { method: 'POST' })
      setNote(submit ? 'Sent to your recruiter. They score it and may suggest changes.' : 'Saved.')
      onSaved()
    } catch (e) { setError(e as Error) } finally { setBusy('') }
  }

  return (
    <div className="stack-4">
      {job.jobDescription && (
        <details className="rb-jd">
          <summary>Job description{job.client ? ` · ${job.client}` : ''}</summary>
          <p className="prog-note">{job.jobDescription}</p>
        </details>
      )}
      {match.score !== null && (
        <div className="rb-match" role="status">
          <strong>JD match: {match.score}%</strong>
          <span className="muted-small"> · {match.have.length} of {match.asked.length} skills in the job description</span>
          {match.missing.length > 0 && <p className="muted-small">Not in your resume yet: {match.missing.join(', ')}. Add them only if you have used them.</p>}
        </div>
      )}
      <div className="rb-grid">
        <div className="field"><label htmlFor={id('name')}>Name</label><input id={id('name')} value={doc.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="field"><label htmlFor={id('title')}>Title line</label><input id={id('title')} value={doc.title} placeholder="Software Engineer | .NET | Angular | Azure | 4+ years" onChange={(e) => set({ title: e.target.value })} /></div>
      </div>
      <div className="field">
        <label htmlFor={id('summary')}>Summary</label>
        <textarea id={id('summary')} rows={5} value={doc.summary} aria-describedby={id('summary-hint')} onChange={(e) => set({ summary: e.target.value })} />
        <p id={id('summary-hint')} className="hint">4–6 sentences: years of experience, main stack, the kind of systems you built, one or two results with numbers.</p>
      </div>
      <fieldset className="stack-2">
        <legend><strong>Technical skills</strong></legend>
        {doc.skills.map((g, i) => (
          <div key={i} className="rb-skill">
            <label className="sr-only" htmlFor={id(`sl${i}`)}>Group name</label>
            <input id={id(`sl${i}`)} value={g.label} onChange={(e) => set({ skills: doc.skills.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <label className="sr-only" htmlFor={id(`si${i}`)}>{g.label || 'Group'} skills</label>
            <input id={id(`si${i}`)} value={g.items} placeholder="Comma-separated" onChange={(e) => set({ skills: doc.skills.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)) })} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ skills: doc.skills.filter((_, j) => j !== i) })}>Remove<span className="sr-only"> {g.label}</span></button>
          </div>
        ))}
        <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ skills: [...doc.skills, { label: '', items: '' }] })}>Add a skill group</button></div>
      </fieldset>
      <fieldset className="stack-3">
        <legend><strong>Project details</strong></legend>
        {doc.projects.map((p, i) => {
          const upd = (patch: Partial<typeof p>) => set({ projects: doc.projects.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
          return (
            <div key={i} className="rb-project stack-2">
              <div className="rb-grid">
                <div className="field"><label htmlFor={id(`pn${i}`)}>Project</label><input id={id(`pn${i}`)} value={p.name} placeholder="Cover Care – Care Management Platform" onChange={(e) => upd({ name: e.target.value })} /></div>
                <div className="field"><label htmlFor={id(`pt${i}`)}>Team size</label><input id={id(`pt${i}`)} value={p.teamSize} inputMode="numeric" onChange={(e) => upd({ teamSize: e.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor={id(`pd${i}`)}>Details</label><textarea id={id(`pd${i}`)} rows={3} value={p.details} onChange={(e) => upd({ details: e.target.value })} /></div>
              <div className="field"><label htmlFor={id(`pk${i}`)}>Technology</label><input id={id(`pk${i}`)} value={p.technology} onChange={(e) => upd({ technology: e.target.value })} /></div>
              <div className="field">
                <label htmlFor={id(`pr${i}`)}>Responsibilities</label>
                <textarea id={id(`pr${i}`)} rows={5} value={p.responsibilities} aria-describedby={id(`pr${i}-hint`)} onChange={(e) => upd({ responsibilities: e.target.value })} />
                <p id={id(`pr${i}-hint`)} className="hint">One per line. Start with a verb; add a number where you can (users, records a day, % faster).</p>
              </div>
              {doc.projects.length > 1 && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ projects: doc.projects.filter((_, j) => j !== i) })}>Remove this project</button></div>}
            </div>
          )
        })}
        <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ projects: [...doc.projects, emptyProject()] })}>Add a project</button></div>
      </fieldset>
      {missing.length > 0 && <p className="muted-small">Before submitting, add {missing.join(', ')}.</p>}
      {error && <ErrorNotice error={error} what="your resume" />}
      {note && <p className="muted-small" role="status">{note}</p>}
      <div className="prog-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => void save(false)}>{busy === 'Saving…' ? busy : 'Save draft'}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void download(doc, job.title)}>Download Word</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy) || missing.length > 0} onClick={() => void save(true)}>{busy === 'Submitting…' ? busy : 'Submit to my recruiter'}</button>
      </div>
    </div>
  )
}

const STATUS: Record<ResumeState['status'], string> = { Draft: 'Draft', Submitted: 'With your recruiter', Reviewed: 'Reviewed' }

/**
 * Candidate page → "Your resume for this role" (2026-10-26): shown when the sales team shares the resume builder. The candidate writes
 * the resume in the agency's standard format against the job description, then submits it; the recruiter's score and feedback show here.
 */
export function ResumeBuilder({ token }: Readonly<{ token: string }>) {
  const ws = useApi<Workspace>(`/api/v1/public/progress/${encodeURIComponent(token)}/resumes`)
  const [pick, setPick] = useState<string>('')
  const jobs = ws.data?.jobs ?? []
  const job = jobs.find((j) => j.dealId === pick) ?? jobs[0]
  if (ws.error instanceof ApiError && ws.error.status === 404) return null
  if (!ws.data || jobs.length === 0 || !job) return null
  const r = job.resume
  return (
    <Card level={2} title="Your resume for this role" subtitle="Written in the format the client receives. Your recruiter reviews it before sending."
      actions={<Badge tone={r.status === 'Reviewed' ? 'success' : r.status === 'Submitted' ? 'primary' : 'neutral'}>{STATUS[r.status]}</Badge>}>
      <div className="stack-3">
        {jobs.length > 1 && (
          <div className="field">
            <label htmlFor="rb-role">Role</label>
            <select id="rb-role" value={job.dealId} onChange={(e) => setPick(e.target.value)}>{jobs.map((j) => <option key={j.dealId} value={j.dealId}>{j.title}</option>)}</select>
          </div>
        )}
        {r.salesScore !== null && (
          <div className="rb-review" role="status">
            <strong>Recruiter score: {r.salesScore}/100</strong>
            {r.salesFeedback && <p className="prog-note">{r.salesFeedback}</p>}
          </div>
        )}
        <Editor key={job.dealId} token={token} ws={ws.data} job={job} onSaved={ws.reload} />
      </div>
    </Card>
  )
}
