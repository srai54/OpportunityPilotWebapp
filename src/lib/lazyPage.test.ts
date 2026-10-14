import { describe, expect, it } from 'vitest'
import { isStaleChunkError } from './lazyPage'

describe('isStaleChunkError', () => {
  it('recognises the browsers’ missing-page-file errors and nothing else', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/StaffingDealsPage-BKV-1r7A.js'))).toBe(true)
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
