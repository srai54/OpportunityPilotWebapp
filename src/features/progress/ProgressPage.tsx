import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { ProgressBar } from '../../components/ProgressBar'
import { ApiError } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { stagePercent, type ProgressView } from './progressModel'

const when = (iso: string, zone?: string | null) => {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(zone ? { timeZone: zone } : {}) }) } catch { return new Date(iso).toLocaleString() }
}

/**
 * The candidate's private page (/progress/<link>). No sign-in. It shows only what the sales team chose to share, and nothing about
 * pay, rates or internal notes.
 */
export function ProgressPage({ token }: Readonly<{ token: string }>) {
  const view = useApi<ProgressView>(`/api/v1/public/progress/${encodeURIComponent(token)}`)
  const gone = view.error instanceof ApiError && view.error.status === 404
  return (
    <main className="signin" id="main">
      <div className="page stack-4" style={{ maxWidth: 640, width: '100%' }}>
        <header className="stack-2">
          <h1 className="page-title">{view.data ? `Hi ${view.data.firstName}, here is where things stand` : 'Your progress'}</h1>
          {view.data && <p className="muted-small">Updated {when(view.data.asOf)}. Reload the page to see the latest.</p>}
        </header>
        {view.loading && !view.data && <LoadingState label="Loading your progress…" waking={view.waking} rows={2} />}
        {gone && <Card tone="muted" title="This link is not active"><p>It may have been replaced or switched off. Ask the person who sent it for a new one.</p></Card>}
        {view.error && !gone && <ErrorNotice error={view.error} onRetry={view.reload} what="your progress" />}
        {view.data && view.data.items.length === 0 && <Card tone="muted"><p>Nothing to show yet. When your profile is sent to a client, it appears here.</p></Card>}
        {view.data?.items.map((item, i) => (
          <Card key={`${item.stage}-${i}`} title={item.role ?? 'Your application'} subtitle={item.client ?? undefined} actions={<Badge tone="primary">{item.stage}</Badge>}>
            <div className="stack-2">
              <ProgressBar pct={stagePercent(item.stage)} label={`Progress: ${item.stage}`} tone={item.stage.includes('accepted') ? 'success' : 'primary'} size="sm" />
              <p className="muted-small">Last change {when(item.updatedAt)}</p>
              {item.interview && (
                <p><strong>Round {item.interview.round}:</strong> {when(item.interview.scheduledAt, item.interview.timeZone)}
                  {item.interview.minutes ? ` · ${item.interview.minutes} min` : ''}{item.interview.mode ? ` · ${item.interview.mode}` : ''}
                  {item.interview.location ? <> · {/^https?:\/\//.test(item.interview.location) ? <a href={item.interview.location} target="_blank" rel="noopener noreferrer">Join<span className="sr-only"> (opens in a new tab)</span></a> : item.interview.location}</> : null}
                  {item.interview.notes ? <><br /><span className="muted-small">{item.interview.notes}</span></> : null}</p>
              )}
            </div>
          </Card>
        ))}
        <p className="muted-small">This page shows only what was chosen to share with you.</p>
      </div>
    </main>
  )
}
