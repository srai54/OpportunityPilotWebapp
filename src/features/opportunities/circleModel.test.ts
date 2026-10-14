import { describe, expect, it } from 'vitest'
import { degreeLabel, groupCircle, profileUrlProblem, type CirclePerson } from './circleModel'

const p = (name: string, relation: CirclePerson['relation'], degree: number | null): CirclePerson =>
  ({ id: name, name, title: null, profileUrl: `https://www.linkedin.com/in/${name}`, relation, degree, source: 'LinkedInAgent', foundAt: '2026-10-14T00:00:00Z' })

describe('groupCircle', () => {
  it('puts people you know first, then decision makers, then recruiters; closest connections first in each', () => {
    const groups = groupCircle([p('zed', 'Recruiter', 2), p('amy', 'Connection', 1), p('bob', 'HiringManager', 3), p('cat', 'HiringManager', 2)])
    expect(groups.map((g) => g.relation)).toEqual(['Connection', 'HiringManager', 'Recruiter'])
    expect(groups[1].people.map((x) => x.name)).toEqual(['cat', 'bob'])
  })
})

describe('helpers', () => {
  it('labels degrees and checks profile links', () => {
    expect(degreeLabel(1)).toBe('1st')
    expect(degreeLabel(3)).toBe('3rd+')
    expect(degreeLabel(null)).toBeNull()
    expect(profileUrlProblem('https://www.linkedin.com/in/nikhil-malhotra-3b8202175/')).toBeNull()
    expect(profileUrlProblem('https://www.linkedin.com/company/acme')).not.toBeNull()
    expect(profileUrlProblem('https://evil.test/in/x')).not.toBeNull()
  })
})
