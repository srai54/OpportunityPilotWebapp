import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { ProgressBar } from '../../components/ProgressBar'
import { percentOf } from '../../components/percent'
import { journeySteps } from '../journey/journeyModel'
import { api, ApiUnreachableError, isDegraded } from '../../lib/api'
import type { Capabilities, Overview } from '../../lib/types'
import { config } from '../../lib/config'
import { allowedWorkspaces, effectiveWorkspace, type Me } from '../access/accessModel'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../auth/AuthContext'
import { ShellContext } from './ShellContext'
import { CoachHost } from '../../components/CoachHost'
import { CallHost } from '../calls/CallHost'
import { COACH_FLOW_IDS } from '../coach/coachFlows'
import { flowIdForPath, resetAllTips, setTipsOff, tipsOff } from '../coach/coachModel'
import { JourneyBar } from '../journey/JourneyBar'
import { NextBar } from '../journey/NextBar'
import { VoiceLaunch } from '../voice/VoiceLaunch'
import { VoicePill } from '../voice/VoicePill'
import { AppFooter } from './AppFooter'
import { ThemeToggle } from './ThemeToggle'
import {
  aiModeLabel,
  API_STATUS_LABELS,
  type ApiStatus,
  gmailLabel,
  initials,
  navGroupFor,
  navGroupsFor,
  readAdvanced,
  writeAdvanced,
  navAccessibleName,
  navCount,
  readNavCollapsed,
  readWorkspace,
  type Workspace,
  WORKSPACES,
  writeNavCollapsed,
  writeWorkspace,
} from './shellModel'

/** Below this width the rail is always a drawer (matches --op-nav-drawer-breakpoint and the 860 px rules in styles/app/*.css). */
const DRAWER_QUERY = '(max-width: 860px)'

function subscribeDrawerQuery(onChange: () => void) {
  const mq = window.matchMedia(DRAWER_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useIsDrawerLayout() {
  return useSyncExternalStore(subscribeDrawerQuery, () => window.matchMedia(DRAWER_QUERY).matches)
}

/** Polls readiness with backoff so a sleeping free-tier host reads as "starting", not as a failure. */
function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking')
  useEffect(() => {
    let cancelled = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      try {
        await api('/health/ready')
        if (cancelled) return
        setStatus('ready')
        attempt = 0
        // Keep watching once ready (every 60 s while the tab is visible), so a later outage shows instead of a stale "ready".
        timer = setTimeout(function again() { if (document.visibilityState === 'visible') void check(); else timer = setTimeout(again, 60000) }, 60000)
      } catch (e) {
        if (cancelled) return
        // A 429 or other 4xx is this browser being throttled, not a database outage: keep the last known state.
        if (e instanceof ApiUnreachableError) setStatus('waking')
        else if (isDegraded(e)) setStatus('degraded')
        // Back off quickly at first, then keep checking every 30 s so the banner clears once the host wakes.
        timer = setTimeout(check, attempt++ < 8 ? Math.min(2000 * 2 ** attempt, 20000) : 30000)
      }
    }
    void check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])
  return status
}

const FOCUSABLE = 'a[href], button:not([disabled])'

/** Closes a popover on Escape (returning focus to its trigger) or on a click outside `root`. */
function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>, trigger?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
      trigger?.current?.focus()
    }
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close()
    }
    // Capture phase so Escape closes the innermost popover before the drawer sees it.
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, close, root, trigger])
}

