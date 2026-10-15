/** Browser speech recognition (Chrome, Edge, Android Chrome, iOS Safari). No audio leaves the browser through our servers. */
export type Recognition = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null; start: () => void; stop: () => void }
type RecognitionCtor = new () => Recognition

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Starts one recognition; returns the recognizer so the caller can stop it, or null when the browser has no speech support. */
export function listenOnce(onText: (text: string) => void, onEnd: () => void): Recognition | null {
  const Ctor = recognitionCtor()
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = navigator.language || 'en-US'
  r.interimResults = false
  r.onresult = (e) => onText(e.results[0]?.[0]?.transcript ?? '')
  r.onend = onEnd
  r.onerror = onEnd
  r.start()
  return r
}
