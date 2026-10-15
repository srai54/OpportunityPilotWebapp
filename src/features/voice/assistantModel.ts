/** What /api/v1/assistant answers: a spoken reply and at most one action the person confirms. */
export interface AssistantReply {
  reply: string
  action: { kind: 'launch' | 'open' | 'review' | 'outreach' | 'apply'; label: string; query: string | null; location: string | null; page: string | null; days?: number | null } | null
  source: string
  fallbackReason: string | null
}

/** "yes", "yeah, do it", "ok run it" confirm; anything else does not. */
export function isYes(heard: string): boolean {
  return /^\s*(yes|yeah|yep|ok|okay|sure|do it|run it|go ahead|haan|ha)\b/i.test(heard)
}

let playing: HTMLAudioElement | null = null

/** Stops whatever the assistant is saying (natural voice or browser voice). */
export function stopSpeaking(): void {
  playing?.pause(); playing = null
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

/**
 * Reads the reply aloud in a human-sounding voice: Groq's natural voice from the server for English; for Hindi, or when the server
 * voice is unavailable, the most natural voice the browser has (Edge "Natural"/"Online" voices first). Calls done when finished.
 */
export function speak(text: string, done?: () => void): void {
  stopSpeaking()
  if (speechLang(text, 'en') === 'hi-IN') { browserSpeak(text, done); return }
  void import('../../lib/api').then(({ apiBlob }) => apiBlob('/api/v1/voice/speak', { method: 'POST', body: JSON.stringify({ text }) }))
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      playing = audio
      const finish = () => { URL.revokeObjectURL(url); if (playing === audio) playing = null; done?.() }
      audio.onended = finish
      audio.onerror = finish
      return audio.play()
    })
    .catch(() => browserSpeak(text, done))
}

function browserSpeak(text: string, done?: () => void): void {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { done?.(); return }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = speechLang(text, navigator.language || 'en-IN')
  const voice = bestVoice(synth.getVoices(), u.lang)
  if (voice) u.voice = voice
  u.rate = 1.02
  u.onend = () => done?.()
  u.onerror = () => done?.()
  synth.speak(u)
}

/** The most natural-sounding installed voice for a language: neural ("Natural", "Online", "Neural") beats the default robotic one. */
export function bestVoice(voices: readonly Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>[], lang: string): SpeechSynthesisVoice | undefined {
  const base = lang.slice(0, 2).toLowerCase()
  const score = (v: Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>) => {
    const name = v.name.toLowerCase()
    let s = 0
    if (v.lang.toLowerCase() === lang.toLowerCase()) s += 4
    else if (v.lang.toLowerCase().startsWith(base)) s += 2
    else return -1
    if (/natural|neural|online/.test(name)) s += 6
    if (/google/.test(name)) s += 3
    if (!v.localService) s += 1
    return s
  }
  const ranked = voices.map((v) => ({ v, s: score(v) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)
  return ranked[0]?.v as SpeechSynthesisVoice | undefined
}

/** Hindi script is read with a Hindi voice; anything else with the browser's language. */
export function speechLang(text: string, fallback: string): string {
  return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : fallback
}
