import { describe, expect, it } from 'vitest'
import { sameCompany, sameLink } from './bulkFromSearch'

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
