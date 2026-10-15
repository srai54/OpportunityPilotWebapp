import { api } from '../../lib/api'

/** Whisper fallback for browsers without speech recognition: record a short clip, the API transcribes it (key stays on the server). */
export function canRecord(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export async function whisperAvailable(): Promise<boolean> {
  try { return (await api<{ whisper: boolean }>('/api/v1/voice/status')).whisper } catch { return false }
}

export interface Recording { stop: () => void }

/** Starts recording; calls onText with the transcript (or onError) after stop() or 15 seconds. */
export async function recordAndTranscribe(onText: (t: string) => void, onError: (m: string) => void, onEnd: () => void): Promise<Recording | null> {
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
  const timer = window.setTimeout(() => { if (rec.state === 'recording') rec.stop() }, 15_000)
  return { stop: () => { window.clearTimeout(timer); if (rec.state === 'recording') rec.stop() } }
}
