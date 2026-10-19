import { describe, expect, it } from 'vitest'
import { pagerOf } from './composer'

describe('pagerOf (one message at a time)', () => {
  it('gives the position and both neighbours', () => {
    expect(pagerOf(['a', 'b', 'c'], 'b')).toEqual({ index: 1, total: 3, prev: 'a', next: 'c' })
    expect(pagerOf(['a', 'b', 'c'], 'a')).toMatchObject({ prev: null, next: 'b' })
    expect(pagerOf(['a', 'b', 'c'], 'c')).toMatchObject({ prev: 'b', next: null })
  })
  it('has no neighbours when the open message is not in the list', () => {
    expect(pagerOf(['a'], 'z')).toEqual({ index: -1, total: 1, prev: null, next: null })
  })
})
