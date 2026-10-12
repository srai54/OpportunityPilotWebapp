import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { NavLink, Outlet, useLocation, useMatches } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { api, ApiUnreachableError, isDegraded } from '../../lib/api'
import type { Capabilities, Overview } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { useAuth } from '../auth/AuthContext'
import { ShellContext } from './ShellContext'
import { CoachHost } from '../../components/CoachHost'
import { flowIdForPath } from '../coach/coachModel'
import { ThemeToggle } from './ThemeToggle'
import {
  aiModeLabel,
  API_STATUS_LABELS,
  type ApiStatus,
  gmailLabel,
  initials,
  navGroupsFor,
  readAdvanced,
  writeAdvanced,
  navAccessibleName,
  navCount,
  readNavCollapsed,
  readWorkspace,
  topbarHint,
  type Workspace,
  WORKSPACES,
  writeNavCollapsed,
  writeWorkspace,
} from './shellModel'

/** Below this width the rail is always a drawer (matches --op-nav-drawer-breakpoint and the 860 px rules in app.css). */
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
        if (!cancelled) setStatus('ready')
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

export function AppShell() {
  const { user, signOut } = useAuth()
  const apiStatus = useApiStatus()
  // Capabilities need no database, so they also explain a degraded API (e.g. missing setup).
  const capabilities = useApi<Capabilities>(apiStatus === 'ready' || apiStatus === 'degraded' ? '/api/v1/capabilities' : null)
  // For the rail counts and the top-bar hint; screens that show the figures fetch their own copy.
  const overview = useApi<Overview>(apiStatus === 'ready' ? '/api/v1/overview' : null)
  const awaitingApproval = overview.data?.awaitingApproval
  const location = useLocation()
  const matches = useMatches()
  const isDrawerLayout = useIsDrawerLayout()

  const [collapsedPref, setCollapsedPref] = useState(readNavCollapsed)
  const collapsed = collapsedPref && !isDrawerLayout
  const [workspace, setWorkspaceState] = useState<Workspace>(readWorkspace)
  const setWorkspace = useCallback((ws: Workspace) => {
    setWorkspaceState(ws)
    writeWorkspace(ws)
  }, [])
  const [demoHidden, setDemoHidden] = useState(() => { try { return sessionStorage.getItem('op.demoBanner') === '1' } catch { return false } })
  const [replay, setReplay] = useState(0)
  const [advanced, setAdvancedState] = useState(readAdvanced)
  const setAdvanced = useCallback((on: boolean) => {
    setAdvancedState(on)
    writeAdvanced(on)
  }, [])

  // Drawer and popovers remember the path they were opened on, so any route change closes them.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const drawerOpen = isDrawerLayout && drawerPath === location.pathname
  const menuOpen = menuPath === location.pathname

  const menuRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const title =
    [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean) ??
    'OpportunityPilot'
  const hint = topbarHint(location.pathname, workspace, overview.data)

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

  // Widening past the breakpoint forgets an open drawer, so narrowing again does not reopen it.
  useEffect(() => {
    const mq = window.matchMedia(DRAWER_QUERY)
    const onChange = () => {
      if (!mq.matches) setDrawerPath(null)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // However the drawer closed (its button, Escape, scrim, a link, a route change), focus goes back to the menu
  // button. Done after the commit: until then the button sits in the inert page and cannot take focus.
  const drawerWasOpen = useRef(false)
  useEffect(() => {
    if (drawerWasOpen.current && !drawerOpen) menuButtonRef.current?.focus()
    drawerWasOpen.current = drawerOpen
  }, [drawerOpen])

  // Drawer: focus moves in, Tab stays in, Escape closes, the page behind does not scroll.
  useEffect(() => {
    if (!drawerOpen) return
    const rail = railRef.current
    const target = rail?.querySelector<HTMLElement>('[aria-current="page"]') ?? rail?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDrawer()
        return
      }
      if (e.key !== 'Tab' || !rail) return
      const items = [...rail.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !rail.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !rail.contains(document.activeElement))) {
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
  const aiMode = gemini && aiModeLabel(gemini)
  const statuses = [apiLabel, ...(gmailStatus ? [gmailStatus] : [])]

  const railClass = ['rail', collapsed && 'rail-collapsed', drawerOpen && 'rail-open'].filter(Boolean).join(' ')

  return (
    <ShellContext.Provider
      value={{ capabilities: caps, awaitingApproval, refreshOverview: overview.reload, workspace, setWorkspace, advanced, setAdvanced }}
    >
      <div className={`shell ws-${workspace}`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <nav ref={railRef} className={railClass} aria-label="Primary" id="primary-nav">
          <div className="rail-head">
            {isDrawerLayout ? (
              <button type="button" className="rail-toggle" aria-label="Close navigation" onClick={closeDrawer}>
                <Icon name="menu" size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="rail-toggle"
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                aria-expanded={!collapsed}
                data-tip={collapsed ? 'Expand navigation' : undefined}
                onClick={toggleCollapsed}
              >
                <Icon name="menu" size={collapsed ? 19 : 18} />
              </button>
            )}
            {!collapsed && <span className="rail-brand-name">OpportunityPilot</span>}
          </div>

          <div className="ws-seg" role="group" aria-label="Workspace">
            {(Object.keys(WORKSPACES) as Workspace[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`ws-seg-btn ws-seg-${key}`}
                aria-pressed={key === workspace}
                aria-label={collapsed ? `${WORKSPACES[key].label} workspace` : undefined}
                data-tip={collapsed ? `${WORKSPACES[key].label} workspace` : undefined}
                onClick={() => setWorkspace(key)}
              >
                <Icon name={WORKSPACES[key].icon} size={14} />
                {!collapsed && <span>{WORKSPACES[key].label}</span>}
              </button>
            ))}
          </div>

          <div className="rail-groups">
            {navGroupsFor(workspace, advanced).map((group) => (
              <div key={group.id} className="rail-group">
                {group.label &&
                  (collapsed ? (
                    <div className="rail-divider" aria-hidden="true" />
                  ) : (
                    <div className="rail-section" id={`nav-group-${group.id}`}>
                      {group.label}
                    </div>
                  ))}
                <ul
                  className="rail-list"
                  aria-labelledby={group.label && !collapsed ? `nav-group-${group.id}` : undefined}
                  aria-label={group.label && collapsed ? group.label : undefined}
                >
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
                          aria-label={collapsed ? name : undefined}
                          data-tip={collapsed ? name : undefined}
                          onClick={drawerOpen ? closeDrawer : undefined}
                        >
                          <Icon name={n.icon} size={collapsed ? 18 : 16} className="rail-icon" />
                          {collapsed ? (
                            n.count?.tone === 'attention' && count !== null && <span className="nav-dot" aria-hidden="true" />
                          ) : (
                            <>
                              <span className="rail-label">{n.label}</span>
                              {n.notBuilt && (
                                <span className="nav-soon">
                                  Soon<span className="sr-only"> (not built yet)</span>
                                </span>
                              )}
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
            <button
              type="button"
              className="rail-switch"
              role="switch"
              aria-checked={advanced}
              onClick={() => setAdvanced(!advanced)}
              title={collapsed ? (advanced ? 'Advanced: on' : 'Advanced: off') : undefined}
            >
              <span className="rail-switch-track" aria-hidden="true"><i /></span>
              <span className={collapsed ? 'sr-only' : undefined}>Advanced</span>
            </button>
            {statuses.map((s) => (
              <div key={s.text} className="rail-status" title={collapsed ? s.text : undefined}>
                <span className={`dot dot-${s.tone}`} aria-hidden="true" />
                <span className={collapsed ? 'sr-only' : undefined}>{s.text}</span>
              </div>
            ))}
          </div>
        </nav>
        {drawerOpen && <div className="scrim" onClick={closeDrawer} aria-hidden="true" />}

        <div className="main-col" inert={drawerOpen}>
          <header className="topbar">
            <button
              ref={menuButtonRef}
              type="button"
              className="menu-toggle"
              aria-label="Open navigation"
              aria-controls="primary-nav"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerPath(location.pathname)}
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="topbar-heading">
              <h1 className="topbar-title">{title}</h1>
              {hint && <span className="topbar-hint">{hint}</span>}
            </div>
            <div className="grow" />
            {advanced && aiMode && (
              <span className={`pill pill-${aiMode.tone}`}>
                <span className="dot" aria-hidden="true" />
                {aiMode.text}
              </span>
            )}
            {flowIdForPath(location.pathname) && (
              <button type="button" className="help-btn" aria-label="Show tips for this page" title="Show tips for this page" onClick={() => setReplay((n) => n + 1)}>?</button>
            )}
            <ThemeToggle />
            <div className="account" ref={menuRef}>
              <button
                ref={avatarRef}
                type="button"
                className="avatar"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuPath((p) => (p === location.pathname ? null : location.pathname))}
              >
                <span className="avatar-initials" aria-hidden="true">
                  {user ? initials(user.email) : '?'}
                </span>
              </button>
              {menuOpen && (
                <div className="menu" role="menu">
                  <div className="menu-meta">{user?.email}</div>
                  <button type="button" role="menuitem" className="menu-item" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </header>

          {apiStatus === 'waking' && (
            <div className="banner" role="status">
              <Icon name="alert" size={15} className="banner-icon" />
              <span>
                <strong>Starting the API service…</strong> The host sleeps when idle; the first request can take up to a
                minute.
              </span>
            </div>
          )}
          {(caps?.temporaryStorage || caps?.guestSignIn) && !demoHidden && (
            <div className="banner" role="status">
              <Icon name="alert" size={15} className="banner-icon" />
              <span>
                <strong>Demo mode.</strong>{' '}
                {caps.temporaryStorage
                  ? 'Your data is temporary and is cleared when the server restarts.'
                  : 'Data is stored, but sign-in is guest-only.'}{' '}
                {caps.guestSignIn && 'You are signed in as a private guest.'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm banner-close" aria-label="Dismiss this message" onClick={() => { setDemoHidden(true); try { sessionStorage.setItem('op.demoBanner', '1') } catch { /* shown again next time */ } }}>✕</button>
            </div>
          )}
          {apiStatus === 'degraded' && (
            <div className="banner banner-danger" role="alert">
              <Icon name="alert" size={15} className="banner-icon" />
              <span>
                The API is running but reports its database as unavailable. Data screens will fail until it recovers.
              </span>
            </div>
          )}

          <main id="main" className="content" tabIndex={-1}>
            <Outlet />
          </main>
          <CoachHost pathname={location.pathname} replay={replay} />
        </div>
      </div>
    </ShellContext.Provider>
  )
}
