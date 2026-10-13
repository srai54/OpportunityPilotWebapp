import { Link } from 'react-router-dom'
import { Card } from '../../components/cards'
import { PageHeader } from '../../components/PageHeader'
import { useShell } from '../shell/ShellContext'
import { ALWAYS_TRUE, FLOW_STEPS } from './guideModel'

/** /how-it-works: five short steps, each with a button to that screen. No history, no tables. */
export function HowItWorksPage() {
  const sales = useShell().workspace === 'sales'
  return (
    <div className="page page-wide stack-4">
      <PageHeader title="How it works" subtitle="Five steps. The bar at the top of the app shows where you are." />
      <ol className="hwf-cards plain-list" aria-label="The five steps">
        {FLOW_STEPS.map((s, i) => (
          <li key={s.title} className="ccard hwf-card">
            <span className="hwf-icon" aria-hidden="true">{s.icon}</span>
            <span className="hwf-num">Step {i + 1}</span>
            <h2 className="hwf-title">{s.title}</h2>
            <p className="muted">{sales ? s.sales : s.candidate}</p>
            <Link className="btn btn-secondary btn-sm" to={s.to}>{s.action}</Link>
          </li>
        ))}
      </ol>
      <Card tone="muted" title="Always true">
        <ul className="state-list">{ALWAYS_TRUE.map((l) => <li key={l}>{l}</li>)}</ul>
      </Card>
    </div>
  )
}
