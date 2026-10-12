import { describe, expect, it } from 'vitest'
import { buildSummary, confirmationState, createFields, FIELDS as ALL_FIELDS, isFullyConfirmed, isWideField, joinTags, splitTags, readiness, simpleCreateFields, starterSearchTerm, confirmFilledClaims, needsProfileConfirm } from './profileFields'

describe('profile confirmation', () => {
  it('is not confirmed when no claims are filled in', () => {
    expect(isFullyConfirmed('Candidate', { fields: { offer: '.NET work' }, confirmations: {} })).toBe(false)
  })

  it('requires every filled claim to be confirmed', () => {
    const data = { fields: { experience: '4 years .NET', skills: 'C#, React' }, confirmations: { experience: true } }
    expect(isFullyConfirmed('Candidate', data)).toBe(false)
    expect(confirmationState('Candidate', data).awaiting).toEqual(['Skills'])

    data.confirmations = { experience: true, skills: true } as never
    expect(isFullyConfirmed('Candidate', data)).toBe(true)
  })

  it('ignores stale confirmations on empty fields', () => {
    const data = { fields: { experience: '4 years .NET', skills: '' }, confirmations: { experience: true, skills: true } }
    expect(isFullyConfirmed('Candidate', data)).toBe(true)
    expect(confirmationState('Candidate', data).missing).toEqual(['Skills'])
  })
})

describe('summary', () => {
  it('uses only what the user typed, in field order, without rewording', () => {
    const summary = buildSummary('Candidate', {
      fields: { skills: 'C#', offer: 'Backend work', availability: 'Rate: [YOUR RATE]' },
      confirmations: {},
    })
    expect(summary).toBe('What you offer: Backend work\nSkills: C#\nAvailability and terms: Rate: [YOUR RATE]')
  })
})


describe('round-3 profile editor', () => {
  it('round-trips skills between text and chips', () => {
    expect(splitTags('C#, .NET 8,\nDocker , ')).toEqual(['C#', '.NET 8', 'Docker'])
    expect(joinTags(['C#', 'Docker'])).toBe('C#, Docker')
    expect(splitTags(undefined)).toEqual([])
  })

  it('creates with the offer and non-claim fields only; claims come after saving', () => {
    expect(createFields('Candidate').map((f) => f.key)).toEqual(['offer', 'availability', 'outreachIdentity'])
    expect(createFields('Candidate').some((f) => f.confirmable)).toBe(false)
  })

  it('simple mode asks only for what a first search and a first message need', () => {
    expect(simpleCreateFields('Candidate').map((f) => f.key)).toEqual(['offer', 'skills', 'outreachIdentity'])
    expect(simpleCreateFields('Product').map((f) => f.key)).toEqual(['offer', 'idealCustomer', 'capabilities', 'outreachIdentity'])
  })

  it('turns a profile name into a search phrase', () => {
    expect(starterSearchTerm('Data analyst — 5 years')).toBe('Data analyst')
    expect(starterSearchTerm('.NET developer (remote)')).toBe('.NET developer')
    expect(starterSearchTerm('React, Node')).toBe('React')
  })

  it('makes the offer full width', () => {
    expect(isWideField(ALL_FIELDS.Candidate[0])).toBe(true)
  })
})

describe('readiness', () => {
  it('lists missing required fields and unconfirmed claims', () => {
    const r = readiness('Services', { fields: { offer: 'Fixed-scope .NET work', proof: 'Acme migration' }, confirmations: {} })
    expect(r.missingRequired).toEqual(['Ideal customer', 'Outreach identity'])
    expect(r.claimsAwaiting).toEqual(['Case studies you approve for outreach'])
    expect(r.ready).toBe(false)
  })
  it('is ready when required fields are filled and every claim is confirmed', () => {
    const r = readiness('Product', {
      fields: { offer: 'Route planning SaaS', idealCustomer: 'Mid-size 3PLs in DACH', outreachIdentity: 'Asha Rao, Sales, RouteCo', proof: '20% fewer km at Acme' },
      confirmations: { proof: true },
    })
    expect(r.ready).toBe(true)
    expect(r.requiredFilled).toBe(r.requiredTotal)
  })
})

describe('confirmFilledClaims', () => {
  it('confirms the claims that were typed and leaves empty ones alone', () => {
    const out = confirmFilledClaims('Candidate', { fields: { offer: 'x', skills: 'C#, Azure', experience: '' }, confirmations: {} })
    expect(out.confirmations.skills).toBe(true)
    expect(out.confirmations.experience).toBeUndefined()
    expect(isFullyConfirmed('Candidate', out)).toBe(true)
  })
})

describe('needsProfileConfirm', () => {
  it('finds the reason in a validation field error, not only in the message', () => {
    expect(needsProfileConfirm(Object.assign(new Error('Validation failed'), { fieldErrors: { profile: ['Confirm the campaign profile before generating a cover note.'] } }))).toBe(true)
    expect(needsProfileConfirm(new Error('Validation failed'))).toBe(false)
    expect(needsProfileConfirm(undefined)).toBe(false)
  })
})
