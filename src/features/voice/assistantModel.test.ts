import { describe, expect, it } from 'vitest'
import { isYes, speechLang } from './assistantModel'

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
