import { useState } from 'react'
import { Icon } from '../../components/icons'
import type { Workspace } from '../shell/shellModel'
import { writeWorkspace } from '../shell/shellModel'
import { config } from '../../lib/config'
import { api } from '../../lib/api'
import { roleFor, shouldSaveRole, type Me } from '../access/accessModel'
import { BrandMark } from './AuthLayout'
import { ONBOARDED_KEY, writeFlag } from './authModel'
import { useAuth } from './AuthContext'

const CHOICES: { key: Workspace; title: string; sub: string; status: string; tone: string; points: string[] }[] = [
  {
    key: 'candidate',
    title: 'Candidate',
    sub: 'I am looking for work',
    status: 'Built',
    tone: 'badge-success',
    points: [
      'Roles from Greenhouse, Lever and your own sources',
      'Approve a batch, then apply with one click on each job',
      'Every score shows the sentence that justifies it',
    ],
  },
  {
    key: 'sales',
    title: 'Sales',
    sub: 'I am looking for customers',
    status: 'Built — you send',
    tone: 'badge-warning',
    points: [
      'Companies from CSVs, public pages, feeds or pasted lists',
      'Shortlist with the evidence attached',
      'Draft and approve outreach and bids here; you send them and record the receipt',
    ],
  },
]

const CANDIDATE_SHARED = {
  ...CHOICES[0],
  sub: 'My recruiter shares my progress',
  status: 'Built',
  points: ['Where each application stands, live', 'Your next interview: join link and calendar', 'Prep tips and roles your recruiter suggests'],
}

const NEXT = [
  ['Write a profile', 'A few lines on what you offer. Fit is scored against it.'],
  ['Add a source', 'A Greenhouse or Lever board slug is enough to start.'],
  ['Run a campaign', 'Set criteria, queue it, approve what comes back.'],
]

/** Design AuthOnboarding: shown once per browser after first sign-in. Picks the workspace, then opens Profiles. */
export function OnboardingPage({ onDone }: { onDone: (path: string) => void }) {
  const { user, signOut } = useAuth()
  const [choice, setChoice] = useState<Workspace>(config.candidateWorkspace && config.candidateJobSearch ? 'candidate' : 'sales')
  // Candidate view = what the sales team shares (2026-10-26), unless candidate job search is switched on.
  const all = config.candidateJobSearch ? CHOICES : CHOICES.map((c) => (c.key === 'candidate' ? CANDIDATE_SHARED : c))
  const choices = config.candidateWorkspace ? all : all.filter((c) => c.key === 'sales')

  async function finish(path: string) {
    writeWorkspace(choice)
    // Role-based access (2026-10-22): a brand-new account's choice becomes its role; an existing user keeps both views. Best effort:
    // if the API is unreachable the user simply keeps both views until the admin sets a role.
    if (!user?.guest) {
      try {
        const me = await api<Me>('/api/v1/me')
        if (shouldSaveRole(me)) await api('/api/v1/me/role', { method: 'PUT', body: JSON.stringify({ role: roleFor(choice) }) })
      } catch { /* keep both views */ }
    }
    writeFlag(ONBOARDED_KEY, true)
    onDone(path)
  }

  return (
    <div className="onboarding">
      <header className="onboarding-top">
        <span className="auth-brand">
          <span className="auth-brand-mark">
            <BrandMark />
          </span>
          OpportunityPilot
        </span>
        <div className="grow" />
        <span className="muted-small">Signed in as {user?.email}</span>
        <button type="button" className="btn-link small" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <main className="onboarding-main stack-5">
        <ol className="onboarding-steps" aria-label="Setup progress">
          <li className="done">Your account</li>
          <li className="current" aria-current="step">
            Pick a workspace
          </li>
          <li>Seed a profile</li>
        </ol>

        <div className="stack-2">
          <h1 className="onboarding-title">{config.candidateWorkspace ? 'Which job are you here to do?' : 'Your sales workspace'}</h1>
          <p className="muted">
            {config.candidateWorkspace
              ? user?.guest
                ? 'Both run on the same pipeline. The one you pick decides what the app shows you and what a campaign searches for. You can switch any time from the rail, and you can use both.'
                : 'Both run on the same pipeline. The one you pick decides what the app shows you and what a campaign searches for.'
              : 'This app is for the sales team. Candidates follow their progress in the candidate portal, through the private link you share with them.'}
          </p>
        </div>

        <fieldset className="onboarding-choices">
          <legend className="sr-only">Workspace</legend>
          {choices.map((c) => (
            <label key={c.key} className={`onboarding-choice onboarding-${c.key} ${choice === c.key ? 'is-on' : ''}`}>
              <div className="row">
                <input type="radio" name="workspace" checked={choice === c.key} onChange={() => setChoice(c.key)} />
                <span className="onboarding-icon" aria-hidden="true">
                  <Icon name={c.key} size={18} />
                </span>
                <span className="stack-0">
                  <strong>{c.title}</strong>
                  <span className="muted-small">{c.sub}</span>
                </span>
                <div className="grow" />
                <span className={`badge ${c.tone}`}>{c.status}</span>
              </div>
              <ul className="onboarding-points">
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </label>
          ))}
        </fieldset>

        <section className="card stack-3">
          <div className="eyebrow">Next, in 60 seconds</div>
          <ol className="onboarding-next">
            {NEXT.map(([t, d]) => (
              <li key={t}>
                <strong>{t}</strong>
                <span className="muted-small">{d}</span>
              </li>
            ))}
          </ol>
        </section>

        {!user?.guest && <p className="muted-small">Your choice sets what you see. Your admin can give you both views.</p>}
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => void finish('/')}>
            Skip for now
          </button>
          <div className="grow" />
          <span className="muted-small">You can change all of this later.</span>
          <button type="button" className="btn btn-primary" onClick={() => void finish('/profiles')}>
            Continue to profile
          </button>
        </div>
      </main>
    </div>
  )
}
