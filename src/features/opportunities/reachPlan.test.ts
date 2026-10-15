import { describe, expect, it } from 'vitest'
import { connectionsAtUrl, reachRoutes, referralNote, signOffName, type ReachInput } from './reachPlan'

const job: ReachInput = { mode: 'Job', organization: 'Acme', title: '.NET Developer', url: 'https://www.linkedin.com/jobs/view/1/', applyUrl: null, platform: 'LinkedIn' }
const lead: ReachInput = { mode: 'Customer', organization: 'Northwind', title: 'Northwind', url: 'https://northwind.example/about', applyUrl: null, platform: null }

describe('reachRoutes', () => {
  it('for a job with no email: apply first, then the recruiter, a referral, then a lookup service', () => {
    const ids = reachRoutes(job).map((r) => r.id)
    expect(ids).toEqual(['apply', 'recruiter', 'referral', 'find-email', 'connect-finder'])
    expect(reachRoutes(job)[0].why).toMatch(/desktop agent/)
  })
  it('a published email goes first and removes the lookups', () => {
    const ids = reachRoutes({ ...lead, publishedEmail: 'sales@northwind.example' }).map((r) => r.id)
    expect(ids[0]).toBe('email')
    expect(ids).not.toContain('find-email')
    expect(ids).not.toContain('connect-finder')
  })
  it('a sales lead goes to a decision maker and offers the contact form on its own site', () => {
    const routes = reachRoutes(lead)
    expect(routes.map((r) => r.id)).toEqual(['decision-maker', 'referral', 'find-email', 'connect-finder', 'contact-form'])
    expect(routes.at(-1)?.why).toContain('northwind.example')
  })
  it('never offers a job board\'s own contact form for a lead found there', () => {
    for (const url of ['https://www.naukri.com/job-listings-x-123', 'https://www.instahyre.com/job-1', 'https://boards.greenhouse.io/acme/jobs/1'])
      expect(reachRoutes({ ...lead, url }).map((r) => r.id)).not.toContain('contact-form')
  })
  it('a connected Hunter or Apollo replaces the connect prompt, and a finished search is not offered again', () => {
    const ids = reachRoutes({ ...lead, finders: ['Hunter', 'Apollo'], emailSearched: true }).map((r) => r.id)
    expect(ids).toContain('people-Hunter')
    expect(ids).toContain('people-Apollo')
    expect(ids).not.toContain('connect-finder')
    expect(ids).not.toContain('find-email')
  })
  it('the referral search is limited to the person’s own 1st-degree connections', () => {
    const u = new URL(connectionsAtUrl('Acme "Inc"'))
    expect(u.searchParams.get('network')).toBe('["F"]')
    expect(u.searchParams.get('keywords')).toBe('"Acme Inc"')
  })
})

describe('referralNote', () => {
  it('fits LinkedIn’s 300 characters, names the role and signs with the name', () => {
    const note = referralNote({ mode: 'Job', organization: 'Acme', title: 'Senior .NET Developer' }, 'Asha Rao')
    expect(note.length).toBeLessThanOrEqual(300)
    expect(note).toContain('Senior .NET Developer')
    expect(note.endsWith('Asha Rao')).toBe(true)
    expect(referralNote({ mode: 'Customer', organization: 'X'.repeat(500), title: 'Y'.repeat(500) }, 'Asha').length).toBeLessThanOrEqual(300)
  })
  it('takes the sign-off from a generated draft only when it is a real name', () => {
    expect(signOffName('Hello\n\nRegards,\nAsha Rao\n')).toBe('Asha Rao')
    expect(signOffName('Hello\n\nRegards,\n[Your name]')).toBeNull()
    expect(signOffName('Hello\n\nRegards,')).toBeNull()
  })
})

describe('connections at a company', () => {
  it('opens the same LinkedIn search as typing the company with 1st-degree connections only', async () => {
    const { connectionsAtUrl } = await import('./reachPlan')
    expect(connectionsAtUrl('Comviva')).toBe('https://www.linkedin.com/search/results/people/?keywords=%22Comviva%22&network=%5B%22F%22%5D')
  })
})
