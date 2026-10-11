import { createContext, useContext } from 'react'
import type { Capabilities } from '../../lib/types'
import type { Workspace } from './shellModel'

export interface ShellState {
  capabilities: Capabilities | undefined
  /** Suggested opportunities waiting in /approvals (from GET /api/v1/overview); undefined until known. */
  awaitingApproval: number | undefined
  /** Re-reads the overview counts, e.g. after an approval decision or a status change. */
  refreshOverview: () => void
  /** Client-side preference (localStorage `op.workspace`), not an account setting; filters no data. */
  workspace: Workspace
  setWorkspace: (workspace: Workspace) => void
  /** Client-side preference (localStorage `op.advanced`): show the advanced menu items and sections. */
  advanced: boolean
  setAdvanced: (on: boolean) => void
}

export const ShellContext = createContext<ShellState>({
  capabilities: undefined,
  awaitingApproval: undefined,
  refreshOverview: () => {},
  workspace: 'candidate',
  setWorkspace: () => {},
  advanced: false,
  setAdvanced: () => {},
})

export const useShell = () => useContext(ShellContext)
