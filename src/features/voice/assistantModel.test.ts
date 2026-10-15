import { describe, expect, it } from 'vitest'
import { bestVoice, isYes, sentences, speechLang } from './assistantModel'

describe('isYes', () => {
  it('accepts a spoken confirmation and nothing else', () => {
    for (const t of ['yes', 'Yeah do it', 'ok run it', 'go ahead', 'haan']) expect(isYes(t)).toBe(true)
    for (const t of ['no', 'not yet', 'yesterday', 'cancel']) expect(isYes(t)).toBe(false)
  })
})

describe('speechLang', () => {
  it('reads Hindi script in Hindi and the rest in the browser language', () => {
    expect(speechLang('आज 3 ईमेल भेजे गए', 'en-IN')).toBe('hi-IN')
    expect(speechLang('aaj 3 mails bheje', 'en-IN')).toBe('en-IN')
  })
})

describe('bestVoice', () => {
  it('prefers a natural (neural) voice in the right language over the robotic default', () => {
    const voices = [
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true },
      { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN', localService: false },
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN', localService: false },
    ]
    expect(bestVoice(voices, 'en-IN')?.name).toContain('Neerja')
    expect(bestVoice(voices, 'hi-IN')?.name).toContain('Swara')
    expect(bestVoice(voices, 'fr-FR')).toBeUndefined()
  })
})

describe('sentences', () => {
  it('keeps each piece under the natural voice limit', () => {
    expect(sentences('You sent 3 emails today. Shall I start a search?')).toEqual(['You sent 3 emails today.', 'Shall I start a search?'])
    const long = 'word '.repeat(120).trim() + '.'
    expect(sentences(long).every((p) => p.length <= 200)).toBe(true)
  })
})

describe('isEcho', () => {
  it('spots the assistant hearing its own reply, not the person answering it', async () => {
    const { isEcho } = await import('./assistantModel')
    const said = 'Shall I launch a campaign for software engineer jobs posted in the last 3 days in Gurugram?'
    expect(isEcho('shall I launch a campaign for software engineer jobs in Gurugram', said)).toBe(true)
    expect(isEcho('yes', said)).toBe(false)
    expect(isEcho('no, search Pune instead', said)).toBe(false)
  })
})
