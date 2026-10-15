/** What /api/v1/assistant answers: a spoken reply and at most one action the person confirms. */
export interface AssistantReply {
  reply: string
  action: AssistantAction | null
  source: string
  fallbackReason: string | null
}

export type AssistantActionKind = 'launch' | 'open' | 'review' | 'outreach' | 'apply' | 'schedule'
export type InterviewModeName = 'Video' | 'Phone' | 'Onsite'

/** One proposed action. `schedule` carries the interview plan: the deal or opportunity it belongs to and the time (ISO, local). */
export interface AssistantAction {
  kind: AssistantActionKind
  label: string
  query: string | null
  location: string | null
  page: string | null
  days?: number | null
  campaignId?: string | null
  /** schedule: the company, deal or job name the person said. */
  target?: string | null
  /** schedule: the deal (Sales) or opportunity (Candidate) id the server matched. */
  targetId?: string | null
  targetType?: 'deal' | 'opportunity' | null
  round?: number | null
  /** schedule: local date-time without a zone, e.g. 2026-10-17T15:00:00. */
  when?: string | null
  mode?: InterviewModeName | null
  minutes?: number | null
}

/** "yes", "yeah, do it", "ok run it" confirm; anything else does not. */
export function isYes(heard: string): boolean {
  return /^\s*(yes|yeah|yep|ok|okay|sure|do it|run it|go ahead|haan|ha)\b/i.test(heard)
}

let playing: HTMLAudioElement | null = null

/** Stops whatever the assistant is saying (natural voice or browser voice). */
export function stopSpeaking(): void {
  speakToken += 1
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
  const parts = sentences(text)
  const token = (speakToken += 1)
  const next = (k: number): void => {
    if (token !== speakToken) return
    if (k >= parts.length) { done?.(); return }
    void import('../../lib/api').then(({ apiBlob }) => apiBlob('/api/v1/voice/speak', { method: 'POST', body: JSON.stringify({ text: parts[k] }) }))
      .then((blob) => new Promise<void>((resolve, reject) => {
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        playing = audio
        audio.onended = () => { URL.revokeObjectURL(url); resolve() }
        audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio')) }
        audio.play().catch(reject)
      }))
      .then(() => next(k + 1))
      // The natural voice is unavailable: say the rest with the browser's best voice.
      .catch(() => { if (token === speakToken) browserSpeak(parts.slice(k).join(' '), done) })
  }
  next(0)
}
let speakToken = 0

/** Splits a reply into sentences of at most 200 characters (the natural voice's limit per request). */
export function sentences(text: string, max = 200): string[] {
  const out: string[] = []
  for (const raw of text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]) {
    let s = raw.trim()
    while (s.length > max) { const cut = s.lastIndexOf(' ', max); const at = cut > 40 ? cut : max; out.push(s.slice(0, at).trim()); s = s.slice(at).trim() }
    if (s) out.push(s)
  }
  return out
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
