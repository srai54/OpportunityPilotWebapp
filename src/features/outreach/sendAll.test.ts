import { describe, expect, it } from 'vitest'
import type { DraftListItem } from '../../lib/types'
import { sendAllCandidates, summarizeBatchSend } from './sendAll'

const d = (id: string, over: Partial<DraftListItem> = {}): DraftListItem => ({
  id, opportunityId: 'o' + id, campaignId: 'c', campaignName: 'C', opportunityTitle: 'T', organization: 'Org ' + id, channel: 'Email',
  recipient: `${id}@x.test`, recipientVerified: false, recipientSource: 'UserEntered', recipientEvidenceId: null, state: 'Approved', version: 1, updatedAt: '2026-10-13T00:00:00Z', ...over,
})

describe('sendAllCandidates', () => {
  it('includes only approved emails that have a recipient, and counts the ones still waiting for approval', () => {
    const items = [d('a'), d('b', { state: 'Draft' }), d('c', { state: 'Sent' }), d('d', { channel: 'LinkedInMessage' }), d('e', { recipient: null }), d('f', { recipient: '  ' }), d('g')]
    const { ready, needApproval } = sendAllCandidates(items)
    expect(ready.map((x) => x.id)).toEqual(['a', 'g'])
    expect(needApproval).toBe(1)
  })
  it('is empty when nothing is approved', () => {
    expect(sendAllCandidates([d('a', { state: 'Draft' })])).toEqual({ ready: [], needApproval: 1 })
  })
})

describe('summarizeBatchSend', () => {
  const items = [d('a'), d('b'), d('c')]
  it('says plainly when everything went', () => {
    const s = summarizeBatchSend([{ id: 'a', outcome: 'Sent', reason: null }, { id: 'b', outcome: 'Sent', reason: null }], items)
    expect(s.headline).toBe('2 messages sent')
    expect(s.failed).toBe(0)
  })
  it('names what was sent, what failed and what was left alone', () => {
    const s = summarizeBatchSend([
      { id: 'a', outcome: 'Sent', reason: null },
      { id: 'b', outcome: 'Failed', reason: 'The mail provider did not accept the message.' },
      { id: 'c', outcome: 'NotAttempted', reason: 'An earlier message failed.' },
    ], items)
    expect(s.headline).toBe('1 sent, then stopped: 1 failed, 1 not attempted')
    expect(s.lines.map((l) => `${l.recipient}:${l.outcome}`)).toEqual(['a@x.test:sent', 'b@x.test:not sent', 'c@x.test:not attempted'])
    expect(s.lines[1].reason).toContain('did not accept')
  })
  it('uses singular wording for one message', () => {
    expect(summarizeBatchSend([{ id: 'a', outcome: 'Sent', reason: null }], items).headline).toBe('1 message sent')
  })
})
