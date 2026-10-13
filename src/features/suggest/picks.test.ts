import { describe, expect, it } from 'vitest'
import { defaultRegion, PLACES, placeFor, POPULAR_ROLES } from './picks'

describe('quick picks', () => {
  it('offers places in and outside India and a spread of roles', () => {
    expect(PLACES.india).toContain('Bengaluru')
    expect(PLACES.abroad).toContain('London')
    expect(POPULAR_ROLES.length).toBeGreaterThanOrEqual(10)
    expect(new Set([...POPULAR_ROLES]).size).toBe(POPULAR_ROLES.length)
  })
  it('turns a pick into a search place', () => {
    expect(placeFor('Pune')).toEqual({ location: 'Pune', remote: false })
    expect(placeFor('Remote (India)')).toEqual({ location: 'India', remote: true })
    expect(placeFor('Remote (worldwide)')).toEqual({ location: '', remote: true })
  })
  it('puts India first for Indian browsers', () => {
    expect(defaultRegion('en-IN', 'UTC')).toBe('india')
    expect(defaultRegion('en-US', 'Asia/Calcutta')).toBe('india')
    expect(defaultRegion('en-GB', 'Europe/London')).toBe('abroad')
  })
})
