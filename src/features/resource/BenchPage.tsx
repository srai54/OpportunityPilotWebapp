import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, LoadingState } from '../../components/States'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { SampleDataButton } from '../sample/SampleDataButton'
import { useApi } from '../../lib/useApi'
import { groupBench, kindOf, when, type Bench, type GroupBy } from './journeyModel'

const initials = (name: string) => name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')

/**
 * Staffing → Bench (2026-10-26): every resource from the day they joined, grouped for a quick decision (status, main skill or salesperson):
 * certifications, resume strength against the bench, best fit and the next event. A card opens the resource's 360 view.
 */
export function BenchPage() {
  const bench = useApi<Bench>('/api/v1/staffing/bench')
  const [by, setBy] = useState<GroupBy>('status')
  const [q, setQ] = useState('')
  const rows = (bench.data?.rows ?? []).filter((r) => !q.trim() || `${r.name} ${r.headline ?? ''} ${r.certifications.join(' ')} ${r.salesperson ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const groups = groupBench(rows, by)
  const avg = bench.data?.averageStrength ?? null
  const all = bench.data?.rows ?? []
  const kpis = [
    ['All resources', all.length, 'from the day they joined'],
    ['Priority', all.filter((r) => r.priority).length, 'put forward first'],
    ['Interviewing', all.filter((r) => r.status === 'interviewing').length, 'interviews running'],
    ['Mapped', all.filter((r) => r.status === 'mapped').length, 'going to a project'],
    ['Average resume strength', avg ?? '—', avg === null ? 'no scored resumes yet' : 'from scored resumes'],
  ] as const
  return (
    <div className="page page-wide stack-4">
      <PageHeader title="Resources" subtitle="Every resource from the day they joined: what they are doing, what fits them, and what is next."
        actions={<div className="row wrap">
          <div className="jr-seg" role="group" aria-label="Group by">
            {(['status', 'skill', 'sales'] as const).map((g) => <button key={g} type="button" className="jr-seg-btn" aria-pressed={by === g} onClick={() => setBy(g)}>{g === 'status' ? 'Status' : g === 'skill' ? 'Skill' : 'Salesperson'}</button>)}
          </div>
          <label className="sr-only" htmlFor="bench-q">Search resources</label>
          <input id="bench-q" className="bench-search" value={q} placeholder="Search name, skill, certification" onChange={(e) => setQ(e.target.value)} />
        </div>} />
      {bench.loading && !bench.data && <LoadingState label="Loading resources…" rows={3} waking={bench.waking} />}
      {bench.error && <ErrorNotice error={bench.error} onRetry={bench.reload} what="resources" />}
      {bench.data && all.length === 0 && (
        <EmptyState title="No resources yet" actions={<SampleDataButton workspace="Sales" onLoaded={bench.reload} />}>Add candidates under Staffing → Candidates, or load labelled sample data.</EmptyState>
      )}
      {all.length > 0 && (
        <>
          <section className="bench-kpis" aria-label="Resources summary">
            {kpis.map(([label, value, sub]) => <div key={label} className="ccard ccard-default bench-kpi"><span className="muted-small">{label}</span><strong className="op-numeric">{value}</strong><span className="muted-small">{sub}</span></div>)}
          </section>
          <section className="bench-groups" aria-label="Resources">
            {groups.map((g) => (
              <div key={g.id} className="bench-group">
                <div className="row"><span className={`jr-dot jr-${g.tone}`} aria-hidden="true" /><h3 className="bench-group-title">{g.name}</h3><span className="grow" /><span className="muted-small op-numeric">{g.rows.length}</span></div>
                <p className="muted-small">{g.hint}</p>
                {g.rows.map((r) => (
                  <Link key={r.candidateId} to={`/staffing/candidates/${r.candidateId}`} className="bench-card">
                    <div className="row">
                      <span className="bench-avatar" aria-hidden="true">{initials(r.name)}</span>
                      <div className="stack-1 bench-who"><strong>{r.name}</strong><span className="muted-small">{r.headline ?? 'No headline'} · day {r.day}</span></div>
                      {r.priority && <span className="jr-chip jr-danger">Priority</span>}
                    </div>
                    {r.certifications.length > 0 && <div className="row wrap">{r.certifications.slice(0, 4).map((c) => <span key={c} className="jr-chip jr-teal">{c}</span>)}</div>}
                    <div className="bench-figs">
                      <div className="stack-1">
                        <span className="muted-small">Resume strength</span>
                        <span className="bench-bar" aria-hidden="true"><span style={{ width: `${r.resumeStrength ?? 0}%` }} className={avg !== null && (r.resumeStrength ?? 0) >= avg ? 'is-strong' : ''} /></span>
                        <span className="bench-fig">{r.resumeStrength ?? '—'}{r.resumeStrength !== null && avg !== null ? ` · ${r.resumeStrength - avg >= 0 ? '+' : ''}${r.resumeStrength - avg} vs average` : ''}</span>
                      </div>
                      <div className="stack-1">
                        <span className="muted-small">Best fit</span>
                        <span className="bench-fig">{r.bestFit ? `${r.bestFit.score}%` : '—'}</span>
                        <span className="muted-small bench-ellipsis">{r.bestFit?.role ?? 'No resume for a role yet'}</span>
                      </div>
                    </div>
                    <div className="bench-next">
                      <span>{r.next ? `${kindOf(r.next.kind).label}: ${r.next.title} · ${when(r.next.at)}` : 'Nothing booked'}</span>
                      <span className="grow" />
                      <span className="muted-small">{r.salesperson ?? 'No salesperson'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
