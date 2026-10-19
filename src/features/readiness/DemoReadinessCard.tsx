import { Card } from '../../components/cards'
import { useShell } from '../shell/ShellContext'
import { readinessChecks, readyCount, sourcesNeedingWork } from './readinessModel'

/** Settings → "Demo readiness": what works live right now, straight from the server's capabilities. */
export function DemoReadinessCard() {
  const { capabilities } = useShell()
  const checks = readinessChecks(capabilities)
  const todo = sourcesNeedingWork(capabilities)
  if (checks.length === 0) return null
  return (
    <Card title="Demo readiness" subtitle={`${readyCount(checks)} of ${checks.length} ready. Check this before a demo.`}>
      <ul className="readiness-list">
        {checks.map((c) => <li key={c.label} className={c.ok ? 'is-ok' : 'is-off'}>
          <span aria-hidden="true">{c.ok ? '✓' : '!'}</span> <strong>{c.label}</strong> <span className="sr-only">{c.ok ? 'ready' : 'needs attention'}:</span> {c.text}
        </li>)}
      </ul>
      {todo.length > 0 && <details className="muted-small"><summary>Sources not live ({todo.length})</summary>
        <ul>{todo.map((s) => <li key={s.key}><strong>{s.name}</strong>: {s.detail || s.status}</li>)}</ul></details>}
    </Card>
  )
}
