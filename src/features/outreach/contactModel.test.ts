import { describe, expect, it } from 'vitest'
import { contactBadge, usableAsRecipient } from './contactModel'

describe('contact suggestions', () => {
  it('says whether an address is on the company\'s own domain', () => {
    expect(contactBadge({ kind: 'Email', label: 'Role inbox', matchesCompanySite: true })).toBe("Role inbox · on the company's own domain")
    expect(contactBadge({ kind: 'Email', label: 'Role inbox', matchesCompanySite: false })).toBe("Role inbox · not on the company's domain")
    expect(contactBadge({ kind: 'LinkedIn', label: 'Company page', matchesCompanySite: false })).toBe('Company page')
  })
  it('only an email can become a recipient', () => {
    expect(usableAsRecipient({ kind: 'Email' })).toBe(true)
    expect(usableAsRecipient({ kind: 'LinkedIn' })).toBe(false)
  })
})
