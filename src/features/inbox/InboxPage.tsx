import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Card, CardList } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, LoadingState } from '../../components/States'
import { Badge } from '../../components/StatusBadge'
import { api } from '../../lib/api'
import type { OutreachDraft } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { ReplyCheck } from '../mail/ReplyCheck'
import type { Mailbox } from '../mail/mailModel'
import { parseReply, replySubject, type Reply, type ReplyActivity } from './inboxModel'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Inbox: the replies to what you sent, newest first, from both workspaces. Replies are found in your connected email every 30 minutes
 * (only sender, subject and date are read). Answering writes a draft you check and send like any other message.
 */
export function InboxPage() {
  const candidate = useApi<ReplyActivity[]>('/api/v1/analytics/activity?workspace=Candidate&kinds=Replied&take=100')
  const sales = useApi<ReplyActivity[]>('/api/v1/analytics/activity?workspace=Sales&kinds=Replied&take=100')
  const mailboxes = useApi<Mailbox[]>('/api/v1/mailboxes')
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error>()
  const connected = mailboxes.data?.some((m) => m.provider === 'Smtp' && m.connected && m.status !== 'NeedsReconnect')
  const replies: Reply[] = [...(candidate.data ?? []), ...(sales.data ?? [])].map(parseReply).sort((a, b) => b.at.localeCompare(a.at))
  const loading = (candidate.loading && !candidate.data) || (sales.loading && !sales.data)
  const reload = () => { candidate.reload(); sales.reload() }

  /** A draft to the person who replied, in the same thread subject; it opens in Outreach to write, approve and send. */
  async function answer(r: Reply) {
    if (!r.opportunityId) return
    setBusy(r.at); setError(undefined)
    try {
      const made = await api<OutreachDraft>(`/api/v1/opportunities/${r.opportunityId}/drafts`, { method: 'POST', body: JSON.stringify({ channel: 'Email', recipient: r.from }) })
      await api<OutreachDraft>(`/api/v1/drafts/${made.id}`, { method: 'PUT', body: JSON.stringify({ recipient: r.from, subject: replySubject(r.subject), body: made.body, expectedVersion: made.version }) })
      navigate(`/outreach?draft=${made.id}`)
    } catch (e) { setError(e as Error); setBusy(null) }
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader title="Inbox" subtitle="Replies to what you sent, newest first. A reply moves the lead to Responded and stops its follow-ups." />
      {connected ? <Card tone="muted"><ReplyCheck onDone={reload} /></Card>
        : mailboxes.data && <Card tone="muted"><p>Replies are found in your own email. <Link to="/settings">Connect your email with an app password</Link> and they appear here every 30 minutes. Only the sender, subject and date are read.</p></Card>}
      {error && <ErrorNotice error={error} />}
      {(candidate.error || sales.error) && <ErrorNotice error={(candidate.error ?? sales.error)!} onRetry={reload} what="your replies" />}
      {loading && <LoadingState label="Loading replies…" rows={3} />}
      {!loading && replies.length === 0 && (
        <EmptyState title="No replies yet" actions={<Link className="btn btn-primary" to="/outreach">Go to Outreach</Link>}>
          <p>When someone answers a message you sent, it shows here and the lead moves to Responded.</p>
        </EmptyState>
      )}
      {replies.length > 0 && (
        <CardList label="Replies">
          {replies.map((r) => (
            <li key={`${r.at}-${r.opportunityId}`} className="ccard lead-card result-lite inbox-row">
              <span aria-hidden="true" />
              <Avatar name={r.organization || r.from || r.title} />
              <div className="lead-main">
                <h3 className="lead-title">{r.organization || r.title}</h3>
                <p className="lead-meta">{r.from ? <>From {r.from}</> : 'Noted by you'} · {when(r.receivedAt ?? r.at)}</p>
                <p className="inbox-subject">{r.subject ?? r.text}</p>
                <div className="lead-tags"><Badge tone="success">Replied</Badge><span className="lead-note">{r.title}</span></div>
              </div>
              <div className="lead-side">
                {r.from && r.opportunityId && <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void answer(r)}>{busy === r.at ? 'Writing…' : 'Write a reply'}</button>}
                {r.opportunityId && <Link className="btn btn-ghost btn-sm" to={`/opportunities/${r.opportunityId}`}>Open lead<span className="sr-only"> {r.organization}</span></Link>}
              </div>
            </li>
          ))}
        </CardList>
      )}
    </div>
  )
}
