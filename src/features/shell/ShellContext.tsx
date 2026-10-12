import { createContext, useContext } from 'react'
import type { Capabilities, Overview } from '../../lib/types'
import type { Workspace } from './shellModel'

export interface ShellState {
  capabilities: Capabilities | undefined
  /** Suggested opportunities waiting in /approvals (from GET /api/v1/overview); undefined until known. */
  awaitingApproval: number | undefined
  /** The overview counts (profiles, campaigns, drafts…) that drive the journey; undefined until known. */
  overview: Overview | undefined
  /** Re-reads the overview counts, e.g. after an approval decision or a status change. */
  refreshOverview: () => void
  /** Client-side preference (localStorage `op.workspace`), not an account setting; filters no data. */
  workspace: Workspace
  setWorkspace: (workspace: Workspace) => void
  /** Client-side preference (localStorage `op.advanced`): show the advanced menu items and sections. */
  advanced: boolean
  setAdvanced: (on: boolean) => void
  /** Guide mode: coachmarks and the Next bar. On by default; turning it on restarts every tour. */
  guide: boolean
  setGuide: (on: boolean) => void
}

export const ShellContext = createContext<ShellState>({
  capabilities: undefined,
  awaitingApproval: undefined,
  overview: undefined,
  refreshOverview: () => {},
  workspace: 'candidate',
  setWorkspace: () => {},
  advanced: false,
  setAdvanced: () => {},
  guide: true,
  setGuide: () => {},
})

export const useShell = () => useContext(ShellContext)
