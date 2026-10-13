import { describe, expect, it } from 'vitest'
import { commandPath, describeCommand, parseCommand } from './commandModel'

describe('parseCommand', () => {
  it('takes the role and the place', () => {
    expect(parseCommand('find react developer jobs in Berlin', 'candidate')).toEqual({ query: 'react developer', location: 'Berlin', remoteOnly: false, next: 'review', repeat: 0 })
  })
  it('understands remote, apply and daily', () => {
    const c = parseCommand('Search .NET developer remote and apply every day', 'candidate')!
    expect(c).toMatchObject({ query: '.NET developer', remoteOnly: true, next: 'apply', repeat: 1440 })
  })
  it('understands sending outreach for sales and never turns apply into a sales step', () => {
    expect(parseCommand('find companies hiring payroll engineers in London then send outreach', 'sales')).toMatchObject({ query: 'payroll engineers', location: 'London', next: 'send' })
    expect(parseCommand('find react developers and apply', 'sales')?.next).toBe('send')
  })
  it('accepts a bare keyword and weekly', () => {
    expect(parseCommand('golang weekly', 'candidate')).toMatchObject({ query: 'golang', repeat: 10080, next: 'review' })
  })
  it('returns nothing when there is no search word', () => {
    expect(parseCommand('   ', 'candidate')).toBeNull()
    expect(parseCommand('find jobs', 'candidate')).toBeNull()
  })
})

describe('describe and path', () => {
  const c = parseCommand('find react developers in Berlin and apply daily', 'candidate')!
  it('says exactly what will happen and that nothing is sent by itself', () => {
    const s = describeCommand(c, 'candidate')
    expect(s).toContain('“react developers” jobs in Berlin')
    expect(s).toContain('apply from a queue')
    expect(s).toContain('repeat every day')
    expect(s).toContain('Nothing is sent or applied until you approve it.')
  })
  it('builds the quick-campaign link with the choice carried along', () => {
    const p = new URLSearchParams(commandPath(c, 'candidate').split('?')[1])
    expect(Object.fromEntries(p)).toEqual({ keywords: 'react developers', auto: '1', then: 'apply', location: 'Berlin', repeat: '1440', board: 'FreeFeeds' })
  })
})
