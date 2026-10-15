import { useMemo, useState } from 'react'
import { Card } from '../../components/cards'
import { Icon } from '../../components/icons'
import { ProgressBar } from '../../components/ProgressBar'
import { percentOf } from '../../components/percent'
import { saveBlob } from '../../lib/download'
import { analyzeResume, suggestionsEmail, tailorResume } from './resumeModel'

const KEY = 'op.resumeDraft'
const read = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
const write = (v: string) => { try { localStorage.setItem(KEY, v) } catch { /* the text just is not remembered */ } }

/** The resume as a .docx: the first line is the headline, a blank line starts a new paragraph. Built in the browser; nothing is uploaded. */
async function resumeDocx(text: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const lines = text.split(/\r?\n/)
  const doc = new Document({
    sections: [{
      children: lines.map((line, i) => new Paragraph({
        spacing: { after: line.trim() ? 60 : 120 },
        children: [new TextRun({ text: line, bold: i === 0, size: i === 0 ? 28 : 22 })],
      })),
    }],
  })
  return Packer.toBlob(doc)
}

/**
 * "Tailor your resume to this job": compares the job posting with your resume, says what to change, makes only the safe changes
 * (headline, skills in the job's order) and lets you edit and download the result. It never adds a skill you did not write.
 */
export function ResumeTailorPanel({ jobTitle, jobText, editableJob = false, candidate }: Readonly<{
  jobTitle: string
  jobText: string
  /** Sales team: the posting is pasted here instead of coming from a saved job. */
  editableJob?: boolean
  /** Sales team: who the suggestions are for, so they can be emailed from the sender's own mail app. */
  candidate?: { name: string; email: string | null }
}>) {
  const [resume, setResume] = useState(read)
  const [pasted, setPasted] = useState('')
  const [title, setTitle] = useState(jobTitle)
  const [result, setResult] = useState<{ text: string; changes: string[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const posting = editableJob ? pasted : jobText
  const analysis = useMemo(() => (resume.trim() && posting.trim() ? analyzeResume(resume, title, posting) : null), [resume, title, posting])
  const askedCount = analysis?.asked.length ?? 0

  async function download() {
    if (!result) return
    saveBlob(await resumeDocx(result.text), `resume-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'tailored'}.docx`)
  }
  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result.text); setCopied(true) } catch { setCopied(false) }
  }
  const mailto = analysis && candidate?.email
    ? `mailto:${encodeURIComponent(candidate.email)}?subject=${encodeURIComponent(`Your resume for ${title}`)}&body=${encodeURIComponent(suggestionsEmail(candidate.name, title, analysis))}`
    : null

  return (
    <Card title={editableJob ? 'Resume fit for a job' : 'Tailor your resume to this job'} subtitle="Paste your resume. Safe edits only, never invented skills.">
      <div className="stack-3">
        {editableJob && (
          <>
            <label className="field"><span>Job title</span><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior React Developer" /></label>
            <label className="field"><span>Job description</span><textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the job description" /></label>
          </>
        )}
        <label className="field"><span>{candidate ? `${candidate.name}'s resume` : 'Your resume'}</span>
          <textarea rows={8} value={resume} onChange={(e) => { setResume(e.target.value); write(e.target.value); setResult(null) }} placeholder={'Paste your resume as text. A line like "Skills: React, Docker" lets it reorder your skills.'} /></label>
        <p className="muted-small">Kept in this browser only so you do not paste it again. Clear the box to remove it.</p>

        {analysis && (
          <div className="stack-3" aria-live="polite">
            <ProgressBar pct={percentOf(analysis.have.length, askedCount)} label="Skills the job asks for that your resume names" text={askedCount ? `${analysis.have.length} of ${askedCount}` : 'no skills found in the job'}
              tone={askedCount > 0 && analysis.missing.length === 0 ? 'success' : 'primary'} />
            {analysis.have.length > 0 && <div className="chip-row"><span className="muted-small picks-label">You have</span>{analysis.have.map((s) => <span key={s} className="chip chip-ok">{s}</span>)}</div>}
            {analysis.missing.length > 0 && <div className="chip-row"><span className="muted-small picks-label">Not named</span>{analysis.missing.map((s) => <span key={s} className="chip chip-warn">{s}</span>)}</div>}
            <ul className="plain-list stack-2" aria-label="What to change">
              {analysis.suggestions.map((s, i) => <li key={`${s.kind}-${i}`} className="row"><Icon name="check" size={14} /><span>{s.text}</span></li>)}
            </ul>
            <div className="row wrap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setResult(tailorResume(resume, title, analysis))}>Make the safe changes</button>
              {mailto && <a className="btn btn-secondary btn-sm" href={mailto}><Icon name="mail" size={14} /> Email these suggestions to {candidate!.name.split(' ')[0]}</a>}
            </div>
          </div>
        )}
        {!analysis && resume.trim() && editableJob && <p className="muted-small">Paste the job description to compare.</p>}

        {result && (
          <div className="stack-2">
            {result.changes.length > 0
              ? <ul className="plain-list" aria-label="Changes made">{result.changes.map((c) => <li key={c}>{c}</li>)}</ul>
              : <p className="muted-small">Nothing could be changed safely: your resume does not name the skills this job asks for. Follow the suggestions above.</p>}
            <label className="field"><span>Tailored resume (edit it before you use it)</span>
              <textarea rows={10} value={result.text} onChange={(e) => setResult({ ...result, text: e.target.value })} /></label>
            <div className="row wrap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void download()}><Icon name="download" size={14} /> Download .docx</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy text'}</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
