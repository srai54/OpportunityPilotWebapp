import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { commandPath, describeCommand, parseCommand, type ParsedCommand } from '../command/commandModel'
import { listenOnce, recognitionCtor, type Recognition } from '../command/speech'
import type { Workspace } from '../shell/shellModel'
import { canRecord, recordAndTranscribe, whisperAvailable, type Recording } from './whisper'
import { api } from '../../lib/api'
import { isYes, speak, type AssistantReply } from './assistantModel'

/**
 * Voice assistant and launch from anywhere. What you say goes to the assistant, which answers aloud from your own numbers and may
 * propose one action (start a search, open a screen); say "yes" or tap to run it. Without the server it falls back to the local parser.
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
  const useWhisper = whisper && canRecord()
  const canVoice = useWhisper || canSpeak
  const [reply, setReply] = useState<AssistantReply | null>(null)
  const [thinking, setThinking] = useState(false)
  const [startWhenReady, setStartWhenReady] = useState(false)

  function understand(value: string) {
    setText(value); setReply(null)
    setThinking(true)
    void api<AssistantReply>('/api/v1/assistant', { method: 'POST', body: JSON.stringify({ text: value, workspace: ws === 'sales' ? 'Sales' : 'Candidate', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
      .then((r) => {
        setReply(r)
        const launch = r.action?.kind === 'launch' ? parseCommand([r.action.query, r.action.location ? `in ${r.action.location}` : ''].join(' ').trim(), ws) ?? parseCommand(value, ws) : null
        setPlan(launch); setTried(r.action?.kind === 'launch')
        speak(r.reply, () => { if (r.action && canSpeak) listenForYes(r, launch) })
      })
      .catch(() => { const parsed = parseCommand(value, ws); setPlan(parsed); setTried(true) })
      .finally(() => setThinking(false))
  }
  /** After the spoken answer, one short listen: "yes" runs the proposed action, anything else leaves it on screen. */
  function listenForYes(r: AssistantReply, launch: ParsedCommand | null) {
    listen((t) => { if (isYes(t)) run(r, launch) }, 5_000)
  }
  /** Groq Whisper first (accurate, multilingual); the browser's own speech only when the server has no Whisper key. */
  function listen(onText: (t: string) => void, maxMs = 15_000) {
    if (useWhisper) {
      setListening(true)
      void recordAndTranscribe(onText, (m) => setErr(m), () => setListening(false), maxMs).then((r) => { recording.current = r })
      return
    }
    const r = listenOnce(onText, () => setListening(false))
    if (r) { rec.current = r; setListening(true) }
  }
  function run(r: AssistantReply | null, launch: ParsedCommand | null) {
    if (launch) { close(); navigate(commandPath(launch, ws)); return }
    if (r?.action?.kind === 'open' && r.action.page) { close(); navigate(r.action.page) }
  }
  function start() {
    setPlan(null); setTried(false); setErr(null)
    if (listening) { rec.current?.stop(); recording.current?.stop(); return }
    if (canVoice) listen((t) => understand(t))
  }
  function openSheet() {
    setOpen(true); setText(''); setPlan(null); setTried(false); setErr(null); setReply(null)
    // Ask the server once whether Groq Whisper is on, then start listening with the best engine.
    void (canRecord() ? whisperAvailable() : Promise.resolve(false)).then((w) => { setWhisper(w); setStartWhenReady(true) })
  }
  function close() { rec.current?.stop(); recording.current?.stop(); window.speechSynthesis?.cancel(); setOpen(false); setListening(false) }

  // Starts listening after the Whisper check, so the engine choice uses the answer.
  useEffect(() => {
    if (!startWhenReady) return
    setStartWhenReady(false)
    if (canVoice) start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWhenReady])

  useEffect(() => {
    if (!open) return
    if (!canSpeak && !canRecord()) inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const example = ws === 'sales' ? '“What’s my status?” or “Find companies hiring React developers in London”' : '“What’s my status?” or “Find .NET jobs in Pune every day”'
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
              <h2 id="voice-title">{listening ? 'Listening…' : plan || reply ? 'Ready' : 'Ask or say what to do'}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={close}><span aria-hidden="true">✕</span></button>
            </div>
            <button type="button" className={`voice-orb${listening ? ' is-on' : ''}`} onClick={start} disabled={!canVoice} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak'}>
              <Icon name="mic" size={30} />
            </button>
            <p className="muted-small voice-hint">{canVoice ? (listening ? (useWhisper ? 'Listening (any language)… stops when you pause' : 'Listening…') : example) : 'Voice needs Chrome, Edge or Safari — type instead.'}</p>
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) understand(text) }} className="voice-form">
              <label className="sr-only" htmlFor="voice-text">Command</label>
              <input id="voice-text" ref={inputRef} value={text} maxLength={300} onChange={(e) => { setText(e.target.value); setPlan(null); setTried(false) }} placeholder="find react jobs in Berlin" />
              <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>Check</button>
            </form>
            {err && <p className="notice notice-warning" role="alert">{err}</p>}
            {thinking && <p className="muted-small" role="status">Thinking…</p>}
            {reply && <div className="voice-plan" role="status" aria-live="polite">
              <p>{reply.reply}</p>
              {reply.action?.kind === 'open' && <button type="button" className="btn btn-primary voice-run" onClick={() => run(reply, null)}>{reply.action.label || 'Open it'}</button>}
              {reply.action && <span className="muted-small">Say “yes” or tap.</span>}
            </div>}
            {tried && !plan && <p className="notice notice-warning" role="alert">Add a role or skill, e.g. “react developer in Berlin”.</p>}
            {plan && (
              <div className="voice-plan" role="status">
                <p>{describeCommand(plan, ws)}</p>
                <button type="button" className="btn btn-primary voice-run" data-testid="voice-run" onClick={() => run(reply, plan)}>Yes, run it</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
