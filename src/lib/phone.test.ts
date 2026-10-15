import { describe, expect, it } from 'vitest'
import { displayPhone, findPhone, normalisePhone, toTel, toWhatsApp } from './phone'

describe('normalisePhone', () => {
  it('adds +91 to a 10-digit Indian mobile', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210')
    expect(normalisePhone('098765-43210')).toBe('+919876543210')
    expect(normalisePhone('919876543210')).toBe('+919876543210')
  })
  it('keeps an international number with its plus', () => {
    expect(normalisePhone('+1 (415) 555-0100')).toBe('+14155550100')
    expect(normalisePhone('0044 20 7946 0958')).toBe('+442079460958')
  })
  it('returns "" for nothing usable', () => {
    expect(normalisePhone('')).toBe('')
    expect(normalisePhone(null)).toBe('')
    expect(normalisePhone('call me')).toBe('')
    expect(normalisePhone('12345')).toBe('')
  })
  it('leaves a landline without a country code as digits', () => {
    expect(normalisePhone('2079460958')).toBe('2079460958')
  })
})

describe('toTel', () => {
  it('builds a tel: link', () => expect(toTel('98765 43210')).toBe('tel:+919876543210'))
  it('is null without a number', () => expect(toTel(undefined)).toBeNull())
})

describe('toWhatsApp', () => {
  it('builds a wa.me link with digits only and encoded text', () => {
    expect(toWhatsApp('+91 98765 43210', 'Hi Priya, round 2 & more')).toBe('https://wa.me/919876543210?text=Hi%20Priya%2C%20round%202%20%26%20more')
  })
  it('adds +91 for an Indian 10-digit number', () => expect(toWhatsApp('9876543210')).toBe('https://wa.me/919876543210'))
  it('is null without a number', () => expect(toWhatsApp('', 'x')).toBeNull())
})

describe('displayPhone', () => {
  it('groups an Indian mobile', () => expect(displayPhone('9876543210')).toBe('+91 98765 43210'))
  it('leaves others normalised', () => expect(displayPhone('+1 415 555 0100')).toBe('+14155550100'))
})

describe('findPhone', () => {
  it('finds a number in a note', () => expect(findPhone('Call Rahul on 98765 43210 after 5')).toBe('+919876543210'))
  it('ignores dates and short numbers', () => {
    expect(findPhone('Round 2 on 17 Oct')).toBe('')
    expect(findPhone('Due 2026-10-17 15:00')).toBe('')
    expect(findPhone(null)).toBe('')
  })
})
