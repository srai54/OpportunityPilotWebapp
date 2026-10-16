import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { isYes, speak, stopVoice, voiceEpoch } from './assistantModel'
import { resetFlow, setFlow, useFlow } from './voiceFlow'
import { hearOnce } from './whisper'

/**
 * The voice pill: a small island at the top of the screen that shows what a voice command is doing — a waveform while listening, dots
 * while thinking, a progress bar while a campaign runs, and the result. Tap it for the steps and the yes/no of a confirm step.
 * It stays across screens until it is dismissed.
 */
export function VoicePill() {
  const flow = useFlow()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // A confirm step is asked aloud and a spoken "yes" answers it; the buttons work the same.
  const asking = flow.phase === 'confirm' ? `${flow.title}. ${flow.detail ?? ''}` : ''
  useEffect(() => {
    if (!asking) return
    let live = true
    const started = voiceEpoch()
    speak(asking, () => {
      if (!live || voiceEpoch() !== started) return
      // Sending (email) needs a tap: the question is spoken, but a spoken yes is not listened for.
      if (flow.confirm?.tapOnly) return
      setTimeout(() => { if (live && voiceEpoch() === started) void hearOnce((t) => { if (live && voiceEpoch() === started && isYes(t)) void yes() }) }, 600)
    })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking])
  if (flow.phase === 'idle') return null
  const expanded = open || flow.phase === 'confirm' || flow.phase === 'error' || (flow.phase === 'done' && !!flow.confirm)

  async function yes() {
    if (!flow.confirm) return
    setBusy(true)
    try { await flow.confirm.run() } catch (e) { setFlow({ phase: 'error', title: 'That did not work', detail: (e as Error).message, steps: [] }) } finally { setBusy(false) }
  }
  function go(to: string) { setOpen(false); resetFlow(); navigate(to) }

  return (
    <div className={`vpill is-${flow.phase}${expanded ? ' is-open' : ''}`} role="status" aria-live="polite" data-testid="voice-pill">
      <button type="button" className="vpill-bar" aria-expanded={expanded} onClick={() => setOpen(!open)}>
        <span className="vpill-icon" aria-hidden="true">
          {flow.phase === 'listening' ? <span className="vpill-wave"><i /><i /><i /><i /><i /></span>
            : flow.phase === 'thinking' ? <span className="vpill-dots"><i /><i /><i /></span>
              : flow.phase === 'done' ? <Icon name="check" size={16} />
                : flow.phase === 'error' ? <Icon name="alert" size={16} />
                  : flow.phase === 'confirm' ? <Icon name="help" size={16} /> : <span className="vpill-spin" />}
        </span>
        <span className="vpill-title">{flow.title || (flow.phase === 'listening' ? 'Listening…' : 'Thinking…')}</span>
        {flow.phase === 'running' && flow.progress != null && <span className="vpill-pct op-numeric">{flow.progress}%</span>}
      </button>
      {flow.phase === 'running' && <span className="vpill-progress" aria-hidden="true"><i style={{ width: `${flow.progress ?? 10}%` }} /></span>}
      {expanded && (
        <div className="vpill-body">
          {flow.detail && <p className="vpill-detail">{flow.detail}</p>}
          {flow.steps.length > 0 && <ol className="vpill-steps">{flow.steps.map((s) => <li key={s.label} className={`is-${s.state}`}><span aria-hidden="true" />{s.label}</li>)}</ol>}
          <div className="vpill-actions">
            {flow.confirm && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void yes()}>{busy ? 'Working…' : flow.confirm.yes}</button>}
            {flow.link && <button type="button" className={`btn btn-sm ${flow.confirm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => go(flow.link!.to)}>{flow.link.label}</button>}
            {flow.phase === 'done' && flow.next?.map((n) => <button key={n.label} type="button" className="btn btn-secondary btn-sm" onClick={() => { if (n.run) void n.run(); else if (n.to) go(n.to) }}>{n.label}</button>)}
            {(flow.phase === 'done' || flow.phase === 'error') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('op-open-assistant', { detail: 'What should I do next?' })) }}>What next?</button>}
            {flow.phase !== 'running' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { stopVoice(); setOpen(false); resetFlow() }}>{flow.confirm ? 'Not now' : 'Close'}</button>}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => stopVoice()} aria-label="Stop talking and listening">Stop voice</button>
          </div>
        </div>
      )}
    </div>
  )
}
