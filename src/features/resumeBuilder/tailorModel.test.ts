import { describe, expect, it } from 'vitest'
import { startDoc } from './resumeDoc'
import { matchLine, previewOf } from './tailorModel'

describe('tailor preview', () => {
  const current = startDoc('Asha Rao', 'Developer', null)
  const jd = 'We need React and TypeScript and C# developers.'

  it('shows the match before and after and who wrote it', () => {
    const tailored = { ...current, title: 'React developer', skills: [{ label: 'Frontend', items: 'React, TypeScript' }] }
    const p = previewOf(current, { data: JSON.stringify(tailored), provider: 'Claude', model: 'claude-opus-5-5', changes: ['Put React first'], notAdded: ['C#'] }, jd)!
    expect(p.doc.title).toBe('React developer')
    expect(p.after).toBeGreaterThan(p.before ?? 0)
    expect(p.by).toBe('Claude (claude-opus-5-5)')
    expect(matchLine(p)).toMatch(/→/)
  })

  it('refuses an answer that is not a resume', () => {
    expect(previewOf(current, { data: '{}', provider: 'Claude', model: null, changes: [], notAdded: [] }, jd)).toBeNull()
  })

  it('says nothing when there is nothing to compare', () => {
    expect(matchLine({ before: null, after: null })).toBeNull()
    expect(matchLine({ before: 50, after: 50 })).toBe('JD match 50%')
  })
})
