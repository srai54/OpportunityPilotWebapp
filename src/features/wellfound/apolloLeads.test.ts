import { describe, expect, it } from 'vitest'
import { leadsAsPaste } from './apolloLeads'

describe('leadsAsPaste', () => {
  it('writes one block per lead in the Paste source format, with the contact for the email', () => {
    const text = leadsAsPaste([
      { name: 'Ana Berg', company: 'Acme AB', title: 'CTO', location: 'Stockholm, Sweden', website: 'https://acme.se/', linkedIn: 'https://www.linkedin.com/in/ana' },
      { name: 'Name hidden (demo)', company: 'Atmoz', title: 'CTO', location: null, website: null, linkedIn: null },
    ])
    expect(text).toBe([
      'Acme AB', 'Company: Acme AB', 'Location: Stockholm, Sweden', 'Website: https://acme.se/', 'URL: https://www.linkedin.com/in/ana', 'Contact from Apollo: Ana Berg, CTO.',
      '---',
      'Atmoz', 'Company: Atmoz', 'Contact from Apollo: CTO.',
    ].join('\n'))
  })
})