/** A small labelled on/off switch for the app bar (Guide, Advanced). */
function TopSwitch({ label, on, onChange, coach, hint, testId }: Readonly<{ label: string; on: boolean; onChange: (on: boolean) => void; coach?: string; hint?: string; testId?: string }>) {
  return (
    <button type="button" className="top-switch" role="switch" aria-checked={on} title={hint} data-coach={coach} data-testid={testId} onClick={() => onChange(!on)}>
      <span className="top-switch-track" aria-hidden="true"><i /></span>
      <span>{label}</span>
    </button>
  )
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const apiStatus = useApiStatus()
  // Capabilities need no database, so they also explain a degraded API (e.g. missing setup).
  const capabilities = useApi<Capabilities>(apiStatus === 'ready' || apiStatus === 'degraded' ? '/api/v1/capabilities' : null)
  // For the rail counts and the journey; screens that show the figures fetch their own copy.
  const overview = useApi<Overview>(apiStatus === 'ready' ? '/api/v1/overview' : null)
  const awaitingApproval = overview.data?.awaitingApproval
  const reloadOverview = overview.reload
  const location = useLocation()
  const matches = useMatches()
  const isNarrow = useIsDrawerLayout()

  const [collapsedPref, setCollapsedPref] = useState(readNavCollapsed)
  const [workspace, setWorkspaceState] = useState<Workspace>(readWorkspace)
  const agent = useApi<{ connected: boolean; online: boolean }>(apiStatus === 'ready' && workspace !== 'sales' ? '/api/v1/agent-keys/status' : null)
  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws)
    writeWorkspace(ws)
  }, [])
  // Role-based access (2026-10-22): a Candidate-only or Sales-only user sees that view only; Both, no role yet and the admin keep both.
  // The shown email goes along only as the admin's label (Hanko tokens may carry none); access is decided from the token on the server.
  const meLabel = user?.guest ? '' : user?.email ?? ''
  const me = useApi<Me>(apiStatus === 'ready' ? `/api/v1/me${meLabel.includes('@') ? `?label=${encodeURIComponent(meLabel)}` : ''}` : null)
  const allowedWs = useMemo(() => allowedWorkspaces(me.data), [me.data])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (!allowedWs.includes(workspace)) setWorkspace(effectiveWorkspace(workspace, allowedWs))
  }, [allowedWs, workspace, setWorkspace])
  const [demoHidden, setDemoHidden] = useState(() => { try { return sessionStorage.getItem('op-demo-hidden') === '1' } catch { return false } })
  const [replay, setReplay] = useState(0)
  const [guide, setGuideState] = useState(() => !tipsOff())
  // Bumped every time Guide is turned on, so the tours for the current screen start again.
  const [guideTick, setGuideTick] = useState(0)
  const setGuide = useCallback((on: boolean) => {
    setGuideState(on)
    setTipsOff(!on)
    if (on) {
      resetAllTips(COACH_FLOW_IDS)
      setGuideTick((t) => t + 1)
    }
  }, [])
  const [advanced, setAdvancedState] = useState(readAdvanced)
  const setAdvanced = useCallback((on: boolean) => {
    setAdvancedState(on)
    writeAdvanced(on)
  }, [])

  // Advanced on a wide screen keeps a rail beside the page; everything else (Simple at any width, Advanced on a phone) uses a drawer.
  const railVisible = advanced && !isNarrow
  const collapsed = railVisible && collapsedPref
  // The drawer and popovers remember the path they were opened on, so any route change closes them.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const drawerOpen = !railVisible && drawerPath === location.pathname
  const menuOpen = menuPath === location.pathname

  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const [chromeH, setChromeH] = useState(104)

  const title =
    [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ??
    'OpportunityPilot'
  const section = navGroupFor(location.pathname, navGroupsFor(workspace, true))?.label

  // The rail sticks under the app bar and journey bar, whatever height they have at this width.
  useLayoutEffect(() => {
    const el = chromeRef.current
    if (!el) return
    const measure = () => setChromeH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The journey bar and Next bar read these counts, so refresh them whenever the person moves to another screen.
  const reloadAgent = agent.reload
  useEffect(() => { reloadOverview(); reloadAgent() }, [location.pathname, reloadOverview, reloadAgent])

  const closeDrawer = useCallback(() => setDrawerPath(null), [])
  const closeMenu = useCallback(() => setMenuPath(null), [])
  useDismiss(menuOpen, closeMenu, menuRef, avatarRef)

  const toggleCollapsed = () => {
    const next = !collapsedPref
    setCollapsedPref(next)
    writeNavCollapsed(next)
  }

  useEffect(() => {
    document.title = `${title} · OpportunityPilot`
  }, [title])

  // However the drawer closed (its button, Escape, scrim, a link, a route change), focus goes back to the hamburger.
  const drawerWasOpen = useRef(false)
  useEffect(() => {
    if (drawerWasOpen.current && !drawerOpen) burgerRef.current?.focus()
    drawerWasOpen.current = drawerOpen
  }, [drawerOpen])

  // Drawer: focus moves in, Tab stays in, Escape closes, the page behind does not scroll.
  useEffect(() => {
    if (!drawerOpen) return
    const drawer = drawerRef.current
    const target = drawer?.querySelector<HTMLElement>('[aria-current="page"]') ?? drawer?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
        return
      }
      if (e.key !== 'Tab' || !drawer) return
      const items = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen, closeDrawer])

  const caps = capabilities.data
  const gemini = caps?.items.find((i) => i.key === 'gemini')
  const gmail = caps?.items.find((i) => i.key === 'gmail')
  const apiLabel = API_STATUS_LABELS[apiStatus]
  const gmailStatus = gmail && gmailLabel(gmail)
  // The desktop agent (Candidate): always visible in the rail so "is it applying?" has an answer on every screen (U17-14).
  const agentStatus = workspace !== 'sales' && agent.data
    ? agent.data.online ? { text: 'Agent · running', tone: 'success' as const } : agent.data.connected ? { text: 'Agent · not running', tone: 'warning' as const } : { text: 'Agent · not set up', tone: 'neutral' as const }
    : null
  const aiMode = gemini && aiModeLabel(gemini)
  const pathSteps = journeySteps(workspace, overview.data)
  const pathDone = pathSteps.filter((s) => s.done).length
  // AI status sits with the other statuses in the rail footer (Advanced): in the app bar it squeezed the Candidate/Sales switch.
  const aiStatus = advanced && aiMode ? { text: `AI · ${aiMode.text.replace(/^Gemini /, '')}`, tone: (gemini?.status === 'Ready' ? 'success' : gemini?.status === 'Configured' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral' } : null
  const statuses = [apiLabel, ...(gmailStatus ? [gmailStatus] : []), ...(agentStatus ? [agentStatus] : []), ...(aiStatus ? [aiStatus] : [])]

  const burgerLabel = railVisible ? (collapsed ? 'Expand the menu' : 'Collapse the menu') : drawerOpen ? 'Close the menu' : 'Open the menu'
  const onBurger = railVisible ? toggleCollapsed : () => setDrawerPath(drawerOpen ? null : location.pathname)

  /** The menu: the same list in the side rail (Advanced, wide) and in the drawer (everything else). */
  const navList = (iconsOnly: boolean, afterClick?: () => void) => (
    <>
      <div className="rail-groups">
        {navGroupsFor(workspace, advanced).map((group) => (
          <div key={group.id} className="rail-group">
            {group.label &&
              (iconsOnly ? (
                <div className="rail-divider" aria-hidden="true" />
              ) : (
                <div className="rail-section" id={`nav-group-${group.id}`}>{group.label}</div>
              ))}
            <ul className="rail-list" aria-labelledby={group.label && !iconsOnly ? `nav-group-${group.id}` : undefined} aria-label={group.label && iconsOnly ? group.label : undefined}>
              {group.items.map((n) => {
                const count = navCount(n, overview.data)
                const name = navAccessibleName(n, count)
                return (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.end}
                      className="rail-link"
                      data-coach={n.to === '/wellfound' ? 'nav-find' : n.to === '/opportunities' ? 'nav-opps' : n.to === '/outreach' ? 'nav-outreach' : undefined}
                      aria-label={iconsOnly ? name : undefined}
                      title={iconsOnly ? name : undefined}
                      onClick={afterClick}
                    >
                      <Icon name={n.icon} size={17} className="rail-icon" />
                      {iconsOnly ? (
                        n.count?.tone === 'attention' && count !== null && <span className="nav-dot" aria-hidden="true" />
                      ) : (
                        <>
                          <span className="rail-label">{n.label}</span>
                          {n.notBuilt && <span className="nav-soon">Soon<span className="sr-only"> (not built yet)</span></span>}
                          {n.count && count !== null && (
                            <span className={`nav-count nav-count-${n.count.tone} op-numeric`}>
                              {count}
                              <span className="sr-only"> {n.count.srLabel}</span>
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="rail-footer">
        {!iconsOnly && (
          <div className="rail-path">
            <span className="rail-path-title">Your path</span>
            <ProgressBar pct={percentOf(pathDone, pathSteps.length)} label="Steps of your path done" text={`${pathDone} of ${pathSteps.length}`} size="sm" tone={pathDone === pathSteps.length ? 'success' : 'primary'} />
          </div>
        )}
        {statuses.map((s) => (
          <div key={s.text} className="rail-status" title={iconsOnly ? s.text : undefined}>
            <span className={`dot dot-${s.tone}`} aria-hidden="true" />
            <span className={iconsOnly ? 'sr-only' : undefined}>{s.text}</span>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <ShellContext.Provider
      value={{ capabilities: caps, awaitingApproval, overview: overview.data, refreshOverview: overview.reload, workspace, setWorkspace, me: me.data, allowedWorkspaces: allowedWs, advanced, setAdvanced, guide, setGuide }}
    >
      <div className={`shell ws-${workspace} ${advanced ? 'is-advanced' : 'is-simple'}`} style={{ ['--chrome-h' as string]: `${chromeH}px` }}>
        <a href="#main" className="skip-link">Skip to content</a>

        <div className="chrome" ref={chromeRef}>
          <header className="appbar" data-testid="app-topbar">
            <div className="ab-l">
              <button
                ref={burgerRef}
                type="button"
                className="ab-burger"
                data-testid="app-burger"
                aria-label={burgerLabel}
                aria-controls={railVisible ? 'primary-nav' : 'nav-drawer'}
                aria-expanded={railVisible ? !collapsed : drawerOpen}
                onClick={onBurger}
              >
                <Icon name="menu" size={19} />
              </button>
              <Link to="/" className="brand" aria-label="OpportunityPilot home">
                <span className="brand-name">OpportunityPilot</span>
              </Link>
              <span className="ab-sep" aria-hidden="true" />
              {/* The Candidate/Sales switch only when the Candidate workspace is on; otherwise this is the Sales portal. */}
              {config.candidateWorkspace && allowedWs.length > 1 && <div className="ws-seg ws-seg-top" role="group" aria-label="Workspace" data-coach="ws-toggle">
                {(Object.keys(WORKSPACES) as Workspace[]).map((key) => (
                  <button key={key} type="button" className={`ws-seg-btn ws-seg-${key}`} aria-pressed={key === workspace} onClick={() => setWorkspace(key)}>
                    <Icon name={WORKSPACES[key].icon} size={14} />
                    <span className="ws-seg-label">{WORKSPACES[key].label}</span>
                  </button>
                ))}
              </div>}
              {advanced ? (
                <>
                  <span className="ab-sep ab-sep-crumb" aria-hidden="true" />
                  <div className="crumb" aria-label="You are here">
                    {section && <span className="crumb-sec">{section}<span className="crumb-slash" aria-hidden="true"> / </span></span>}
                    <h1 className="crumb-page">{title}</h1>
                  </div>
                </>
              ) : (
                <h1 className="sr-only">{title}</h1>
              )}
            </div>
            <div className="ab-r">
              <div className="top-switches" aria-label="View preferences">
                {/* Guide is back in the bar next to Advanced (user, 2026-10-16); the account menu keeps a copy for phones. */}
                <TopSwitch label="Guide" on={guide} onChange={setGuide} coach="guide-switch" hint="Tips and the Next bar on every screen" testId="toggle-guide" />
                <TopSwitch label="Advanced" on={advanced} onChange={setAdvanced} coach="advanced-switch" hint="Every screen, filter and detail" testId="toggle-advanced" />
              </div>
              <VoiceLaunch workspace={workspace} />
              <VoicePill />
              <button type="button" className="help-btn" aria-label="Show tips for this page" title="Show tips for this page" disabled={!flowIdForPath(location.pathname)} onClick={() => setReplay((n) => n + 1)}>
                <Icon name="help" size={17} />
              </button>
              <ThemeToggle />
              <div className="account" ref={menuRef}>
                <button
                  ref={avatarRef}
                  type="button"
                  className="avatar"
                  data-testid="account-menu-button"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuPath((p) => (p === location.pathname ? null : location.pathname))}
                >
                  <span className="avatar-initials" aria-hidden="true">{user ? initials(user.email) : '?'}</span>
                </button>
                {menuOpen && (
                  <div className="menu" role="menu" data-testid="account-menu">
                    <div className="menu-meta">{user?.email}</div>
                    <div className="menu-switches">
                      <button type="button" role="menuitemcheckbox" aria-checked={guide} data-testid="toggle-guide" className="menu-item menu-check" onClick={() => setGuide(!guide)}>
                        <span>Guide</span><span className="menu-switch" aria-hidden="true"><i /></span>
                      </button>
                      <button type="button" role="menuitemcheckbox" aria-checked={advanced} data-testid="toggle-advanced" className="menu-item menu-check" onClick={() => setAdvanced(!advanced)}>
                        <span>Advanced</span><span className="menu-switch" aria-hidden="true"><i /></span>
                      </button>
                    </div>
                    <Link to="/settings" role="menuitem" className="menu-item" onClick={closeMenu}>Settings</Link>
                    <Link to="/" role="menuitem" className="menu-item" onClick={closeMenu}>Home</Link>
                    <button type="button" role="menuitem" className="menu-item" onClick={() => void signOut()}>Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <JourneyBar workspace={workspace} overview={overview.data} pathname={location.pathname} />
        </div>

        <div className="shell-body">
          {railVisible && (
            <nav className={`rail${collapsed ? ' rail-collapsed' : ''}`} aria-label="Primary" id="primary-nav" data-testid="app-rail">
              {navList(collapsed)}
            </nav>
          )}
          <div className="main-col">
            {apiStatus === 'waking' && (
              <div className="banner" role="status">
                <Icon name="alert" size={15} className="banner-icon" />
                <span><strong>Waking the server…</strong> up to a minute.</span>
              </div>
            )}
            {(caps?.temporaryStorage || caps?.guestSignIn) && !demoHidden && (
              <div className="banner" role="status">
                <Icon name="alert" size={15} className="banner-icon" />
                <span>
                  <strong>Demo mode.</strong>{' '}
                  {caps.temporaryStorage ? 'Data clears on restart.' : 'Private guest session.'}
                </span>
                <button type="button" className="btn btn-ghost btn-sm banner-close" aria-label="Dismiss this message" onClick={() => { setDemoHidden(true); try { sessionStorage.setItem('op-demo-hidden', '1') } catch { /* shown again next time */ } }}>✕</button>
              </div>
            )}
            {apiStatus === 'degraded' && (
              <div className="banner banner-danger" role="alert">
                <Icon name="alert" size={15} className="banner-icon" />
                <span>The API is running but reports its database as unavailable. Data screens will fail until it recovers.</span>
              </div>
            )}
            {guide && <NextBar workspace={workspace} overview={overview.data} pathname={location.pathname} search={location.search} />}
            <main id="main" className="content" tabIndex={-1} inert={drawerOpen}>
              <Outlet />
            </main>
            <AppFooter apiStatus={apiStatus} workspace={workspace} />
          </div>
        </div>

        {drawerOpen && (
          <>
            <div className="scrim" onClick={closeDrawer} aria-hidden="true" />
            <div ref={drawerRef} className="rail rail-open drawer" id="nav-drawer" data-testid="nav-drawer" role="dialog" aria-modal="true" aria-label="Menu">
              <nav aria-label="Primary" className="drawer-nav">{navList(false, closeDrawer)}</nav>
            </div>
          </>
        )}
        <CoachHost pathname={location.pathname} replay={replay} guide={guide} guideTick={guideTick} workspace={workspace} onSkip={() => setGuide(false)} />
        <CallHost />
      </div>
    </ShellContext.Provider>
  )
}
