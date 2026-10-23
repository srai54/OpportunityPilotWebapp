import { describe, expect, it } from 'vitest'
import { allowedWorkspaces, effectiveWorkspace, roleFor, shouldSaveRole, type Me } from './accessModel'

const me = (over: Partial<Me>): Me => ({ accountId: 'a', role: 'Both', roleChosen: false, isAdmin: false, guest: false, newAccount: false, ...over })

describe('role-based access', () => {
  it('keeps both views while unknown, for Both, for no choice yet and for the admin', () => {
    expect(allowedWorkspaces(undefined)).toEqual(['candidate', 'sales'])
    expect(allowedWorkspaces(me({}))).toEqual(['candidate', 'sales'])
    expect(allowedWorkspaces(me({ role: 'Candidate', isAdmin: true }))).toEqual(['candidate', 'sales'])
  })
  it('limits a one-role user to that view and moves them there', () => {
    expect(allowedWorkspaces(me({ role: 'Sales', roleChosen: true }))).toEqual(['sales'])
    expect(allowedWorkspaces(me({ role: 'Candidate', roleChosen: true }))).toEqual(['candidate'])
    expect(effectiveWorkspace('candidate', ['sales'])).toBe('sales')
    expect(effectiveWorkspace('sales', ['candidate', 'sales'])).toBe('sales')
  })
  it('saves the sign-up role only for a new account without one', () => {
    expect(shouldSaveRole(me({ newAccount: true }))).toBe(true)
    expect(shouldSaveRole(me({ newAccount: false }))).toBe(false)
    expect(shouldSaveRole(me({ newAccount: true, roleChosen: true }))).toBe(false)
    expect(shouldSaveRole(me({ newAccount: true, guest: true }))).toBe(false)
    expect(shouldSaveRole(undefined)).toBe(false)
    expect(roleFor('candidate')).toBe('Candidate')
    expect(roleFor('sales')).toBe('Sales')
  })
})
