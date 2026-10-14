import { describe, expect, it } from 'vitest'
import { hankoApiUrl } from './config'

describe('Hanko API URL', () => {
  it('is off when unset or blank', () => {
    expect(hankoApiUrl(undefined)).toBeUndefined()
    expect(hankoApiUrl('')).toBeUndefined()
    expect(hankoApiUrl('   ')).toBeUndefined()
  })

  it('accepts https and drops trailing slashes', () => {
    expect(hankoApiUrl(' https://abc123.hanko.io/ ')).toBe('https://abc123.hanko.io')
    expect(hankoApiUrl('https://abc123.hanko.io//')).toBe('https://abc123.hanko.io')
  })

  it('accepts plain http only for a local Hanko', () => {
    expect(hankoApiUrl('http://localhost:8000')).toBe('http://localhost:8000')
    expect(hankoApiUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000')
    expect(hankoApiUrl('http://abc123.hanko.io')).toBeUndefined()
  })

  it('rejects text that is not a URL', () => {
    expect(hankoApiUrl('abc123.hanko.io')).toBeUndefined()
    expect(hankoApiUrl('javascript:alert(1)')).toBeUndefined()
  })
})
