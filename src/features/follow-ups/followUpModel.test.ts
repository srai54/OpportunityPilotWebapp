import { describe, expect, it } from 'vitest'
import { dueLabel } from './followUpModel'

const now = new Date('2026-10-12T10:00:00Z')
describe('dueLabel', () => {
  it('reads a reminder at a glance', () => {
    expect(dueLabel('2026-10-12T18:00:00Z', now)).toBe('due today')
    expect(dueLabel('2026-10-17T10:00:00Z', now)).toBe('due in 5 days')
    expect(dueLabel('2026-10-11T09:00:00Z', now)).toBe('1 day overdue')
    expect(dueLabel('2026-10-08T10:00:00Z', now)).toBe('4 days overdue')
  })
})
