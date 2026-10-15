import { api } from '../../lib/api'

/** Voice through Groq Whisper (multilingual, Hindi and Hinglish included): record a short clip, the API transcribes it (key stays on the server). */
export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export async function whisperAvailable(): Promise<boolean> {
  try { return (await api<{ whisper: boolean }>('/api/v1/voice/status')).whisper } catch { return false }
}

export interface Recording { stop: () => void }

/** Starts recording; stops by itself after you finish talking (or at maxMs), then the server transcribes it with Whisper. */
export async function recordAndTranscribe(onText: (t: string) => void, onError: (m: string) => void, onEnd: () => void, maxMs = 15_000): Promise<Recording | null> {
  let stream: MediaStream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { onError('Microphone permission was refused.'); onEnd(); return null }
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop())
    try {
      const type = rec.mimeType || 'audio/webm'
      const form = new FormData()
      form.append('audio', new Blob(chunks, { type }), type.includes('ogg') ? 'voice.ogg' : type.includes('mp4') ? 'voice.mp4' : 'voice.webm')
      const r = await api<{ text: string }>('/api/v1/voice/transcribe', { method: 'POST', body: form })
      if (r.text) onText(r.text); else onError('Nothing was heard. Try again or type it.')
    } catch { onError('Could not transcribe. Type the command instead.') } finally { onEnd() }
  }
  rec.start()
  const finish = () => { window.clearTimeout(timer); stopSilence(); if (rec.state === 'recording') rec.stop() }
  const timer = window.setTimeout(finish, maxMs)
  const stopSilence = watchSilence(stream, finish)
  return { stop: finish }
}

/**
 * Hands-free stop: once speech has been heard, about 1.2 s of quiet ends the recording. Returns a cleanup function.
 * Without Web Audio it does nothing and the tap or the time limit stops the recording.
 */
function watchSilence(stream: MediaStream, onSilence: () => void, quietMs = 1200, level = 0.02): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return () => {}
  const ctx = new Ctx()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(analyser)
  const data = new Float32Array(analyser.fftSize)
  let spoke = false
  let quietSince = 0
  let frame = 0
  const tick = () => {
    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += v * v
    const loud = Math.sqrt(sum / data.length) > level
    const now = performance.now()
    if (loud) { spoke = true; quietSince = 0 } else if (spoke) {
      if (!quietSince) quietSince = now
      else if (now - quietSince > quietMs) { onSilence(); return }
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => { cancelAnimationFrame(frame); void ctx.close().catch(() => {}) }
}

let whisperCache: Promise<boolean> | null = null
/** One short listen with the best engine (Groq Whisper if the server has it, else the browser); used for a spoken yes/no. */
export async function hearOnce(onText: (t: string) => void, maxMs = 5_000): Promise<void> {
  whisperCache ??= canRecord() ? whisperAvailable() : Promise.resolve(false)
  if (await whisperCache) { await recordAndTranscribe(onText, () => {}, () => {}, maxMs); return }
  const { listenOnce } = await import('../command/speech')
  listenOnce(onText, () => {})
}
