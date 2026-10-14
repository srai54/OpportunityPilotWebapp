import { describe, expect, it } from 'vitest'
import { naukriCampaignPath, naukriSearchUrl } from './naukriModel'

describe('naukri links', () => {
  it('builds Naukri’s own search address', () => {
    expect(naukriSearchUrl('React Developer', 'Pune')).toBe('https://www.naukri.com/react-developer-jobs-in-pune?k=React+Developer&l=Pune')
    expect(naukriSearchUrl('.NET developer')).toBe('https://www.naukri.com/net-developer-jobs?k=.NET+developer')
  })
  it('starts a campaign with the Naukri board for the right workspace', () => {
    const p = new URLSearchParams(naukriCampaignPath('sales', 'payroll', 'Mumbai').split('?')[1])
    expect(p.get('board')).toBe('Naukri')
    expect(p.get('mode')).toBe('Customer')
    expect(p.get('location')).toBe('Mumbai')
  })
})
