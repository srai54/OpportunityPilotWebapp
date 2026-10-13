import { describe, expect, it } from 'vitest'
import { percentOf } from './percent'

describe('percentOf', () => {
  it('is a safe percentage', () => {
    expect(percentOf(3, 4)).toBe(75)
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(9, 4)).toBe(100)
    expect(percentOf(-1, 4)).toBe(0)
  })
})
