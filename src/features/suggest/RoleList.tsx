import { ROLES } from './catalog'

/** Native suggestions for any role input: add `list={ROLE_LIST_ID}` to the input and render this once on the page. */
export const ROLE_LIST_ID = 'role-suggestions'

export function RoleList() {
  return <datalist id={ROLE_LIST_ID}>{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
}
