import type { Workspace } from '../shell/shellModel'

/** GET /api/v1/me. A user who has not chosen yet (and every guest) has role "Both": both views, as before roles existed. */
export type Role = 'Candidate' | 'Sales' | 'Both'
export interface Me { accountId: string; role: Role; roleChosen: boolean; isAdmin: boolean; guest: boolean; newAccount: boolean }
export interface AccessUser { accountId: string; email: string | null; role: Role; roleChosen: boolean; roleSetByAdmin: boolean; firstSeenAt: string; lastSeenAt: string }

export const ROLE_LABEL: Record<Role, string> = { Candidate: 'Candidate', Sales: 'Sales', Both: 'Both' }

/** The views this user may open. Unknown (still loading or the API is down) keeps both, so nothing is hidden by mistake. */
export function allowedWorkspaces(me: Me | undefined): Workspace[] {
  if (!me || me.isAdmin || me.role === 'Both') return ['candidate', 'sales']
  return [me.role === 'Candidate' ? 'candidate' : 'sales']
}

/** The workspace to show: the saved one when it is allowed, otherwise the first allowed one. */
export function effectiveWorkspace(saved: Workspace, allowed: readonly Workspace[]): Workspace {
  return allowed.includes(saved) ? saved : allowed[0]
}

/** The role a new account gets from its sign-up choice. */
export function roleFor(workspace: Workspace): Role {
  return workspace === 'candidate' ? 'Candidate' : 'Sales'
}

/** Sign-up saves the role only for a brand-new account that has not chosen, so an existing user on a new browser keeps both views. */
export function shouldSaveRole(me: Me | undefined): boolean {
  return Boolean(me && !me.guest && !me.roleChosen && me.newAccount)
}
