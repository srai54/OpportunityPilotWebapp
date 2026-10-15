import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { commandPath, describeCommand, parseCommand, type ParsedCommand } from '../command/commandModel'
import { listenOnce, recognitionCtor, type Recognition } from '../command/speech'
import type { Workspace } from '../shell/shellModel'
import { canRecord, recordAndTranscribe, setVoiceLanguage, voiceLanguage, whisperAvailable, type Recording } from './whisper'
import { api } from '../../lib/api'
import { isEcho, isYes, speak, stopVoice, voiceEpoch, type AssistantReply } from './assistantModel'
import { addTurn, flowContext, getFlow, runAction, scheduleFlow, setFlow, useTurns } from './voiceFlow'
import { schedulePlan, scheduleQuestion } from './scheduleModel'

/**
 * Voice assistant and launch from anywhere. What you say goes to the assistant, which answers aloud from your own numbers and may
 * propose one action (start a search, open a screen); say "yes" or tap to run it. Without the server it falls back to the local parser.
 * While it listens, a green "Listening" pill shows at the top of the screen (tap it to stop), like a phone's live-call indicator.
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
  const [lang, setLang] = useState<'en' | 'hi'>(voiceLanguage)
  const [speaking, setSpeaking] = useState(false)
  const turns = useTurns()
  const scheduling = reply?.action?.kind === 'schedule' ? schedulePlan(reply.action, ws === 'sales') : null
  const chatEnd = useRef<HTMLDivElement>(null)
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }) }, [turns.length, thinking, plan])

  function understand(value: string) {
    const said = value.trim()
    if (!said) return
    // The mic picked up the assistant's own voice: ignore it instead of answering itself.
    if (isEcho(said)) return
    // A "yes" while an action is waiting confirms it; it is not a new question.
    if ((reply?.action || plan) && isYes(said)) { addTurn({ role: 'you', text: said }); run(reply, plan); return }
    if ((reply?.action || plan) && /^\s*(no|not now|cancel|stop|nahi)\b/i.test(said)) { addTurn({ role: 'you', text: said }); setReply(null); setPlan(null); addTurn({ role: 'assistant', text: 'Okay, not now.' }); speak('Okay, not now.'); return }
    const history = turns.slice(-8)
    addTurn({ role: 'you', text: said })
    setText(''); setReply(null); setPlan(null)
    setThinking(true)
    // The pill shows "thinking" only when nothing else is running; a running campaign keeps its progress.
    const idle = getFlow().phase === 'idle'
    if (idle) setFlow({ phase: 'thinking', title: `“${said.slice(0, 60)}”`, steps: [] })
    void api<AssistantReply>('/api/v1/assistant', { method: 'POST', body: JSON.stringify({
      text: said, workspace: ws === 'sales' ? 'Sales' : 'Candidate', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      history, context: flowContext(),
    }) })
      .then((r) => {
        setReply(r)
        addTurn({ role: 'assistant', text: r.reply })
        const launch = r.action?.kind === 'launch' ? parseCommand([r.action.query, r.action.location ? `in ${r.action.location}` : ''].join(' ').trim(), ws) ?? parseCommand(said, ws) : null
        setPlan(launch); setTried(r.action?.kind === 'launch')
        // It never re-listens on its own after a plain answer (that made it talk to itself). When an action waits, it listens
        // once, briefly, for "yes" or "no" — starting after its own voice has ended; anything else is ignored.
        const started = voiceEpoch()
        setSpeaking(true)
        speak(r.reply, () => {
          setSpeaking(false)
          if (!r.action || !canVoice || voiceEpoch() !== started) return
          setTimeout(() => {
            if (voiceEpoch() !== started) return
            listen((t) => {
              if (voiceEpoch() !== started || isEcho(t)) return
              if (isYes(t)) { addTurn({ role: 'you', text: t }); run(r, launch) }
              else if (/^\s*(no|not now|cancel|stop|nahi)\b/i.test(t)) { addTurn({ role: 'you', text: t }); setReply(null); setPlan(null) }
            }, 5_000)
          }, 600)
        })
      })
      .catch(() => { const parsed = parseCommand(said, ws); setPlan(parsed); setTried(true) })
      .finally(() => { setThinking(false); if (getFlow().phase === 'thinking') setFlow({ phase: 'idle', title: '', steps: [] }) })
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
    const action = r?.action
    // The sheet already showed the interview plan and the person said yes to it: save it without asking again.
    if (action?.kind === 'schedule') { close(); void scheduleFlow(action, ws === 'sales', true).catch((e: Error) => setFlow({ phase: 'error', title: 'Not scheduled', detail: e.message, steps: [] })); return }
    // Multi-step commands run in the voice pill, which shows each step and stays across screens.
    if (action && action.kind !== 'open') { close(); void runAction(launch && action.kind === 'launch' ? { ...action, query: launch.query, location: launch.location || action.location, days: action.days ?? launch.days ?? null } : action, ws === 'sales'); return }
    if (launch) { close(); navigate(commandPath(launch, ws)); return }
    if (action?.kind === 'open' && action.page) { close(); navigate(action.page) }
  }
  function start() {
    setPlan(null); setTried(false); setErr(null)
    if (listening) { rec.current?.stop(); recording.current?.stop(); return }
    if (canVoice) listen((t) => understand(t))
  }
  function openSheet() {
    setOpen(true); setText(''); setPlan(null); setTried(false); setErr(null)
    // Ask the server once whether Groq Whisper is on, then start listening with the best engine.
    void (canRecord() ? whisperAvailable() : Promise.resolve(false)).then((w) => { setWhisper(w); setStartWhenReady(true) })
  }
  /** Stop button: ends speaking and listening at once, and anything they would have started. */
  function stopAll() { stopVoice(); rec.current?.stop(); recording.current?.stop(); setListening(false); setSpeaking(false) }
  function close() { stopAll(); setOpen(false) }

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

  return (
    <>
      <button type="button" className="cmd-pill" data-testid="command-pill" aria-label="Start a campaign: type or say it" onClick={openSheet}>
        <span>{ws === 'sales' ? 'Find companies hiring… or say it' : 'Find jobs… or say it'}</span><i aria-hidden="true"><Icon name="mic" size={15} /></i>
      </button>
      <button type="button" className="voice-btn" data-testid="voice-launch" aria-label="Start a campaign by voice" title="Start a campaign by voice" onClick={openSheet}>
        <Icon name="mic" size={17} />
      </button>
      <button type="button" className="voice-fab" aria-label="Start a campaign by voice" onClick={openSheet}><Icon name="mic" size={22} /></button>
      {open && listening && (
        <button type="button" className="voice-island" data-testid="voice-island" aria-label="Listening. Stop listening" onClick={start}>
          <span className="voice-island-dot" aria-hidden="true" />
          <span className="voice-island-label">Listening</span>
          <span className="voice-island-wave" aria-hidden="true"><i /><i /><i /><i /></span>
        </button>
      )}
      {open && (
        <div className="voice-scrim" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div className="voice-sheet va" role="dialog" aria-modal="true" aria-labelledby="voice-title" data-testid="voice-sheet">
            <div className="va-head">
              <span className="va-badge" aria-hidden="true"><Icon name="sparkles" size={14} /></span>
              <h2 id="voice-title">{listening ? 'Listening…' : thinking ? 'Thinking…' : 'Your assistant'}</h2>
              <div className="va-lang" role="group" aria-label="Language you speak">
                {(['en', 'hi'] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); setVoiceLanguage(l) }}>{l === 'en' ? 'EN' : 'हिंदी'}</button>)}
              </div>
              <button type="button" className="va-close" aria-label="Close" onClick={close}><span aria-hidden="true">✕</span></button>
            </div>

            <div className="va-chat" aria-live="polite">
              {turns.length === 0 && !thinking && (
                <div className="va-hello">
                  <p className="va-hi">Ask anything, or tell me what to do.</p>
                  <div className="va-chips">
                    {(ws === 'sales'
                      ? ['What’s my status?', 'Find companies hiring React developers in Pune', 'Send the outreach', 'Show my interviews']
                      : ['What’s my status?', 'Find software engineer jobs in Gurugram from the past 3 days', 'Apply to the best matches', 'How many emails did I send today?']
                    ).map((c) => <button key={c} type="button" className="va-chip" onClick={() => understand(c)}>{c}</button>)}
                  </div>
                </div>
              )}
              {turns.map((t, i) => <div key={i} className={`va-msg ${t.role === 'you' ? 'is-you' : 'is-ai'}`}><span>{t.text}</span></div>)}
              {thinking && <div className="va-msg is-ai"><span className="va-typing" aria-label="Thinking"><i /><i /><i /></span></div>}
              {err && <div className="va-msg is-ai is-warn"><span>{err}</span></div>}
              {tried && !plan && !reply && <div className="va-msg is-ai is-warn"><span>Add a role or skill, e.g. “react developer in Berlin”.</span></div>}
              {(plan || (reply?.action && reply.action.kind !== 'launch')) && (
                <div className="va-action">
                  <p>{plan ? describeCommand(plan, ws) : scheduling ? scheduleQuestion(scheduling, new Date()) : reply?.action?.label}</p>
                  <div className="va-action-btns">
                    <button type="button" className="btn btn-primary voice-run" data-testid="voice-run" onClick={() => run(reply, plan)}>{plan ? 'Yes, run it' : scheduling ? 'Yes, schedule' : 'Yes, do it'}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => understand('not now')}>Not now</button>
                  </div>
                  <span className="va-say">or just say “yes”</span>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            <div className="va-dock">
              <button type="button" className={`va-orb${listening ? ' is-on' : ''}${thinking ? ' is-thinking' : ''}`} onClick={start} disabled={!canVoice} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak'}>
                <span className="va-ring" aria-hidden="true" /><span className="va-ring r2" aria-hidden="true" />
                <Icon name="mic" size={26} />
              </button>
              {(listening || speaking) && <button type="button" className="va-stop" onClick={stopAll}>■ Stop</button>}
              <p className="va-hint">{canVoice ? (listening ? (useWhisper ? 'Speak in any language — I stop when you pause' : 'Listening…') : 'Tap to talk') : 'Voice needs Chrome, Edge or Safari — type below.'}</p>
              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) understand(text) }} className="va-form">
                <label className="sr-only" htmlFor="voice-text">Message</label>
                <input id="voice-text" ref={inputRef} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Or type here…" />
                <button type="submit" className="va-send" disabled={!text.trim()} aria-label="Send"><Icon name="arrowUp" size={18} /></button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
