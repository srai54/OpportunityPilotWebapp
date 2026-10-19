import { describe, expect, it } from 'vitest'
import { leadSearchBody, sizeText } from './apolloModel'

const base = { keywords: '', titles: '', country: '', sizes: [] as string[], kind: 'companies' as const }

describe('leadSearchBody', () => {
  it('needs words or a country', () => expect(leadSearchBody(base)).toBeNull())
  it('sends keywords, the country and only known sizes', () => {
    expect(leadSearchBody({ ...base, keywords: ' SaaS ', country: 'Sweden', sizes: ['10-20', '50-100', 'x'] }))
      .toEqual({ keywords: 'SaaS', titles: null, countries: ['Sweden'], sizes: ['10-20', '50-100'], kind: 'companies', page: 1 })
  })
  it('sends titles only for people', () => {
    expect(leadSearchBody({ ...base, titles: 'CTO', country: 'Germany' })?.titles).toBeNull()
    expect(leadSearchBody({ ...base, titles: 'CTO', kind: 'people' })?.titles).toBe('CTO')
  })
})

describe('sizeText', () => {
  it('shows the count with its band, the count alone, or a dash', () => {
    expect(sizeText({ employees: 35, sizeBand: '20-50' })).toBe('35 (20–50)')
    expect(sizeText({ employees: 900, sizeBand: null })).toBe('900')
    expect(sizeText({ employees: null, sizeBand: null })).toBe('—')
  })
})
