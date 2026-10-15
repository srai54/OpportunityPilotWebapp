import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { commandPath, describeCommand, parseCommand, type ParsedCommand } from '../command/commandModel'
import { listenOnce, recognitionCtor, type Recognition } from '../command/speech'
import type { Workspace } from '../shell/shellModel'
import { canRecord, recordAndTranscribe, whisperAvailable, type Recording } from './whisper'

/**
 * Voice launch from anywhere: a mic in the app bar (and a round button on phones). Say "find react jobs in Pune every day";
 * it shows what it understood and runs only after "Yes, run it". Typing works where the browser has no speech support.
 */
export function VoiceLaunch({ workspace }: Readonly<{ workspace: Workspace }>) {
  const navigate = useNavigate()
  const ws = workspace === 'sales' ? 'sales' : 'candidate'
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [plan, setPlan] = useState<ParsedCommand | null>(null)
  const [tried, setTried] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const canSpeak = recognitionCtor() !== null
  const inputRef = useRef<HTMLInputElement>(null)
  const [whisper, setWhisper] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const recording = useRef<Recording | null>(null)
  const canVoice = canSpeak || (whisper && canRecord())

  function understand(value: string) {
    setText(value)
    const parsed = parseCommand(value, ws)
    setPlan(parsed); setTried(true)
  }
  function start() {
    setPlan(null); setTried(false); setErr(null)
    if (listening) { rec.current?.stop(); recording.current?.stop(); return }
    if (canSpeak) {
      const r = listenOnce((t) => understand(t), () => setListening(false))
      if (r) { rec.current = r; setListening(true) }
      return
    }
    if (whisper && canRecord()) {
      setListening(true)
      void recordAndTranscribe((t) => understand(t), (m) => setErr(m), () => setListening(false)).then((r) => { recording.current = r })
    }
  }
  function openSheet() {
    setOpen(true); setText(''); setPlan(null); setTried(false); setErr(null)
    if (canSpeak) start()
    else if (canRecord()) void whisperAvailable().then(setWhisper)
  }
  function close() { rec.current?.stop(); recording.current?.stop(); setOpen(false); setListening(false) }

  useEffect(() => {
    if (!open) return
    if (!canSpeak) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const example = ws === 'sales' ? '“Find companies hiring React developers in London”' : '“Find .NET jobs in Pune every day”'
  return (
    <>
      <button type="button" className="cmd-pill" data-testid="command-pill" aria-label="Start a campaign: type or say it" onClick={openSheet}>
        <span>{ws === 'sales' ? 'Find companies hiring… or say it' : 'Find jobs… or say it'}</span><i aria-hidden="true"><Icon name="mic" size={15} /></i>
      </button>
      <button type="button" className="voice-btn" data-testid="voice-launch" aria-label="Start a campaign by voice" title="Start a campaign by voice" onClick={openSheet}>
        <Icon name="mic" size={17} />
      </button>
      <button type="button" className="voice-fab" aria-label="Start a campaign by voice" onClick={openSheet}><Icon name="mic" size={22} /></button>
      {open && (
        <div className="voice-scrim" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div className="voice-sheet" role="dialog" aria-modal="true" aria-labelledby="voice-title" data-testid="voice-sheet">
            <div className="voice-head">
              <h2 id="voice-title">{listening ? 'Listening…' : plan ? 'Ready' : 'Say it or type it'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close}><span aria-hidden="true">✕</span></button>
            </div>
            <button type="button" className={`voice-orb${listening ? ' is-on' : ''}`} onClick={start} disabled={!canVoice} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak'}>
              <Icon name="mic" size={30} />
            </button>
            <p className="muted-small voice-hint">{canVoice ? (listening && !canSpeak ? 'Recording… tap to stop' : example) : 'Voice needs Chrome, Edge or Safari — type instead.'}</p>
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) understand(text) }} className="voice-form">
              <label className="sr-only" htmlFor="voice-text">Command</label>
              <input id="voice-text" ref={inputRef} value={text} maxLength={300} onChange={(e) => { setText(e.target.value); setPlan(null); setTried(false) }} placeholder="find react jobs in Berlin" />
              <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>Check</button>
            </form>
            {err && <p className="notice notice-warning" role="alert">{err}</p>}
            {tried && !plan && <p className="notice notice-warning" role="alert">Add a role or skill, e.g. “react developer in Berlin”.</p>}
            {plan && (
              <div className="voice-plan" role="status">
                <p>{describeCommand(plan, ws)}</p>
                <button type="button" className="btn btn-primary voice-run" data-testid="voice-run" onClick={() => { close(); navigate(commandPath(plan, ws)) }}>Yes, run it</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
