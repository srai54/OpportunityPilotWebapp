import { describe, expect, it } from 'vitest'
import { pickedAsPaste, sameCompany, sameLink } from './bulkFromSearch'

describe('bulk matching', () => {
  it('matches a posting link however the board wrote it', () => {
    expect(sameLink('https://www.naukri.com/job-listings-data-scientist-123?src=x', 'https://www.naukri.com/job-listings-data-scientist-123/')).toBe(true)
    expect(sameLink('https://www.naukri.com/a-1', 'https://www.naukri.com/a-2')).toBe(false)
    expect(sameLink('', '')).toBe(false)
  })
  it('matches a company without Ltd/Pvt/Inc or punctuation', () => {
    expect(sameCompany('Infosys Ltd.', 'infosys')).toBe(true)
    expect(sameCompany('Tata Consultancy Services Pvt. Ltd', 'Tata Consultancy Services')).toBe(true)
    expect(sameCompany('Tesco', 'Tesla')).toBe(false)
  })
})

describe('pickedAsPaste', () => {
  const j = (title: string, company: string, url: string) => ({ providerJobId: url, title, companyName: company, companyLogoUrl: null, boardUrl: url, location: 'Sydney NSW', isRemote: false, employmentType: null, salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null, postedAt: null, snippet: null })
  it('writes one block per job for a candidate, with the board link', () => {
    expect(pickedAsPaste(false, [j('.NET Developer', 'Acme', 'https://www.seek.com.au/job/1')]))
      .toBe('.NET Developer\nCompany: Acme\nLocation: Sydney NSW\nURL: https://www.seek.com.au/job/1')
  })
  it('writes one block per company for Sales, with the roles it is hiring for', () => {
    const text = pickedAsPaste(true, [j('Dev', 'Acme Pty Ltd', 'https://www.seek.com.au/job/1'), j('QA', 'acme', 'https://www.seek.com.au/job/2'), j('PM', 'Beta', 'https://www.seek.com.au/job/3')])
    expect(text.split('\n---\n')).toHaveLength(2)
    expect(text).toContain('Hiring: Dev, QA.')
  })
})
