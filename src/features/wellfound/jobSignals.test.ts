import { describe, expect, it } from 'vitest'
import { isContract, isRemote } from './jobSignals'

const j = (o: { title?: string; employmentType?: string | null; snippet?: string | null; description?: string | null; location?: string | null; isRemote?: boolean }) =>
  ({ title: 'React developer', employmentType: null, ...o })

describe('isContract (J4: one rule for every source)', () => {
  it.each([
    ['CONTRACTOR', 'employment type'], ['Contract/Temp', 'SEEK type'], ['freelance', 'Remotive type'], ['C2C', 'type c2c'], ['Temporary', 'temp'],
  ])('reads the employment type %s (%s)', (type) => expect(isContract(j({ employmentType: type }))).toBe(true))

  it.each([
    'Contract React developer', 'React developer (Contractor)', 'Freelance React developer', 'React developer C2C', 'React dev - corp-to-corp',
    'Interim CTO', 'React developer, day rate', '6-month React developer', 'React developer 12 months',
  ])('reads the title "%s"', (title) => expect(isContract(j({ title }))).toBe(true))

  it.each([
    'This is a contract role for 3 months.', 'Hired on a contract basis', 'B2B contract with a German client', 'Day rate £500',
    'Fixed-term contract until June', 'A 6-month contract, remote', 'Paid C2C only', 'Freelance project for a startup',
  ])('reads clear phrases in the text: "%s"', (description) => expect(isContract(j({ description }))).toBe(true))

  it('does not treat ordinary jobs as contract', () => {
    expect(isContract(j({ employmentType: 'FULLTIME', title: 'Backend engineer' }))).toBe(false)
    expect(isContract(j({ description: 'We build B2B SaaS for banks. Permanent role.' }))).toBe(false)
    expect(isContract(j({ description: 'Sign the employment contract on day one.' }))).toBe(false)
    expect(isContract(j({ title: 'Contracts manager' }))).toBe(false)
  })
})

describe('isRemote (J4)', () => {
  it('trusts the source flag', () => expect(isRemote(j({ isRemote: true }))).toBe(true))
  it.each(['Remote', 'Anywhere', 'Worldwide', 'Remote — Germany', 'Work from home'])('reads the place "%s"', (location) => expect(isRemote(j({ location }))).toBe(true))
  it('reads the title and clear phrases in the text', () => {
    expect(isRemote(j({ title: 'Remote React developer' }))).toBe(true)
    expect(isRemote(j({ snippet: 'We are a fully remote team' }))).toBe(true)
    expect(isRemote(j({ description: 'WFH allowed' }))).toBe(true)
  })
  it('does not call an office job remote', () => {
    expect(isRemote(j({ location: 'Berlin', description: 'Office in Berlin, 5 days a week. Remote controls for drones.' }))).toBe(false)
  })
})
