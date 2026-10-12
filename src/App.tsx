import { lazy, Suspense, useState } from 'react'
import { createBrowserRouter, Link, Navigate, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/AuthContext'
import { authScreenFor, isAuthOnlyPath, ONBOARDED_KEY, readFlag } from './features/auth/authModel'
import { OnboardingPage } from './features/auth/OnboardingPage'
import { NewPasswordPage, ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignInPage } from './features/auth/SignInPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { EmptyState } from './components/States'

const CampaignBuilder = lazy(() => import('./features/campaigns/CampaignBuilder').then((m) => ({ default: m.CampaignBuilder })))
const CampaignsPage = lazy(() => import('./features/campaigns/CampaignsPage').then((m) => ({ default: m.CampaignsPage })))
const ConnectorsPage = lazy(() => import('./features/connectors/ConnectorsPage').then((m) => ({ default: m.ConnectorsPage })))
const InsightsPage = lazy(() => import('./features/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })))
const OpportunitiesPage = lazy(() => import('./features/opportunities/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })))
const OpportunityDetailPage = lazy(() => import('./features/opportunities/OpportunityDetailPage').then((m) => ({ default: m.OpportunityDetailPage })))
const OverviewPage = lazy(() => import('./features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const OutreachPage = lazy(() => import('./features/outreach/OutreachPage').then((m) => ({ default: m.OutreachPage })))
const FollowUpsPage = lazy(() => import('./features/follow-ups/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })))
const ProfilesPage = lazy(() => import('./features/profiles/ProfilesPage').then((m) => ({ default: m.ProfilesPage })))
const ResearchProgressPage = lazy(() => import('./features/research/ResearchProgressPage').then((m) => ({ default: m.ResearchProgressPage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const StaffingDealsPage = lazy(() => import('./features/staffing/StaffingDealsPage').then((m) => ({ default: m.StaffingDealsPage })))
const StaffingDealPage = lazy(() => import('./features/staffing/StaffingDealPage').then((m) => ({ default: m.StaffingDealPage })))
const StaffingCandidatesPage = lazy(() => import('./features/staffing/StaffingCandidatesPage').then((m) => ({ default: m.StaffingCandidatesPage })))
const AppShell = lazy(() => import('./features/shell/AppShell').then((m) => ({ default: m.AppShell })))
const HowItWorksPage = lazy(() => import('./features/guide/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })))
const WellfoundPage = lazy(() => import('./features/wellfound/WellfoundPage').then((m) => ({ default: m.WellfoundPage })))

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
  const { ready, user, recovering } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [onboarded, setOnboarded] = useState(() => readFlag(ONBOARDED_KEY, false))
  if (!ready) return <div className="boot" role="status">Checking your session…</div>
  if (recovering) return <NewPasswordPage />
  if (!user) {
    const Screen = SIGNED_OUT_SCREENS[authScreenFor(location.pathname)]
    return <Screen />
  }
  if (isAuthOnlyPath(location.pathname)) return <Navigate to="/" replace />
  if (!onboarded)
    return (
      <OnboardingPage
        onDone={(path) => {
          setOnboarded(true)
          navigate(path)
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
      { path: 'follow-ups', handle: { title: 'Follow-ups' }, element: <FollowUpsPage /> },
      { path: 'staffing', element: <StaffingDealsPage />, handle: { title: 'Staffing deals' } },
      { path: 'staffing/deals/:id', element: <StaffingDealPage />, handle: { title: 'Staffing deal' } },
      { path: 'staffing/candidates', element: <StaffingCandidatesPage />, handle: { title: 'Candidates' } },
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
