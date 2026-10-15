import { describe, expect, it } from 'vitest'
import { easeOut, formatCount, splitNumber } from './countUp'

describe('count-up helpers', () => {
  it('eases from 0 to 1 and clamps', () => {
    expect(easeOut(0)).toBe(0); expect(easeOut(1)).toBe(1); expect(easeOut(2)).toBe(1); expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })
  it('splits a number out of a label', () => {
    expect(splitNumber('1,250 jobs')).toEqual({ prefix: '', value: 1250, suffix: ' jobs', decimals: 0 })
    expect(splitNumber('40%')).toEqual({ prefix: '', value: 40, suffix: '%', decimals: 0 })
    expect(splitNumber('£2.5k')).toEqual({ prefix: '£', value: 2.5, suffix: 'k', decimals: 1 })
    expect(splitNumber('—')).toBeNull()
  })
  it('formats with fixed decimals', () => { expect(formatCount(2.5, 1)).toBe((2.5).toLocaleString(undefined, { minimumFractionDigits: 1 })) })
})
