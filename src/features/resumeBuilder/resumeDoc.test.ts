import { describe, expect, it } from 'vitest'
import { fileName, gaps, jdMatch, lines, parseDoc, startDoc } from './resumeDoc'

describe('resume builder model', () => {
  it('starts from the candidate record', () => {
    const d = startDoc('Priya Sharma', 'Senior .NET developer', 'C#, .NET, Azure')
    expect(d.title).toBe('Senior .NET developer')
    expect(d.skills[0]).toEqual({ label: 'Key skills', items: 'C#, .NET, Azure' })
    expect(d.projects).toHaveLength(1)
  })
  it('reads saved JSON and refuses anything else', () => {
    expect(parseDoc('{}')).toBeNull()
    expect(parseDoc('nope')).toBeNull()
    expect(parseDoc(JSON.stringify(startDoc('A', null, null)))?.name).toBe('A')
  })
  it('scores the JD skills the resume names and lists the missing ones', () => {
    const d = startDoc('A', 'Engineer', 'C#, Azure, Angular')
    const m = jdMatch(d, 'We need C#, Azure, Kubernetes and Angular experience.')
    expect(m.asked).toEqual(expect.arrayContaining(['C#', 'Azure', 'Kubernetes', 'Angular']))
    expect(m.missing).toContain('Kubernetes')
    expect(m.score).toBe(Math.round((m.have.length / m.asked.length) * 100))
    expect(jdMatch(d, null).score).toBeNull()
  })
  it('lists what is still empty, splits bullet lines, names the file', () => {
    expect(gaps(startDoc('', null, null))).toContain('your name')
    expect(lines('● One\n- Two\n\n  Three ')).toEqual(['One', 'Two', 'Three'])
    expect(fileName(startDoc('Priya Sharma', null, null), '3 senior .NET devs')).toBe('Priya_Sharma_3_senior_NET_devs.docx')
  })
})
