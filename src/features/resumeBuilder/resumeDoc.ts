import { skillsIn } from '../resume/resumeModel'

/**
 * The agency's standard resume format (2026-10-26), as the sales team sends it to clients: name and title line, Summary, Technical
 * Skills in labelled groups, and Project Details (Project, Details, Team Size, Technology, Responsibilities).
 */
export interface SkillGroup { label: string; items: string }
export interface ProjectEntry { name: string; details: string; teamSize: string; technology: string; responsibilities: string }
export interface ResumeDoc { name: string; title: string; summary: string; skills: SkillGroup[]; projects: ProjectEntry[] }

export const DEFAULT_SKILL_GROUPS = ['Programming Languages', 'Frontend', 'Backend', 'Databases', 'Cloud', 'CI/CD & DevOps', 'Testing & Quality']

export const emptyProject = (): ProjectEntry => ({ name: '', details: '', teamSize: '', technology: '', responsibilities: '' })

/** A new resume, started from what the candidate's record already says. */
export function startDoc(name: string, headline: string | null, skills: string | null): ResumeDoc {
  const groups = DEFAULT_SKILL_GROUPS.map((label) => ({ label, items: '' }))
  if (skills?.trim()) groups[0] = { label: 'Key skills', items: skills.trim() }
  return { name, title: headline ?? '', summary: '', skills: groups, projects: [emptyProject()] }
}

/** The saved JSON, or null when nothing was saved yet ("{}") or it is not a resume. */
export function parseDoc(data: string): ResumeDoc | null {
  try {
    const d = JSON.parse(data) as Partial<ResumeDoc>
    if (!d || typeof d !== 'object' || typeof d.name !== 'string') return null
    return {
      name: d.name, title: d.title ?? '', summary: d.summary ?? '',
      skills: Array.isArray(d.skills) ? d.skills.map((g) => ({ label: String(g.label ?? ''), items: String(g.items ?? '') })) : [],
      projects: Array.isArray(d.projects) ? d.projects.map((p) => ({ ...emptyProject(), ...p })) : [],
    }
  } catch { return null }
}

export function docText(d: ResumeDoc): string {
  return [d.title, d.summary, ...d.skills.map((g) => `${g.label}: ${g.items}`),
    ...d.projects.flatMap((p) => [p.name, p.details, p.technology, p.responsibilities])].join('\n')
}

export interface JdMatch { score: number | null; asked: string[]; have: string[]; missing: string[] }

/** How much of the job description's skills the resume names. Null when the JD names none we know. */
export function jdMatch(d: ResumeDoc, jd: string | null): JdMatch {
  const asked = jd ? skillsIn(jd) : []
  if (asked.length === 0) return { score: null, asked, have: [], missing: [] }
  const mine = new Set(skillsIn(docText(d)).map((s) => s.toLowerCase()))
  const have = asked.filter((s) => mine.has(s.toLowerCase()))
  return { score: Math.round((have.length / asked.length) * 100), asked, have, missing: asked.filter((s) => !mine.has(s.toLowerCase())) }
}

export const lines = (text: string) => text.split(/\r?\n/).map((l) => l.replace(/^[-•●*]\s*/, '').trim()).filter(Boolean)

/** What is still empty, so the candidate knows before submitting. */
export function gaps(d: ResumeDoc): string[] {
  const out: string[] = []
  if (!d.name.trim()) out.push('your name')
  if (!d.title.trim()) out.push('a title line')
  if (d.summary.trim().length < 80) out.push('a summary (a few sentences)')
  if (!d.skills.some((g) => g.items.trim())) out.push('technical skills')
  if (!d.projects.some((p) => p.name.trim() && lines(p.responsibilities).length > 0)) out.push('at least one project with responsibilities')
  return out
}

/** The resume as a Word file in the standard format (docx is loaded only when needed). */
export async function resumeDocx(d: ResumeDoc): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx')
  const blue = '1F5FA8'
  const heading = (text: string) => new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text, bold: true, color: blue, size: 24 })] })
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cell = (children: InstanceType<typeof Paragraph>[], width: number, bold = false) =>
    new TableCell({ borders, width: { size: width, type: WidthType.PERCENTAGE }, children: bold ? children.map((p) => p) : children })
  const label = (text: string) => new Paragraph({ children: [new TextRun({ text, bold: true })] })
  const row = (name: string, body: InstanceType<typeof Paragraph>[]) => new TableRow({ children: [cell([label(name)], 25, true), cell(body, 75)] })
  const para = (text: string) => new Paragraph({ children: [new TextRun(text)] })
  const projectTable = (p: ProjectEntry) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row('Project', [para(p.name)]),
      row('Details', lines(p.details).map(para)),
      ...(p.teamSize.trim() ? [row('Team Size', [para(p.teamSize)])] : []),
      row('Technology', [para(p.technology)]),
      row('Responsibilities', lines(p.responsibilities).map((t) => new Paragraph({ text: t, bullet: { level: 0 } }))),
    ],
  })
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: d.name, bold: true, color: blue, size: 28 })] }),
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: d.title, bold: true })] }),
        heading('Summary:'),
        ...lines(d.summary).map(para),
        heading('Technical Skills'),
        ...d.skills.filter((g) => g.items.trim()).map((g) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${g.label}: `, bold: true }), new TextRun(g.items.trim())] })),
        heading('Project Details'),
        ...d.projects.filter((p) => p.name.trim()).flatMap((p) => [projectTable(p), new Paragraph({ text: '' })]),
      ],
    }],
  })
  return Packer.toBlob(doc)
}

export function fileName(d: ResumeDoc, role: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return `${safe(d.name) || 'Resume'}_${safe(role) || 'role'}.docx`
}
