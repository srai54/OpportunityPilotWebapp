import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNo, isYes, stopVoice } from './assistantModel'
import { sendableFromFlow } from './voiceFlow'

describe('S5: yes/no must be the whole answer', () => {
  const yes = ['yes', 'Yes!', 'yeah do it', 'go ahead', 'sure', 'do it', 'confirm', 'haan', 'हाँ', 'हां।', 'जी', 'जी हाँ', 'ठीक है']
  const notYes = ['ok', 'okay', 'ha', 'yes but search Pune instead', 'yesterday', 'no', 'not now', 'what is my status', '']
  it.each(yes)('accepts %s', (t) => expect(isYes(t)).toBe(true))
  it.each(notYes)('does not take %s as a yes', (t) => expect(isYes(t)).toBe(false))
  it.each(['no', 'not now', 'cancel', 'nahi', 'नहीं', 'मत करो'])('hears %s as a no', (t) => expect(isNo(t)).toBe(true))
})

describe('S1: voice sends only what this flow wrote, for the target campaign', () => {
  const d = (id: string, campaignId: string, over: Partial<{ state: string; recipient: string | null; channel: string }> = {}) =>
    ({ id, campaignId, channel: 'Email', state: 'Draft', recipient: `${id}@acme.test`, ...over })
  it('leaves drafts from other campaigns and older drafts untouched', () => {
    const drafts = [d('a', 'c1'), d('b', 'c1'), d('old', 'c1'), d('other', 'c2'), d('sent', 'c1', { state: 'Sent' }), d('noaddr', 'c1', { recipient: null })]
    const { toSend, withAddress } = sendableFromFlow(drafts, ['c1'], new Set(['a', 'b', 'other', 'sent', 'noaddr']))
    expect(toSend.map((x) => x.id)).toEqual(['a', 'b', 'noaddr'])
    expect(withAddress.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('S4: closing while recording sends nothing', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('drops the clip and makes no request after Stop', async () => {
    const api = await import('../../lib/api')
    const call = vi.spyOn(api, 'api').mockResolvedValue({ text: 'find java jobs' } as never)
    let onstop: (() => void) | null = null
    class FakeRecorder { mimeType = 'audio/webm'; state = 'inactive'; ondataavailable: ((e: { data: Blob }) => void) | null = null
      set onstop(f: () => void) { onstop = f } start() { this.state = 'recording' } stop() { this.state = 'inactive'; onstop?.() } }
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } })
    const { recordAndTranscribe } = await import('./whisper')
    const heard = vi.fn()
    const rec = await recordAndTranscribe(heard, () => {}, () => {}, 60_000)
    stopVoice()            // the person presses Stop / closes the window…
    rec?.stop()            // …which ends the recording
    await new Promise((r) => setTimeout(r, 10))
    expect(call).not.toHaveBeenCalled()
    expect(heard).not.toHaveBeenCalled()
  })
})
