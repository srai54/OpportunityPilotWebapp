import { describe, expect, it } from 'vitest'
import { BULK_MAX, parseQueue, queuePath, summarizeBulk, type BulkOutcome } from './bulkDraft'

const o = (kind: BulkOutcome['kind'], id: string | null): BulkOutcome => ({ opportunityId: 'x', draftId: id, kind })

describe('summarizeBulk', () => {
  it('counts created, reused and failed in one sentence and keeps the draft ids', () => {
    const s = summarizeBulk([o('created', 'a'), o('created', 'b'), o('existing', 'c'), o('failed', null)], 'leads')
    expect(s).toMatchObject({ created: 2, existing: 1, failed: 1, draftIds: ['a', 'b', 'c'] })
    expect(s.text).toBe('Drafted 2 messages · 1 already had one (reused) · 1 could not be drafted for the leads you selected.')
  })
  it('uses the singular and omits zero parts', () => {
    expect(summarizeBulk([o('created', 'a')], 'jobs').text).toBe('Drafted 1 message for the jobs you selected.')
  })
})

describe('queue path', () => {
  it('opens the first message and carries the whole list', () => {
    expect(queuePath(['aaaaaaaa-1', 'bbbbbbbb-2'])).toBe('/outreach?queue=aaaaaaaa-1,bbbbbbbb-2&draft=aaaaaaaa-1')
    expect(queuePath([])).toBe('/outreach')
  })
  it('reads ids back and ignores junk', () => {
    expect(parseQueue('aaaaaaaa-1, bbbbbbbb-2,,<script>')).toEqual(['aaaaaaaa-1', 'bbbbbbbb-2'])
    expect(parseQueue(null)).toEqual([])
  })
  it('limits one batch to a reviewable size', () => expect(BULK_MAX).toBe(25))
})
