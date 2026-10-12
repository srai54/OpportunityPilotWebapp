import { describe, expect, it } from 'vitest'
import { ROLES, SKILLS, suggest } from './catalog'

describe('catalog', () => {
  it('has no blanks or duplicates (case-insensitive) and is a useful size', () => {
    for (const list of [SKILLS, ROLES]) {
      const seen = new Set(list.map((x) => x.toLowerCase()))
      expect(seen.size).toBe(list.length)
      expect(list.every((x) => x.trim() === x && x.length > 0 && x.length <= 40)).toBe(true)
    }
    expect(SKILLS.length).toBeGreaterThan(300)
    expect(ROLES.length).toBeGreaterThan(120)
  })
})

describe('suggest', () => {
  it('ranks a phrase start before a word start before a substring', () => {
    const r = suggest(['Azure', 'Microsoft Azure DevOps', 'Pazure'], 'azure')
    expect(r).toEqual(['Azure', 'Microsoft Azure DevOps', 'Pazure'])
  })
  it('finds skills with punctuation and by word start', () => {
    expect(suggest(SKILLS, 'c#')[0]).toBe('C#')
    expect(suggest(SKILLS, '.net')).toContain('.NET')
    expect(suggest(SKILLS, 'sales')).toContain('Sales operations')
    expect(suggest(SKILLS, 'cold')).toEqual(expect.arrayContaining(['Cold calling', 'Cold emailing']))
  })
  it('leaves out what is already chosen, ignoring case', () => {
    expect(suggest(SKILLS, 'azure', ['azure'])).not.toContain('Azure')
  })
  it('returns the common ones for an empty query and honours the limit', () => {
    expect(suggest(SKILLS, '', [], 5)).toEqual(SKILLS.slice(0, 5))
    expect(suggest(SKILLS, 'a', [], 3)).toHaveLength(3)
  })
  it('returns nothing for gibberish', () => expect(suggest(SKILLS, 'zzzzqq')).toEqual([]))
  it('suggests roles', () => expect(suggest(ROLES, 'react')[0]).toBe('React developer'))
})
