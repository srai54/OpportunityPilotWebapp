import { Card } from '../../components/cards'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { SampleRunCard } from '../overview/SampleRunCard'
import { useShell } from '../shell/ShellContext'
import { GUIDE_LIMITS, PIPELINE_STEPS, SOURCE_CHECKS } from './guideModel'

/**
 * /how-it-works (TASKS.md T3): the whole pipeline in one page — what each step does, where to see it in the app,
 * and how to check that each source really worked. Static text about what is built; no figures are shown.
 */
export function HowItWorksPage() {
  const { workspace } = useShell()
  return (
    <div className="page page-wide stack-4">
      <PageHeader
        title="How it works"
        subtitle="One pipeline for both workspaces: it reads the sources you choose, scores what it finds against your criteria, and shows why. You decide what happens next."
      />

      <section className="panel" aria-labelledby="guide-pipeline">
        <header className="panel-head">
          <h3 id="guide-pipeline" className="eyebrow">
            The pipeline, step by step
          </h3>
        </header>
        <ol className="guide-steps plain-list">
          {PIPELINE_STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-num">{i + 1}</span>
              <div className="guide-step-body">
                <strong>{s.title}</strong>
                <span className="muted-small">{s.what}</span>
              </div>
              <div className="guide-step-where">
                <span className="eyebrow">Where you see it</span>
                {s.link ? <Link to={s.link.to}>{s.link.label}</Link> : <span className="muted-small">{s.where}</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="guide-sources">
        <header className="panel-head">
          <h3 id="guide-sources" className="eyebrow">
            How to check each source worked
          </h3>
          <div className="grow" />
          <span className="muted-small">Open a research run and read its event log — every source writes one line.</span>
        </header>
        <div className="table-scroll" role="region" aria-label="Sources table, scrollable" tabIndex={0}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">What you add</th>
                <th scope="col">What the event log says when it worked</th>
                <th scope="col">Needs</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_CHECKS.map((s) => (
                <tr key={s.source}>
                  <th scope="row" className="table-rowhead">
                    {s.source}
                  </th>
                  <td className="muted-small">{s.add}</td>
                  <td>
                    <code className="guide-log">{s.log}</code>
                  </td>
                  <td>
                    <span className={`badge ${s.needs === 'Nothing' ? 'badge-success' : 'badge-warning'}`}>{s.needs}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted-small panel-note">
          A source that fails or is not configured is a <strong>gap, not a failure</strong>: the run finishes as “Completed with
          gaps” and the event log says which source and why.
        </p>
      </section>

      <div className="panel-grid-2">
        <section className="panel" aria-labelledby="guide-limits">
          <header className="panel-head">
            <h3 id="guide-limits" className="eyebrow">
              What it does not do
            </h3>
          </header>
          <ul className="state-list panel-body">
            {GUIDE_LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        {workspace === 'candidate' ? (
          <SampleRunCard />
        ) : (
          <Card title="Try it">
<div className="stack-3">
              <p className="muted-small">
                For Sales, build a Customer, Partner, Investor or Freelance campaign from a CSV, a pasted list or a job board
                search, queue a run, shortlist with the evidence, then draft, approve and send outreach yourself. Staffing deals
                (candidates, submissions, interviews, offers) live under Staffing.
              </p>
              <Link className="btn btn-primary btn-sm cap-action" to="/campaigns/new">
                Build a Customers campaign
              </Link>
            </div>
</Card>
        )}
      </div>
    </div>
  )
}
