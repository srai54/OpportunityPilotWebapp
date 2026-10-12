import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { ErrorNotice } from '../../components/ErrorNotice'
import { api } from '../../lib/api'
import { config } from '../../lib/config'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../auth/AuthContext'
import { useShell } from '../shell/ShellContext'
import { WORKSPACES, type Workspace } from '../shell/shellModel'
import { ThemeChoiceGroup } from '../shell/ThemeToggle'

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const AUTH_LABEL = { supabase: 'Email & password / Google', dev: 'Development sign-in (local only)', guest: 'Guest (demo mode)' }

/** Rules that are product guarantees, not preferences — shown so nobody looks for a switch. */
const FIXED_RULES = [
  ['Nothing is sent or applied without your approval', 'Approval binds one version. Editing anything clears it.'],
  ['No bulk send, no auto-apply', 'Approve-all affects a loaded batch; each job is still applied to individually.'],
  ['Unknown never counts as a pass', 'A fact no source supplies stays Unknown and scores zero.'],
  ['Generated text is labelled', 'AI or template text never shares styling with source evidence.'],
  ['Secrets are never shown', 'Agent keys appear once at creation. API keys live in server configuration.'],
]

/**
 * Design round 3 `Settings`: account and display on the left, fixed rules and deployment facts on the right.
 * Only preferences this build can really keep are editable (theme and default workspace, both per browser).
 */
export function SettingsPage() {
  const diagnostics = useApi<{ version: string; database: { pendingMigrations: number | null } }>('/api/v1/diagnostics')
  const { user, mode, signOut } = useAuth()
  const { capabilities, workspace, setWorkspace, advanced, setAdvanced, guide, setGuide } = useShell()
  const [accountError, setAccountError] = useState<Error>()
  const [accountBusy, setAccountBusy] = useState(false)

  async function exportData() {
    setAccountBusy(true); setAccountError(undefined)
    try {
      const data = await api<object>('/api/v1/account-data/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `opportunitypilot-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    } catch (e) { setAccountError(e as Error) } finally { setAccountBusy(false) }
  }

  async function deleteData() {
    if (!window.confirm('Permanently delete all OpportunityPilot data for this account? Export first if you may need it.')) return
    setAccountBusy(true); setAccountError(undefined)
    try { await api('/api/v1/account-data', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }); await signOut() }
    catch (e) { setAccountError(e as Error); setAccountBusy(false) }
  }

  return (
    <div className="page page-wide stack-4">
      <PageHeader title="Settings" subtitle="Your account, how things are shown, and the rules that cannot be switched off." />

      <div className="panel-grid-2">
        <div className="stack-4">
          <section className="panel" aria-labelledby="set-account">
            <header className="panel-head">
              <h3 id="set-account" className="eyebrow">
                Account
              </h3>
            </header>
            <dl className="settings-rows panel-body">
              <div>
                <dt>Signed in as</dt>
                <dd>
                  <strong>{user?.email}</strong>
                  {user?.guest && <div className="muted-small">Guest — your data is tied to this browser.</div>}
                </dd>
              </div>
              <div>
                <dt>Sign-in method</dt>
                <dd>
                  <span className="badge">{AUTH_LABEL[mode]}</span>
                  {mode === 'guest' && <div className="muted-small">Accounts appear once the Supabase sign-in keys are set.</div>}
                </dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="set-workspace">Workspace</label>
                  <div className="muted-small">What the rail and Overview show. You can switch any time from the rail.</div>
                </dt>
                <dd>
                  <select id="set-workspace" value={workspace} onChange={(e) => setWorkspace(e.target.value as Workspace)}>
                    {(Object.keys(WORKSPACES) as Workspace[]).map((w) => (
                      <option key={w} value={w}>
                        {WORKSPACES[w].label} — {WORKSPACES[w].status.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div>
                <dt>Time zone</dt>
                <dd>
                  {timeZone} <span className="muted-small">· from this browser; every date is shown in it</span>
                </dd>
              </div>
              <div><dt>Your data</dt><dd className="row wrap"><button className="btn btn-secondary btn-sm" type="button" disabled={accountBusy} onClick={exportData}>Export JSON</button><button className="btn btn-ghost btn-sm text-danger" type="button" disabled={accountBusy} onClick={deleteData}>Delete all data</button></dd></div>
            </dl>
            {accountError && <div className="panel-body"><ErrorNotice error={accountError} /></div>}
          </section>

          <section className="panel" aria-labelledby="set-display">
            <header className="panel-head">
              <h3 id="set-display" className="eyebrow">
                Display
              </h3>
            </header>
            <div className="panel-body">
              <p className="muted-small">Saved in this browser. System follows your device's light or dark setting.</p>
              <ThemeChoiceGroup />
              <label className="check-row">
                <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
                <span><strong>Guide</strong> — tips on every screen and a "Next" bar that says what to do now. Turning it on shows all the tips again.</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
                <span><strong>Advanced</strong> — show the full menu, campaigns, follow-ups, staffing, help and the detailed settings below</span>
              </label>
            </div>
          </section>
        </div>

        <div className="stack-4">
          {advanced && <>
          <section className="panel" aria-labelledby="set-rules">
            <header className="panel-head">
              <h3 id="set-rules" className="eyebrow">
                Rules that cannot be switched off
              </h3>
            </header>
            <ul className="plain-list settings-rules panel-body">
              {FIXED_RULES.map(([t, d]) => (
                <li key={t}>
                  <span aria-hidden="true">🔒︎</span>
                  <span className="grow">
                    <strong>{t}</strong>
                    <span className="muted-small">{d}</span>
                  </span>
                  <span className="badge">Always on</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" aria-labelledby="set-deploy">
            <header className="panel-head">
              <h3 id="set-deploy" className="eyebrow">
                This deployment
              </h3>
            </header>
            <dl className="settings-rows panel-body">
              <div>
                <dt>Web</dt>
                <dd className="mono">{typeof window === 'undefined' ? '' : window.location.host} · {typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "local"}</dd>
              </div>
              <div>
                <dt>API version</dt>
                <dd className="mono">{diagnostics.data ? `${diagnostics.data.version} · ${diagnostics.data.database.pendingMigrations ?? 0} pending migrations` : '—'}</dd>
              </div>
              <div>
                <dt>API</dt>
                <dd className="mono">{config.apiBaseUrl}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>{capabilities?.environment ?? '—'}</dd>
              </div>
              <div>
                <dt>Database</dt>
                <dd>
                  {capabilities?.databaseProvider ?? '—'}
                  {capabilities?.temporaryStorage && <span className="badge badge-warning"> temporary</span>}
                </dd>
              </div>
              <div>
                <dt>AI mode</dt>
                <dd>{capabilities?.aiMode ?? '—'}</dd>
              </div>
              <div>
                <dt>Idle behaviour</dt>
                <dd className="muted-small">
                  The API sleeps on free hosting. A first request after a quiet spell can take up to a minute — shown as a wait,
                  never as a failure.
                </dd>
              </div>
            </dl>
            <div className="panel-body">
              <button type="button" className="btn btn-secondary btn-sm cap-action" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </section>
          </>}
        </div>
      </div>
    </div>
  )
}
