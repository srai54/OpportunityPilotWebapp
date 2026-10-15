/** What /api/v1/assistant answers: a spoken reply and at most one action the person confirms. */
export interface AssistantReply {
  reply: string
  action: { kind: 'launch' | 'open'; label: string; query: string | null; location: string | null; page: string | null } | null
  source: string
  fallbackReason: string | null
}

/** "yes", "yeah, do it", "ok run it" confirm; anything else does not. */
export function isYes(heard: string): boolean {
  return /^\s*(yes|yeah|yep|ok|okay|sure|do it|run it|go ahead|haan|ha)\b/i.test(heard)
}

/** Reads the reply aloud with the browser's own voice (free, on-device); calls done when finished or when speech is unavailable. */
export function speak(text: string, done?: () => void): void {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { done?.(); return }
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = speechLang(text, navigator.language || 'en-US')
  u.onend = () => done?.()
  u.onerror = () => done?.()
  synth.speak(u)
}

/** Hindi script is read with a Hindi voice; anything else with the browser's language. */
export function speechLang(text: string, fallback: string): string {
  return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : fallback
}
