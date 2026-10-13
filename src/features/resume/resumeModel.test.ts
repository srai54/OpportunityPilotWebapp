import { describe, expect, it } from 'vitest'
import { analyzeResume, skillsIn, suggestionsEmail, tailorResume } from './resumeModel'

const JOB = 'We need a Senior React Developer with 5+ years. You will use React, TypeScript, Docker and AWS, and we like GraphQL.'
const RESUME = 'Asha Rao\nBackend and web engineer.\nSkills: Python, Docker, React, SQL\nExperience: built APIs and web apps.'

describe('skillsIn', () => {
  it('finds named skills in order and does not find Java inside JavaScript', () => {
    expect(skillsIn('We use JavaScript and, later, TypeScript.')).toEqual(['JavaScript', 'TypeScript'])
    expect(skillsIn('Strong .NET and C# skills')).toEqual(expect.arrayContaining(['.NET', 'C#']))
    expect(skillsIn('You will go to meetings.')).toEqual([])
  })
})

describe('analyzeResume', () => {
  const a = analyzeResume(RESUME, 'Senior React Developer', JOB)
  it('splits what the job asks for into what the resume has and what it lacks', () => {
    expect(a.have).toEqual(expect.arrayContaining(['React', 'Docker']))
    expect(a.missing).toEqual(expect.arrayContaining(['TypeScript', 'AWS', 'GraphQL']))
    expect(a.have.some((s) => a.missing.includes(s))).toBe(false)
  })
  it('never tells the person to claim a missing skill', () => {
    const missing = a.suggestions.filter((s) => s.kind === 'missing')
    expect(missing.length).toBeGreaterThan(0)
    for (const m of missing) expect(m.text).toContain('only if you really have it')
  })
  it('asks for the years and notes a missing Skills line; the title only when the first lines lack it', () => {
    expect(a.suggestions.map((s) => s.kind)).toEqual(expect.arrayContaining(['order', 'years']))
    expect(a.suggestions.some((s) => s.kind === 'skills-line')).toBe(false)
    expect(a.suggestions.some((s) => s.kind === 'title')).toBe(false)
    const other = analyzeResume('Asha Rao\nI build things.\nDocker and Python daily.', 'Senior React Developer', JOB)
    expect(other.suggestions.map((s) => s.kind)).toEqual(expect.arrayContaining(['title', 'skills-line']))
  })
})

describe('tailorResume', () => {
  it('moves matching skills first and adds a headline, adding no new skill', () => {
    const a = analyzeResume(RESUME, 'Senior React Developer', JOB)
    const t = tailorResume(RESUME, 'Senior React Developer', a)
    expect(t.text.startsWith('Senior React Developer — ')).toBe(true)
    expect(t.text).toContain('Skills: React, Docker, Python, SQL')
    for (const s of a.missing) expect(t.text).not.toContain(s)
    expect(t.changes.length).toBe(2)
  })
  it('changes nothing when nothing matches', () => {
    const a = analyzeResume('Chef with ten years in kitchens.', 'Senior React Developer', JOB)
    const t = tailorResume('Chef with ten years in kitchens.', 'Senior React Developer', a)
    expect(t.text).toBe('Chef with ten years in kitchens.')
    expect(t.changes).toEqual([])
  })
})

describe('suggestionsEmail', () => {
  it('is a plain note that tells the candidate to change only what is true', () => {
    const a = analyzeResume(RESUME, 'Senior React Developer', JOB)
    const e = suggestionsEmail('Asha Rao', 'Senior React Developer', a)
    expect(e).toContain('Hi Asha,')
    expect(e).toContain('only what is true for you')
  })
})
