import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/cards'
import { Icon } from '../../components/icons'
import { useShell } from '../shell/ShellContext'
import { commandPath, describeCommand, parseCommand, type ParsedCommand } from './commandModel'

import { recognitionCtor, type Recognition } from './speech'
import { canRecord, recordAndTranscribe, whisperAvailable, type Recording } from '../voice/whisper'

/**
 * "Tell it what to do": type or speak a short instruction. It is read as a search (what, where, remote, repeat) and what you want
 * next (apply or send). You always see what will happen first; nothing is sent or applied by it.
 */
export function CommandBar() {
  const navigate = useNavigate()
  const { workspace } = useShell()
  const ws = workspace === 'sales' ? 'sales' : 'candidate'
  const [text, setText] = useState('')
  const [heard, setHeard] = useState(false)
  const [listening, setListening] = useState(false)
  const [plan, setPlan] = useState<ParsedCommand | null>(null)
  const [tried, setTried] = useState(false)
  const [micError, setMicError] = useState('')
  const recognizer = useRef<Recognition | null>(null)
  const [whisper, setWhisper] = useState(false)
  const recording = useRef<Recording | null>(null)
  useEffect(() => { if (canRecord()) void whisperAvailable().then(setWhisper) }, [])
  const canSpeak = (whisper && canRecord()) || recognitionCtor() !== null

  function understand() {
    const parsed = parseCommand(text, ws)
    setPlan(parsed); setTried(true)
  }

  function speak() {
    if (listening) { recognizer.current?.stop(); recording.current?.stop(); return }
    setMicError('')
    // Groq Whisper first: accurate and multilingual (Hindi, Hinglish…); the browser's own speech only without it.
    if (whisper && canRecord()) {
      setListening(true)
      void recordAndTranscribe((t) => { setText(t); setHeard(true); setPlan(null); setTried(false) }, setMicError, () => setListening(false))
        .then((r) => { recording.current = r })
      return
    }
    const Ctor = recognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.onresult = (e) => { setText(e.results[0]?.[0]?.transcript ?? ''); setHeard(true); setPlan(null); setTried(false) }
    r.onend = () => setListening(false)
    r.onerror = (e: { error?: string }) => {
      setListening(false)
      setMicError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is blocked. Allow it in the browser (the icon in the address bar), or type instead.'
        : e.error === 'no-speech' ? 'Nothing was heard. Tap Speak and talk, or type instead.' : 'Voice did not work here. Type instead.')
    }
    recognizer.current = r
    setListening(true); setMicError('')
    r.start()
  }

  const example = ws === 'sales' ? 'find companies hiring payroll engineers in London then send outreach' : 'find react developer jobs in Berlin and apply every day'
  return (
    <Card title="Tell it what to do" subtitle={`Type or say it, e.g. “${example}”. You confirm before anything runs.`} coach="command-bar">
      <form className="stack-3" onSubmit={(e) => { e.preventDefault(); understand() }} aria-label="Command">
        <div className="search-bar">
          <label className="search-field search-field-main"><span className="sr-only">What should it do?</span>
            <input value={text} onChange={(e) => { setText(e.target.value); setPlan(null); setTried(false) }} maxLength={300} placeholder={ws === 'sales' ? 'e.g. find companies hiring React developers in Berlin' : 'e.g. find .NET developer jobs in Pune'} /></label>
          {canSpeak && <button type="button" className={`btn btn-secondary${listening ? ' is-listening' : ''}`} aria-pressed={listening} onClick={speak}><Icon name="mic" size={16} /> {listening ? 'Listening… tap to stop' : 'Speak'}</button>}
          <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Go</button>
        </div>
        {micError && <p className="notice notice-warning" role="alert">{micError}</p>}
        {heard && <p className="muted-small" role="status">Heard: “{text}”. Fix it above if it is wrong, then press Go.</p>}
        {!canSpeak && <p className="muted-small">Voice needs Chrome, Edge or Safari. Typing works everywhere.</p>}
        {tried && !plan && <p className="notice notice-warning" role="alert">I need at least a role or skill to search for, e.g. “react developer in Berlin”.</p>}
        {plan && (
          <div className="notice notice-neutral stack-2" role="status">
            <p>{describeCommand(plan, ws)}</p>
            <div className="row wrap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(commandPath(plan, ws))}>Yes, run it</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlan(null)}>Change it</button>
            </div>
          </div>
        )}
      </form>
    </Card>
  )
}
