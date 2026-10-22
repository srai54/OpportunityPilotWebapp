import { Suspense, useEffect, useRef, useState } from 'react'
import { lazyPage } from './lib/lazyPage'
import { RouteError } from './components/RouteError'
import { createBrowserRouter, Link, Navigate, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/AuthContext'
import { authScreenFor, isAuthOnlyPath, ONBOARDED_KEY, readFlag } from './features/auth/authModel'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { MfaChallengePage } from './features/auth/MfaChallengePage'
import { NewPasswordPage, ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignInPage } from './features/auth/SignInPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { EmptyState } from './components/States'
import { config } from './lib/config'

const CampaignBuilder = lazyPage(() => import('./features/campaigns/CampaignBuilder').then((m) => ({ default: m.CampaignBuilder })))
const CampaignsPage = lazyPage(() => import('./features/campaigns/CampaignsPage').then((m) => ({ default: m.CampaignsPage })))
const ConnectorsPage = lazyPage(() => import('./features/connectors/ConnectorsPage').then((m) => ({ default: m.ConnectorsPage })))
const InsightsPage = lazyPage(() => import('./features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })))
const OpportunitiesPage = lazyPage(() => import('./features/opportunities/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })))
const OpportunityDetailPage = lazyPage(() => import('./features/opportunities/OpportunityDetailPage').then((m) => ({ default: m.OpportunityDetailPage })))
const OverviewPage = lazyPage(() => import('./features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const OutreachPage = lazyPage(() => import('./features/outreach/OutreachPage').then((m) => ({ default: m.OutreachPage })))
const AutopilotPage = lazyPage(() => import('./features/autopilot/AutopilotPage').then((m) => ({ default: m.AutopilotPage })))
const FollowUpHub = lazyPage(() => import('./features/follow-ups/FollowUpHub').then((m) => ({ default: m.FollowUpHub })))
const ProfilesPage = lazyPage(() => import('./features/profiles/ProfilesPage').then((m) => ({ default: m.ProfilesPage })))
const ResearchProgressPage = lazyPage(() => import('./features/research/ResearchProgressPage').then((m) => ({ default: m.ResearchProgressPage })))
const SettingsPage = lazyPage(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const StaffingDealsPage = lazyPage(() => import('./features/staffing/StaffingDealsPage').then((m) => ({ default: m.StaffingDealsPage })))
const StaffingDealPage = lazyPage(() => import('./features/staffing/StaffingDealPage').then((m) => ({ default: m.StaffingDealPage })))
const StaffingInterviewsPage = lazyPage(() => import('./features/staffing/StaffingInterviewsPage').then((m) => ({ default: m.StaffingInterviewsPage })))
const MyInterviewsPage = lazyPage(() => import('./features/interviews/MyInterviewsPage').then((m) => ({ default: m.MyInterviewsPage })))
const StaffingCandidatesPage = lazyPage(() => import('./features/staffing/StaffingCandidatesPage').then((m) => ({ default: m.StaffingCandidatesPage })))
const AppShell = lazyPage(() => import('./features/shell/AppShell').then((m) => ({ default: m.AppShell })))
const ProgressPage = lazyPage(() => import('./features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const HowItWorksPage = lazyPage(() => import('./features/guide/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })))
const WellfoundPage = lazyPage(() => import('./features/wellfound/WellfoundPage').then((m) => ({ default: m.WellfoundPage })))

const SIGNED_OUT_SCREENS = {
  signin: SignInPage,
  signup: SignUpPage,
  verify: VerifyEmailPage,
  reset: ResetPasswordPage,
  'new-password': NewPasswordPage,
}

/**
 * Signed-out visitors see an account screen; any non-account URL shows sign-in, so deep links survive sign-in.
 * A password-reset link opens "Choose a new password" first. New browsers see onboarding once.
 */
function AuthGate() {
  const { ready, user, recovering, mfaRequired } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [onboarded, setOnboarded] = useState(() => readFlag(ONBOARDED_KEY, false))
  // After signing in (from any account screen or deep link) everyone lands on Overview, in every workspace and mode.
  const signedOutSeen = useRef(false)
  useEffect(() => {
    if (!ready) return
    if (!user) { signedOutSeen.current = true; return }
    if (!mfaRequired && signedOutSeen.current) {
      signedOutSeen.current = false
      if (location.pathname !== '/') navigate('/', { replace: true })
    }
  }, [ready, user, mfaRequired, location.pathname, navigate])
  // A candidate's private progress link works without an account.
  const progressToken = /^\/progress\/([^/]+)$/.exec(location.pathname)?.[1]
  // Old links keep working: with the candidate portal set, they forward there (2026-10-22); otherwise the page shows here.
  if (progressToken && config.candidatePortalUrl) { window.location.replace(`${config.candidatePortalUrl}/progress/${progressToken}`); return null }
  if (progressToken) return <Suspense fallback={<div className="boot" role="status">Loading…</div>}><ProgressPage token={decodeURIComponent(progressToken)} /></Suspense>
  if (!ready) return <div className="boot" role="status">Checking your session…</div>
  if (recovering) return <NewPasswordPage />
  if (!user) {
    const Screen = SIGNED_OUT_SCREENS[authScreenFor(location.pathname)]
    return <Screen />
  }
  if (mfaRequired) return <MfaChallengePage />
  if (isAuthOnlyPath(location.pathname)) return <Navigate to="/" replace />
  if (!onboarded)
    return (
      <OnboardingPage
        onDone={() => {
          setOnboarded(true)
          navigate('/')
        }}
      />
    )
  return <AppShell />
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        title="There is no page at this address"
        actions={
          <Link className="btn btn-secondary" to="/">
            Go to overview
          </Link>
        }
      >
        The link may be old, or the item may belong to another account.
      </EmptyState>
    </div>
  )
}

// A data router is required: ProfilesPage and CampaignBuilder use useBlocker to guard unsaved edits.
const router = createBrowserRouter([
  {
    element: <AuthGate />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <OverviewPage />, handle: { title: 'Overview' } },
      { path: 'campaigns', element: <CampaignsPage />, handle: { title: 'Campaigns' } },
      { path: 'campaigns/new', element: <CampaignBuilder />, handle: { title: 'New campaign' } },
      { path: 'campaigns/:id/edit', element: <CampaignBuilder />, handle: { title: 'Campaign builder' } },
      { path: 'campaigns/:id/opportunities', element: <OpportunitiesPage />, handle: { title: 'Opportunities' } },
      { path: 'research/:jobId', element: <ResearchProgressPage />, handle: { title: 'Research run' } },
      { path: 'opportunities', element: <OpportunitiesPage />, handle: { title: 'Opportunities' } },
      { path: 'opportunities/:id', element: <OpportunityDetailPage />, handle: { title: 'Opportunity' } },
      { path: 'approvals', element: <Navigate to="/opportunities?view=approvals" replace />, handle: { title: 'Opportunities' } },
      { path: 'outreach', handle: { title: 'Outreach' }, element: <OutreachPage /> },
      // Inbox and Follow-ups are one Follow up screen now; the old address opens its Replies tab.
      { path: 'inbox', element: <Navigate to="/follow-ups?tab=replies" replace />, handle: { title: 'Follow up' } },
      { path: 'autopilot', handle: { title: 'Autopilot' }, element: <AutopilotPage /> },
      { path: 'follow-ups', handle: { title: 'Follow up' }, element: <FollowUpHub /> },
      { path: 'staffing', element: <StaffingDealsPage />, handle: { title: 'Staffing deals' } },
      { path: 'staffing/deals/:id', element: <StaffingDealPage />, handle: { title: 'Staffing deal' } },
      { path: 'staffing/candidates', element: <StaffingCandidatesPage />, handle: { title: 'Candidates' } },
      { path: 'staffing/interviews', element: <StaffingInterviewsPage />, handle: { title: 'Interviews' } },
      { path: 'interviews', element: <MyInterviewsPage />, handle: { title: 'My interviews' } },
      { path: 'how-it-works', element: <HowItWorksPage />, handle: { title: 'How it works' } },
      { path: 'profiles', element: <ProfilesPage />, handle: { title: 'Profiles' } },
      { path: 'profiles/:id', element: <ProfilesPage />, handle: { title: 'Profiles' } },
      { path: 'trends', element: <Navigate to="/wellfound?tab=trends" replace />, handle: { title: 'Find jobs' } },
      { path: 'wellfound', element: <WellfoundPage />, handle: { title: 'Find jobs' } },
      { path: 'connectors', element: <ConnectorsPage />, handle: { title: 'Connectors' } },
      { path: 'insights', element: <InsightsPage />, handle: { title: 'Insights' } },
      { path: 'settings', element: <SettingsPage />, handle: { title: 'Settings' } },
      { path: '*', element: <NotFound />, handle: { title: 'Not found' } },
    ],
  },
])

export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="boot" role="status">Loading page…</div>}><RouterProvider router={router} /></Suspense>
    </AuthProvider>
  )
}
