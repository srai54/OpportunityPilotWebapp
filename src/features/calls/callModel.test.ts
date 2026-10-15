import { describe, expect, it } from 'vitest'
import {
  agoLabel, callNote, clearPendingCall, followUpAt, followUpNote, PENDING_CALL_KEY, readPendingCall, savePendingCall, saveTarget, shouldAskAboutCall,
  type PendingCall,
} from './callModel'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } }
}
const call: PendingCall = { who: 'Priya Sharma', phone: '+919876543210', entityType: 'candidate', entityId: 'c1', at: '2026-10-15T10:00:00.000Z', dealId: 'd1' }

describe('pending call storage', () => {
  it('saves, reads and clears', () => {
    const s = memory()
    savePendingCall(call, s)
    expect(readPendingCall(s)).toEqual(call)
    clearPendingCall(s)
    expect(readPendingCall(s)).toBeNull()
  })
  it('ignores broken values', () => {
    const s = memory()
    s.setItem(PENDING_CALL_KEY, '{bad json')
    expect(readPendingCall(s)).toBeNull()
    s.setItem(PENDING_CALL_KEY, JSON.stringify({ who: 'x' }))
    expect(readPendingCall(s)).toBeNull()
  })
  it('works without storage', () => {
    expect(readPendingCall(null)).toBeNull()
    expect(() => savePendingCall(call, null)).not.toThrow()
  })
})

describe('shouldAskAboutCall', () => {
  it('asks a few minutes after the tap', () => expect(shouldAskAboutCall(call, new Date('2026-10-15T10:05:00Z'))).toBe(true))
  it('does not ask straight away (mis-tap) or hours later', () => {
    expect(shouldAskAboutCall(call, new Date('2026-10-15T10:00:00.500Z'))).toBe(false)
    expect(shouldAskAboutCall(call, new Date('2026-10-15T14:00:00Z'))).toBe(false)
    expect(shouldAskAboutCall(null)).toBe(false)
  })
})

describe('callNote', () => {
  it('joins who, outcome and note', () => expect(callNote('Priya', 'NoAnswer', ' Try at 5 ')).toBe('Call with Priya · No answer · Try at 5'))
  it('leaves out an empty note', () => expect(callNote('Priya', 'Talked', '')).toBe('Call with Priya · Talked'))
  it('trims to the limit', () => {
    const text = callNote('Priya', 'Talked', 'x'.repeat(600))
    expect(text.length).toBe(500)
    expect(text.endsWith('…')).toBe(true)
  })
})

describe('follow-up', () => {
  it('is two days later at 10:00 local', () => {
    const at = followUpAt(new Date(2026, 9, 15, 18, 30))
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([17, 10, 0])
  })
  it('words a call-again for no answer', () => {
    expect(followUpNote('Priya', 'NoAnswer', '+919876543210')).toBe('Call Priya again (+919876543210)')
    expect(followUpNote('Priya', 'Talked', '')).toBe('Follow up with Priya')
  })
})

describe('agoLabel and saveTarget', () => {
  it('words the time since the tap', () => {
    const now = new Date('2026-10-15T10:00:00Z')
    expect(agoLabel('2026-10-15T09:59:30Z', now)).toBe('Just now')
    expect(agoLabel('2026-10-15T09:45:00Z', now)).toBe('15 min ago')
    expect(agoLabel('2026-10-15T08:00:00Z', now)).toBe('2 h ago')
  })
  it('saves to the deal, else the job, else nowhere', () => {
    expect(saveTarget(call)).toBe('deal')
    expect(saveTarget({ ...call, dealId: null, opportunityId: 'o1' })).toBe('opportunity')
    expect(saveTarget({ ...call, dealId: null })).toBeNull()
  })
})
