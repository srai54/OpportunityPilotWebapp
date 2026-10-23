import { useState } from 'react'
import { Card } from '../../components/cards'
import { ErrorNotice } from '../../components/ErrorNotice'
import { LoadingState } from '../../components/States'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ROLE_LABEL, type AccessUser, type Role } from './accessModel'

const ROLES: Role[] = ['Candidate', 'Sales', 'Both']
const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso } }

/** One user's role picker. Saves at once; the user sees the change the next time the app loads. */
function UserRow({ row, onSaved }: Readonly<{ row: AccessUser; onSaved: (r: AccessUser) => void }>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Error>()
  const id = `role-${row.accountId}`
  async function set(role: Role) {
    setBusy(true); setError(undefined)
    try { onSaved(await api<AccessUser>(`/api/v1/admin/users/${row.accountId}/role`, { method: 'PUT', body: JSON.stringify({ role }) })) }
    catch (e) { setError(e as Error) } finally { setBusy(false) }
  }
  return (
    <li className="access-row">
      <div className="stack-1">
        <label htmlFor={id}><strong>{row.email ?? 'No email on the sign-in'}</strong></label>
        <span className="muted-small">Last seen {when(row.lastSeenAt)} · {row.roleChosen ? (row.roleSetByAdmin ? 'set by you' : 'chosen at sign-up') : 'not chosen yet (sees both)'}</span>
      </div>
      <select id={id} value={row.role} disabled={busy} onChange={(e) => void set(e.target.value as Role)}>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      {error && <ErrorNotice error={error} />}
    </li>
  )
}

/** Settings → Users & roles (admin only): every signed-in user with their role; Candidate, Sales or Both. */
export function UsersRolesCard() {
  const users = useApi<AccessUser[]>('/api/v1/admin/users')
  const [saved, setSaved] = useState<Record<string, AccessUser>>({})
  const rows = (users.data ?? []).map((u) => saved[u.accountId] ?? u)
  return (
    <Card title="Users & roles" subtitle="Who sees the Candidate view, the Sales view or both. Guests are not listed and always see both.">
      {users.loading && !users.data && <LoadingState label="Loading users…" rows={2} />}
      {users.error && <ErrorNotice error={users.error} onRetry={users.reload} what="the users" />}
      {users.data && rows.length === 0 && <p className="muted-small">Nobody has signed in yet.</p>}
      {rows.length > 0 && (
        <ul className="access-list">
          {rows.map((r) => <UserRow key={r.accountId} row={r} onSaved={(n) => setSaved((cur) => ({ ...cur, [n.accountId]: n }))} />)}
        </ul>
      )}
    </Card>
  )
}
