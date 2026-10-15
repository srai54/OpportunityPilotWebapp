import { describe, expect, it } from 'vitest'
import { isYes } from './assistantModel'

describe('isYes', () => {
  it('accepts a spoken confirmation and nothing else', () => {
    for (const t of ['yes', 'Yeah do it', 'ok run it', 'go ahead', 'haan']) expect(isYes(t)).toBe(true)
    for (const t of ['no', 'not yet', 'yesterday', 'cancel']) expect(isYes(t)).toBe(false)
  })
})
